import type { ApiErrorBody } from '@/lib/http/errors';

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

/** Calls the app's own API from the browser. A 401 sends the user back to the login page. */
export async function apiRequest<T>(path: string, { method = 'GET', body }: ApiRequestOptions = {}): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const payload: unknown = await response.json().catch(() => null);

  if (response.status === UNAUTHORIZED) window.location.assign('/');
  if (!response.ok) {
    throw new ApiRequestError(response.status, (payload as ApiErrorBody | null)?.message ?? FALLBACK_MESSAGE);
  }
  return payload as T;
}
