import type {
  EnrichedPlaylistTracks,
  PlaylistLink,
  PlaylistSummary,
  Track,
} from '@/lib/domain/models/playlist';
import { apiRequest } from './request';

const playlistPath = (playlistId: string, suffix = '') => `/api/playlists/${encodeURIComponent(playlistId)}${suffix}`;

export const playlistsApi = {
  list: () => apiRequest<{ playlists: PlaylistSummary[] }>('/api/playlists'),

  get: (playlistId: string) =>
    apiRequest<{ playlist: PlaylistSummary; canEdit: boolean }>(playlistPath(playlistId)),

  tracks: (playlistId: string) => apiRequest<EnrichedPlaylistTracks>(playlistPath(playlistId, '/tracks')),

  recommendations: (playlistId: string, count: number) =>
    apiRequest<{ tracks: Track[] }>(playlistPath(playlistId, `/recommendations?count=${count}`)),

  replaceTracks: (playlistId: string, uris: string[]) =>
    apiRequest<PlaylistLink>(playlistPath(playlistId, '/tracks'), { method: 'PUT', body: { uris } }),

  addTracks: (playlistId: string, uris: string[]) =>
    apiRequest<PlaylistLink>(playlistPath(playlistId, '/tracks'), { method: 'POST', body: { uris } }),

  create: (name: string, uris: string[]) =>
    apiRequest<PlaylistLink>('/api/playlists', { method: 'POST', body: { name, uris } }),
};
