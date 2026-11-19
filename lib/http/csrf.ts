import { getAppOrigin } from '@/lib/config/app-origin';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method.toUpperCase());
}

/**
 * CSRF check for requests that change data. SameSite=Lax cookies are not enough on their own:
 * another app on the same host but a different port counts as the same site. Browsers always
 * send Origin (or at least Sec-Fetch-Site) on cross-origin POST/PUT, so a request without
 * either one is rejected too.
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (origin) return origin === getAppOrigin();
  return request.headers.get('sec-fetch-site') === 'same-origin';
}
