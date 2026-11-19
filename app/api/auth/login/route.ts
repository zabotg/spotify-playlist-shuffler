import { NextResponse } from 'next/server';
import { generatePkcePair, generateState } from '@/lib/auth/pkce';
import { getSession } from '@/lib/auth/session';
import { withErrorHandling } from '@/lib/http/route-handler';
import { buildAuthorizeUrl } from '@/lib/spotify/oauth';

export const GET = withErrorHandling(async () => {
  const session = await getSession();
  const { codeVerifier, codeChallenge } = generatePkcePair();
  const state = generateState();

  session.pkceVerifier = codeVerifier;
  session.oauthState = state;
  await session.save();

  return NextResponse.redirect(buildAuthorizeUrl(state, codeChallenge));
});
