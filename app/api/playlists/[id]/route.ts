import { NextResponse } from 'next/server';
import { canEditPlaylist } from '@/lib/domain/playlist';
import { withErrorHandling, type PlaylistRouteContext } from '@/lib/http/route-handler';
import { getSpotifyContext } from '@/lib/services/spotify-context';

export const GET = withErrorHandling(async (_request, { params }: PlaylistRouteContext) => {
  const { id } = await params;
  const { client, session } = await getSpotifyContext();
  const playlist = await client.getPlaylist(id);
  return NextResponse.json({ playlist, canEdit: canEditPlaylist(playlist, session.userId) });
});
