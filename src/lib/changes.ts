// Applies /v1/changes items to the board's copy. Idempotent: `request` is the request as it is now,
// so an item that arrives twice gives the same result.
import type { ChangeItem } from "../types";
import type { BoardData } from "../useBoard";
import { countsInRange } from "./rules";

export function applyChanges(data: BoardData, items: ChangeItem[], from: string, to: string): BoardData {
  const byId = new Map(data.requests.map((r) => [r.id, r]));
  const staff = new Map(data.staff);
  const versions = new Map(data.versions);
  const bump = (id: number) => versions.set(id, (versions.get(id) ?? 0) + 1);

  for (const item of items) {
    if (item.type === "staff.updated") {
      staff.set(item.staff.id, item.staff);
    } else if (item.type === "event.created") {
      bump(item.request_id);
    } else {
      const r = item.request;
      const site = data.sites.get(r.site_id);
      if (site && countsInRange(r, site.timezone, from, to)) byId.set(r.id, r);
      else byId.delete(r.id); // now canceled, deleted, merged or outside the range
      bump(r.id);
    }
  }
  return { ...data, requests: [...byId.values()], staff, versions };
}