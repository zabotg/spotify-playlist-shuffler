import { fetchJsonOrNull } from '@/lib/clients/http/fetch-json';
import type { TrackDetails } from '@/lib/domain/models/playlist';
import { createRateLimiter, sleep } from '@/lib/utils/async';

/**
 * Public Deezer API (no key needed). It allows 50 requests every 5 seconds per IP and answers
 * with HTTP 200 + `{ error: { code: 4 } }` when that quota is exceeded, so every call goes
 * through a rate limiter and quota errors are retried instead of being read as "not found".
 */
const DEEZER_API_URL = 'https://api.deezer.com';
const RATE_LIMIT_CALLS = 45;
const RATE_LIMIT_WINDOW_MS = 5000;
const QUOTA_ERROR_CODE = 4;
const MAX_QUOTA_RETRIES = 3;
const QUOTA_RETRY_DELAY_MS = 2000;

const acquireSlot = createRateLimiter(RATE_LIMIT_CALLS, RATE_LIMIT_WINDOW_MS);

interface DeezerList<T> {
  data: T[];
}

export interface DeezerTrack {
  title: string;
  bpm?: number;
  rank?: number;
  preview?: string;
  artist: { name: string };
}

/** `failed` is temporary (quota, network): callers should not cache it. */
export type DeezerResult<T> = { status: 'ok'; data: T } | { status: 'not_found' } | { status: 'failed' };

export interface TrackReference {
  title: string;
  artistName: string;
}

export interface RelatedTracksOptions {
  relatedArtistLimit: number;
  tracksPerArtist: number;
}

async function deezerGet<T>(path: string, attempt = 0): Promise<DeezerResult<T>> {
  await acquireSlot();
  const body = await fetchJsonOrNull<T & { error?: { code?: number } }>(`${DEEZER_API_URL}${path}`, {
    maxRetries: 1,
  });
  if (!body) return { status: 'failed' };

  if (body.error?.code === QUOTA_ERROR_CODE) {
    if (attempt >= MAX_QUOTA_RETRIES) return { status: 'failed' };
    await sleep(QUOTA_RETRY_DELAY_MS);
    return deezerGet<T>(path, attempt + 1);
  }
  return body.error ? { status: 'not_found' } : { status: 'ok', data: body };
}

/** Deezer's search syntax uses double quotes, so they are removed from user-facing text. */
function searchTerm(text: string): string {
  return text.replace(/"/g, '').trim();
}

export function toTrackDetails(track: DeezerTrack): TrackDetails {
  return {
    bpm: track.bpm && track.bpm > 0 ? track.bpm : null,
    popularity: track.rank && track.rank > 0 ? track.rank : null,
  };
}

export function getTrackByIsrc(isrc: string): Promise<DeezerResult<DeezerTrack>> {
  return deezerGet<DeezerTrack>(`/track/isrc:${encodeURIComponent(isrc)}`);
}

export async function searchTrack(title: string, artistName: string): Promise<DeezerTrack | null> {
  const query = encodeURIComponent(`artist:"${searchTerm(artistName)}" track:"${searchTerm(title)}"`);
  const result = await deezerGet<DeezerList<DeezerTrack>>(`/search?q=${query}&limit=1`);
  return result.status === 'ok' ? (result.data.data[0] ?? null) : null;
}

export async function getRelatedArtistTopTracks(
  artistName: string,
  { relatedArtistLimit, tracksPerArtist }: RelatedTracksOptions,
): Promise<TrackReference[]> {
  const search = await deezerGet<DeezerList<{ id: number }>>(
    `/search/artist?q=${encodeURIComponent(searchTerm(artistName))}&limit=1`,
  );
  const artistId = search.status === 'ok' ? search.data.data[0]?.id : undefined;
  if (!artistId) return [];

  const related = await deezerGet<DeezerList<{ id: number }>>(
    `/artist/${artistId}/related?limit=${relatedArtistLimit}`,
  );
  const relatedArtists = related.status === 'ok' ? related.data.data : [];
  const topTracks = await Promise.all(
    relatedArtists.map((artist) =>
      deezerGet<DeezerList<DeezerTrack>>(`/artist/${artist.id}/top?limit=${tracksPerArtist}`),
    ),
  );

  return topTracks
    .flatMap((result) => (result.status === 'ok' ? result.data.data : []))
    .map((track) => ({ title: track.title, artistName: track.artist.name }));
}
