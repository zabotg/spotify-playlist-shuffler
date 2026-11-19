import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { getEnv } from '@/lib/config/env';
import { HttpError } from '@/lib/http/errors';
import type { TokenResponse } from '@/lib/clients/spotify/oauth';

const SESSION_COOKIE_NAME = 'sp_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const TOKEN_REFRESH_MARGIN_MS = 60_000;

export interface SpotifySession {
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: number;
  userId?: string;
  displayName?: string;
  pkceVerifier?: string;
  oauthState?: string;
}

export type AuthenticatedSession = IronSession<SpotifySession> &
  Required<Pick<SpotifySession, 'accessToken' | 'refreshToken' | 'userId'>>;

export function getSessionOptions(): SessionOptions {
  return {
    cookieName: SESSION_COOKIE_NAME,
    password: getEnv().SESSION_SECRET,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: '/',
    },
  };
}

export async function getSession(): Promise<IronSession<SpotifySession>> {
  return getIronSession<SpotifySession>(await cookies(), getSessionOptions());
}

export function isAuthenticated(session: IronSession<SpotifySession>): session is AuthenticatedSession {
  return Boolean(session.accessToken && session.refreshToken && session.userId);
}

export async function getAuthenticatedSession(): Promise<AuthenticatedSession | null> {
  const session = await getSession();
  return isAuthenticated(session) ? session : null;
}

export async function requireSession(): Promise<AuthenticatedSession> {
  const session = await getAuthenticatedSession();
  if (!session) throw new HttpError(401, 'UNAUTHORIZED', 'Not authenticated.');
  return session;
}

export function isTokenExpired(session: SpotifySession): boolean {
  if (!session.accessTokenExpiresAt) return true;
  return Date.now() >= session.accessTokenExpiresAt - TOKEN_REFRESH_MARGIN_MS;
}

export function applyTokens(session: SpotifySession, tokens: TokenResponse): void {
  session.accessToken = tokens.access_token;
  session.accessTokenExpiresAt = Date.now() + tokens.expires_in * 1000;
  if (tokens.refresh_token) session.refreshToken = tokens.refresh_token;
}
