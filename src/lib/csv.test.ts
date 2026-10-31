import { describe, expect, it } from "vitest";
import type { HelpdeskRequest } from "../types";
import type { BoardData } from "../useBoard";
import { csvField, csvFilename, toCsv } from "./csv";

const board: BoardData = {
  requests: [],
  sites: new Map([[11, { id: 11, name: "Bluebay Tower Singapore", timezone: "Asia/Singapore", business_hours: {} }]]),
  staff: new Map([[5, { id: 5, name: "Chloe Lim" }]]),
  statuses: new Map([["pending", "Pending"]]),
  versions: new Map(),
};
const req: HelpdeskRequest = {
  id: 1, ref: "WO-1", title: 'Lift "stuck", level 4', location: "l", site_id: 11, status: "pending", priority: null,
  created_at: "2026-10-06T23:00:00Z", updated_at: "2026-10-06T23:00:00Z", due_on: "2026-10-08",
  assignee: { id: 5, name: "Stale" }, deleted_at: null, merged_into_id: null,
};

describe("csvField", () => {
  it("leaves plain values alone and empties null", () => {
    expect(csvField("WO-1")).toBe("WO-1");
    expect(csvField(null)).toBe("");
  });
  it("quotes commas, quotes and line breaks", () => {
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("a\nb")).toBe('"a\nb"');
  });
});

describe("toCsv", () => {
  it("starts with the exact header and writes one line per row", () => {

    const now = new Date("2026-10-10T00:00:00Z");
    const lines = toCsv([req, { ...req, id: 2, ref: "WO-2", title: "Plain", assignee: null, due_on: null }], board, now).split("\r\n");
    expect(lines[0]).toBe("ref,site,title,priority,status,assignee,created_at,due_on,overdue");
    expect(lines[1]).toBe('WO-1,Bluebay Tower Singapore,"Lift ""stuck"", level 4",,Pending,Chloe Lim,07/10/2026 07:00 GMT+8 (Asia/Singapore),2026-10-08,true');
    expect(lines[2]).toBe("WO-2,Bluebay Tower Singapore,Plain,,Pending,,07/10/2026 07:00 GMT+8 (Asia/Singapore),,false");
    expect(lines).toHaveLength(4); // header, 2 rows, trailing empty after final CRLF
  });
});

describe("csvFilename", () => {
  it("uses YYYY-MM-DD dates", () => {
    expect(csvFilename("2026-10-02", "2026-10-31")).toBe("requests-2026-10-02-2026-10-31.csv");
  });
});