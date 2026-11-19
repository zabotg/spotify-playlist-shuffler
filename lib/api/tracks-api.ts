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

export const tracksApi = {
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
