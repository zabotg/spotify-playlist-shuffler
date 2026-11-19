import { refreshAccessToken, type TokenResponse } from '@/lib/clients/spotify/oauth';
import { applyTokens, isTokenExpired, type AuthenticatedSession } from './session';

/**
 * Refreshes that are already running, keyed by refresh token. When a page fires several API
 * calls at once with an expired token, they share one refresh instead of racing each other
 * (Spotify may rotate the refresh token, which would break the losers).
 */
const refreshesInFlight = new Map<string, Promise<TokenResponse>>();

function refreshOnce(refreshToken: string): Promise<TokenResponse> {
  const pending = refreshesInFlight.get(refreshToken);
  if (pending) return pending;

  const refresh = refreshAccessToken(refreshToken).finally(() => refreshesInFlight.delete(refreshToken));
  refreshesInFlight.set(refreshToken, refresh);
  return refresh;
}

/** Returns a valid access token, refreshing it and updating the session cookie when needed. */
export async function ensureFreshAccessToken(session: AuthenticatedSession): Promise<string> {
  if (!isTokenExpired(session)) return session.accessToken;

  applyTokens(session, await refreshOnce(session.refreshToken));
  await session.save();
  return session.accessToken;
}
