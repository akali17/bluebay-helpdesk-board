import { describe, expect, it } from "vitest";
import type { ChangeItem, HelpdeskRequest } from "../types";
import type { BoardData } from "../useBoard";
import { applyChanges } from "./changes";

const req = (id: number, patch: Partial<HelpdeskRequest> = {}): HelpdeskRequest => ({
  id, ref: `WO-${id}`, title: "t", location: "l", site_id: 11, status: "pending", priority: null,
  created_at: "2026-10-10T02:00:00Z", updated_at: "2026-10-10T02:00:00Z", due_on: null,
  assignee: null, deleted_at: null, merged_into_id: null, ...patch,
});
const board = (): BoardData => ({
  requests: [req(1)],
  sites: new Map([[11, { id: 11, name: "SG", timezone: "Asia/Singapore", business_hours: {} }]]),
  staff: new Map([[5, { id: 5, name: "Old" }]]),
  statuses: new Map(),
  versions: new Map(),
});
const range = ["2026-10-01", "2026-10-31"] as const;

describe("applyChanges", () => {
  it("adds new requests in range and updates existing ones", () => {
    const items: ChangeItem[] = [
      { seq: 1, type: "request.created", at: "", request: req(2) },
      { seq: 2, type: "request.updated", at: "", request: req(1, { status: "processing" }) },
    ];
    const out = applyChanges(board(), items, ...range);
    expect(out.requests.map((r) => [r.id, r.status])).toEqual([[1, "processing"], [2, "pending"]]);
  });
  it("drops requests that stop counting (rule 1) or are outside the range", () => {
    const items: ChangeItem[] = [
      { seq: 1, type: "request.updated", at: "", request: req(1, { status: "canceled" }) },
      { seq: 2, type: "request.created", at: "", request: req(3, { created_at: "2026-11-05T00:00:00Z" }) },
    ];
    expect(applyChanges(board(), items, ...range).requests).toEqual([]);
  });
  it("is safe when an item arrives twice", () => {
    const item: ChangeItem = { seq: 1, type: "request.created", at: "", request: req(2) };
    const once = applyChanges(board(), [item], ...range);
    expect(applyChanges(once, [item], ...range).requests).toEqual(once.requests);
  });
  it("updates staff names and bumps versions for events", () => {
    const items: ChangeItem[] = [
      { seq: 1, type: "staff.updated", at: "", staff: { id: 5, name: "New" } },
      { seq: 2, type: "event.created", at: "", request_id: 1, event: {} as never },
    ];
    const out = applyChanges(board(), items, ...range);
    expect(out.staff.get(5)?.name).toBe("New");
    expect(out.versions.get(1)).toBe(1);
  });
});