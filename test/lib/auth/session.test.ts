import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeSession } from '@/test/fakes';

const { getIronSession, cookies } = vi.hoisted(() => ({
  getIronSession: vi.fn(),
  cookies: vi.fn(),
}));
vi.mock('iron-session', () => ({ getIronSession }));
vi.mock('next/headers', () => ({ cookies }));

import {
  applyTokens,
  getAuthenticatedSession,
  getSession,
  getSessionOptions,
  isAuthenticated,
  isTokenExpired,
  requireSession,
} from '@/lib/auth/session';

describe('session', () => {
  beforeEach(() => {
    cookies.mockResolvedValue('cookie-store');
  });

  it('uses an httpOnly, SameSite=Lax cookie that is not Secure in development', () => {
    expect(getSessionOptions()).toMatchObject({
      cookieName: 'sp_session',
      password: process.env.SESSION_SECRET,
      cookieOptions: { httpOnly: true, secure: false, sameSite: 'lax', path: '/' },
    });
  });

  it('uses a Secure __Host- cookie in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(getSessionOptions()).toMatchObject({ cookieName: '__Host-sp_session', cookieOptions: { secure: true } });
  });

  it('reads the session from the request cookies', async () => {
    getIronSession.mockResolvedValue({ userId: 'me' });
    expect(await getSession()).toEqual({ userId: 'me' });
    expect(getIronSession).toHaveBeenCalledWith('cookie-store', getSessionOptions());
  });

  it('is authenticated only with both tokens and a user ID', () => {
    expect(isAuthenticated(fakeSession())).toBe(true);
    expect(isAuthenticated(fakeSession({ refreshToken: '' }))).toBe(false);
    expect(isAuthenticated(fakeSession({ userId: '' }))).toBe(false);
  });

  it('returns the session only when signed in', async () => {
    const session = fakeSession();
    getIronSession.mockResolvedValueOnce(session).mockResolvedValueOnce(fakeSession({ accessToken: '' }));
    expect(await getAuthenticatedSession()).toBe(session);
    expect(await getAuthenticatedSession()).toBeNull();
  });

  it('throws a 401 when a session is required but missing', async () => {
    getIronSession.mockResolvedValue(fakeSession({ userId: '' }));
    await expect(requireSession()).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    getIronSession.mockResolvedValue(fakeSession());
    await expect(requireSession()).resolves.toMatchObject({ userId: 'me' });
  });

  it('treats tokens as expired a minute early, or when the expiry is unknown', () => {
    expect(isTokenExpired(fakeSession({ accessTokenExpiresAt: Date.now() + 30_000 }))).toBe(true);
    expect(isTokenExpired(fakeSession({ accessTokenExpiresAt: Date.now() + 120_000 }))).toBe(false);
    expect(isTokenExpired(fakeSession({ accessTokenExpiresAt: undefined }))).toBe(true);
  });

  it('applies new tokens and keeps the old refresh token when none is returned', () => {
    const session = fakeSession();
    applyTokens(session, { access_token: 'new', expires_in: 3600 });
    expect(session.accessToken).toBe('new');
    expect(session.refreshToken).toBe('refresh-token');
    applyTokens(session, { access_token: 'newer', refresh_token: 'rotated', expires_in: 3600 });
    expect(session.refreshToken).toBe('rotated');
  });
});
