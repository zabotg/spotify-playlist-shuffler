import { NextResponse } from 'next/server';
import { parseJsonBody, withErrorHandling, type PlaylistRouteContext } from '@/lib/http/route-handler';
import { shufflePlaylist } from '@/lib/services/playlist-service';
import { getSpotifyContext } from '@/lib/services/spotify-context';
import { shuffleRequestSchema } from '@/lib/validation/schemas';

export const POST = withErrorHandling(async (request, { params }: PlaylistRouteContext) => {
  const { id } = await params;
  const { client } = await getSpotifyContext();
  const options = await parseJsonBody(request, shuffleRequestSchema);
  return NextResponse.json({ tracks: await shufflePlaylist(client, id, options) });
});
