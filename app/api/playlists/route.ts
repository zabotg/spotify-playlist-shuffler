/**
 * GET /api/playlists
 * Returns all of the authenticated user's playlists.
 */

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { SpotifyClient, SpotifyApiError } from '@/lib/spotify/client';

export async function GET() {
  try {
    const session = await requireSession();
    const client = await SpotifyClient.create(session);
    const playlists = await client.getAllPlaylists();
    return NextResponse.json({ playlists });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof SpotifyApiError) {
      if (err.status === 401) {
        return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Session expired' }, { status: 401 });
      }
      return NextResponse.json({ error: 'SPOTIFY_ERROR', message: 'Spotify API error' }, { status: 502 });
    }
    console.error('[playlists] Unexpected error:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Internal error' }, { status: 500 });
  }
}
