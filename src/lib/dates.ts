// Date helpers. The API wants DD/MM/YYYY; the rules talk about each site's local date.

/** "2026-10-06" -> "06/10/2026" (the format the API's created_from/created_to expect). */
export function toApiDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error(`Not a YYYY-MM-DD date: ${isoDate}`);
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/** The YYYY-MM-DD date of an instant in a given IANA timezone. */
export function localDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Today's date, as YYYY-MM-DD, minus `days` days (UTC arithmetic on the calendar date). */
export function daysAgo(days: number, today = new Date()): string {
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - days));
  return date.toISOString().slice(0, 10);
}
/** "2026-10-06" + 1 -> "2026-10-07" (pure calendar arithmetic). */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "07/10/2026 10:00 GMT+11 (Australia/Sydney)": an instant shown in a site's timezone, zone named. */
export function formatInZone(instant: Date, timeZone: string): string {
  const text = new Intl.DateTimeFormat("en-GB", {
    timeZone, day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "shortOffset",
  }).format(instant).replace(",", "");
  return `${text} (${timeZone})`;
}