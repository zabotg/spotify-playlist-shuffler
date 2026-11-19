import { NextResponse } from 'next/server';
import { canEditPlaylist } from '@/lib/domain/models/playlist';
import { withPlaylist } from '@/lib/http/route-handler';

export const GET = withPlaylist(async ({ client, session, playlistId }) => {
  const playlist = await client.getPlaylist(playlistId);
  return NextResponse.json({ playlist, canEdit: canEditPlaylist(playlist, session.userId) });
});
