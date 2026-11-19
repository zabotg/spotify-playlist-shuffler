'use client';

import { useMemo } from 'react';
import { tracksApi } from '@/lib/api/tracks-api';
import type { EnrichedTrack } from '@/lib/domain/models/playlist';
import { isDefined } from '@/lib/utils/array';
import { useBatchedLoader, type BatchProgress } from './use-batched-loader';

/** Must match MAX_DETAILS_ISRCS in the API validation. */
const ISRCS_PER_REQUEST = 50;

export type TrackDetailsProgress = BatchProgress;

const loadDetails = async (isrcs: string[]) => (await tracksApi.details(isrcs)).details;

/**
 * Loads BPM and popularity from Deezer in the background, in batches, and merges them into
 * the tracks as they arrive. The table is usable right away and fills in while this runs.
 */
export function useTrackDetails(tracks: readonly EnrichedTrack[] | null) {
  const pendingIsrcs = useMemo(() => {
    const needed = (tracks ?? []).filter((item) => item.bpm === null || item.popularity === null);
    return [...new Set(needed.map((item) => item.track.isrc).filter(isDefined))];
  }, [tracks]);
  const { results: detailsByIsrc, progress } = useBatchedLoader(pendingIsrcs, ISRCS_PER_REQUEST, loadDetails);

  const mergedTracks = useMemo(() => {
    if (!tracks) return null;
    return tracks.map((item): EnrichedTrack => {
      const details = item.track.isrc ? detailsByIsrc[item.track.isrc] : undefined;
      if (!details) return item;
      return { ...item, bpm: item.bpm ?? details.bpm, popularity: item.popularity ?? details.popularity };
    });
  }, [tracks, detailsByIsrc]);

  return { tracks: mergedTracks, progress };
}
