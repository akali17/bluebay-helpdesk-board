import { useEffect, useRef, useState } from "react";
import { ApiError, getAllPages, listChanges, listRequests, listSites, listStaff, listStatuses } from "./api";
import { applyChanges } from "./lib/changes";
import { toApiDate } from "./lib/dates";
import { apiRange, countsInRange } from "./lib/rules";
import type { ChangeItem, HelpdeskRequest, Site, Staff } from "./types";

export interface BoardData {
  requests: HelpdeskRequest[];
  sites: Map<number, Site>;
  staff: Map<number, Staff>;
  statuses: Map<string, string>; // value -> label
  versions: Map<number, number>; // request id -> bumped on every change, so an open detail view reloads
}

const POLL_MS = 20_000; // well inside the "within a minute" requirement

export function useBoard(from: string, to: string) {
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [liveError, setLiveError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0); // bumped by "Try again"
    // Feed position and items read but not yet applied. Kept across failed rounds and range
  // changes, so a 429 mid catch-up resumes where it stopped instead of starting over.
  const feed = useRef<{ cursor: string | undefined; items: ChangeItem[] }>({ cursor: undefined, items: [] });
  const key = `${from}|${to}`;

  // Snapshot of the range (rule 1).
  useEffect(() => {
    const ctrl = new AbortController();
    const { signal } = ctrl;
    setLoading(true);

    setError(null);

    setData(null);

    (async () => {
      const [sites, staff, statuses] = await Promise.all([listSites(signal), listStaff(signal), listStatuses(signal)]);
      const siteMap = new Map(sites.data.map((s) => [s.id, s]));
      const range = apiRange(from, to);
      const raw = await getAllPages((page) =>
        listRequests({ page, per_page: 100, created_from: toApiDate(range.from), created_to: toApiDate(range.to) }, signal),
      );
      const unique = [...new Map(raw.map((r) => [r.id, r])).values()];
      const requests = unique.filter((r) => {
        const site = siteMap.get(r.site_id);
        return site ? countsInRange(r, site.timezone, from, to) : false;
      });
      setData({
        requests,
        sites: siteMap,
        staff: new Map(staff.data.map((s) => [s.id, s])),
        statuses: new Map(statuses.data.map((s) => [s.value, s.label])),
        versions: new Map(),
      });
      setLoadedFor(`${from}|${to}`);
    })()
      .catch((e: unknown) => { if (!signal.aborted) setError(e); })
      .finally(() => { if (!signal.aborted) setLoading(false); });

    return () => ctrl.abort();
  }, [from, to, attempt]);

  // Live: follow /v1/changes and apply it to the snapshot.
  useEffect(() => {
    if (loadedFor !== key) return;

    const ctrl = new AbortController();
    const { signal } = ctrl;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      const f = feed.current;
      try {
        for (;;) {
          let page;
          try {
            page = await listChanges(f.cursor, 500, signal);
          } catch (e) {
            if (e instanceof ApiError && e.status === 410) { f.cursor = undefined; continue; } // cursor expired: read again from the start
            throw e;
          }
          f.items.push(...page.data);
          if (page.next_cursor) f.cursor = page.next_cursor;
          if (!page.has_more) break;
        }
        // Up to date: apply everything read so far in one render. Applying is idempotent.
        const batch = f.items;
        f.items = [];
        if (batch.length) setData((prev) => (prev ? applyChanges(prev, batch, from, to) : prev));
        setLastUpdated(new Date());
        setLiveError(null);
      } catch (e) {
        if (signal.aborted) return;
        setLiveError(e); // progress is kept in `feed`; the next round continues from there
      }
      if (!signal.aborted) timer = setTimeout(poll, POLL_MS);
    };
    poll();

    return () => { ctrl.abort(); clearTimeout(timer); };
  }, [loadedFor, key, from, to]);

  return { data, error, loading, lastUpdated, liveError, retry: () => setAttempt((a) => a + 1) };
}