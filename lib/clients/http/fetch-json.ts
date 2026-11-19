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

function retryDelayMs(response: Response | null, attempt: number): number | null {
  const backoff = BASE_BACKOFF_MS * 2 ** attempt;
  if (response?.status !== 429) return backoff;

  const retryAfterSeconds = Number(response.headers.get('Retry-After'));
  if (!(retryAfterSeconds > 0)) return backoff;
  const retryAfterMs = retryAfterSeconds * 1000;
  return retryAfterMs <= MAX_RETRY_AFTER_MS ? retryAfterMs : null;
}

function isTimeoutOrNetworkError(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError');
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const {
    method = 'GET',
    headers = {},
    json,
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    toError = (status, responseBody) => new UpstreamError(status, responseBody),
  } = options;

  const requestBody = json === undefined ? body : JSON.stringify(json);
  const requestHeaders = json === undefined ? headers : { ...headers, 'Content-Type': 'application/json' };

  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: requestBody,
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const delay = retryDelayMs(null, attempt);
      if (attempt < maxRetries && delay !== null && isTimeoutOrNetworkError(error)) {
        await sleep(delay);
        continue;
      }
      throw error;
    }

    if (RETRYABLE_STATUSES.has(response.status) && attempt < maxRetries) {
      const delay = retryDelayMs(response, attempt);
      if (delay !== null) {
        await response.body?.cancel();
        await sleep(delay);
        continue;
      }
    }

    const text = await response.text();
    if (!response.ok) throw toError(response.status, text);
    return (text ? JSON.parse(text) : undefined) as T;
  }
}

/** Same as {@link fetchJson} but returns `null` instead of throwing, for optional data sources. */
export async function fetchJsonOrNull<T>(url: string, options: FetchJsonOptions = {}): Promise<T | null> {
  try {
    return await fetchJson<T>(url, options);
  } catch {
    return null;
  }
}
