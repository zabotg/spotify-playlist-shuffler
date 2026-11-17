/**
 * GET /api/playlists/[id]
 * Returns a single playlist's metadata.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { SpotifyClient, SpotifyApiError } from '@/lib/spotify/client';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const client = await SpotifyClient.create(session);
    const playlist = await client.getPlaylist(id);
    return NextResponse.json({ playlist });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof SpotifyApiError) {
      if (err.status === 404) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
      if (err.status === 401) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
