import { describe, expect, it, vi } from 'vitest';
import { isSafeMethod, isSameOriginRequest } from '@/lib/http/csrf';
import { HttpError } from '@/lib/http/errors';
import { withSecurityHeaders } from '@/lib/http/security-headers';

const request = (headers: Record<string, string>) =>
  new Request('http://127.0.0.1:3000/api/playlists', { method: 'POST', headers });

describe('csrf', () => {
  it('treats only read methods as safe', () => {
    expect(isSafeMethod('get')).toBe(true);
    expect(isSafeMethod('HEAD')).toBe(true);
    expect(isSafeMethod('OPTIONS')).toBe(true);
    expect(isSafeMethod('POST')).toBe(false);
    expect(isSafeMethod('PUT')).toBe(false);
  });

  it('accepts the app origin and rejects any other origin', () => {
    expect(isSameOriginRequest(request({ origin: 'http://127.0.0.1:3000' }))).toBe(true);
    expect(isSameOriginRequest(request({ origin: 'http://127.0.0.1:4000' }))).toBe(false);
    expect(isSameOriginRequest(request({ origin: 'null' }))).toBe(false);
  });

  it('falls back to Sec-Fetch-Site and rejects requests with neither header', () => {
    expect(isSameOriginRequest(request({ 'sec-fetch-site': 'same-origin' }))).toBe(true);
    expect(isSameOriginRequest(request({ 'sec-fetch-site': 'same-site' }))).toBe(false);
    expect(isSameOriginRequest(request({}))).toBe(false);
  });
});

describe('security headers', () => {
  it('adds a strict CSP and isolation headers', () => {
    const response = withSecurityHeaders(new Response('ok'));
    const csp = response.headers.get('content-security-policy');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain('media-src https://*.dzcdn.net');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('cross-origin-opener-policy')).toBe('same-origin');
    expect(response.headers.get('strict-transport-security')).toBeNull();
  });

  it('adds HSTS and upgrade-insecure-requests in production', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    const { withSecurityHeaders: productionHeaders } = await import('@/lib/http/security-headers');
    const response = productionHeaders(new Response('ok'));
    expect(response.headers.get('strict-transport-security')).toContain('max-age=');
    expect(response.headers.get('content-security-policy')).toContain('upgrade-insecure-requests');
    expect(response.headers.get('content-security-policy')).not.toContain('unsafe-eval');
  });
});

describe('HttpError', () => {
  it('keeps the status and code', () => {
    const error = new HttpError(409, 'CONFLICT', 'Nope');
    expect(error).toMatchObject({ status: 409, code: 'CONFLICT', message: 'Nope', name: 'HttpError' });
  });
});
