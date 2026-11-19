import { NextResponse, type NextRequest } from 'next/server';
import type { LoginError } from '@/lib/auth/login-errors';
import { applyTokens, getSession } from '@/lib/auth/session';
import { SpotifyClient } from '@/lib/spotify/client';
import { exchangeCodeForTokens } from '@/lib/spotify/oauth';

export async function GET(request: NextRequest) {
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url));
  const failWith = (error: LoginError) => redirectTo(`/?error=${error}`);

  const { searchParams } = request.nextUrl;
  if (searchParams.has('error')) return failWith('access_denied');

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  if (!code || !state) return failWith('invalid_callback');

  const session = await getSession();
  const { pkceVerifier, oauthState } = session;
  session.pkceVerifier = undefined;
  session.oauthState = undefined;

  if (!pkceVerifier || state !== oauthState) {
    await session.save();
    return failWith('state_mismatch');
  }

  try {
    const tokens = await exchangeCodeForTokens(code, pkceVerifier);
    const user = await SpotifyClient.withAccessToken(tokens.access_token).getCurrentUser();
    applyTokens(session, tokens);
    session.userId = user.id;
    session.displayName = user.displayName ?? undefined;
    await session.save();
    return redirectTo('/dashboard');
  } catch (error) {
    console.error('[auth/callback] Login failed', error);
    return failWith('token_exchange_failed');
  }
}
