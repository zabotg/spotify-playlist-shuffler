import { getIronSession } from 'iron-session';
import { NextResponse, type NextRequest } from 'next/server';
import { getSessionOptions, isAuthenticated, type SpotifySession } from '@/lib/auth/session';
import { appUrl } from '@/lib/config/app-origin';
import { isSafeMethod, isSameOriginRequest } from '@/lib/http/csrf';
import { withSecurityHeaders } from '@/lib/http/security-headers';

const PROTECTED_PAGE_PREFIXES = ['/dashboard', '/playlists'];

function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isCrossSiteApiWrite(request: NextRequest): boolean {
  return (
    request.nextUrl.pathname.startsWith('/api/') && !isSafeMethod(request.method) && !isSameOriginRequest(request)
  );
}

/** Runs before every request: CSRF guard for API writes, auth guard for pages, security headers. */
export async function proxy(request: NextRequest) {
  if (isCrossSiteApiWrite(request)) {
    return withSecurityHeaders(
      NextResponse.json({ error: 'FORBIDDEN', message: 'Cross-site request blocked.' }, { status: 403 }),
    );
  }

  const response = NextResponse.next();
  if (!isProtectedPage(request.nextUrl.pathname)) return withSecurityHeaders(response);

  const session = await getIronSession<SpotifySession>(request, response, getSessionOptions());
  if (isAuthenticated(session)) return withSecurityHeaders(response);

  return withSecurityHeaders(NextResponse.redirect(appUrl('/')));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
