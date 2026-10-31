// CSV export for the finance team (client message, 31 Oct). Standard CSV (RFC 4180).
import type { HelpdeskRequest } from "../types";
import type { BoardData } from "../useBoard";
import { formatInZone } from "./dates";
import { isOverdue, staffName } from "./rules";

export const CSV_HEADER = ["ref", "site", "title", "priority", "status", "assignee", "created_at", "due_on", "overdue"];

/** null -> empty field; quote when the value has a comma, a quote or a line break. */
export function csvField(value: string | null | undefined): string {
  if (value == null) return "";
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Rows in the order given (the board's current sort), values as shown on the board. */
export function toCsv(rows: HelpdeskRequest[], board: BoardData, now = new Date()): string {
  const lines = [CSV_HEADER.join(",")];
  for (const r of rows) {
    const site = board.sites.get(r.site_id);
    const tz = site?.timezone ?? "UTC";
    lines.push(
      [
        r.ref,
        site?.name ?? null,
        r.title,
        r.priority,
        board.statuses.get(r.status) ?? r.status,
        r.assignee ? staffName(r.assignee.id, board.staff) : null,
        formatInZone(new Date(r.created_at), tz),
        r.due_on,
        String(isOverdue(r, tz, now)),
      ].map(csvField).join(","),

    );
  }
  return lines.join("\r\n") + "\r\n";
}

export const csvFilename = (from: string, to: string) => `requests-${from}-${to}.csv`;

export function downloadCsv(content: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}