/**
 * GET /api/auth/callback?code=...&state=...
 *
 * Spotify redirects here after user approves/denies.
 * 1. Validates state (prevents CSRF)
 * 2. Exchanges code + PKCE verifier for tokens (server-side only)
 * 3. Fetches user profile
 * 4. Stores tokens + user info in session cookie
 * 5. Redirects to dashboard
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { exchangeCodeForTokens, tokenExpiresAt } from '@/lib/spotify/oauth';
import { SpotifyClient } from '@/lib/spotify/client';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // User denied authorization
  if (error) {
    return NextResponse.redirect(`${APP_URL}/?error=access_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${APP_URL}/?error=invalid_callback`);
  }

  const session = await getSession();

  // Validate state to prevent CSRF
  if (!session.oauthState || session.oauthState !== state) {
    return NextResponse.redirect(`${APP_URL}/?error=state_mismatch`);
  }

  const codeVerifier = session.pkceVerifier;
  if (!codeVerifier) {
    return NextResponse.redirect(`${APP_URL}/?error=missing_verifier`);
  }

  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  if (!redirectUri) {
    return NextResponse.redirect(`${APP_URL}/?error=server_error`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code, codeVerifier, redirectUri);

    // Store tokens in session
    session.accessToken = tokens.access_token;
    session.refreshToken = tokens.refresh_token;
    session.accessTokenExpiresAt = tokenExpiresAt(tokens.expires_in);

    // Clear temporary PKCE fields
    session.pkceVerifier = undefined;
    session.oauthState = undefined;

    // Save partial session so SpotifyClient can use it
    await session.save();

    // Fetch user profile to cache in session
    const client = await SpotifyClient.create(session);
    const user = await client.getMe();

    session.spotifyUserId = user.id;
    session.displayName = user.display_name;
    session.email = user.email;
    session.country = user.country ?? null;
    await session.save();

    return NextResponse.redirect(`${APP_URL}/dashboard`);
  } catch (err) {
    console.error('[auth/callback] Token exchange failed:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.redirect(`${APP_URL}/?error=token_exchange_failed`);
  }
}
