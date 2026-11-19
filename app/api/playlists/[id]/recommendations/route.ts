import { NextResponse } from 'next/server';
import { parseSearchParams, withErrorHandling, type PlaylistRouteContext } from '@/lib/http/route-handler';
import { recommendTracks } from '@/lib/services/playlist-service';
import { getSpotifyContext } from '@/lib/services/spotify-context';
import { recommendationsQuerySchema } from '@/lib/validation/schemas';

export const GET = withErrorHandling(async (request, { params }: PlaylistRouteContext) => {
  const { id } = await params;
  const { client } = await getSpotifyContext();
  const { count } = parseSearchParams(request, recommendationsQuerySchema);
  return NextResponse.json({ tracks: await recommendTracks(client, id, count) });
});
