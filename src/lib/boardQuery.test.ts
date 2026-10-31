import { describe, expect, it } from "vitest";
import type { HelpdeskRequest } from "../types";
import { applyQuery, parseQuery, toSearch, type BoardQuery } from "./boardQuery";

const defaults = { from: "2026-10-02", to: "2026-10-31" };
const row = (id: number, site_id: number, status: HelpdeskRequest["status"], created_at: string, due_on: string | null) =>
  ({ id, site_id, status, created_at, due_on } as HelpdeskRequest);

describe("parseQuery / toSearch", () => {
  it("round-trips through the URL", () => {
    const q = parseQuery("?from=2026-10-01&to=2026-10-15&site=11,13&status=pending&sort=due&dir=asc", defaults);
    expect(q).toEqual({ from: "2026-10-01", to: "2026-10-15", sites: [11, 13], statuses: ["pending"], sort: "due", dir: "asc" });
    expect(parseQuery(toSearch(q), defaults)).toEqual(q);
  });
  it("falls back to defaults on bad input and ignores canceled", () => {
    const q = parseQuery("?from=yesterday&status=canceled,bogus&sort=x", defaults);
    expect(q).toMatchObject({ from: "2026-10-02", statuses: [], sort: "created", dir: "desc" });
  });
  it("swaps a reversed range", () => {
    expect(parseQuery("?from=2026-10-20&to=2026-10-10", defaults)).toMatchObject({ from: "2026-10-10", to: "2026-10-20" });
  });
});

describe("applyQuery", () => {
  const rows = [
    row(1, 11, "pending", "2026-10-05T00:00:00Z", "2026-10-09"),
    row(2, 12, "complete", "2026-10-07T00:00:00Z", null),
    row(3, 11, "processing", "2026-10-06T00:00:00Z", "2026-10-08"),
  ];
  const base: BoardQuery = { ...defaults, sites: [], statuses: [], sort: "created", dir: "desc" };
  it("filters by site and status", () => {
    expect(applyQuery(rows, { ...base, sites: [11], statuses: ["pending"] }).map((r) => r.id)).toEqual([1]);

  });
  it("sorts by created", () => {
    expect(applyQuery(rows, { ...base }).map((r) => r.id)).toEqual([2, 3, 1]);
  });
  it("sorts by due with missing due dates last in both directions", () => {
    expect(applyQuery(rows, { ...base, sort: "due", dir: "asc" }).map((r) => r.id)).toEqual([3, 1, 2]);
    expect(applyQuery(rows, { ...base, sort: "due", dir: "desc" }).map((r) => r.id)).toEqual([1, 3, 2]);
  });
});