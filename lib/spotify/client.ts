/**
 * Spotify Web API client — server-side only.
 *
 * Features:
 * - Automatic token refresh (via session)
 * - Rate limit handling: respects Retry-After, exponential backoff
 * - Paginated fetching helpers for large playlists
 * - Batched audio feature fetching (100 IDs per request)
 */

import type { IronSession } from 'iron-session';
import type { SpotifySession } from '@/lib/auth/session';
import { refreshAccessToken, tokenExpiresAt } from '@/lib/spotify/oauth';
import { isTokenExpired } from '@/lib/auth/session';
import type {
  SpotifyPlaylist,
  SpotifyTrack,
  AudioFeatures,
  SpotifyUser,
  SpotifyArtist,
} from '@/types';

const BASE = 'https://api.spotify.com/v1';
const MAX_RETRIES = 3;

export class SpotifyClient {
  private accessToken: string;
  private session: IronSession<SpotifySession>;

  private constructor(token: string, session: IronSession<SpotifySession>) {
    this.accessToken = token;
    this.session = session;
  }

  /** Factory — refreshes token if needed before returning client. */
  static async create(session: IronSession<SpotifySession>): Promise<SpotifyClient> {
    if (!session.accessToken || !session.refreshToken) {
      throw new Error('No tokens in session');
    }

    if (isTokenExpired(session)) {
      const refreshed = await refreshAccessToken(session.refreshToken);
      session.accessToken = refreshed.access_token;
      // Spotify sometimes rotates the refresh token
      if (refreshed.refresh_token) {
        session.refreshToken = refreshed.refresh_token;
      }
      session.accessTokenExpiresAt = tokenExpiresAt(refreshed.expires_in);
      await session.save();
    }

    return new SpotifyClient(session.accessToken!, session);
  }

  private async fetch<T>(
    path: string,
    options: RequestInit = {},
    retries = 0
  ): Promise<T> {
    const url = path.startsWith('http') ? path : `${BASE}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      cache: 'no-store',
    });

    // Rate limited — respect Retry-After header
    if (res.status === 429 && retries < MAX_RETRIES) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '1', 10);
      await sleep((retryAfter + 1) * 1000);
      return this.fetch(path, options, retries + 1);
    }

    // Transient server errors — exponential backoff
    if ((res.status === 500 || res.status === 503) && retries < MAX_RETRIES) {
      await sleep(Math.pow(2, retries) * 500);
      return this.fetch(path, options, retries + 1);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new SpotifyApiError(res.status, body);
    }

    // 204 No Content (e.g. after playlist modification)
    if (res.status === 204) return undefined as T;

    return res.json() as Promise<T>;
  }

  // ── User ────────────────────────────────────────────────────────────────

  async getMe(): Promise<SpotifyUser> {
    return this.fetch<SpotifyUser>('/me');
  }

  // ── Playlists ────────────────────────────────────────────────────────────

  async getPlaylists(limit = 50, offset = 0): Promise<{ items: SpotifyPlaylist[]; total: number; next: string | null }> {
    return this.fetch(`/me/playlists?limit=${limit}&offset=${offset}`);
  }

  async getAllPlaylists(): Promise<SpotifyPlaylist[]> {
    const first = await this.getPlaylists(50, 0);
    const all: SpotifyPlaylist[] = [...first.items];
    let offset = 50;
    while (all.length < first.total) {
      const page = await this.getPlaylists(50, offset);
      all.push(...page.items);
      offset += 50;
    }
    return all;
  }

  async getPlaylist(id: string): Promise<SpotifyPlaylist> {
    return this.fetch(`/playlists/${id}?fields=id,name,description,images,owner,public,collaborative,tracks(total),snapshot_id,uri`);
  }

  // ── Tracks ───────────────────────────────────────────────────────────────

  async getPlaylistTracksPage(
    playlistId: string,
    limit = 100,
    offset = 0
  ): Promise<{ items: Array<{ track: SpotifyTrack; added_at: string }>; total: number }> {
    return this.fetch(
      `/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}&fields=total,items(added_at,track(id,name,artists,album,duration_ms,popularity,explicit,preview_url,is_local,is_playable,uri,external_ids))`
    );
  }

  /** Fetches ALL tracks in a playlist, handling pagination automatically. */
  async getAllPlaylistTracks(
    playlistId: string
  ): Promise<Array<{ track: SpotifyTrack; added_at: string }>> {
    const first = await this.getPlaylistTracksPage(playlistId, 100, 0);
    const all = [...first.items];

    // Build offset list for remaining pages
    const remaining = Math.ceil((first.total - 100) / 100);
    if (remaining <= 0) return all.filter(i => i.track && !i.track.is_local);

    // Process in batches of 5 concurrent requests (~500ms between batches)
    const offsets = Array.from({ length: remaining }, (_, i) => (i + 1) * 100);
    const batches = chunk(offsets, 5);

    for (const batch of batches) {
      const pages = await Promise.all(
        batch.map(offset => this.getPlaylistTracksPage(playlistId, 100, offset))
      );
      all.push(...pages.flatMap(p => p.items));
      if (batches.indexOf(batch) < batches.length - 1) {
        await sleep(200); // brief pause between batches
      }
    }

    // Filter out local files and null tracks (can happen with removed tracks)
    return all.filter(i => i.track && !i.track.is_local);
  }

  // ── Audio Features ────────────────────────────────────────────────────────

  /** Spotify allows max 100 IDs per request. */
  async getAudioFeaturesBatch(trackIds: string[]): Promise<(AudioFeatures | null)[]> {
    if (trackIds.length === 0) return [];
    try {
      const res = await this.fetch<{ audio_features: (AudioFeatures | null)[] }>(
        `/audio-features?ids=${trackIds.join(',')}`
      );
      return res.audio_features;
    } catch (err) {
      // Spotify restricts this API for new apps — degrade gracefully
      if (err instanceof SpotifyApiError && (err.status === 403 || err.status === 404)) {
        return new Array(trackIds.length).fill(null);
      }
      throw err;
    }
  }

  async getAllAudioFeatures(trackIds: string[]): Promise<Map<string, AudioFeatures>> {
    const map = new Map<string, AudioFeatures>();
    const batches = chunk(trackIds, 100);

    for (const batch of batches) {
      const features = await this.getAudioFeaturesBatch(batch);
      features.forEach((f, i) => {
        if (f) map.set(batch[i], f);
      });
      if (batches.indexOf(batch) < batches.length - 1) {
        await sleep(100);
      }
    }
    return map;
  }

  // ── Artists ───────────────────────────────────────────────────────────────

  async getArtistsBatch(artistIds: string[]): Promise<SpotifyArtist[]> {
    if (artistIds.length === 0) return [];
    const res = await this.fetch<{ artists: SpotifyArtist[] }>(
      `/artists?ids=${artistIds.slice(0, 50).join(',')}`
    );
    return res.artists;
  }

  // ── Recommendations ───────────────────────────────────────────────────────

  async getRecommendations(params: {
    seed_tracks?: string[];
    seed_artists?: string[];
    seed_genres?: string[];
    limit?: number;
    market?: string;
    target_energy?: number;
    target_danceability?: number;
    target_valence?: number;
    target_tempo?: number;
    target_acousticness?: number;
    min_popularity?: number;
  }): Promise<{ tracks: SpotifyTrack[] }> {
    const q = new URLSearchParams();
    if (params.seed_tracks?.length) q.set('seed_tracks', params.seed_tracks.join(','));
    if (params.seed_artists?.length) q.set('seed_artists', params.seed_artists.join(','));
    if (params.seed_genres?.length) q.set('seed_genres', params.seed_genres.join(','));
    q.set('limit', String(params.limit ?? 20));
    if (params.market) q.set('market', params.market);
    const numericKeys = ['target_energy', 'target_danceability', 'target_valence', 'target_tempo', 'target_acousticness', 'min_popularity'] as const;
    for (const key of numericKeys) {
      if (params[key] != null) q.set(key, String(params[key]));
    }
    return this.fetch(`/recommendations?${q}`);
  }

  // ── Playlist Modification ─────────────────────────────────────────────────

  async replacePlaylistTracks(playlistId: string, uris: string[]): Promise<void> {
    // Spotify allows max 100 URIs per replace call; for >100 we replace + add
    const [first, ...rest] = chunk(uris, 100);

    await this.fetch(`/playlists/${playlistId}/tracks`, {
      method: 'PUT',
      body: JSON.stringify({ uris: first }),
    });

    for (const batch of rest) {
      await this.fetch(`/playlists/${playlistId}/tracks`, {
        method: 'POST',
        body: JSON.stringify({ uris: batch }),
      });
      await sleep(100);
    }
  }

  async createPlaylist(
    userId: string,
    name: string,
    description = '',
    isPublic = false
  ): Promise<SpotifyPlaylist> {
    return this.fetch(`/users/${userId}/playlists`, {
      method: 'POST',
      body: JSON.stringify({ name, description, public: isPublic }),
    });
  }

  async addTracksToPlaylist(playlistId: string, uris: string[]): Promise<void> {
    const batches = chunk(uris, 100);
    for (const batch of batches) {
      await this.fetch(`/playlists/${playlistId}/tracks`, {
        method: 'POST',
        body: JSON.stringify({ uris: batch }),
      });
      if (batches.indexOf(batch) < batches.length - 1) await sleep(100);
    }
  }

  async getArtistTopTracks(artistId: string, market?: string): Promise<SpotifyTrack[]> {
    const q = market ? `?market=${market}` : '?market=US';
    const res = await this.fetch<{ tracks: SpotifyTrack[] }>(`/artists/${artistId}/top-tracks${q}`);
    return res.tracks;
  }

  async getUserTopArtists(limit = 10): Promise<SpotifyArtist[]> {
    const res = await this.fetch<{ items: SpotifyArtist[] }>(
      `/me/top/artists?limit=${limit}&time_range=medium_term`
    );
    return res.items;
  }
}

export class SpotifyApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`Spotify API error ${status}: ${body}`);
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
