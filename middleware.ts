/**
 * Next.js middleware — runs on every matched request.
 *
 * Responsibilities:
 * 1. Auth guard: redirect unauthenticated users from /dashboard and /playlists
 * 2. Security headers: CSP, HSTS, X-Frame-Options, etc.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import type { SpotifySession } from '@/lib/auth/session';

const PROTECTED_PATHS = ['/dashboard', '/playlists'];

const SESSION_OPTIONS = {
  cookieName: 'sp_session',
  password: process.env.SESSION_SECRET ?? '',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  },
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // ── Security Headers ────────────────────────────────────────────────────
  const isProduction = process.env.NODE_ENV === 'production';
  // Next.js App Router streams the RSC payload via inline <script> tags
  // (self.__next_f=...). Without 'unsafe-inline', those scripts are blocked
  // by CSP and React never hydrates — so no buttons work.
  // 'unsafe-eval' is additionally required for Turbopack dev HMR.
  const scriptSrc = isProduction
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
  const csp = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",  // Tailwind needs inline styles
    "img-src 'self' https://*.scdn.co https://*.spotifycdn.com data:",
    "connect-src 'self' https://api.deezer.com",
    "media-src https:",
    "font-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (isProduction) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // ── Auth Guard ──────────────────────────────────────────────────────────
  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p));
  if (!isProtected) return response;

  if (!process.env.SESSION_SECRET) return response; // skip during build

  try {
    const session = await getIronSession<SpotifySession>(request, response, SESSION_OPTIONS);
    if (!session.accessToken || !session.spotifyUserId) {
      const loginUrl = new URL('/', request.url);
      return NextResponse.redirect(loginUrl);
    }
  } catch {
    const loginUrl = new URL('/', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Apply to all routes except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
