import { ApiError, configured } from "./api";
import { isFutureDated, isOverdue, staffName } from "./lib/rules";
import { useBoard } from "./useBoard";
import { addDays, formatInZone, localDate } from "./lib/dates";
const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const isoToDisplay = (iso: string) => iso.split("-").reverse().join("/"); // 2026-10-07 -> 07/10/2026

export default function App() {
  if (!configured()) {
    return <p>Save <code>HELPDESK_URL</code> and <code>HELPDESK_TOKEN</code> in <code>.env</code>, then restart <code>npm run dev</code>.</p>;
  }
  return <Board />;
}

function Board() {
  const to = localDate(new Date(), browserZone);
  const from = addDays(to, -29); // last 30 days, inclusive
  const { data, error, loading } = useBoard(from, to);
  const now = new Date();

  return (
    <main>
      <h1>Requests board</h1>
      <p className="muted">
        {isoToDisplay(from)} to {isoToDisplay(to)}. {loading ? "Loading…" : data ? `${data.requests.length} requests.` : ""}
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
            {data.requests.map((r) => {
              const site = data.sites.get(r.site_id)!;
              const overdue = isOverdue(r, site.timezone, now);
              return (
                <tr key={r.id}>
                  <td>{site.name}</td>
                  <td>{r.ref}</td>
                  <td>{r.title}{isFutureDated(r, now) && <span className="badge"> future-dated</span>}</td>
                  <td>{r.priority ?? "—"}</td>
                  <td>{data.statuses.get(r.status) ?? r.status}</td>
                  <td>{r.assignee ? staffName(r.assignee.id, data.staff) : "Unassigned"}</td>
                  <td>{formatInZone(new Date(r.created_at), site.timezone)}</td>
                  <td>
                    {r.due_on ? isoToDisplay(r.due_on) : "—"}
                    {overdue && <span className="badge overdue"> Overdue</span>}
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