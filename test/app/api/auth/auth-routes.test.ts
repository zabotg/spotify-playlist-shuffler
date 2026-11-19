import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeSession } from '@/test/fakes';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
  getCurrentUser: vi.fn(),
}));
vi.mock('@/lib/auth/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/session')>()),
  getSession: mocks.getSession,
}));
vi.mock('@/lib/clients/spotify/oauth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/clients/spotify/oauth')>()),
  exchangeCodeForTokens: mocks.exchangeCodeForTokens,
}));
vi.mock('@/lib/clients/spotify/client', () => ({
  SpotifyClient: class {
    getCurrentUser = mocks.getCurrentUser;
  },
}));

import { GET as callback } from '@/app/api/auth/callback/route';
import { GET as login } from '@/app/api/auth/login/route';
import { POST as logout } from '@/app/api/auth/logout/route';

const location = (response: Response) => response.headers.get('location');

describe('GET /api/auth/login', () => {
  it('moves the login to the configured host first', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/login', { headers: { host: 'localhost:3000' } });
    const response = await login(request, {});
    expect(location(response)).toBe('http://127.0.0.1:3000/api/auth/login');
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it('stores PKCE verifier and state, then redirects to Spotify', async () => {
    const session = fakeSession();
    mocks.getSession.mockResolvedValue(session);
    const request = new NextRequest('http://127.0.0.1:3000/api/auth/login', { headers: { host: '127.0.0.1:3000' } });

    const response = await login(request, {});
    const url = new URL(location(response) ?? '');

    expect(url.origin).toBe('https://accounts.spotify.com');
    expect(url.searchParams.get('state')).toBe(session.oauthState);
    expect(session.pkceVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(session.save).toHaveBeenCalled();
  });
});

describe('GET /api/auth/callback', () => {
  const callbackRequest = (query: string) => new NextRequest(`http://127.0.0.1:3000/api/auth/callback?${query}`);
  let session: ReturnType<typeof fakeSession>;

  beforeEach(() => {
    session = fakeSession({ accessToken: '', userId: '', pkceVerifier: 'verifier', oauthState: 'state-1' });
    mocks.getSession.mockResolvedValue(session);
  });

  it('reports a cancelled login', async () => {
    expect(location(await callback(callbackRequest('error=access_denied')))).toBe(
      'http://127.0.0.1:3000/?error=access_denied',
    );
  });

  it('rejects callbacks without code or state', async () => {
    expect(location(await callback(callbackRequest('code=x')))).toBe('http://127.0.0.1:3000/?error=invalid_callback');
  });

  it('rejects a state that does not match and clears the one-time values', async () => {
    const response = await callback(callbackRequest('code=x&state=forged'));
    expect(location(response)).toBe('http://127.0.0.1:3000/?error=state_mismatch');
    expect(session.oauthState).toBeUndefined();
    expect(session.pkceVerifier).toBeUndefined();
    expect(mocks.exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it('rejects a callback when no login was started', async () => {
    mocks.getSession.mockResolvedValue(fakeSession({ pkceVerifier: undefined, oauthState: undefined }));
    expect(location(await callback(callbackRequest('code=x&state=undefined')))).toBe(
      'http://127.0.0.1:3000/?error=state_mismatch',
    );
  });

  it('signs the user in and goes to the dashboard', async () => {
    mocks.exchangeCodeForTokens.mockResolvedValue({ access_token: 'a', refresh_token: 'r', expires_in: 3600 });
    mocks.getCurrentUser.mockResolvedValue({ id: 'me', displayName: null });

    const response = await callback(callbackRequest('code=code-1&state=state-1'));

    expect(location(response)).toBe('http://127.0.0.1:3000/dashboard');
    expect(mocks.exchangeCodeForTokens).toHaveBeenCalledWith('code-1', 'verifier');
    expect(session).toMatchObject({ accessToken: 'a', refreshToken: 'r', userId: 'me', displayName: undefined });
  });

  it('keeps the display name when Spotify has one', async () => {
    mocks.exchangeCodeForTokens.mockResolvedValue({ access_token: 'a', refresh_token: 'r', expires_in: 3600 });
    mocks.getCurrentUser.mockResolvedValue({ id: 'me', displayName: 'Me' });
    await callback(callbackRequest('code=code-1&state=state-1'));
    expect(session.displayName).toBe('Me');
  });

  it('reports a failed token exchange without leaking details', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.exchangeCodeForTokens.mockRejectedValue(new Error('invalid_grant'));
    const response = await callback(callbackRequest('code=x&state=state-1'));
    expect(location(response)).toBe('http://127.0.0.1:3000/?error=token_exchange_failed');
    expect(log).toHaveBeenCalledWith('[auth/callback] Login failed', 'invalid_grant');

    mocks.exchangeCodeForTokens.mockRejectedValue('weird');
    session.pkceVerifier = 'verifier';
    session.oauthState = 'state-1';
    await callback(callbackRequest('code=x&state=state-1'));
    expect(log).toHaveBeenLastCalledWith('[auth/callback] Login failed', 'weird');
  });
});

describe('POST /api/auth/logout', () => {
  it('destroys the session and redirects home with 303', async () => {
    const session = fakeSession();
    mocks.getSession.mockResolvedValue(session);
    const response = await logout(new NextRequest('http://127.0.0.1:3000/api/auth/logout', { method: 'POST' }), {});
    expect(response.status).toBe(303);
    expect(location(response)).toBe('http://127.0.0.1:3000/');
    expect(session.destroy).toHaveBeenCalled();
  });
});
