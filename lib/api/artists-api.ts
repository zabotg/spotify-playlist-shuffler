import type { ArtistOrigin } from '@/lib/domain/models/metadata';
import { apiRequest } from './request';

export const artistsApi = {
  genres: (artistIds: string[]) =>
    apiRequest<{ genres: string[][] }>(`/api/artists/genres?ids=${artistIds.map(encodeURIComponent).join(',')}`),

  origins: (artistIds: string[]) =>
    apiRequest<{ origins: Record<string, ArtistOrigin> }>('/api/artists/origins', {
      method: 'POST',
      body: { ids: artistIds },
    }),
};
