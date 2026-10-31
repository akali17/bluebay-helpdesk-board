// Event rules from docs/rules.md (5 and 6). Pure functions, tested.
import type { RequestEvent } from "../types";

/** Rule 5: events that undo another event, and the events they undo. */
export function undoneIds(events: RequestEvent[]): Set<number> {
  const ids = new Set<number>();
  for (const e of events) {
    if (e.reverts_id != null) {
      ids.add(e.id);
      ids.add(e.reverts_id);
    }
  }
  return ids;
}

/** Oldest first; undone pairs hidden unless asked for. Duplicates (from paging while data changes) dropped. */
export function timeline(events: RequestEvent[], showUndone = false): RequestEvent[] {
  const unique = [...new Map(events.map((e) => [e.id, e])).values()];
  const hidden = undoneIds(unique);
  return unique
    .filter((e) => showUndone || !hidden.has(e.id))
    .sort((a, b) => a.at - b.at || a.id - b.id);
}

/** Rule 6: earliest event with status processing and a person (not System) as actor. Undone events don't count. */
export function firstResponse(events: RequestEvent[]): RequestEvent | null {
  const hidden = undoneIds(events);
  let best: RequestEvent | null = null;
  for (const e of events) {
    if (e.status !== "processing" || e.actor_id == null || hidden.has(e.id)) continue;
    if (!best || e.at < best.at || (e.at === best.at && e.id < best.id)) best = e;
  }

  return best;
}