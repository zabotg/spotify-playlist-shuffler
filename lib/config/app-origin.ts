import { getEnv } from './env';

/**
 * The single origin the app is served from, taken from the Spotify redirect URI.
 * Redirects and CSRF checks use it instead of request headers like Host or X-Forwarded-Host,
 * which a client can set to anything.
 */
export function getAppOrigin(): string {
  return new URL(getEnv().SPOTIFY_REDIRECT_URI).origin;
}

export function appUrl(path: string): URL {
  return new URL(path, getAppOrigin());
}

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

function isLoopback(host: string): boolean {
  return LOOPBACK_HOSTNAMES.has(host.replace(/:\d+$/, ''));
}

/**
 * Whether the request came in on another name for this machine than the configured one (e.g.
 * localhost instead of 127.0.0.1). The session cookie only exists on the configured host and
 * browsers treat the two as different sites, so pages there look signed out and the visit should
 * move over. Only loopback names count: a reverse proxy that rewrites Host must not cause a loop.
 *
 * The proxy can't do this redirect: Next.js treats all loopback names as the same host and strips
 * the origin from proxy redirects, so it would loop. Pages and route handlers check it instead.
 */
export function isOtherLocalHost(host: string | null): boolean {
  const appHost = new URL(getAppOrigin()).host;
  return host !== null && host !== appHost && isLoopback(host) && isLoopback(appHost);
}
