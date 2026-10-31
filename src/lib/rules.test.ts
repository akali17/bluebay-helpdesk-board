import { describe, expect, it } from "vitest";
import type { HelpdeskRequest, Staff } from "../types";
import { addDays, formatInZone } from "./dates";
import { apiRange, countsInRange, isFutureDated, isOverdue, staffName } from "./rules";

const base: HelpdeskRequest = {
  id: 1, ref: "WO-1", title: "t", location: "l", site_id: 12, status: "pending", priority: null,
  created_at: "2026-10-06T15:30:00Z", updated_at: "2026-10-06T15:30:00Z",
  due_on: "2026-10-10", assignee: { id: 304, name: "Old Name" }, deleted_at: null, merged_into_id: null,
};
const SYD = "Australia/Sydney";
const SGP = "Asia/Singapore";

describe("rule 1: countsInRange", () => {
  it("uses the site's local date, not UTC", () => {
    // 15:30Z on 6 Oct is already 7 Oct in Sydney
    expect(countsInRange(base, SYD, "2026-10-07", "2026-10-07")).toBe(true);
    expect(countsInRange(base, SGP, "2026-10-07", "2026-10-07")).toBe(false);
  });
  it("is inclusive at both ends", () => {
    expect(countsInRange(base, SGP, "2026-10-06", "2026-10-06")).toBe(true);
  });
  it("skips canceled, deleted and merged", () => {
    const r = ["2026-10-01", "2026-10-31"] as const;
    expect(countsInRange({ ...base, status: "canceled" }, SGP, ...r)).toBe(false);
    expect(countsInRange({ ...base, deleted_at: "2026-10-08T00:00:00Z" }, SGP, ...r)).toBe(false);
    expect(countsInRange({ ...base, merged_into_id: 99 }, SGP, ...r)).toBe(false);
  });
});

describe("apiRange", () => {
  it("widens by one day each side", () => {
    expect(apiRange("2026-10-01", "2026-10-31")).toEqual({ from: "2026-09-30", to: "2026-11-01" });
  });
});

describe("rule 2: isOverdue", () => {
  const now = new Date("2026-10-10T14:00:00Z"); // 11 Oct in Sydney, 10 Oct in Singapore
  it("compares due_on with today in the site's timezone", () => {
    expect(isOverdue(base, SYD, now)).toBe(true);
    expect(isOverdue(base, SGP, now)).toBe(false);
  });
  it("is never overdue when closed or without a due date", () => {
    expect(isOverdue({ ...base, status: "complete" }, SYD, now)).toBe(false);
    expect(isOverdue({ ...base, due_on: null }, SYD, now)).toBe(false);
  });
});

describe("isFutureDated", () => {
  it("flags created_at after now", () => {
    expect(isFutureDated(base, new Date("2026-10-01T00:00:00Z"))).toBe(true);
    expect(isFutureDated(base, new Date("2026-10-31T00:00:00Z"))).toBe(false);
  });
});

describe("rule 3: staffName", () => {
  const staff = new Map<number, Staff>([[304, { id: 304, name: "New Name" }]]);
  it("uses the current name from /v1/staff", () => {
    expect(staffName(304, staff)).toBe("New Name");
  });
  it("handles missing and unknown ids", () => {
    expect(staffName(null, staff)).toBe("—");
    expect(staffName(999, staff)).toBe("Unknown staff #999");
  });
});

describe("rule 4: formatInZone", () => {
  it("shows local time and names the zone, including DST", () => {
    const t = new Date("2026-10-06T23:00:00Z");
    expect(formatInZone(t, SYD)).toBe("07/10/2026 10:00 GMT+11 (Australia/Sydney)");
    expect(formatInZone(t, SGP)).toBe("07/10/2026 07:00 GMT+8 (Asia/Singapore)");
  });
  it("addDays crosses month ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
});