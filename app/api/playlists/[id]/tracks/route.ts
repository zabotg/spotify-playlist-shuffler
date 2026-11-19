import { NextResponse } from 'next/server';
import { parseJsonBody, withErrorHandling, type PlaylistRouteContext } from '@/lib/http/route-handler';
import { addTracks, replacePlaylistOrder } from '@/lib/services/playlist-service';
import { getSpotifyContext } from '@/lib/services/spotify-context';
import { trackUrisRequestSchema } from '@/lib/validation/schemas';

export const PUT = withErrorHandling(async (request, { params }: PlaylistRouteContext) => {
  const { id } = await params;
  const { client } = await getSpotifyContext();
  const { uris } = await parseJsonBody(request, trackUrisRequestSchema);
  return NextResponse.json(await replacePlaylistOrder(client, id, uris));
});

export const POST = withErrorHandling(async (request, { params }: PlaylistRouteContext) => {
  const { id } = await params;
  const { client } = await getSpotifyContext();
  const { uris } = await parseJsonBody(request, trackUrisRequestSchema);
  return NextResponse.json(await addTracks(client, id, uris));
});
