import { describe, expect, it } from 'vitest';
import { jsonResponse, mockFetch } from '@/test/fakes';
import { SpotifyApiError } from '@/lib/clients/spotify/errors';
import { buildAuthorizeUrl, exchangeCodeForTokens, refreshAccessToken } from '@/lib/clients/spotify/oauth';

describe('Spotify OAuth', () => {
  it('builds the authorize URL with PKCE and state', () => {
    const url = new URL(buildAuthorizeUrl('state-1', 'challenge-1'));
    expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: 'code',
      client_id: 'test-client-id',
      redirect_uri: 'http://127.0.0.1:3000/api/auth/callback',
      state: 'state-1',
      code_challenge_method: 'S256',
      code_challenge: 'challenge-1',
    });
    expect(url.searchParams.get('scope')).toContain('playlist-modify-private');
  });

  it('exchanges the code with basic auth and the verifier, without retrying', async () => {
    const fetchMock = mockFetch(jsonResponse({ access_token: 'a', refresh_token: 'r', expires_in: 3600 }));
    expect(await exchangeCodeForTokens('code-1', 'verifier-1')).toMatchObject({ access_token: 'a' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://accounts.spotify.com/api/token');
    expect(init?.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from('test-client-id:test-client-secret').toString('base64')}`,
    });
    expect(Object.fromEntries(init?.body as URLSearchParams)).toEqual({
      grant_type: 'authorization_code',
      code: 'code-1',
      redirect_uri: 'http://127.0.0.1:3000/api/auth/callback',
      code_verifier: 'verifier-1',
    });
  });

  it('refreshes tokens and reports failures as SpotifyApiError', async () => {
    const fetchMock = mockFetch(jsonResponse({ access_token: 'b', expires_in: 3600 }), new Response('', { status: 503 }));
    expect(await refreshAccessToken('r1')).toMatchObject({ access_token: 'b' });
    expect(Object.fromEntries(fetchMock.mock.calls[0][1]?.body as URLSearchParams)).toEqual({
      grant_type: 'refresh_token',
      refresh_token: 'r1',
    });
    await expect(refreshAccessToken('r1')).rejects.toBeInstanceOf(SpotifyApiError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
