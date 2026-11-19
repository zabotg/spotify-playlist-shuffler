import { NextResponse } from 'next/server';
import { parseJsonBody, withSpotify } from '@/lib/http/route-handler';
import { createPlaylistWithTracks, getEditablePlaylists } from '@/lib/services/playlist-service';
import { createPlaylistRequestSchema } from '@/lib/validation/schemas';

const CREATED = 201;

export const GET = withSpotify(async ({ client, session }) =>
  NextResponse.json({ playlists: await getEditablePlaylists(client, session.userId) }),
);

export const POST = withSpotify(async ({ request, client }) => {
  const { name, uris } = await parseJsonBody(request, createPlaylistRequestSchema);
  return NextResponse.json(await createPlaylistWithTracks(client, name, uris), { status: CREATED });
});
