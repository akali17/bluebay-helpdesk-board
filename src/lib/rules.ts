// The six rules from docs/rules.md. Pure functions: no fetching, easy to test.
import type { HelpdeskRequest, Staff } from "../types";
import { addDays, localDate } from "./dates";

/** Rule 1: does this request count for the from..to range (site-local dates, inclusive)? */
export function countsInRange(req: HelpdeskRequest, timeZone: string, from: string, to: string): boolean {
  if (req.status === "canceled" || req.deleted_at || req.merged_into_id) return false;
  const created = localDate(new Date(req.created_at), timeZone);
  return created >= from && created <= to; // YYYY-MM-DD compares correctly as strings
}

/** The API's date filter has no stated timezone, so ask for one extra day on each side. */
export function apiRange(from: string, to: string): { from: string; to: string } {
  return { from: addDays(from, -1), to: addDays(to, 1) };
}

/** Rule 2: open request whose due date is before today in the site's timezone. */
export function isOverdue(req: HelpdeskRequest, timeZone: string, now = new Date()): boolean {
  if (req.status !== "pending" && req.status !== "processing") return false;
  if (!req.due_on) return false;
  return req.due_on < localDate(now, timeZone);
}

/** Data surprise: created_at later than now. */
export function isFutureDated(req: HelpdeskRequest, now = new Date()): boolean {
  return new Date(req.created_at).getTime() > now.getTime();
}

/** Rule 3: current name by id; never the name embedded in a request or event. */
export function staffName(id: number | null | undefined, staff: Map<number, Staff>): string {
  if (id == null) return "—";
  return staff.get(id)?.name ?? `Unknown staff #${id}`;

}