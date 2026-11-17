import { redirect } from 'next/navigation';
import { getAuthenticatedSession } from '@/lib/auth/session';
import { SpotifyClient } from '@/lib/spotify/client';
import type { SpotifyPlaylist } from '@/types';

export default async function DashboardPage() {
  const session = await getAuthenticatedSession();
  if (!session) redirect('/');

  let playlists: SpotifyPlaylist[] = [];
  try {
    const client = await SpotifyClient.create(session);
    const all = await client.getAllPlaylists();
    playlists = all.filter(p => p.owner.id === session.spotifyUserId);
  } catch {
    // token refresh failed — kick back to login
    redirect('/');
  }

  return (
    <main className="min-h-screen bg-black text-white px-6 py-8">
      <div className="max-w-5xl mx-auto flex flex-col gap-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Olá, {session.displayName ?? 'usuário'}</h1>
            <p className="text-zinc-400 text-sm mt-1">{playlists.length} playlists</p>
          </div>
          <a
            href="/api/auth/logout"
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Sair
          </a>
        </header>

        <section>
          <h2 className="text-lg font-semibold mb-4">Suas playlists</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {playlists.map((playlist) => (
              <a
                key={playlist.id}
                href={`/playlists/${playlist.id}`}
                className="group flex flex-col gap-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 p-3 transition-colors"
              >
                {playlist.images[0] ? (
                  <img
                    src={playlist.images[0].url}
                    alt={playlist.name}
                    className="w-full aspect-square object-cover rounded"
                  />
                ) : (
                  <div className="w-full aspect-square rounded bg-zinc-700 flex items-center justify-center">
                    <span className="text-zinc-500 text-3xl">♪</span>
                  </div>
                )}
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium leading-tight line-clamp-2 group-hover:text-white">
                    {playlist.name}
                  </span>
                  <span className="text-xs text-zinc-500">{playlist.tracks.total} músicas</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
