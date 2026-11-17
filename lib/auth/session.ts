/**
 * Session management via iron-session.
 *
 * The entire session (tokens + user info) lives in an encrypted httpOnly cookie.
 * No database. No server-side state. Zero user data persisted.
 *
 * iron-session uses AES-256-CBC + HMAC-SHA-256 (via the password you provide).
 * The cookie is opaque to the browser — JS cannot read it.
 */

import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export interface SpotifySession {
  // Spotify tokens — stored encrypted in cookie
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: number; // Unix ms timestamp

  // User info — cached to avoid extra API calls
  spotifyUserId?: string;
  displayName?: string;
  email?: string;
  country?: string | null;

  // Temporary state during OAuth PKCE flow only.
  // Cleared after callback succeeds.
  pkceVerifier?: string;
  oauthState?: string;
}

function getSessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters');
  }
  return {
    cookieName: 'sp_session',
    password,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      // 7 days — matches Spotify refresh token lifetime
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    },
  };
}

export async function getSession(): Promise<IronSession<SpotifySession>> {
  return getIronSession<SpotifySession>(await cookies(), getSessionOptions());
}

/** Returns session only if authenticated (has valid tokens). */
export async function getAuthenticatedSession(): Promise<IronSession<SpotifySession> | null> {
  const session = await getSession();
  if (!session.accessToken || !session.spotifyUserId) return null;
  return session;
}

/** Throws a Response (for use in route handlers) if not authenticated. */
export async function requireSession(): Promise<IronSession<SpotifySession>> {
  const session = await getAuthenticatedSession();
  if (!session) {
    throw Response.json({ error: 'UNAUTHORIZED', message: 'Not authenticated' }, { status: 401 });
  }
  return session;
}

export function isTokenExpired(session: SpotifySession): boolean {
  if (!session.accessTokenExpiresAt) return true;
  // Refresh 60s before expiry to avoid edge cases
  return Date.now() >= session.accessTokenExpiresAt - 60_000;
}
