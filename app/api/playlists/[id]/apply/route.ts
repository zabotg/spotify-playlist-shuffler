/**
 * POST /api/playlists/[id]/apply
 *
 * Applies a final ordered URI list to Spotify.
 * target=overwrite → replaces tracks in the original playlist
 * target=new       → creates a new playlist and adds the tracks
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { SpotifyClient, SpotifyApiError } from '@/lib/spotify/client';
import { ApplyRequestSchema } from '@/lib/validation/schemas';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const parsed = ApplyRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { uris, target, newName } = parsed.data;
    const session = await requireSession();
    const client = await SpotifyClient.create(session);

    if (target === 'overwrite') {
      await client.replacePlaylistTracks(id, uris);
      return NextResponse.json({
        success: true,
        playlistId: id,
        playlistUrl: `https://open.spotify.com/playlist/${id}`,
      });
    }

    // Create new playlist
    const userId = session.spotifyUserId!;
    const name = newName ?? 'Shuffled Playlist';
    const newPlaylist = await client.createPlaylist(userId, name, `Created by Spotify Shuffler`);
    await client.addTracksToPlaylist(newPlaylist.id, uris);

    return NextResponse.json({
      success: true,
      playlistId: newPlaylist.id,
      playlistUrl: `https://open.spotify.com/playlist/${newPlaylist.id}`,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof SpotifyApiError) {
      if (err.status === 403) {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: 'You do not own this playlist' },
          { status: 403 }
        );
      }
    }
    console.error('[apply] Error:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
