import type { ApiErrorBody } from '@/lib/http/errors';
import type { PlaylistInsights } from '@/lib/domain/insights';
import type { EnrichedTrack, PlaylistLink, PlaylistSummary, Track } from '@/lib/domain/playlist';
import type { ShuffleOptions } from '@/lib/domain/shuffle';

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

  shuffle: (playlistId: string, options: ShuffleOptions) =>
    request<{ tracks: EnrichedTrack[] }>(playlistPath(playlistId, '/shuffle'), { method: 'POST', body: options }),

  insights: (playlistId: string) =>
    request<{ insights: PlaylistInsights | null }>(playlistPath(playlistId, '/insights')),

  recommendations: (playlistId: string, count: number) =>
    request<{ tracks: Track[] }>(playlistPath(playlistId, `/recommendations?count=${count}`)),

  replaceTracks: (playlistId: string, uris: string[]) =>
    request<PlaylistLink>(playlistPath(playlistId, '/tracks'), { method: 'PUT', body: { uris } }),

  addTracks: (playlistId: string, uris: string[]) =>
    request<PlaylistLink>(playlistPath(playlistId, '/tracks'), { method: 'POST', body: { uris } }),

  create: (name: string, uris: string[]) =>
    request<PlaylistLink>('/api/playlists', { method: 'POST', body: { name, uris } }),
};
