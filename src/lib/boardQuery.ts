// Board state <-> URL query string, and applying it to the rows. Pure, so it's tested.
import type { HelpdeskRequest, Status } from "../types";

export type SortKey = "created" | "due";
export type SortDir = "asc" | "desc";
export interface BoardQuery {
  from: string; // YYYY-MM-DD
  to: string;
  sites: number[]; // empty = all
  statuses: Status[]; // empty = all
  sort: SortKey;
  dir: SortDir;
}

export const FILTER_STATUSES: Status[] = ["pending", "processing", "complete"]; // canceled never counts (rule 1)
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function parseQuery(search: string, defaults: { from: string; to: string }): BoardQuery {
  const p = new URLSearchParams(search);
  let from = ISO.test(p.get("from") ?? "") ? p.get("from")! : defaults.from;
  let to = ISO.test(p.get("to") ?? "") ? p.get("to")! : defaults.to;
  if (from > to) [from, to] = [to, from];
  const list = (key: string) => (p.get(key) ?? "").split(",").filter(Boolean);
  return {
    from,
    to,
    sites: list("site").map(Number).filter(Number.isInteger),
    statuses: list("status").filter((s): s is Status => FILTER_STATUSES.includes(s as Status)),
    sort: p.get("sort") === "due" ? "due" : "created",
    dir: p.get("dir") === "asc" ? "asc" : "desc",
  };
}


export function toSearch(q: BoardQuery): string {
  const p = new URLSearchParams({ from: q.from, to: q.to });
  if (q.sites.length) p.set("site", q.sites.join(","));
  if (q.statuses.length) p.set("status", q.statuses.join(","));
  p.set("sort", q.sort);
  p.set("dir", q.dir);
  return `?${p.toString()}`;
}

export function applyQuery(rows: HelpdeskRequest[], q: BoardQuery): HelpdeskRequest[] {
  const filtered = rows.filter(
    (r) => (!q.sites.length || q.sites.includes(r.site_id)) && (!q.statuses.length || q.statuses.includes(r.status)),
  );
  const sign = q.dir === "asc" ? 1 : -1;
  return filtered.sort((a, b) => {
    if (q.sort === "due") {
      if (a.due_on !== b.due_on) {
        if (!a.due_on) return 1; // no due date: always last
        if (!b.due_on) return -1;
        return sign * a.due_on.localeCompare(b.due_on);
      }
    } else {
      const d = Date.parse(a.created_at) - Date.parse(b.created_at);
      if (d) return sign * d;
    }
    return a.id - b.id;
  });
}