import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { fakeSession } from '@/test/fakes';

const { getIronSession } = vi.hoisted(() => ({ getIronSession: vi.fn() }));
vi.mock('iron-session', () => ({ getIronSession }));

import { config, proxy } from '@/proxy';

const request = (path: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
  new NextRequest(`http://127.0.0.1:3000${path}`, init);

describe('proxy', () => {
  it('blocks cross-site API writes', async () => {
    const response = await proxy(request('/api/playlists', { method: 'POST', headers: { origin: 'http://evil.test' } }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'FORBIDDEN', message: 'Cross-site request blocked.' });
    expect(response.headers.get('content-security-policy')).toBeTruthy();
  });

  it('lets same-origin API writes and all API reads through', async () => {
    const write = await proxy(
      request('/api/playlists', { method: 'POST', headers: { origin: 'http://127.0.0.1:3000' } }),
    );
    expect(write.headers.get('x-middleware-next')).toBe('1');
    const read = await proxy(request('/api/playlists'));
    expect(read.headers.get('x-middleware-next')).toBe('1');
    expect(getIronSession).not.toHaveBeenCalled();
  });

  it('lets public pages through with security headers', async () => {
    const response = await proxy(request('/'));
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
  });

  it('redirects signed-out users from protected pages to the app origin', async () => {
    getIronSession.mockResolvedValue(fakeSession({ userId: '' }));
    const response = await proxy(request('/playlists/abc', { headers: { 'x-forwarded-host': 'evil.test' } }));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://127.0.0.1:3000/');
  });

  it('lets signed-in users reach protected pages', async () => {
    getIronSession.mockResolvedValue(fakeSession());
    const response = await proxy(request('/dashboard'));
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('does not treat lookalike paths as protected', async () => {
    const response = await proxy(request('/dashboards-public'));
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(getIronSession).not.toHaveBeenCalled();
  });

  it('skips static assets', () => {
    expect(config.matcher[0]).toContain('_next/static');
  });
});
