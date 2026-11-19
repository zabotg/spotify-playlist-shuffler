import { describe, expect, it } from 'vitest';

/**
 * Smoke tests against a running app (`npm run dev` or `npm start`), over real HTTP.
 * They only use routes that work without a Spotify login and never change any data.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
const APP_ORIGIN = new URL(BASE_URL).origin;

/** Where a redirect goes, resolved like a browser would (servers may send relative paths). */
const redirectTarget = (response: Response) => new URL(response.headers.get('location') ?? '', BASE_URL).href;

const get = (path: string, headers: Record<string, string> = {}) =>
  fetch(`${BASE_URL}${path}`, { redirect: 'manual', headers });
const send = (path: string, method: string, headers: Record<string, string> = {}) =>
  fetch(`${BASE_URL}${path}`, {
    method,
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: '{}',
  });

describe('public pages', () => {
  it('serves the landing page with the sign-in button', async () => {
    const response = await get('/');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Continue with Spotify');
  });

  it('sends strict security headers', async () => {
    const { headers } = await get('/');
    expect(headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(headers.get('content-security-policy')).toContain("object-src 'none'");
    expect(headers.get('x-frame-options')).toBe('DENY');
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('cross-origin-opener-policy')).toBe('same-origin');
    expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });

  it('does not break on unexpected login error codes', async () => {
    const response = await get('/?error=toString');
    expect(response.status).toBe(200);
  });
});

describe('access control', () => {
  it.each(['/dashboard', '/playlists/abc123'])('sends signed-out visitors from %s to the home page', async (path) => {
    const response = await get(path, { 'X-Forwarded-Host': 'evil.example' });
    expect(response.status).toBe(307);
    expect(redirectTarget(response)).toBe(`${APP_ORIGIN}/`);
  });

  it.each(['/api/playlists', '/api/playlists/abc123/tracks', '/api/tracks/preview?title=a&artist=b'])(
    'answers 401 on %s without a session',
    async (path) => {
      const response = await get(path);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'UNAUTHORIZED', message: 'Not authenticated.' });
    },
  );
});

describe('CSRF protection', () => {
  it.each([
    ['POST', '/api/playlists'],
    ['PUT', '/api/playlists/abc123/tracks'],
    ['DELETE', '/api/playlists/abc123/tracks'],
  ])('blocks a cross-site %s %s', async (method, path) => {
    const withoutOrigin = await send(path, method);
    const otherSite = await send(path, method, { Origin: 'http://127.0.0.1:4000' });
    expect(withoutOrigin.status).toBe(403);
    expect(otherSite.status).toBe(403);
  });

  it('lets same-origin writes through to the auth check', async () => {
    const response = await send('/api/playlists', 'POST', { Origin: APP_ORIGIN });
    expect(response.status).toBe(401);
  });
});

describe('login flow', () => {
  it('starts OAuth with PKCE and a state, in an HttpOnly cookie', async () => {
    const response = await get('/api/auth/login');
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.origin).toBe('https://accounts.spotify.com');
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('rejects a callback with a state it did not issue', async () => {
    const response = await get('/api/auth/callback?code=fake&state=forged', { 'X-Forwarded-Host': 'evil.example' });
    expect(redirectTarget(response)).toBe(`${APP_ORIGIN}/?error=state_mismatch`);
  });

  it('reports a cancelled login', async () => {
    const response = await get('/api/auth/callback?error=access_denied');
    expect(redirectTarget(response)).toBe(`${APP_ORIGIN}/?error=access_denied`);
  });
});
