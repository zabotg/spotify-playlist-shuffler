import { describe, expect, it, vi } from 'vitest';
import { appUrl, getAppOrigin } from './app-origin';
import { getEnv } from './env';
import { isAllowedPreviewUrl, PREVIEW_CSP_SOURCES } from './media-hosts';

describe('getEnv', () => {
  it('parses and caches the environment', () => {
    const env = getEnv();
    expect(env.SPOTIFY_CLIENT_ID).toBe('test-client-id');
    expect(getEnv()).toBe(env);
  });

  it('rejects an invalid environment', async () => {
    vi.resetModules();
    vi.stubEnv('SESSION_SECRET', 'too-short');
    const { getEnv: freshGetEnv } = await import('./env');
    expect(() => freshGetEnv()).toThrow();
  });
});

describe('app origin', () => {
  it('comes from the Spotify redirect URI, not from the request', () => {
    expect(getAppOrigin()).toBe('http://127.0.0.1:3000');
    expect(appUrl('/dashboard').href).toBe('http://127.0.0.1:3000/dashboard');
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
