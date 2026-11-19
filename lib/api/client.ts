import type { ApiErrorBody } from '@/lib/http/errors';
import type { EnrichedPlaylistTracks, PlaylistLink, PlaylistSummary, Track, TrackDetails } from '@/lib/domain/models/playlist';

const UNAUTHORIZED = 401;

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
}

async function request<T>(path: string, { method = 'GET', body }: RequestOptions = {}): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);

  if (response.status === UNAUTHORIZED) window.location.assign('/');
  if (!response.ok) {
    const message = (payload as ApiErrorBody | null)?.message ?? 'Something went wrong. Please try again.';
    throw new ApiRequestError(response.status, message);
  }
  return payload as T;
}

const playlistPath = (playlistId: string, suffix = '') => `/api/playlists/${encodeURIComponent(playlistId)}${suffix}`;

export const playlistsApi = {
  list: () => request<{ playlists: PlaylistSummary[] }>('/api/playlists'),

  get: (playlistId: string) => request<{ playlist: PlaylistSummary; canEdit: boolean }>(playlistPath(playlistId)),

  tracks: (playlistId: string) => request<EnrichedPlaylistTracks>(playlistPath(playlistId, '/tracks')),

  recommendations: (playlistId: string, count: number) =>
    request<{ tracks: Track[] }>(playlistPath(playlistId, `/recommendations?count=${count}`)),

  replaceTracks: (playlistId: string, uris: string[]) =>
    request<PlaylistLink>(playlistPath(playlistId, '/tracks'), { method: 'PUT', body: { uris } }),

  addTracks: (playlistId: string, uris: string[]) =>
    request<PlaylistLink>(playlistPath(playlistId, '/tracks'), { method: 'POST', body: { uris } }),

  create: (name: string, uris: string[]) =>
    request<PlaylistLink>('/api/playlists', { method: 'POST', body: { name, uris } }),
};

export interface PreviewRequest {
  trackId: string;
  isrc: string | null;
  title: string;
  artist: string;
}

export const tracksApi = {
  details: (isrcs: string[]) =>
    request<{ details: Record<string, TrackDetails> }>('/api/tracks/details', { method: 'POST', body: { isrcs } }),

  preview: ({ trackId, isrc, title, artist }: PreviewRequest) => {
    const query = new URLSearchParams({ trackId, title, artist, ...(isrc ? { isrc } : {}) });
    return request<{ url: string | null }>(`/api/tracks/preview?${query}`);
  },
};

export const artistsApi = {
  genres: (artistIds: string[]) =>
    request<{ genres: string[][] }>(`/api/artists/genres?ids=${artistIds.map(encodeURIComponent).join(',')}`),
};
