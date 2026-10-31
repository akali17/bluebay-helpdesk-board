import { useEffect, useMemo, useRef, useState } from "react";
import { configured, describeError } from "./api";
import { addDays, formatInZone, localDate } from "./lib/dates";
import { applyQuery, FILTER_STATUSES, parseQuery, toSearch, type BoardQuery } from "./lib/boardQuery";
import { isFutureDated, isOverdue, staffName } from "./lib/rules";
import { useBoard } from "./useBoard";
import type { Status } from "./types";
import { csvFilename, downloadCsv, toCsv } from "./lib/csv";
import { RequestDetail } from "./RequestDetail";
const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const isoToDisplay = (iso: string) => iso.split("-").reverse().join("/");
const today = localDate(new Date(), browserZone);
const DEFAULTS = { from: addDays(today, -29), to: today }; // last 30 days, inclusive

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

export default function App() {
  if (!configured()) {
    return <p>Save <code>HELPDESK_URL</code> and <code>HELPDESK_TOKEN</code> in <code>.env</code>, then restart <code>npm run dev</code>.</p>;
  }
  return <Board />;
}

const readOpen = () => Number(new URLSearchParams(window.location.search).get("request")) || null;
const buildSearch = (q: BoardQuery, id: number | null) => toSearch(q) + (id ? `&request=${id}` : "");

function Board() {
  const [query, setQuery] = useState<BoardQuery>(() => parseQuery(window.location.search, DEFAULTS));
  const update = (patch: Partial<BoardQuery>) => setQuery((q) => ({ ...q, ...patch }));

  const [openId, setOpenId] = useState<number | null>(readOpen);

  useEffect(() => {
    const search = buildSearch(query, openId);
    if (search !== window.location.search) window.history.replaceState(null, "", search);
  }, [query, openId]);

  // Browser back/forward restores the board or the open request.
  useEffect(() => {
    const onPop = () => { setQuery(parseQuery(window.location.search, DEFAULTS)); setOpenId(readOpen()); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const open = (id: number) => { window.history.pushState(null, "", buildSearch(query, id)); setOpenId(id); };
  const returnFocus = useRef<number | null>(null);
  const close = () => {
    returnFocus.current = openId;
    window.history.pushState(null, "", buildSearch(query, null));
    setOpenId(null);
  };
  useEffect(() => {
    if (openId == null && returnFocus.current != null) {
      document.getElementById(`ref-${returnFocus.current}`)?.focus();
      returnFocus.current = null;
    }
  });

  const { data, error, loading, lastUpdated, liveError, retry } = useBoard(query.from, query.to);
  const rows = useMemo(() => (data ? applyQuery(data.requests, query) : []), [data, query]);
  const now = new Date();
    const liveStatus = (
    <p className="muted">
      {lastUpdated
        ? `Last updated ${lastUpdated.toLocaleTimeString([], { timeZoneName: "short" })}`
        : data ? "Connecting to live updates…" : ""}
      {liveError != null && " · Live updates are failing, retrying in 20 s"}
    </p>
  );
    if (openId != null) {
    return (
      <main>
        {liveStatus}
        {data ? <RequestDetail id={openId} version={data.versions.get(openId) ?? 0} board={data} onClose={close} /> : <p>Loading…</p>}
      </main>
    );
  }
  return (
    <main>
      <h1>Requests board</h1>
      {liveStatus}
      <form className="filters" onSubmit={(e) => e.preventDefault()}>
        <label>From <input type="date" value={query.from} max={query.to} onChange={(e) => e.target.value && update({ from: e.target.value })} /></label>
        <label>To <input type="date" value={query.to} min={query.from} onChange={(e) => e.target.value && update({ to: e.target.value })} /></label>

        <fieldset>
          <legend>Site</legend>
          {data && [...data.sites.values()].map((s) => (
            <label key={s.id}>
              <input type="checkbox" checked={query.sites.includes(s.id)} onChange={() => update({ sites: toggle(query.sites, s.id) })} /> {s.name}
            </label>
          ))}
        </fieldset>

        <fieldset>

          <legend>Status</legend>
          {FILTER_STATUSES.map((s: Status) => (
            <label key={s}>
              <input type="checkbox" checked={query.statuses.includes(s)} onChange={() => update({ statuses: toggle(query.statuses, s) })} /> {data?.statuses.get(s) ?? s}
            </label>
          ))}
        </fieldset>

        <label>Sort by
          <select value={query.sort} onChange={(e) => update({ sort: e.target.value as BoardQuery["sort"] })}>
            <option value="created">Created date</option>
            <option value="due">Due date</option>
          </select>
        </label>
        <label>Order
          <select value={query.dir} onChange={(e) => update({ dir: e.target.value as BoardQuery["dir"] })}>
            <option value="desc">Latest first</option>
            <option value="asc">Earliest first</option>
          </select>
        </label>
      </form>

      <p className="muted" aria-live="polite">
        {isoToDisplay(query.from)} to {isoToDisplay(query.to)}. {data ? `${rows.length} of ${data.requests.length} requests shown.` : ""}{" "}
        <button
          type="button"
          disabled={!data || loading}
          onClick={() => data && downloadCsv(toCsv(rows, data), csvFilename(query.from, query.to))}
        >
          Download CSV ({rows.length} rows)
        </button>
      </p>
      {error != null && (
        <div role="alert" className="error">
          <p>Could not load requests. {describeError(error)}</p>
          <button type="button" onClick={retry}>Try again</button>
        </div>
      )}
      {loading && <p role="status">Loading requests for this range… large ranges can take a few seconds.</p>}
      {data && rows.length === 0 && (
        <p role="status">No requests match this date range and these filters. Try a wider range or untick some filters.</p>
      )}
      {data && rows.length > 0 && (
                <table role="table">
          <caption className="sr-only">
            Requests from {isoToDisplay(query.from)} to {isoToDisplay(query.to)}, sorted by {query.sort === "due" ? "due date" : "created date"}, {query.dir === "desc" ? "latest" : "earliest"} first. Select a reference to see its history.
          </caption>
          <thead role="rowgroup">
            <tr role="row">
              {["Site", "Ref", "Title", "Priority", "Status", "Assignee", "Created", "Due"].map((h) => (
                <th key={h} scope="col" role="columnheader">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody role="rowgroup">
            {rows.map((r) => {
              const site = data.sites.get(r.site_id)!;
              return (
                <tr key={r.id} role="row" className="clickable" onClick={() => open(r.id)}>
                  <td role="cell" data-label="Site">{site.name}</td>
                  <td role="cell" data-label="Ref">
                    <a id={`ref-${r.id}`} href={buildSearch(query, r.id)} onClick={(e) => { e.preventDefault(); e.stopPropagation(); open(r.id); }}>{r.ref}</a>
                  </td>
                  <td role="cell" data-label="Title"><span>{r.title}{isFutureDated(r, now) && <span className="badge"> future-dated</span>}</span></td>
                  <td role="cell" data-label="Priority">{r.priority ?? "—"}</td>
                  <td role="cell" data-label="Status">{data.statuses.get(r.status) ?? r.status}</td>
                  <td role="cell" data-label="Assignee">{r.assignee ? staffName(r.assignee.id, data.staff) : "Unassigned"}</td>
                  <td role="cell" data-label="Created">{formatInZone(new Date(r.created_at), site.timezone)}</td>
                  <td role="cell" data-label="Due">
                    <span>
                      {r.due_on ? isoToDisplay(r.due_on) : "—"}
                      {isOverdue(r, site.timezone, now) && <span className="badge overdue"> Overdue</span>}
                    </span>
                  </td>
                </tr>
              );
            })}

          </tbody>
        </table>
      )}
    </main>
  );
}