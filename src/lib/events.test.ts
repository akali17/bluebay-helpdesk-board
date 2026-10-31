import { describe, expect, it } from "vitest";
import type { RequestEvent } from "../types";
import { firstResponse, timeline, undoneIds } from "./events";

const ev = (id: number, at: number, status: RequestEvent["status"], actor_id: number | null, reverts_id: number | null = null): RequestEvent => ({
  id, at, status, actor_id, actor_name: "stale", assignee_name: null, due_at: null, note: null, reverts_id,
});

describe("rule 5: undone events", () => {
  const events = [ev(4, 400, "pending", 1, 2), ev(3, 300, "processing", 1), ev(2, 200, "complete", 1), ev(1, 100, "pending", null)];
  it("finds both the undoing and the undone event", () => {
    expect([...undoneIds(events)].sort()).toEqual([2, 4]);
  });
  it("hides them by default, oldest first", () => {
    expect(timeline(events).map((e) => e.id)).toEqual([1, 3]);
  });
  it("shows them when asked", () => {
    expect(timeline(events, true).map((e) => e.id)).toEqual([1, 2, 3, 4]);
  });
  it("drops duplicate events", () => {
    expect(timeline([...events, ev(3, 300, "processing", 1)]).map((e) => e.id)).toEqual([1, 3]);
  });
});

describe("rule 6: first response", () => {
  it("is the earliest processing event by a person", () => {
    const events = [ev(3, 300, "processing", 7), ev(2, 200, "processing", null), ev(1, 100, "pending", 5)];
    expect(firstResponse(events)?.id).toBe(3); // id 2 is System
  });
  it("ignores an undone processing event", () => {
    const events = [ev(3, 300, "pending", 7, 1), ev(2, 250, "processing", 8), ev(1, 100, "processing", 7)];
    expect(firstResponse(events)?.id).toBe(2);
  });
  it("is null when nobody has responded", () => {
    expect(firstResponse([ev(1, 100, "pending", null)])).toBeNull();
  });
});