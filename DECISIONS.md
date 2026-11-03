# DECISIONS

## What I assumed

- "Today" is the real clock (matches the server `Date` header), converted to each site's timezone. It drives the default 30-day range and the overdue flag.
- "Last 30 days" = today in the viewer's browser timezone and the 29 days before it, inclusive. Each request is then checked against that range in its own site's timezone (rule 1).
- The API's `created_from`/`created_to` timezone is unknown, so I query one extra day on each side and apply rule 1 on the client using each site's local date.
- Staff names always come from `/v1/staff` by id (rule 3). If an id is missing from `/v1/staff`, I show "Unknown staff #<id>" instead of falling back to the possibly stale embedded name.
- "Name the zone" (rule 4) is shown as the UTC offset plus the IANA name, e.g. `07/10/2026 10:00 GMT+11 (Australia/Sydney)`, because abbreviations like "SGT" are not available in every browser and offsets make DST visible.
- The board shows a Created column (site-local time, zone named) because sorting by created date needs it to be visible.
- Overdue and future-dated are shown as text badges, not colour alone, so they work for screen readers and colour-blind users.
- Filters with nothing ticked mean "all". Canceled is not offered as a status filter because rule 1 never counts canceled requests.
- Sorting by due date puts requests without a due date last in both directions; ties fall back to id so the order is stable.
- The URL holds `from`, `to`, `site`, `status`, `sort`, `dir`. Bad or missing values fall back to the defaults, and a reversed range is swapped.
- The open request is part of the URL (`&request=<id>`), so a link to one request can be shared, and browser Back returns to the board with its filters.
- The detail view fetches the request and all its event pages fresh, so it works even for a request outside the board's current range.
- Rule 6 ignores events hidden by rule 5: an undone "processing" event was taken back, so it isn't treated as the first response.
- The timeline reads oldest first (the API returns newest first), so the history reads as a story.
- A chain of reverts (C undoes B, B undoes A) hides all three; I didn't model "undo of an undo" restoring A because the rules don't mention it.
- Live updates poll `/v1/changes` every 20 s. Each round reads until `has_more: false` and applies what it read in one render. The feed position and any unapplied items are kept across rounds, so an interrupted or failed round resumes instead of starting over or losing changes. "Last updated" is the time the last round finished, in the viewer's timezone.
- Change items are applied idempotently (`request` is the request as it is now), so duplicates are harmless. A request that becomes canceled, deleted or merged leaves the board; an open detail view reloads when its request or events change.
- On `410` (cursor expired) the feed is read again from the start.
- CSV (client request, 31 Oct): values match what the board shows. `site` is the site name, `status` the label from `/v1/statuses`, `assignee` the current staff name (rule 3), `created_at` exactly as on the board. `due_on` stays `YYYY-MM-DD` like the field name; `overdue` uses the same rule 2 check as the badge.
- The CSV holds every row matching the current range, filters and sort, not only the rows on screen: the board already loads every page of the range.
- The CSV uses CRLF line endings (RFC 4180) and no BOM, so the first line is exactly the header. Excel may need "Data → From Text/CSV" to show non-ASCII names correctly, and it reformats `due_on` into the computer's date format on open (e.g. `10/7/2026`); the file itself holds `2026-10-07`.
- Error messages are written for a site manager and depend on the cause: rejected token, helpdesk busy or down (after retries), or no connection. The board and the detail view both offer "Try again".
- While a new range loads, the old rows are cleared so nobody reads the wrong range. If a detail refresh fails, the last loaded version stays on screen with a warning.
- Phones (≤700px): each row becomes a labelled card. The table keeps explicit ARIA roles because `display: block` can drop table semantics in some browsers.
- Keyboard: the Ref is a real link; opening a request moves focus to its heading, closing it returns focus to the same link; focus outlines are always visible.
- Screen readers: the row count is announced when filters change (`aria-live="polite"`). "Last updated" is deliberately not announced every 20 s, which would be noise.

## What I found in the API or data

- Some requests have `created_at` in the future (newest ~46h ahead, e.g. `2026-11-02T03:55:11Z`) while the server `Date` header said 31 Oct 2026 05:53 GMT. 88 requests had `created_from=01/11/2026` or later at the time of checking. Rule 1 compares site-local dates, so requests created later today (e.g. 31/10 23:52 Jakarta while it was ~13:40 there) still count and appear; those on later dates appear only if the user picks a later end date. All of them are flagged "future-dated" on the board rather than hidden, since the rules don't say to drop them. By 3 Nov real time had caught up with those timestamps, so the badge no longer appears; the check itself (`isFutureDated`) is covered by a unit test.
- Events can also be in the future (e.g. a first response at 01/11/2026 07:19 Jakarta time on 31 Oct).
- ~12,000 requests in total, so the board always queries by `created_from`/`created_to` and pages through results with `per_page=100`.
- Data changes while paging through `/v1/requests`, so the same request can appear on two pages; the board de-duplicates by `id` (events too).
- `priority` can be `null` in real data; shown as "—".
- `location` formatting is inconsistent (`"Podium/ Cafe"` vs `"North Wing / L3 / Pantry"`); displayed as-is.
- Events carry `assignee_name` but no assignee id, so rule 3's lookup isn't possible for it. I show it labelled "(name at the time)" rather than hiding who was assigned.
- Three sites: Singapore (`Asia/Singapore`), Sydney (`Australia/Sydney`, observes DST), Jakarta (`Asia/Jakarta`, open Saturday mornings). All conversions use `Intl` with the IANA name, never fixed offsets.
- All three site names changed during the test (e.g. "Bluebay House Sydney" became "Robusttechhouse Court Sydney" by 3 Nov). Ids, timezones and business hours stayed the same, and the board keys everything by site id, so filters, shared links and times are unaffected. The change feed has no site event, so an open board shows new site names only after a reload.
- `/v1/sites` returns business hours and `/v1/sites/{id}/holidays` exists, but none of the six rules use them (overdue is by calendar date, not business time), so the board doesn't either.
- `/v1/changes` can only be read from the beginning. Catching up on first load took ~160 calls, ~28 MB and ~60–70 s (31 Oct), with ~34 `429` responses along the way; the client waits for `Retry-After` and carries on. Browsers log each `429` in the console, which is expected.
- Retrying a single call wasn't enough under `429`: when one page failed 4 times mid catch-up, the whole round started again from the beginning and looped (3,600+ calls and ~260 MB in one test). The feed position and unapplied items are now kept across failed rounds, so the next round resumes.
- Every call has a CORS preflight because of the `Authorization` header; unavoidable for a browser-only app.

## How I used AI

- **Tool:** Claude (chat). I used it as a pair programmer: to plan the work level by level and commit by commit, to draft the code for each step, and to review my edits when I pasted files back.
- **What I did myself:** read the brief, `docs/rules.md` and `docs/api.md`; called the API with curl and PowerShell (found the future-dated data, checked the server `Date` header, counted 88 future requests, confirmed the site renames); measured the change feed in DevTools (~160 calls, ~28 MB, `429`s); tested every state by hand (wrong token, empty range, offline, phone size, keyboard only, Windows Narrator); ran `tsc` and the tests before each commit; checked each change against the rules.
- **What came back wrong, and what I changed:**
  - A draft board had an unused import that broke `tsc --noEmit`, and showed the created time without the zone (rule 4). Fixed in a follow-up commit.
  - A test used `as const`, which made arrays `readonly` and failed type-checking. I typed the fixture as `BoardQuery` instead.
  - The first DECISIONS note said future-dated requests fall outside the default range. My screenshot showed requests created later *today* still appear (rule 1 compares dates, not times), so I corrected it.
  - The first live-update version re-rendered the whole table after every feed page (~1 s per page) and moved the cursor before applying changes, so an interrupted round could lose them. Updates are now batched.
  - The batched version then looped under rate limiting: if one page failed 4 times, the round restarted from the beginning (3,600+ calls, ~260 MB in one test). I found it in DevTools; the feed position is now kept across failed rounds.
  - The sort labels said "Newest/Oldest first", which is wrong when sorting by due date; changed to "Latest/Earliest first".
- **Mistakes I made applying changes** (caught by `tsc`, the tests or by looking): a file saved as `requestDetail.tsx` instead of `RequestDetail.tsx` (would break a case-sensitive Linux build), a `useState` placed after an early return, and the CSV change accidentally overwriting the live-status line. Each was fixed in its own commit.
- Where the AI suggested an interpretation the rules don't settle (e.g. ignoring undone events for the first response, CSV values as shown on the board), I wrote it down under "What I assumed". I can explain every line in the repo.

## Trade-offs and what I would do next

- `HELPDESK_TOKEN` is bundled into the browser build (Vite `envPrefix`). Acceptable for the practice API; a real app would call through a small proxy.
- Did not run `npm audit fix --force`: the reported vulnerabilities are in dev tooling and forcing fixes would bump major versions of the starter.
- The rules and board logic live in `src/lib/` (`rules.ts`, `events.ts`, `changes.ts`, `boardQuery.ts`, `csv.ts`) as pure functions with unit tests, so they can be checked without the API or the UI.
- Filtering and sorting happen in the browser on the loaded range, so changing them never re-calls the API; only changing the date range does. The cost is loading the whole range up front.
- Because the feed has no "start from now", the first ~minute after opening the board is spent catching up; the board shows a fresh snapshot meanwhile, so only changes made during that minute can appear later than one minute. With a back end I would keep the cursor server-side.
- If the first load fails, the Site filter is empty because site names arrive with the same load. Next I would load and cache sites separately.
- Retries are fixed (4 attempts per call, live polling every 20 s). Next: show a countdown and slow live polling down while the helpdesk is unavailable.
- Tested with Chrome device mode (iPhone SE) and Windows Narrator, not on a real phone or with VoiceOver/NVDA.