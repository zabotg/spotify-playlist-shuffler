/**
 * Landing page — shown to unauthenticated users.
 * Authenticated users are redirected to /dashboard by middleware.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import type { SpotifySession } from '@/lib/auth/session';

const SESSION_OPTIONS = {
  cookieName: 'sp_session',
  password: process.env.SESSION_SECRET ?? '',
  cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' },
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // If already logged in, skip straight to dashboard
  if (process.env.SESSION_SECRET) {
    const session = await getIronSession<SpotifySession>(await cookies(), SESSION_OPTIONS);
    if (session.accessToken && session.spotifyUserId) {
      redirect('/dashboard');
    }
  }

  const { error } = await searchParams;

  const errorMessages: Record<string, string> = {
    access_denied: 'You cancelled the Spotify login.',
    state_mismatch: 'Security check failed. Please try again.',
    token_exchange_failed: 'Could not connect to Spotify. Please try again.',
    invalid_callback: 'Invalid login attempt.',
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white px-6">
      <div className="flex flex-col items-center gap-8 max-w-md text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold tracking-tight">Spotify Shuffler</h1>
          <p className="text-zinc-400 text-lg">
            Smarter shuffle modes, deep playlist insights, and music discovery — all in one place.
          </p>
        </div>

        {error && errorMessages[error] && (
          <div className="w-full rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-300">
            {errorMessages[error]}
          </div>
        )}

        <a
          href="/api/auth/login"
          className="flex items-center gap-3 rounded-full bg-[#1DB954] px-8 py-4 text-base font-semibold text-black transition-opacity hover:opacity-90"
        >
          <SpotifyIcon />
          Continue with Spotify
        </a>

        <p className="text-xs text-zinc-600">
          We never store your Spotify credentials or listening history.
          Your session is encrypted and lives only in your browser.
        </p>
      </div>
    </main>
  );
}

function SpotifyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}
