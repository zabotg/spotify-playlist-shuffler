import { NextResponse, type NextRequest } from 'next/server';
import { generatePkcePair, generateState } from '@/lib/auth/pkce';
import { getSession } from '@/lib/auth/session';
import { buildAuthorizeUrl } from '@/lib/clients/spotify/oauth';
import { appUrl, isOtherLocalHost } from '@/lib/config/app-origin';
import { withErrorHandling } from '@/lib/http/route-handler';

export const GET = withErrorHandling(async (request: NextRequest) => {
  // The session cookie is bound to the host it was set on, so the login has to start on the
  // host Spotify redirects back to (e.g. 127.0.0.1, not localhost). The redirect target is the
  // configured origin, never a value taken from the request.
  if (isOtherLocalHost(request.headers.get('host'))) {
    return NextResponse.redirect(appUrl('/api/auth/login'));
  }

  const session = await getSession();
  const { codeVerifier, codeChallenge } = generatePkcePair();
  const state = generateState();

  session.pkceVerifier = codeVerifier;
  session.oauthState = state;
  await session.save();

  return NextResponse.redirect(buildAuthorizeUrl(state, codeChallenge));
});
