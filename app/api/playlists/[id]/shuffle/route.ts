/**
 * POST /api/playlists/[id]/shuffle
 *
 * Body: ShuffleRequest
 *
 * If preview=true  → returns reordered tracks (first 20 shown), no Spotify write
 * If preview=false → applies shuffle directly to Spotify playlist
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { SpotifyClient, SpotifyApiError } from '@/lib/spotify/client';
import { ShuffleRequestSchema } from '@/lib/validation/schemas';
import { applyShuffle } from '@/lib/engines/shuffle';
import type { TrackWithFeatures } from '@/lib/engines/shuffle';
import { getDeezerDataBatch } from '@/lib/deezer/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const parsed = ShuffleRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { preview, ...options } = parsed.data;
    const session = await requireSession();
    const client = await SpotifyClient.create(session);

    // Fetch tracks + features
    const rawTracks = await client.getAllPlaylistTracks(id);
    if (rawTracks.length === 0) {
      return NextResponse.json({ error: 'EMPTY_PLAYLIST' }, { status: 422 });
    }

    const trackIds = rawTracks.map(i => i.track.id);
    const isrcs = rawTracks.map(i => i.track.external_ids?.isrc).filter(Boolean) as string[];

    const [featuresMap, deezerMap] = await Promise.all([
      client.getAllAudioFeatures(trackIds),
      getDeezerDataBatch(isrcs),
    ]);

    const tracks: TrackWithFeatures[] = rawTracks.map(item => ({
      track: item.track,
      features: featuresMap.get(item.track.id) ?? null,
      addedAt: item.added_at,
      deezer: item.track.external_ids?.isrc ? (deezerMap.get(item.track.external_ids.isrc) ?? null) : null,
    }));

    const shuffled = applyShuffle(tracks, options);

    if (preview) {
      return NextResponse.json({
        tracks: shuffled.map(t => ({ track: t.track, features: t.features, deezer: t.deezer ?? null })),
        total: shuffled.length,
      });
    }

    // Apply directly to Spotify
    const uris = shuffled.map(t => t.track.uri);
    await client.replacePlaylistTracks(id, uris);

    return NextResponse.json({ success: true, uris });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof SpotifyApiError) {
      if (err.status === 403) {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: 'Você não tem permissão para modificar esta playlist' },
          { status: 403 }
        );
      }
    }
    console.error('[shuffle] Error:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
