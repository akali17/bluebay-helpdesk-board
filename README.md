# Bluebay requests board

A board for Bluebay Properties site managers to see helpdesk requests across Singapore, Sydney and Jakarta. It runs in the browser and reads straight from the helpdesk; there is no server of its own.

## Getting started

You need [Node.js](https://nodejs.org) 20 or newer.

1. Create a file called `.env` in this folder (copy `.env.example`) with the helpdesk address and your access token:

   ```
   HELPDESK_URL=https://...
   HELPDESK_TOKEN=...
   ```

   The token is private: don't commit `.env` or share it.

2. Install and start:

   ```
   npm install
   npm run dev
   ```

3. Open http://localhost:5173.

## Using the board

### Choosing what you see

- The board opens on the **last 30 days**. Change **From** / **To** to pick another range.
- Tick **sites** and **statuses** to filter. Nothing ticked means "all".

- **Sort by** created date or due date, latest or earliest first. Requests without a due date always go last.
- Canceled, deleted and merged requests are never shown.

### Sharing a view

The address in the browser holds the range, filters, sort and any open request. Copy it and send it to a colleague: they will see the same view.

### Times and dates

Every time is shown in the **site's own local time**, with the zone named, e.g. `07/10/2026 10:00 GMT+11 (Australia/Sydney)`. Sydney's offset changes with daylight saving; the board handles that.

### Marks on a row

- **Overdue**: still pending or processing, and the due date is before today in that site's timezone.
- **future-dated**: the helpdesk recorded a creation time later than now. These are shown, not hidden, so you can spot data problems.

### One request

Click a row (or its reference) to open the request: its details, who gave the **first response** and when, and its full history, oldest first.

Events that were later undone are hidden; tick **Show undone events** to see them.

Use **Back to board** or the browser's back button to return with your filters intact.

### Live updates

The board follows the helpdesk on its own: changes appear within a minute without reloading, and the top line says when it **last updated**.

Right after opening, the board spends about a minute catching up with the helpdesk's change history; the list is already current during that minute.

### Downloading for Excel


**Download CSV** saves every row that matches the current range, filters and sort, in the same order, as `requests-<from>-<to>.csv`.

Excel may show due dates in your computer's date format; the file itself uses `YYYY-MM-DD`.

### When something goes wrong

- If the helpdesk is busy or briefly down, the board waits and retries by itself.
- If it still can't load, it says why and offers **Try again**.
- If live updates fail, the board keeps showing the last good data and keeps trying every 20 seconds.

### Phones, keyboard and screen readers

- On a phone, each request becomes a card with labelled fields.
- Everything works with the keyboard alone: **Tab** to move, **Enter** to open a request. Closing a request puts you back on the row you opened.
- Screen readers announce the number of requests shown when filters change.

## For developers

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app on port 5173 |
| `npm test` | Run the unit tests |
| `npx tsc --noEmit` | Type-check |
| `npm run build` | Production build into `dist/` |

- React 18 + TypeScript + Vite, no other runtime libraries.
- `src/api.ts` is the only place that calls the helpdesk (retries on `429` and `5xx`).
- `src/lib/` holds the rules from `docs/rules.md` as pure, tested functions: `rules.ts`, `events.ts`, `changes.ts`, `boardQuery.ts`, `csv.ts`.
- `src/useBoard.ts` loads a range and keeps it live from `/v1/changes`.
- `src/RequestDetail.tsx` shows one request and its history.
- Decisions, API findings and trade-offs are in [DECISIONS.md](DECISIONS.md).