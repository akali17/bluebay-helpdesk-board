# DECISIONS

Write in English. Short bullet points are fine. Reviewers read this file alongside your code.

## What I assumed

- "Today" is the real clock (matches the server `Date` header), converted to each site's timezone. It drives the default 30-day range and the overdue flag.
- The API's `created_from`/`created_to` timezone is unknown, so I query one extra day on each side and apply rule 1 on the client using each site's local date.
- Staff names always come from `/v1/staff` by id (rule 3). If an id is missing from `/v1/staff`, I show "Unknown staff #<id>" instead of falling back to the possibly stale embedded name.
- "Name the zone" (rule 4) is shown as the UTC offset plus the IANA name, e.g. `07/10/2026 10:00 GMT+11 (Australia/Sydney)`, because abbreviations like "SGT" are not available in every browser and offsets make DST visible.
## What I found in the API or data

- Some requests have `created_at` in the future (newest ~46h ahead, e.g. `2026-11-02T03:55:11Z`) while the server `Date` header said 31 Oct 2026 05:53 GMT. 88 requests had `created_from=01/11/2026` or later at the time of checking. They fall outside the default range (rule 1 is inclusive from..to), appear if the user picks a later end date, and are flagged "future-dated" on the board.
- ~12,000 requests in total, so the board always queries by `created_from`/`created_to` and pages through results with `per_page=100`.
- `priority` can be `null` in real data; shown as "—".
- `location` formatting is inconsistent (`"Podium/ Cafe"` vs `"North Wing / L3 / Pantry"`); displayed as-is.
- Three sites: Singapore (`Asia/Singapore`), Sydney (`Australia/Sydney`, observes DST), Jakarta (`Asia/Jakarta`, open Saturday mornings). All conversions use `Intl` with the IANA name, never fixed offsets.

## How I used AI

<!-- Which tools, what you asked, what came back wrong, what you changed. "I didn't use AI" is fine too. -->

## Trade-offs and what I would do next

- `HELPDESK_TOKEN` is bundled into the browser build (Vite `envPrefix`). Acceptable for the practice API; a real app would call through a small proxy.
- Did not run `npm audit fix --force`: the reported vulnerabilities are in dev tooling and forcing fixes would bump major versions of the starter.
- Rules live in `src/lib/rules.ts` as pure functions with unit tests, so they can be checked without the API or the UI.