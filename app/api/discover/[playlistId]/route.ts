/**
 * GET /api/discover/[playlistId]?count=20
 *
 * Generates track recommendations based on playlist characteristics.
 * Primary: Spotify /recommendations (requires extended API access)
 * Fallback: top tracks from the playlist's top artists
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { SpotifyClient, SpotifyApiError } from '@/lib/spotify/client';
import { DiscoverQuerySchema } from '@/lib/validation/schemas';
import { computeInsights } from '@/lib/engines/insights';
import { buildSeeds, buildTargetFeatures, filterRecommendations } from '@/lib/engines/discovery';
import type { SpotifyTrack } from '@/types';
import type { TrackWithFeatures } from '@/lib/engines/shuffle';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  try {
    const { playlistId } = await params;
    const query = DiscoverQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    if (!query.success) {
      return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const session = await requireSession();
    const client = await SpotifyClient.create(session);

    const rawTracks = await client.getAllPlaylistTracks(playlistId);
    if (rawTracks.length === 0) {
      return NextResponse.json({ tracks: [], message: 'Empty playlist' });
    }

    const trackIds = rawTracks.map(i => i.track.id);
    const featuresMap = await client.getAllAudioFeatures(trackIds);

    const tracks: TrackWithFeatures[] = rawTracks.map(item => ({
      track: item.track,
      features: featuresMap.get(item.track.id) ?? null,
      addedAt: item.added_at,
    }));

    const topArtistIds = [...new Set(
      rawTracks.map(i => i.track.artists[0]?.id).filter(Boolean) as string[]
    )].slice(0, 20);
    const artistDetails = topArtistIds.length > 0 ? await client.getArtistsBatch(topArtistIds) : [];

    const insights = computeInsights(tracks, artistDetails);
    const existingIds = new Set(rawTracks.map(i => i.track.id));
    const market = session.country ?? undefined;

    // Try /recommendations first; fall back to artist top-tracks if restricted
    let discovered: SpotifyTrack[] = [];
    try {
      const seeds = buildSeeds(insights, tracks);
      const targets = buildTargetFeatures(insights);
      const recs = await client.getRecommendations({
        ...seeds,
        ...targets,
        limit: Math.min(query.data.count * 2, 100),
        market,
      });
      discovered = filterRecommendations(recs.tracks, existingIds, session.country);
    } catch (recErr) {
      if (!(recErr instanceof SpotifyApiError)) throw recErr;
      console.warn(`[discover] /recommendations failed (${recErr.status}), using artist top-tracks fallback`);

      // Fallback: top tracks from the top 5 artists not already in the playlist
      const fallbackArtistIds = insights.topArtists.slice(0, 5).map(a => a.id);
      const results = await Promise.all(
        fallbackArtistIds.map(id => client.getArtistTopTracks(id, market).catch(() => [] as SpotifyTrack[]))
      );
      const candidates = results.flat().filter(t => !existingIds.has(t.id));
      // Deduplicate by track id
      const seen = new Set<string>();
      discovered = candidates.filter(t => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });
    }

    return NextResponse.json({
      tracks: discovered.slice(0, query.data.count),
    });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof SpotifyApiError) {
      return NextResponse.json({ error: 'SPOTIFY_ERROR' }, { status: 502 });
    }
    console.error('[discover] Error:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
