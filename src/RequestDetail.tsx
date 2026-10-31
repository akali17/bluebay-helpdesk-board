import { useEffect, useRef, useState } from "react";
import { describeError, getAllPages, getRequest, listEvents } from "./api";
import { formatInZone } from "./lib/dates";
import { firstResponse, timeline, undoneIds } from "./lib/events";
import { isOverdue, staffName } from "./lib/rules";
import type { HelpdeskRequest, RequestEvent } from "./types";
import type { BoardData } from "./useBoard";

const isoToDisplay = (iso: string) => iso.split("-").reverse().join("/");

export function RequestDetail({ id, version, board, onClose }: { id: number; version: number; board: BoardData; onClose: () => void }) {
  const [req, setReq] = useState<HelpdeskRequest | null>(null);
  const [events, setEvents] = useState<RequestEvent[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [showUndone, setShowUndone] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);

 useEffect(() => { setReq(null); setEvents([]); setError(null); }, [id]);

  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([getRequest(id, ctrl.signal), getAllPages((p) => listEvents(id, p, ctrl.signal))])
      .then(([r, ev]) => { setReq(r); setEvents(ev); setError(null); })
      .catch((e: unknown) => { if (!ctrl.signal.aborted) setError(e); });
    return () => ctrl.abort();
  }, [id, version, attempt]);

   const focusedFor = useRef<number | null>(null);
  useEffect(() => {
    if (req && focusedFor.current !== id) { heading.current?.focus(); focusedFor.current = id; }
  }, [req, id]);

  const back = <button type="button" onClick={onClose}>← Back to board</button>;

    const retryButton = <button type="button" onClick={() => setAttempt((a) => a + 1)}>Try again</button>;
  if (error != null && !req) {
    return <>{back}<div role="alert" className="error"><p>Could not load this request. {describeError(error)}</p>{retryButton}</div></>;
  }
  if (!req) return <>{back}<p role="status">Loading request and its history…</p></>;
  

  const site = board.sites.get(req.site_id);
  const tz = site?.timezone ?? "UTC";
  const person = (actorId: number | null) => (actorId == null ? "System" : staffName(actorId, board.staff));
  const first = firstResponse(events);
  const undoneCount = undoneIds(events).size;
  const shown = timeline(events, showUndone);
  const undone = undoneIds(events);

  return (
    <>
      {back}
      <h2 ref={heading} tabIndex={-1}>{req.ref}: {req.title}</h2>
            {error != null && <div role="alert" className="error"><p>Showing the last loaded version. {describeError(error)}</p>{retryButton}</div>}
      <dl className="details">
        <dt>Site</dt><dd>{site?.name ?? `Site #${req.site_id}`}</dd>
        <dt>Location</dt><dd>{req.location}</dd>
        <dt>Status</dt><dd>{board.statuses.get(req.status) ?? req.status}</dd>
        <dt>Priority</dt><dd>{req.priority ?? "—"}</dd>
        <dt>Assignee</dt><dd>{req.assignee ? staffName(req.assignee.id, board.staff) : "Unassigned"}</dd>
        <dt>Created</dt><dd>{formatInZone(new Date(req.created_at), tz)}</dd>
        <dt>Updated</dt><dd>{formatInZone(new Date(req.updated_at), tz)}</dd>
        <dt>Due</dt>
        <dd>{req.due_on ? isoToDisplay(req.due_on) : "—"}{isOverdue(req, tz) && <span className="badge overdue"> Overdue</span>}</dd>
        <dt>First response</dt>
        <dd>{first ? `${person(first.actor_id)}, ${formatInZone(new Date(first.at * 1000), tz)}` : "No response yet"}</dd>
        {req.deleted_at && (<><dt>Deleted</dt><dd>{formatInZone(new Date(req.deleted_at), tz)}</dd></>)}
        {req.merged_into_id && (<><dt>Merged into</dt><dd>Request #{req.merged_into_id}</dd></>)}
      </dl>


      <h3>History ({shown.length} events)</h3>
      {undoneCount > 0 && (
        <label>
          <input type="checkbox" checked={showUndone} onChange={(e) => setShowUndone(e.target.checked)} /> Show {undoneCount} undone events
        </label>
      )}
      {shown.length === 0 ? <p>No events.</p> : (
        <ol className="timeline">
          {shown.map((e) => (
            <li key={e.id}>
              <strong>{formatInZone(new Date(e.at * 1000), tz)}</strong> · {person(e.actor_id)} · {board.statuses.get(e.status) ?? e.status}
              {undone.has(e.id) && <span className="badge"> {e.reverts_id ? "undoes an earlier event" : "undone"}</span>}
              {e.assignee_name && <div>Assigned to {e.assignee_name} <span className="muted">(name at the time)</span></div>}
              {e.due_at && <div>Deadline set to {e.due_at} ({tz})</div>}
              {e.note && <div>Note: {e.note}</div>}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}