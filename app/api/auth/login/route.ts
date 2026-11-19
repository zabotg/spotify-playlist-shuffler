import { NextResponse, type NextRequest } from 'next/server';
import { generatePkcePair, generateState } from '@/lib/auth/pkce';
import { getSession } from '@/lib/auth/session';
import { getEnv } from '@/lib/config/env';
import { getRequestOrigin } from '@/lib/http/request-origin';
import { withErrorHandling } from '@/lib/http/route-handler';
import { buildAuthorizeUrl } from '@/lib/clients/spotify/oauth';

export const GET = withErrorHandling(async (request: NextRequest) => {
  // The session cookie is bound to the host it was set on, so the login must start on the
  // same host Spotify will redirect back to (e.g. 127.0.0.1 vs localhost), or the callback
  // won't see the stored state and PKCE verifier.
  const callbackOrigin = new URL(getEnv().SPOTIFY_REDIRECT_URI).origin;
  if (getRequestOrigin(request) !== callbackOrigin) {
    return NextResponse.redirect(new URL(request.nextUrl.pathname, callbackOrigin));
  }

  const session = await getSession();
  const { codeVerifier, codeChallenge } = generatePkcePair();
  const state = generateState();

  session.pkceVerifier = codeVerifier;
  session.oauthState = state;
  await session.save();

  return NextResponse.redirect(buildAuthorizeUrl(state, codeChallenge));
});
