'use client';

import { useEffect, useMemo, useState } from 'react';
import { tracksApi } from '@/lib/api/tracks-api';
import type { AudioFeatures, EnrichedTrack } from '@/lib/domain/models/playlist';
import { chunk } from '@/lib/utils/array';
import type { TrackDetailsProgress } from './use-track-details';

/** Must match MAX_ANALYSIS_TRACKS in the API validation. */
const TRACKS_PER_REQUEST = 5;

/**
 * For tracks without audio data, asks the server to analyze their 30 second preview, a few
 * tracks at a time, and returns the computed features by track ID as they arrive.
 */
export function useAudioAnalysis(tracks: readonly EnrichedTrack[] | null) {
  const [featuresById, setFeaturesById] = useState<Record<string, AudioFeatures>>({});
  const [progress, setProgress] = useState<TrackDetailsProgress>({ loaded: 0, total: 0, isLoading: false });

  const pending = useMemo(() => {
    const missing = (tracks ?? []).filter((item) => item.features === null);
    const unique = new Map(missing.map(({ track }) => [track.id, track]));
    return [...unique.values()].map((track) => ({
      trackId: track.id,
      isrc: track.isrc,
      title: track.name,
      artist: track.artists[0]?.name ?? '',
    }));
  }, [tracks]);

  useEffect(() => {
    if (pending.length === 0) return;
    let cancelled = false;

    async function analyzeAll() {
      setProgress({ loaded: 0, total: pending.length, isLoading: true });
      let loaded = 0;
      for (const batch of chunk(pending, TRACKS_PER_REQUEST)) {
        if (cancelled) return;
        try {
          const { features } = await tracksApi.analyze(batch);
          if (cancelled) return;
          setFeaturesById((current) => ({ ...current, ...features }));
        } catch {
          // Analysis is optional: keep going with the next batch.
        }
        loaded += batch.length;
        setProgress({ loaded, total: pending.length, isLoading: loaded < pending.length });
      }
    }

    void analyzeAll();
    return () => {
      cancelled = true;
    };
  }, [pending]);

  return { featuresById, progress };
}
