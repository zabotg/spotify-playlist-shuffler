import type {
  EnrichedPlaylistTracks,
  EnrichedTrack,
  PlaylistLink,
  PlaylistSummary,
} from '@/lib/domain/models/playlist';
import { apiRequest } from './request';

const playlistPath = (playlistId: string, suffix = '') => `/api/playlists/${encodeURIComponent(playlistId)}${suffix}`;

export const playlistsApi = {
  list: () => apiRequest<{ playlists: PlaylistSummary[] }>('/api/playlists'),

  get: (playlistId: string) =>
    apiRequest<{ playlist: PlaylistSummary; canEdit: boolean }>(playlistPath(playlistId)),

  tracks: (playlistId: string) => apiRequest<EnrichedPlaylistTracks>(playlistPath(playlistId, '/tracks')),

  recommendations: (playlistId: string, count: number) =>
    apiRequest<{ tracks: EnrichedTrack[] }>(playlistPath(playlistId, `/recommendations?count=${count}`)),

  bridge: (playlistId: string, fromTrackId: string, toTrackId: string) => {
    const query = new URLSearchParams({ from: fromTrackId, to: toTrackId });
    return apiRequest<{ tracks: EnrichedTrack[] }>(playlistPath(playlistId, `/bridge?${query}`));
  },

  replaceTracks: (playlistId: string, uris: string[]) =>
    apiRequest<PlaylistLink>(playlistPath(playlistId, '/tracks'), { method: 'PUT', body: { uris } }),

  addTracks: (playlistId: string, uris: string[], position?: number) =>
    apiRequest<PlaylistLink>(playlistPath(playlistId, '/tracks'), { method: 'POST', body: { uris, position } }),

  removeTracks: (playlistId: string, positions: number[]) =>
    apiRequest<PlaylistLink>(playlistPath(playlistId, '/tracks'), { method: 'DELETE', body: { positions } }),

  create: (name: string, uris: string[]) =>
    apiRequest<PlaylistLink>('/api/playlists', { method: 'POST', body: { name, uris } }),
};
