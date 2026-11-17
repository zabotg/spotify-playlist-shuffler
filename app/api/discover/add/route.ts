/**
 * POST /api/discover/add
 * Adds selected recommended tracks to an existing or new playlist.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { SpotifyClient, SpotifyApiError } from '@/lib/spotify/client';
import { DiscoverAddSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = DiscoverAddSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { trackUris, target, playlistId, newName } = parsed.data;
    const session = await requireSession();
    const client = await SpotifyClient.create(session);

    if (target === 'existing') {
      if (!playlistId) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', message: 'playlistId required for existing target' },
          { status: 400 }
        );
      }
      await client.addTracksToPlaylist(playlistId, trackUris);
      return NextResponse.json({
        success: true,
        playlistId,
        playlistUrl: `https://open.spotify.com/playlist/${playlistId}`,
      });
    }

    // Create a new playlist
    const userId = session.spotifyUserId!;
    const name = newName ?? 'Discovered Tracks';
    const newPlaylist = await client.createPlaylist(userId, name, 'Created by Spotify Shuffler');
    await client.addTracksToPlaylist(newPlaylist.id, trackUris);

    return NextResponse.json({
      success: true,
      playlistId: newPlaylist.id,
      playlistUrl: `https://open.spotify.com/playlist/${newPlaylist.id}`,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof SpotifyApiError) {
      if (err.status === 403) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
