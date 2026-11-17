/**
 * GET /api/playlists/[id]/insights
 *
 * Fetches all tracks + audio features, runs the insights engine,
 * and returns the full analysis. No caching — always fresh from Spotify.
 *
 * For large playlists this can take a few seconds; the client should
 * show a loading state.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { SpotifyClient, SpotifyApiError } from '@/lib/spotify/client';
import { computeInsights } from '@/lib/engines/insights';
import type { TrackWithFeatures } from '@/lib/engines/shuffle';
import { getDeezerDataBatch } from '@/lib/deezer/client';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const client = await SpotifyClient.create(session);

    // Fetch all tracks (handles pagination internally)
    const rawTracks = await client.getAllPlaylistTracks(id);

    if (rawTracks.length === 0) {
      return NextResponse.json({
        insights: null,
        tracks: [],
        message: 'Playlist is empty or contains only local/unavailable tracks',
      });
    }

    // Batch-fetch audio features + Deezer BPM in parallel
    const trackIds = rawTracks.map(i => i.track.id).filter(Boolean);
    const isrcs = rawTracks.map(i => i.track.external_ids?.isrc).filter(Boolean) as string[];

    const [featuresMap, deezerMap] = await Promise.all([
      client.getAllAudioFeatures(trackIds),
      getDeezerDataBatch(isrcs),
    ]);

    // Build TrackWithFeatures array
    const tracks: TrackWithFeatures[] = rawTracks.map(item => ({
      track: item.track,
      features: featuresMap.get(item.track.id) ?? null,
      addedAt: item.added_at,
      deezer: item.track.external_ids?.isrc ? (deezerMap.get(item.track.external_ids.isrc) ?? null) : null,
    }));


    // Fetch artist details for genre inference (top 20 unique artists only)
    const topArtistIds = [
      ...new Set(
        rawTracks
          .map(i => i.track.artists[0]?.id)
          .filter((id): id is string => !!id)
      ),
    ].slice(0, 20);

    const artistDetails = topArtistIds.length > 0
      ? await client.getArtistsBatch(topArtistIds)
      : [];

    const insights = computeInsights(tracks, artistDetails);

    return NextResponse.json({ insights, tracks });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof SpotifyApiError) {
      if (err.status === 404) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
      if (err.status === 401) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      return NextResponse.json({ error: 'SPOTIFY_ERROR' }, { status: 502 });
    }
    console.error('[insights] Error:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
