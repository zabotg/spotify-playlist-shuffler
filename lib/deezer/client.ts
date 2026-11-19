import type { TrackDetails } from '@/lib/domain/playlist';
import { uniqueBy } from '@/lib/utils/array';
import { createRateLimiter, sleep } from '@/lib/utils/async';
import { TtlCache } from '@/lib/utils/ttl-cache';

/**
 * Public Deezer API (no key needed). It allows 50 requests every 5 seconds per IP and answers
 * with HTTP 200 + `{ error: { code: 4 } }` when that quota is exceeded, so every call goes
 * through a rate limiter and quota errors are retried instead of being treated as "not found".
 */
const DEEZER_API_URL = 'https://api.deezer.com';
const RATE_LIMIT_CALLS = 45;
const RATE_LIMIT_WINDOW_MS = 5000;
const QUOTA_ERROR_CODE = 4;
const MAX_QUOTA_RETRIES = 3;
const QUOTA_RETRY_DELAY_MS = 2000;
const DETAILS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DETAILS_CACHE_MAX_ENTRIES = 50_000;

const acquireSlot = createRateLimiter(RATE_LIMIT_CALLS, RATE_LIMIT_WINDOW_MS);
/** `null` means Deezer doesn't have the track, so it is not asked again. */
const detailsByIsrc = new TtlCache<string, TrackDetails | null>(DETAILS_CACHE_TTL_MS, DETAILS_CACHE_MAX_ENTRIES);

interface DeezerList<T> {
  data: T[];
}

interface RawDeezerTrack {
  title: string;
  bpm?: number;
  rank?: number;
  preview?: string;
  artist: { name: string };
}

type DeezerResult<T> = { status: 'ok'; data: T } | { status: 'not_found' } | { status: 'failed' };

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
  try {
    const response = await fetch(`${DEEZER_API_URL}${path}`, { cache: 'no-store' });
    if (!response.ok) return { status: 'failed' };

    const body = (await response.json()) as T & { error?: { code?: number } };
    if (body.error?.code === QUOTA_ERROR_CODE) {
      if (attempt >= MAX_QUOTA_RETRIES) return { status: 'failed' };
      await sleep(QUOTA_RETRY_DELAY_MS);
      return deezerGet<T>(path, attempt + 1);
    }
    return body.error ? { status: 'not_found' } : { status: 'ok', data: body };
  } catch {
    return { status: 'failed' };
  }
}

async function getTrackByIsrc(isrc: string): Promise<DeezerResult<RawDeezerTrack>> {
  return deezerGet<RawDeezerTrack>(`/track/isrc:${encodeURIComponent(isrc)}`);
}

function toTrackDetails(track: RawDeezerTrack): TrackDetails {
  return {
    bpm: track.bpm && track.bpm > 0 ? track.bpm : null,
    popularity: track.rank && track.rank > 0 ? track.rank : null,
  };
}

/** BPM and popularity by ISRC. Results are cached, so only new tracks hit the API. */
export async function getTrackDetailsByIsrc(isrcs: readonly string[]): Promise<Map<string, TrackDetails>> {
  const uniqueIsrcs = uniqueBy(isrcs, (isrc) => isrc);

  await Promise.all(
    uniqueIsrcs
      .filter((isrc) => !detailsByIsrc.has(isrc))
      .map(async (isrc) => {
        const result = await getTrackByIsrc(isrc);
        if (result.status === 'ok') detailsByIsrc.set(isrc, toTrackDetails(result.data));
        if (result.status === 'not_found') detailsByIsrc.set(isrc, null);
      }),
  );

  const details = new Map<string, TrackDetails>();
  for (const isrc of uniqueIsrcs) {
    const value = detailsByIsrc.get(isrc);
    if (value) details.set(isrc, value);
  }
  return details;
}

/** Details already in the cache, without calling Deezer. */
export function peekTrackDetails(isrc: string): TrackDetails | undefined {
  return detailsByIsrc.get(isrc) ?? undefined;
}

/**
 * 30 second preview URL. Deezer signs these URLs for about 15 minutes, so they are always
 * fetched on demand instead of cached with the other details.
 */
export async function findDeezerPreview(isrc: string | null, title: string, artistName: string): Promise<string | null> {
  if (isrc) {
    const result = await getTrackByIsrc(isrc);
    if (result.status === 'ok') {
      detailsByIsrc.set(isrc, toTrackDetails(result.data));
      if (result.data.preview) return result.data.preview;
    }
  }

  const query = encodeURIComponent(`artist:"${artistName}" track:"${title}"`);
  const search = await deezerGet<DeezerList<RawDeezerTrack>>(`/search?q=${query}&limit=1`);
  return search.status === 'ok' ? search.data.data[0]?.preview || null : null;
}

export async function getRelatedArtistTopTracks(
  artistName: string,
  { relatedArtistLimit, tracksPerArtist }: RelatedTracksOptions,
): Promise<TrackReference[]> {
  const search = await deezerGet<DeezerList<{ id: number }>>(
    `/search/artist?q=${encodeURIComponent(artistName)}&limit=1`,
  );
  const artistId = search.status === 'ok' ? search.data.data[0]?.id : undefined;
  if (!artistId) return [];

  const related = await deezerGet<DeezerList<{ id: number }>>(
    `/artist/${artistId}/related?limit=${relatedArtistLimit}`,
  );
  const relatedArtists = related.status === 'ok' ? related.data.data : [];
  const topTracks = await Promise.all(
    relatedArtists.map((artist) =>
      deezerGet<DeezerList<RawDeezerTrack>>(`/artist/${artist.id}/top?limit=${tracksPerArtist}`),
    ),
  );

  return topTracks
    .flatMap((result) => (result.status === 'ok' ? result.data.data : []))
    .map((track) => ({ title: track.title, artistName: track.artist.name }));
}
