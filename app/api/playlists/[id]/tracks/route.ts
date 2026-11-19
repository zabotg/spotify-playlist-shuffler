import { NextResponse } from 'next/server';
import { parseJsonBody, withPlaylist } from '@/lib/http/route-handler';
import { addTracks, loadEnrichedTracks, replacePlaylistOrder } from '@/lib/services/playlist-service';
import { trackUrisRequestSchema } from '@/lib/validation/schemas';

export const GET = withPlaylist(async ({ client, session, playlistId }) => {
  const currentUser = { id: session.userId, displayName: session.displayName };
  return NextResponse.json(await loadEnrichedTracks(client, playlistId, currentUser));
});

export const PUT = withPlaylist(async ({ request, client, playlistId }) => {
  const { uris } = await parseJsonBody(request, trackUrisRequestSchema);
  return NextResponse.json(await replacePlaylistOrder(client, playlistId, uris));
});

export const POST = withPlaylist(async ({ request, client, playlistId }) => {
  const { uris } = await parseJsonBody(request, trackUrisRequestSchema);
  return NextResponse.json(await addTracks(client, playlistId, uris));
});
