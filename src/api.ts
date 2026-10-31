// A thin client for the helpdesk API. All fetch calls go through here.

import type {
  ChangesPage, HelpdeskRequest, Holiday, Page, RequestEvent, Site, Staff, Status, StatusOption,
} from "./types";

const BASE = (import.meta.env.HELPDESK_URL ?? "").replace(/\/$/, "");
const TOKEN = import.meta.env.HELPDESK_TOKEN ?? "";
const MAX_ATTEMPTS = 4;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfterSeconds: number | null = null,
  ) {
    super(message);
  }
}

export function configured(): boolean {
  return Boolean(BASE && TOKEN);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });

}

/** GET with retries on network errors, 429 (honours Retry-After) and 5xx. */
export async function get<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(BASE + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  for (let attempt = 1; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` }, signal });
    } catch (err) {
      if (signal?.aborted || attempt >= MAX_ATTEMPTS) throw err;
      await sleep(500 * 2 ** attempt, signal);
      continue;
    }
    if (response.ok) return (await response.json()) as T;

    const body = (await response.json().catch(() => ({}))) as { error?: string };
    const header = response.headers.get("Retry-After");
    const retryAfter = header ? Number(header) : null;
    const retryable = response.status === 429 || response.status >= 500;

    if (retryable && attempt < MAX_ATTEMPTS) {
      await sleep(retryAfter != null ? retryAfter * 1000 : 500 * 2 ** attempt, signal);
      continue;

    }
    throw new ApiError(response.status, body.error ?? response.statusText, retryAfter);
  }
}

/** Fetch every page of a page-numbered list. */
export async function getAllPages<T>(fetchPage: (page: number) => Promise<Page<T>>): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; ; page++) {
    const res = await fetchPage(page);
    all.push(...res.data);
    const done = res.total_pages != null ? page >= res.total_pages : !res.has_more;
    if (done || res.data.length === 0) return all;
  }
}

export const listRequests = (
  params: { page?: number; per_page?: number; created_from?: string; created_to?: string; status?: Status[] },
  signal?: AbortSignal,
) =>
  get<Page<HelpdeskRequest>>("/v1/requests", {
    ...params,
    status: params.status?.length ? JSON.stringify(params.status) : undefined,
  }, signal);

export const getRequest = (id: number, signal?: AbortSignal) =>
  get<HelpdeskRequest>(`/v1/requests/${id}`, {}, signal);

export const listEvents = (id: number, page = 1, signal?: AbortSignal) =>
  get<Page<RequestEvent>>(`/v1/requests/${id}/events`, { page }, signal);

export const listSites = (signal?: AbortSignal) => get<{ data: Site[] }>("/v1/sites", {}, signal);

export const listStaff = (signal?: AbortSignal) => get<{ data: Staff[] }>("/v1/staff", {}, signal);
export const listStatuses = (signal?: AbortSignal) => get<{ data: StatusOption[] }>("/v1/statuses", {}, signal);
export const listHolidays = (siteId: number, signal?: AbortSignal) =>
  get<{ data: Holiday[] }>(`/v1/sites/${siteId}/holidays`, {}, signal);

export const listChanges = (cursor?: string, limit = 500, signal?: AbortSignal) =>
  get<ChangesPage>("/v1/changes", { cursor, limit }, signal);