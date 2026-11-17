import { redirect } from 'next/navigation';
import { getAuthenticatedSession } from '@/lib/auth/session';
import { SpotifyClient } from '@/lib/spotify/client';
import PlaylistView from './playlist-view';

export default async function PlaylistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getAuthenticatedSession();
  if (!session) redirect('/');

  let playlist;
  try {
    const client = await SpotifyClient.create(session);
    playlist = await client.getPlaylist(id);
  } catch {
    redirect('/dashboard');
  }

  return <PlaylistView playlist={playlist} userId={session.spotifyUserId!} />;
}
