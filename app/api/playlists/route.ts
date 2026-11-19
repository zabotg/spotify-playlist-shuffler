import { NextResponse } from 'next/server';
import { parseJsonBody, withErrorHandling } from '@/lib/http/route-handler';
import { createPlaylistWithTracks, getEditablePlaylists } from '@/lib/services/playlist-service';
import { getSpotifyContext } from '@/lib/services/spotify-context';
import { createPlaylistRequestSchema } from '@/lib/validation/schemas';

const CREATED = 201;

export const GET = withErrorHandling(async () => {
  const { client, session } = await getSpotifyContext();
  return NextResponse.json({ playlists: await getEditablePlaylists(client, session.userId) });
});

export const POST = withErrorHandling(async (request) => {
  const { client } = await getSpotifyContext();
  const { name, uris } = await parseJsonBody(request, createPlaylistRequestSchema);
  return NextResponse.json(await createPlaylistWithTracks(client, name, uris), { status: CREATED });
});
