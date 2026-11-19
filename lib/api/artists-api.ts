import { apiRequest } from './request';

export const artistsApi = {
  genres: (artistIds: string[]) =>
    apiRequest<{ genres: string[][] }>(`/api/artists/genres?ids=${artistIds.map(encodeURIComponent).join(',')}`),
};
