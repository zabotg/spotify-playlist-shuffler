import type { TrackDetails } from '@/lib/domain/models/playlist';
import { apiRequest } from './request';

export interface PreviewRequest {
  isrc: string | null;
  title: string;
  artist: string;
}

export const tracksApi = {
  details: (isrcs: string[]) =>
    apiRequest<{ details: Record<string, TrackDetails> }>('/api/tracks/details', { method: 'POST', body: { isrcs } }),

  preview: ({ isrc, title, artist }: PreviewRequest) => {
    const query = new URLSearchParams({ title, artist, ...(isrc ? { isrc } : {}) });
    return apiRequest<{ url: string | null }>(`/api/tracks/preview?${query}`);
  },
};
