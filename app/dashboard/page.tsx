import { redirect } from 'next/navigation';
import { getAuthenticatedSession } from '@/lib/auth/session';
import { PlaylistGrid } from './playlist-grid';

export default async function DashboardPage() {
  const session = await getAuthenticatedSession();
  if (!session) redirect('/');

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Hi, {session.displayName ?? 'there'}</h1>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="text-sm text-zinc-400 transition-colors hover:text-white">
              Sign out
            </button>
          </form>
        </header>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Your playlists</h2>
          <PlaylistGrid />
        </section>
      </div>
    </main>
  );
}
