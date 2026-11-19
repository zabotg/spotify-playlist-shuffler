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
