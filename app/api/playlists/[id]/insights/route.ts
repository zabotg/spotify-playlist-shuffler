import { NextResponse } from 'next/server';
import { withErrorHandling, type PlaylistRouteContext } from '@/lib/http/route-handler';
import { getPlaylistInsights } from '@/lib/services/playlist-service';
import { getSpotifyContext } from '@/lib/services/spotify-context';

export const GET = withErrorHandling(async (_request, { params }: PlaylistRouteContext) => {
  const { id } = await params;
  const { client } = await getSpotifyContext();
  return NextResponse.json({ insights: await getPlaylistInsights(client, id) });
});
