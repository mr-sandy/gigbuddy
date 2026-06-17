import type { z } from 'zod';

/*
 * The canonical fetch wrapper for the sync layer (architecture.md AR-24,
 * "API response envelope" §, "Error handling" §). Every API call from
 * sync/hooks/error-reporter goes through this module so the x-server-now
 * drift diagnostic, the 401 dispatch, and Zod schema validation live in
 * exactly one place.
 *
 * - `credentials: 'same-origin'` inherits the gigbuddy_session cookie.
 * - `x-server-now` presence is the network-success signal: only a live
 *   server can stamp it (the SW NetworkFirst cache never adds it). A 401
 *   without the header is an offline-cache 401 and MUST NOT trigger the
 *   unauthorized handler (AR-16; redirect-on-401.ts contract).
 * - The 30s drift warning is one-shot per session — diagnostic only.
 * - Schemas are supplied per call because envelope shapes vary
 *   (OkResponseSchema vs AppliedResponseSchema vs DroppedAsStaleResponseSchema).
 */

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;
let warnedAboutDrift = false;

export function setUnauthorizedHandler(fn: UnauthorizedHandler | null): void {
  unauthorizedHandler = fn;
}

/** Test-only escape hatch so the drift warning can fire again per case. */
export function __resetDriftWarningForTests(): void {
  warnedAboutDrift = false;
}

export interface ApiFetchOptions<TSchema extends z.ZodTypeAny> {
  method: 'GET' | 'PUT' | 'POST';
  body?: unknown;
  schema: TSchema;
  /** Reserved for callers (Story 2.5+) that need non-default status acceptance. */
  statusValidator?: (status: number, parsed: unknown) => boolean;
}

export interface ApiFetchResult<TData> {
  status: number;
  data: TData;
  wasNetworkSuccess: boolean;
}

const CLOCK_DRIFT_THRESHOLD_MS = 30_000;

export async function apiFetch<TSchema extends z.ZodTypeAny>(
  path: string,
  opts: ApiFetchOptions<TSchema>,
): Promise<ApiFetchResult<z.infer<TSchema>>> {
  const init: RequestInit = {
    method: opts.method,
    credentials: 'same-origin',
  };
  if (opts.body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(opts.body);
  }
  const res = await fetch(path, init);
  const serverNow = res.headers.get('x-server-now');
  const wasNetworkSuccess = serverNow !== null;
  if (!wasNetworkSuccess) {
    console.warn(`apiFetch: x-server-now header missing for ${path}`);
  } else if (!warnedAboutDrift) {
    const drift = Math.abs(new Date(serverNow).getTime() - Date.now());
    if (drift > CLOCK_DRIFT_THRESHOLD_MS) {
      console.warn(`apiFetch: clock drift`, { driftMs: drift, path });
      warnedAboutDrift = true;
    }
  }
  if (res.status === 401) {
    // Early-return before parsing: a 401 body may be non-JSON (CDN/WAF HTML).
    // Parsing it against a data schema would throw and obscure the auth event.
    if (wasNetworkSuccess && unauthorizedHandler) {
      unauthorizedHandler();
    }
    return { status: 401, data: undefined as z.infer<TSchema>, wasNetworkSuccess };
  }
  if (res.status === 204) {
    return {
      status: 204,
      data: undefined as z.infer<TSchema>,
      wasNetworkSuccess,
    };
  }
  const json = await res.json();
  const parsed = opts.schema.parse(json);
  return { status: res.status, data: parsed, wasNetworkSuccess };
}
