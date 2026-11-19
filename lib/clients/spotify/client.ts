import pLimit from 'p-limit';
import { fetchJson, type FetchJsonOptions } from '@/lib/clients/http/fetch-json';
import type { ReorderMove } from '@/lib/domain/engines/reorder';
import type { PlaylistSummary, PlaylistTracks, SpotifyUser, Track } from '@/lib/domain/models/playlist';
import { chunk, isDefined, range } from '@/lib/utils/array';
import { SpotifyApiError } from './errors';
import { toPlaylistSummary, toPlaylistTracks, toTrack, toUser } from './mappers';
import type { RawArtist, RawPage, RawPlaylist, RawPlaylistEntry, RawTrack, RawUser } from './types';

const API_BASE_URL = 'https://api.spotify.com/v1';
const MAX_CONCURRENT_REQUESTS = 6;
const PLAYLISTS_PAGE_SIZE = 50;
const PLAYLIST_ITEMS_PAGE_SIZE = 100;
const WRITE_BATCH_SIZE = 100;

type RequestOptions = Pick<FetchJsonOptions, 'method' | 'json'>;

const toSpotifyError = (status: number, body: string) => new SpotifyApiError(status, body);
const playlistItemsPath = (playlistId: string) => `/playlists/${encodeURIComponent(playlistId)}/items`;

function withPagination(path: string, limit: number, offset: number): string {
  return `${path}?limit=${limit}&offset=${offset}`;
}

/** Spotify Web API client for one access token. It knows nothing about sessions or cookies. */
export class SpotifyClient {
  private readonly limit = pLimit(MAX_CONCURRENT_REQUESTS);

  constructor(private readonly accessToken: string) {}

  async getCurrentUser(): Promise<SpotifyUser> {
    return toUser(await this.request<RawUser>('/me'));
  }

  async getUser(userId: string): Promise<SpotifyUser> {
    return toUser(await this.request<RawUser>(`/users/${encodeURIComponent(userId)}`));
  }

  async getAllPlaylists(): Promise<PlaylistSummary[]> {
    const playlists = await this.fetchAllPages<RawPlaylist | null>('/me/playlists', PLAYLISTS_PAGE_SIZE);
    return playlists.filter(isDefined).map(toPlaylistSummary);
  }

  async getPlaylist(playlistId: string): Promise<PlaylistSummary> {
    return toPlaylistSummary(await this.request<RawPlaylist>(`/playlists/${encodeURIComponent(playlistId)}`));
  }

  async getPlaylistTracks(playlistId: string): Promise<PlaylistTracks> {
    return toPlaylistTracks(
      await this.fetchAllPages<RawPlaylistEntry>(playlistItemsPath(playlistId), PLAYLIST_ITEMS_PAGE_SIZE),
    );
  }

  async getTrack(trackId: string): Promise<Track> {
    return toTrack(await this.request<RawTrack>(`/tracks/${encodeURIComponent(trackId)}`));
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
      json: { name, description, public: false },
    });
    return toPlaylistSummary(playlist);
  }

  /** Moves a range of items. Moving keeps their "date added". Returns the new snapshot ID. */
  async moveItems(playlistId: string, move: ReorderMove, snapshotId?: string): Promise<string> {
    const { snapshot_id } = await this.request<{ snapshot_id: string }>(playlistItemsPath(playlistId), {
      method: 'PUT',
      json: {
        range_start: move.rangeStart,
        range_length: move.rangeLength,
        insert_before: move.insertBefore,
        ...(snapshotId ? { snapshot_id: snapshotId } : {}),
      },
    });
    return snapshot_id;
  }

  /** Batches run one after another so the tracks keep their order. */
  async addTracksToPlaylist(playlistId: string, uris: readonly string[]): Promise<void> {
    for (const batch of chunk(uris, WRITE_BATCH_SIZE)) {
      await this.request(playlistItemsPath(playlistId), { method: 'POST', json: { uris: batch } });
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
    return this.limit(() =>
      fetchJson<T>(`${API_BASE_URL}${path}`, {
        ...options,
        headers: { Authorization: `Bearer ${this.accessToken}` },
        toError: toSpotifyError,
      }),
    );
  }
}
