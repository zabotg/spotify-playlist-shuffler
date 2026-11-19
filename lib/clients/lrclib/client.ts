import { fetchJson, UpstreamError } from '@/lib/clients/http/fetch-json';
import type { Lyrics } from '@/lib/domain/models/metadata';
import type { LookupResult } from '@/lib/clients/musicbrainz/client';

/**
 * LRCLIB, an open lyrics database (no key needed).
 * https://lrclib.net/docs
 */
const LRCLIB_API_URL = 'https://lrclib.net/api';
const CLIENT_NAME = 'SpotifyPlaylistShuffler/0.2 (self-hosted open source app)';

export interface LyricsQuery {
  title: string;
  artistName: string;
  albumName: string;
  durationMs: number;
}

interface RawLyrics {
  instrumental?: boolean;
  plainLyrics?: string | null;
  duration?: number;
}

/** Search results must be this close in length to count as the same recording. */
const DURATION_TOLERANCE_SECONDS = 3;

function toLyrics(raw: RawLyrics): Lyrics {
  return { instrumental: raw.instrumental === true, plainLyrics: raw.plainLyrics || null };
}

function lrclibGet<T>(path: string, query: URLSearchParams): Promise<T> {
  return fetchJson<T>(`${LRCLIB_API_URL}${path}?${query}`, {
    headers: { 'Lrclib-Client': CLIENT_NAME, 'User-Agent': CLIENT_NAME },
    maxRetries: 1,
  });
}

/** Exact match first; when that fails, a search for a recording of about the same length. */
export async function getLyrics({ title, artistName, albumName, durationMs }: LyricsQuery): Promise<LookupResult<Lyrics>> {
  const durationSeconds = Math.round(durationMs / 1000);
  try {
    const raw = await lrclibGet<RawLyrics>(
      '/get',
      new URLSearchParams({
        track_name: title,
        artist_name: artistName,
        album_name: albumName,
        duration: String(durationSeconds),
      }),
    );
    return { status: 'ok', data: toLyrics(raw) };
  } catch (error) {
    if (!(error instanceof UpstreamError && error.status === 404)) return { status: 'failed' };
  }

  try {
    const results = await lrclibGet<RawLyrics[]>('/search', new URLSearchParams({ track_name: title, artist_name: artistName }));
    const match = results.find(
      (result) =>
        Math.abs((result.duration ?? 0) - durationSeconds) <= DURATION_TOLERANCE_SECONDS &&
        (result.instrumental === true || Boolean(result.plainLyrics)),
    );
    return match ? { status: 'ok', data: toLyrics(match) } : { status: 'not_found' };
  } catch {
    return { status: 'failed' };
  }
}
