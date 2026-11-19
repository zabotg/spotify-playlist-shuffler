import type { Lyrics, LyricsSummary, TrackMetadata } from '@/lib/domain/models/metadata';
import type { AudioFeatures, TrackDetails } from '@/lib/domain/models/playlist';
import { apiRequest } from './request';

export interface PreviewRequest {
  isrc: string | null;
  title: string;
  artist: string;
}

export interface AnalysisRequest {
  trackId: string;
  isrc: string | null;
  title: string;
  artist: string;
}

export interface LyricsRequest {
  title: string;
  artist: string;
  album: string;
  durationMs: number;
}

export const tracksApi = {
  metadata: (isrcs: string[]) =>
    apiRequest<{ metadata: Record<string, TrackMetadata> }>('/api/tracks/metadata', { method: 'POST', body: { isrcs } }),

  lyricsSummary: (tracks: (LyricsRequest & { trackId: string })[]) =>
    apiRequest<{ summaries: Record<string, LyricsSummary> }>('/api/tracks/lyrics-summary', {
      method: 'POST',
      body: { tracks },
    }),

  lyrics: ({ title, artist, album, durationMs }: LyricsRequest) => {
    const query = new URLSearchParams({ title, artist, album, durationMs: String(durationMs) });
    return apiRequest<{ lyrics: Lyrics | null }>(`/api/tracks/lyrics?${query}`);
  },

  analyze: (tracks: AnalysisRequest[]) =>
    apiRequest<{ features: Record<string, AudioFeatures> }>('/api/tracks/analysis', {
      method: 'POST',
      body: { tracks },
    }),

  details: (isrcs: string[]) =>
    apiRequest<{ details: Record<string, TrackDetails> }>('/api/tracks/details', { method: 'POST', body: { isrcs } }),

  preview: ({ isrc, title, artist }: PreviewRequest) => {
    const query = new URLSearchParams({ title, artist, ...(isrc ? { isrc } : {}) });
    return apiRequest<{ url: string | null }>(`/api/tracks/preview?${query}`);
  },
};
