import { LogOut } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BrandMark } from '@/components/ui/brand-mark';
import { getAuthenticatedSession } from '@/lib/auth/session';
import { PlaylistGrid } from './playlist-grid';

export const metadata: Metadata = { title: 'Your playlists' };

export default async function DashboardPage() {
  const session = await getAuthenticatedSession();
  if (!session) redirect('/');

  const name = session.displayName ?? 'there';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-900">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/dashboard" aria-label="Playlist Shuffler, home" className="rounded-lg">
            <BrandMark />
          </Link>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="hidden min-w-0 items-center gap-2 text-sm text-zinc-300 sm:flex">
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-200"
              >
                {name.charAt(0).toUpperCase()}
              </span>
              <span className="max-w-48 truncate">{session.displayName ?? 'Signed in'}</span>
            </span>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-zinc-800 px-4 text-sm font-medium text-zinc-300 transition-colors duration-150 hover:border-zinc-600 hover:bg-zinc-900 hover:text-white"
              >
                <LogOut aria-hidden className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Hi, {name}</h1>
          <p className="text-base text-zinc-400">Pick a playlist to shuffle, explore or add new songs to.</p>
        </div>

        <section aria-labelledby="playlists-heading" className="flex flex-col gap-4">
          <h2 id="playlists-heading" className="text-lg font-semibold text-white">
            Your playlists
          </h2>
          <PlaylistGrid />
        </section>
      </main>
    </div>
  );
}
