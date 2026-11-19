import { getIronSession } from 'iron-session';
import { NextResponse, type NextRequest } from 'next/server';
import { getSessionOptions, isAuthenticated, type SpotifySession } from '@/lib/auth/session';
import { redirectUrl } from '@/lib/http/request-origin';
import { withSecurityHeaders } from '@/lib/http/security-headers';

const PROTECTED_PATH_PREFIXES = ['/dashboard', '/playlists'];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();
  if (!isProtectedPath(request.nextUrl.pathname)) return withSecurityHeaders(response);

  const session = await getIronSession<SpotifySession>(request, response, getSessionOptions());
  if (isAuthenticated(session)) return withSecurityHeaders(response);

  return withSecurityHeaders(NextResponse.redirect(redirectUrl('/', request)));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
