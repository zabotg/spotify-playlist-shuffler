/**
 * Spotify OAuth token exchange and refresh.
 * All calls happen server-side. Tokens never touch the browser.
 */

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

export const SPOTIFY_SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-read-private',
  'user-read-email',
  'user-top-read',
].join(' ');

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  scope: string;
  token_type: 'Bearer';
}

interface RefreshResponse {
  access_token: string;
  refresh_token?: string; // Spotify may or may not rotate it
  expires_in: number;
  scope: string;
  token_type: 'Bearer';
}

function getClientCredentials(): string {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET');
  return Buffer.from(`${id}:${secret}`).toString('base64');
}

/** Exchange authorization code + PKCE verifier for tokens. */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${getClientCredentials()}`,
    },
    body,
    // Never cache token requests
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${err}`);
  }

  return res.json() as Promise<TokenResponse>;
}

/** Refresh an expired access token. Returns new tokens. */
export async function refreshAccessToken(
  refreshToken: string
): Promise<RefreshResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${getClientCredentials()}`,
    },
    body,
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${err}`);
  }

  return res.json() as Promise<RefreshResponse>;
}

/** Millisecond timestamp when the access token expires. */
export function tokenExpiresAt(expiresIn: number): number {
  return Date.now() + expiresIn * 1000;
}
