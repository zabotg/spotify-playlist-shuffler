import { describe, expect, it, vi } from 'vitest';
import { appUrl, getAppOrigin, isOtherLocalHost } from '@/lib/config/app-origin';
import { getEnv } from '@/lib/config/env';
import { isAllowedPreviewUrl, PREVIEW_CSP_SOURCES } from '@/lib/config/media-hosts';

describe('getEnv', () => {
  it('parses and caches the environment', () => {
    const env = getEnv();
    expect(env.SPOTIFY_CLIENT_ID).toBe('test-client-id');
    expect(getEnv()).toBe(env);
  });

  it('rejects an invalid environment', async () => {
    vi.resetModules();
    vi.stubEnv('SESSION_SECRET', 'too-short');
    const { getEnv: freshGetEnv } = await import('@/lib/config/env');
    expect(() => freshGetEnv()).toThrow();
  });
});

describe('app origin', () => {
  it('comes from the Spotify redirect URI, not from the request', () => {
    expect(getAppOrigin()).toBe('http://127.0.0.1:3000');
    expect(appUrl('/dashboard').href).toBe('http://127.0.0.1:3000/dashboard');
  });

  it('flags other names for this machine, but never the configured host or non-local hosts', () => {
    expect(isOtherLocalHost('localhost:3000')).toBe(true);
    expect(isOtherLocalHost('[::1]:3000')).toBe(true);
    expect(isOtherLocalHost('127.0.0.1:3000')).toBe(false);
    expect(isOtherLocalHost('app-container:3000')).toBe(false);
    expect(isOtherLocalHost(null)).toBe(false);
  });

  it('never flags anything when the app is not served from this machine', async () => {
    vi.resetModules();
    vi.stubEnv('SPOTIFY_REDIRECT_URI', 'https://shuffler.example.com/api/auth/callback');
    const { isOtherLocalHost: check } = await import('@/lib/config/app-origin');
    expect(check('localhost:3000')).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe('isAllowedPreviewUrl', () => {
  it.each([
    'https://cdnt-preview.dzcdn.net/api/1/preview.mp3?hdnea=exp=1',
    'https://audio-ssl.itunes.apple.com/itunes-assets/preview.m4a',
    'https://a1.mzstatic.com/preview.m4a',
  ])('accepts %s', (url) => {
    expect(isAllowedPreviewUrl(url)).toBe(true);
  });

  it.each([
    'http://cdnt-preview.dzcdn.net/preview.mp3',
    'https://evil.com/preview.mp3',
    'https://dzcdn.net.evil.com/preview.mp3',
    'https://evildzcdn.net/preview.mp3',
    'https://user:pass@cdnt-preview.dzcdn.net/preview.mp3',
    'https://cdnt-preview.dzcdn.net:8443/preview.mp3',
    'javascript:alert(1)',
    'not a url',
  ])('rejects %s', (url) => {
    expect(isAllowedPreviewUrl(url)).toBe(false);
  });

  it('exposes matching CSP sources', () => {
    expect(PREVIEW_CSP_SOURCES).toContain('https://*.dzcdn.net');
  });
});
