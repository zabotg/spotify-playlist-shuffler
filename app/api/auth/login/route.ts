/**
 * GET /api/auth/login
 *
 * Initiates Spotify OAuth with PKCE:
 * 1. Generates code_verifier + code_challenge + random state
 * 2. Stores verifier + state in encrypted session cookie (temporary)
 * 3. Redirects user to Spotify /authorize
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { generatePKCE, generateState } from '@/lib/auth/pkce';
import { SPOTIFY_SCOPES } from '@/lib/spotify/oauth';

export async function GET(request: NextRequest) {
  const session = await getSession();

  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = generateState();

  // Persist PKCE verifier + state in the encrypted session cookie.
  // These will be validated in /api/auth/callback.
  session.pkceVerifier = codeVerifier;
  session.oauthState = state;
  await session.save();

  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  const clientId = process.env.SPOTIFY_CLIENT_ID;

  if (!redirectUri || !clientId) {
    return NextResponse.json(
      { error: 'SERVER_MISCONFIGURED', message: 'Missing Spotify configuration' },
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SPOTIFY_SCOPES,
    redirect_uri: redirectUri,
    state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  });

  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params}`);
}
