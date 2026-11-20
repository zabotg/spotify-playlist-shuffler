import type { SaveProgress } from '@/lib/domain/models/playlist';
import type { ApiErrorBody } from '@/lib/http/errors';
import type { ProgressEvent } from '@/lib/http/progress-stream';

const UNAUTHORIZED = 401;
const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
}

function send(path: string, { method = 'GET', body }: ApiRequestOptions): Promise<Response> {
  return fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
}

/** The error for a failed response. A 401 also sends the user back to the login page. */
function toApiError(status: number, payload: unknown): ApiRequestError {
  if (status === UNAUTHORIZED) window.location.assign('/');
  return new ApiRequestError(status, (payload as ApiErrorBody | null)?.message ?? FALLBACK_MESSAGE);
}

/** Calls the app's own API from the browser. A 401 sends the user back to the login page. */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw toApiError(response.status, payload);
  return payload as T;
}

const STREAM_ERROR_STATUS = 500;
const INTERRUPTED_MESSAGE =
  'The connection was lost before saving finished. Reload the page to see what was saved.';

/**
 * Calls an endpoint that answers with a progress stream (see `progressStream` on the server),
 * reporting each step to `onProgress` and resolving with the final result.
 */
export async function progressRequest<T>(
  path: string,
  options: ApiRequestOptions,
  onProgress: (progress: SaveProgress) => void,
): Promise<T> {
  const response = await send(path, options);
  if (!response.ok) throw toApiError(response.status, await response.json().catch(() => null));

  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });
    const lines = buffered.split('\n');
    // The last piece may be an incomplete line; keep it for the next chunk.
    buffered = lines.pop() as string;
    for (const line of lines) {
      const event = JSON.parse(line) as ProgressEvent<T>;
      if (event.type === 'progress') onProgress({ done: event.done, total: event.total });
      else if (event.type === 'done') return event.result;
      else throw new ApiRequestError(STREAM_ERROR_STATUS, event.message);
    }
  }
  throw new ApiRequestError(STREAM_ERROR_STATUS, INTERRUPTED_MESSAGE);
}
