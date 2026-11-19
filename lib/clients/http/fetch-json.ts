import { sleep } from '@/lib/utils/async';

/**
 * Shared transport for every external API client: timeouts, bounded retries and JSON parsing
 * live here once instead of being repeated in each client.
 */

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 400;
/** Never wait longer than this for a Retry-After: fail fast instead of hanging the request. */
const MAX_RETRY_AFTER_MS = 10_000;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export class UpstreamError extends Error {
  constructor(
    readonly status: number,
    readonly responseBody: string,
  ) {
    super(`Upstream request failed with status ${status}`);
    this.name = 'UpstreamError';
  }
}

export interface FetchJsonOptions {
  method?: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  /** Serialized as JSON. */
  json?: unknown;
  /** Sent as is (e.g. URLSearchParams for form posts). */
  body?: BodyInit;
  timeoutMs?: number;
  maxRetries?: number;
  /** Builds the error thrown for non-2xx responses, so clients can keep their own error type. */
  toError?: (status: number, responseBody: string) => Error;
}

/** Backoff for server errors; Retry-After for 429 unless it is too long (then `null`: don't retry). */
function retryDelayMs(response: Response, attemptIndex: number): number | null {
  const backoff = BASE_BACKOFF_MS * 2 ** attemptIndex;
  if (response.status !== 429) return backoff;

  const retryAfterSeconds = Number(response.headers.get('Retry-After'));
  if (!(retryAfterSeconds > 0)) return backoff;
  const retryAfterMs = retryAfterSeconds * 1000;
  return retryAfterMs <= MAX_RETRY_AFTER_MS ? retryAfterMs : null;
}

function isTimeoutOrNetworkError(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError');
}

export function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { headers = {}, json, body } = options;
  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers: json === undefined ? headers : { ...headers, 'Content-Type': 'application/json' },
    body: json === undefined ? body : JSON.stringify(json),
    cache: 'no-store',
    redirect: 'error',
  };
  return attempt<T>(url, init, options, 0);
}

async function attempt<T>(url: string, init: RequestInit, options: FetchJsonOptions, attemptIndex: number): Promise<T> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    toError = (status, responseBody) => new UpstreamError(status, responseBody),
  } = options;
  const canRetry = attemptIndex < maxRetries;

  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (!canRetry || !isTimeoutOrNetworkError(error)) throw error;
    await sleep(BASE_BACKOFF_MS * 2 ** attemptIndex);
    return attempt<T>(url, init, options, attemptIndex + 1);
  }

  const delay = canRetry && RETRYABLE_STATUSES.has(response.status) ? retryDelayMs(response, attemptIndex) : null;
  if (delay !== null) {
    await response.body?.cancel();
    await sleep(delay);
    return attempt<T>(url, init, options, attemptIndex + 1);
  }

  const text = await response.text();
  if (!response.ok) throw toError(response.status, text);
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Same as {@link fetchJson} but returns `null` instead of throwing, for optional data sources. */
export async function fetchJsonOrNull<T>(url: string, options: FetchJsonOptions = {}): Promise<T | null> {
  try {
    return await fetchJson<T>(url, options);
  } catch {
    return null;
  }
}

export interface FetchBytesOptions {
  maxBytes: number;
  timeoutMs?: number;
}

/** Downloads a small binary file (e.g. a 30 second preview). Returns `null` on any failure or if too big. */
export async function fetchBytes(url: string, { maxBytes, timeoutMs = DEFAULT_TIMEOUT_MS }: FetchBytesOptions): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok || Number(response.headers.get('content-length')) > maxBytes) {
      await response.body?.cancel();
      return null;
    }
    const bytes = await response.arrayBuffer();
    return bytes.byteLength > maxBytes ? null : bytes;
  } catch {
    return null;
  }
}
