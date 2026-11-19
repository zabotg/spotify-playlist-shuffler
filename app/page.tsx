import { redirect } from 'next/navigation';
import { SpotifyIcon } from '@/components/spotify-icon';
import { Alert } from '@/components/ui/alert';
import { getLoginErrorMessage } from '@/lib/auth/login-errors';
import { getAuthenticatedSession } from '@/lib/auth/session';

interface HomePageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  if (await getAuthenticatedSession()) redirect('/dashboard');

  const errorMessage = getLoginErrorMessage((await searchParams).error);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="flex max-w-md flex-col items-center gap-8 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold tracking-tight">Spotify Playlist Shuffler</h1>
          <p className="text-lg text-zinc-400">
            Smarter shuffle modes, playlist insights and music discovery in one place.
          </p>
        </div>

        {errorMessage && (
          <div className="w-full">
            <Alert tone="error">{errorMessage}</Alert>
          </div>
        )}

        <a
          href="/api/auth/login"
          className="flex items-center gap-3 rounded-full bg-spotify px-8 py-4 font-semibold text-black transition-opacity hover:opacity-90"
        >
          <SpotifyIcon />
          Continue with Spotify
        </a>

        <p className="text-xs text-zinc-600">
          Your Spotify tokens stay in an encrypted cookie. Nothing about your account is stored.
        </p>
      </div>
    </main>
  );
}
