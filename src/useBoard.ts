import { useEffect, useState } from "react";
import { getAllPages, listRequests, listSites, listStaff, listStatuses } from "./api";
import { toApiDate } from "./lib/dates";
import { apiRange, countsInRange } from "./lib/rules";
import type { HelpdeskRequest, Site, Staff, StatusOption } from "./types";

export interface BoardData {
  requests: HelpdeskRequest[];
  sites: Map<number, Site>;
  staff: Map<number, Staff>;
  statuses: Map<string, string>; // value -> label
}

/** Loads reference data + every request whose site-local created date is in from..to (rule 1). */
export function useBoard(from: string, to: string) {
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    const { signal } = ctrl;
    setLoading(true);
    setError(null);

    (async () => {
      const [sites, staff, statuses] = await Promise.all([
        listSites(signal), listStaff(signal), listStatuses(signal),
      ]);
      const siteMap = new Map(sites.data.map((s) => [s.id, s]));
      const range = apiRange(from, to);
      const raw = await getAllPages((page) =>

        listRequests({ page, per_page: 100, created_from: toApiDate(range.from), created_to: toApiDate(range.to) }, signal),
      );
      // Data changes while paging, so the same request can appear on two pages: keep one per id.
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
      });
    })()
      .catch((e: unknown) => { if (!signal.aborted) setError(e); })
      .finally(() => { if (!signal.aborted) setLoading(false); });

    return () => ctrl.abort();
  }, [from, to]);

  return { data, error, loading };
}