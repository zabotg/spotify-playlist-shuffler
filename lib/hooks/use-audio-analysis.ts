'use client';

import { useMemo } from 'react';
import { tracksApi, type AnalysisRequest } from '@/lib/api/tracks-api';
import type { EnrichedTrack } from '@/lib/domain/models/playlist';
import { useBatchedLoader } from './use-batched-loader';

/** Must match MAX_ANALYSIS_TRACKS in the API validation. */
const TRACKS_PER_REQUEST = 5;

const analyze = async (batch: AnalysisRequest[]) => (await tracksApi.analyze(batch)).features;

/**
 * For tracks without audio data, asks the server to analyze their 30 second preview, a few
 * tracks at a time, and returns the computed features by track ID as they arrive.
 */
export function useAudioAnalysis(tracks: readonly EnrichedTrack[] | null) {
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

  const { results: featuresById, progress } = useBatchedLoader(pending, TRACKS_PER_REQUEST, analyze);
  return { featuresById, progress };
}
