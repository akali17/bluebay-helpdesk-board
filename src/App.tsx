import { useEffect, useMemo, useState } from "react";
import { ApiError, configured } from "./api";
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
  const close = () => { window.history.pushState(null, "", buildSearch(query, null)); setOpenId(null); };

  const { data, error, loading, lastUpdated, liveError } = useBoard(query.from, query.to);
  const rows = useMemo(() => (data ? applyQuery(data.requests, query) : []), [data, query]);
  const now = new Date();
    const liveStatus = (
    <p className="muted" role="status">
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
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </label>
      </form>

        <p className="muted">
        {isoToDisplay(query.from)} to {isoToDisplay(query.to)}. {loading ? "Loading…" : data ? `${rows.length} of ${data.requests.length} requests shown.` : ""}{" "}
        <button
          type="button"
          disabled={!data || loading}
          onClick={() => data && downloadCsv(toCsv(rows, data), csvFilename(query.from, query.to))}
        >
          Download CSV ({rows.length} rows)
        </button>
      </p>
      {error != null && (
        <p role="alert">Could not load requests: {error instanceof ApiError ? `${error.status}: ${error.message}` : String(error)}</p>
      )}
      {data && (
        <table>
          <thead>
            <tr>

              <th>Site</th><th>Ref</th><th>Title</th><th>Priority</th><th>Status</th>
              <th>Assignee</th><th>Created</th><th>Due</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const site = data.sites.get(r.site_id)!;
              return (
                 <tr key={r.id} className="clickable" onClick={() => open(r.id)}>
                  <td>{site.name}</td>
                  <td><a href={buildSearch(query, r.id)} onClick={(e) => { e.preventDefault(); e.stopPropagation(); open(r.id); }}>{r.ref}</a></td>
                  <td>{r.title}{isFutureDated(r, now) && <span className="badge"> future-dated</span>}</td>
                  <td>{r.priority ?? "—"}</td>
                  <td>{data.statuses.get(r.status) ?? r.status}</td>
                  <td>{r.assignee ? staffName(r.assignee.id, data.staff) : "Unassigned"}</td>
                  <td>{formatInZone(new Date(r.created_at), site.timezone)}</td>
                  <td>
                    {r.due_on ? isoToDisplay(r.due_on) : "—"}
                    {isOverdue(r, site.timezone, now) && <span className="badge overdue"> Overdue</span>}
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