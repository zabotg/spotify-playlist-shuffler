import pLimit from 'p-limit';
import { applyTokens, isTokenExpired, type AuthenticatedSession } from '@/lib/auth/session';
import type { AudioFeatures, PlaylistSummary, PlaylistTracks, SpotifyUser, Track } from '@/lib/domain/playlist';
import { isAccessRestricted, SpotifyApiError } from '@/lib/spotify/errors';
import { toPlaylistSummary, toPlaylistTracks, toTrack, toUser } from '@/lib/spotify/mappers';
import { refreshAccessToken } from '@/lib/spotify/oauth';
import type { RawArtist, RawPage, RawPlaylist, RawPlaylistEntry, RawTrack, RawUser } from '@/lib/spotify/types';
import { chunk, isDefined, range } from '@/lib/utils/array';
import { sleep } from '@/lib/utils/async';

const API_BASE_URL = 'https://api.spotify.com/v1';
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_CONCURRENT_REQUESTS = 4;
const PLAYLISTS_PAGE_SIZE = 50;
const PLAYLIST_ITEMS_PAGE_SIZE = 100;
const WRITE_BATCH_SIZE = 100;
const AUDIO_FEATURES_BATCH_SIZE = 100;

type HttpMethod = 'GET' | 'POST' | 'PUT';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
}

function withPagination(path: string, limit: number, offset: number): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}limit=${limit}&offset=${offset}`;
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfterSeconds = Number(response.headers.get('Retry-After'));
  if (response.status === 429 && retryAfterSeconds > 0) return retryAfterSeconds * 1000;
  return BASE_BACKOFF_MS * 2 ** attempt;
}

export class SpotifyClient {
  private readonly limit = pLimit(MAX_CONCURRENT_REQUESTS);

  private constructor(private readonly accessToken: string) {}

  static withAccessToken(accessToken: string): SpotifyClient {
    return new SpotifyClient(accessToken);
  }

  static async forSession(session: AuthenticatedSession): Promise<SpotifyClient> {
    if (isTokenExpired(session)) {
      applyTokens(session, await refreshAccessToken(session.refreshToken));
      await session.save();
    }
    return new SpotifyClient(session.accessToken);
  }

  async getCurrentUser(): Promise<SpotifyUser> {
    return toUser(await this.request<RawUser>('/me'));
  }

  async getAllPlaylists(): Promise<PlaylistSummary[]> {
    const playlists = await this.fetchAllPages<RawPlaylist | null>('/me/playlists', PLAYLISTS_PAGE_SIZE);
    return playlists.filter(isDefined).map(toPlaylistSummary);
  }

  async getPlaylist(playlistId: string): Promise<PlaylistSummary> {
    return toPlaylistSummary(await this.request<RawPlaylist>(`/playlists/${encodeURIComponent(playlistId)}`));
  }

  async getPlaylistTracks(playlistId: string): Promise<PlaylistTracks> {
    const path = `/playlists/${encodeURIComponent(playlistId)}/items`;
    return toPlaylistTracks(await this.fetchAllPages<RawPlaylistEntry>(path, PLAYLIST_ITEMS_PAGE_SIZE));
  }

  async getAudioFeatures(trackIds: readonly string[]): Promise<Map<string, AudioFeatures>> {
    const featuresById = new Map<string, AudioFeatures>();
    for (const batch of chunk(trackIds, AUDIO_FEATURES_BATCH_SIZE)) {
      try {
        const { audio_features } = await this.request<{ audio_features: (AudioFeatures | null)[] }>(
          `/audio-features?ids=${batch.join(',')}`,
        );
        for (const features of audio_features.filter(isDefined)) featuresById.set(features.id, features);
      } catch (error) {
        if (isAccessRestricted(error)) return featuresById;
        throw error;
      }
    }
    return featuresById;
  }

  async getArtistGenres(artistIds: readonly string[]): Promise<string[][]> {
    const artists = await Promise.all(
      artistIds.map((id) => this.request<RawArtist>(`/artists/${encodeURIComponent(id)}`)),
    );
    return artists.map((artist) => artist.genres ?? []);
  }

  async searchTrack(title: string, artistName: string): Promise<Track | null> {
    const query = new URLSearchParams({ q: `track:${title} artist:${artistName}`, type: 'track', limit: '1' });
    const result = await this.request<{ tracks: { items: RawTrack[] } }>(`/search?${query}`);
    const [match] = result.tracks.items;
    return match ? toTrack(match) : null;
  }

  async createPlaylist(name: string, description: string): Promise<PlaylistSummary> {
    const playlist = await this.request<RawPlaylist>('/me/playlists', {
      method: 'POST',
      body: { name, description, public: false },
    });
    return toPlaylistSummary(playlist);
  }

  async replacePlaylistTracks(playlistId: string, uris: readonly string[]): Promise<void> {
    const [firstBatch = [], ...remainingBatches] = chunk(uris, WRITE_BATCH_SIZE);
    await this.request(`/playlists/${encodeURIComponent(playlistId)}/items`, {
      method: 'PUT',
      body: { uris: firstBatch },
    });
    await this.addTracksToPlaylist(playlistId, remainingBatches.flat());
  }

  async addTracksToPlaylist(playlistId: string, uris: readonly string[]): Promise<void> {
    for (const batch of chunk(uris, WRITE_BATCH_SIZE)) {
      await this.request(`/playlists/${encodeURIComponent(playlistId)}/items`, {
        method: 'POST',
        body: { uris: batch },
      });
    }
  }

  private async fetchAllPages<T>(path: string, pageSize: number): Promise<T[]> {
    const firstPage = await this.request<RawPage<T>>(withPagination(path, pageSize, 0));
    const remainingPages = await Promise.all(
      range(pageSize, firstPage.total, pageSize).map((offset) =>
        this.request<RawPage<T>>(withPagination(path, pageSize, offset)),
      ),
    );
    return [firstPage, ...remainingPages].flatMap((page) => page.items);
  }

  private request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.limit(() => this.send<T>(path, options));
  }

  private async send<T>(path: string, { method = 'GET', body }: RequestOptions, attempt = 0): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });

    if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
      await sleep(retryDelayMs(response, attempt));
      return this.send<T>(path, { method, body }, attempt + 1);
    }

    if (!response.ok) throw new SpotifyApiError(response.status, await response.text());

    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
}
