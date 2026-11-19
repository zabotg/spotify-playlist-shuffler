'use client';

import { useEffect, useMemo, useState } from 'react';
import { tracksApi } from '@/lib/api/client';
import type { EnrichedTrack, TrackDetails } from '@/lib/domain/playlist';
import { chunk, isDefined } from '@/lib/utils/array';

/** Must match MAX_DETAILS_ISRCS in the API validation. */
const ISRCS_PER_REQUEST = 50;

export interface TrackDetailsProgress {
  loaded: number;
  total: number;
  isLoading: boolean;
}

/**
 * Loads BPM and popularity from Deezer in the background, in batches, and merges them into
 * the tracks as they arrive. The table is usable right away and fills in while this runs.
 */
export function useTrackDetails(tracks: readonly EnrichedTrack[] | null) {
  const [detailsByIsrc, setDetailsByIsrc] = useState<Record<string, TrackDetails>>({});
  const [progress, setProgress] = useState<TrackDetailsProgress>({ loaded: 0, total: 0, isLoading: false });

  const pendingIsrcs = useMemo(() => {
    if (!tracks) return [];
    const needed = tracks.filter((item) => item.bpm === null || item.popularity === null);
    return [...new Set(needed.map((item) => item.track.isrc).filter(isDefined))];
  }, [tracks]);

  useEffect(() => {
    if (pendingIsrcs.length === 0) return;
    let cancelled = false;

    async function loadAll() {
      setProgress({ loaded: 0, total: pendingIsrcs.length, isLoading: true });
      let loaded = 0;
      for (const batch of chunk(pendingIsrcs, ISRCS_PER_REQUEST)) {
        if (cancelled) return;
        try {
          const { details } = await tracksApi.details(batch);
          if (cancelled) return;
          setDetailsByIsrc((current) => ({ ...current, ...details }));
        } catch {
          // Extra details are optional: keep going with the next batch.
        }
        loaded += batch.length;
        setProgress({ loaded, total: pendingIsrcs.length, isLoading: loaded < pendingIsrcs.length });
      }
    }

    void loadAll();
    return () => {
      cancelled = true;
    };
  }, [pendingIsrcs]);

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
