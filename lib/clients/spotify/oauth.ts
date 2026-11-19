import { getEnv } from '@/lib/config/env';
import { SpotifyApiError } from '@/lib/clients/spotify/errors';

const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

const SPOTIFY_SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
].join(' ');

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export function buildAuthorizeUrl(state: string, codeChallenge: string): string {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URI } = getEnv();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: SPOTIFY_SCOPES,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  });
  return `${SPOTIFY_AUTHORIZE_URL}?${params}`;
}

export function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<TokenResponse> {
  return requestToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getEnv().SPOTIFY_REDIRECT_URI,
    code_verifier: codeVerifier,
  });
}

export function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return requestToken({ grant_type: 'refresh_token', refresh_token: refreshToken });
}

async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = getEnv();
  const credentials = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams(params),
    cache: 'no-store',
  });

  if (!response.ok) throw new SpotifyApiError(response.status, await response.text());
  return response.json() as Promise<TokenResponse>;
}
