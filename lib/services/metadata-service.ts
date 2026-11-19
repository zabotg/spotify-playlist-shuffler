import { getLyrics as fetchLyrics, type LyricsQuery } from '@/lib/clients/lrclib/client';
import { lookupArtistOrigin, lookupRecordingByIsrc, type LookupResult } from '@/lib/clients/musicbrainz/client';
import { detectLanguage } from '@/lib/domain/engines/language';
import type { ArtistOrigin, Lyrics, LyricsSummary, TrackMetadata } from '@/lib/domain/models/metadata';
import { normalizeForMatch } from '@/lib/utils/text';
import { TtlCache } from '@/lib/utils/ttl-cache';
import pLimit from 'p-limit';

/**
 * Facts from open databases: MusicBrainz (release years, tags, credits, artist origins) and
 * LRCLIB (lyrics). Cached for a week: this data rarely changes and MusicBrainz is slow (1 req/s).
 */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHED = 50_000;
const LYRICS_CONCURRENCY = 4;

const metadataCache = new TtlCache<string, TrackMetadata | null>(WEEK_MS, MAX_CACHED);
const originCache = new TtlCache<string, ArtistOrigin | null>(WEEK_MS, MAX_CACHED);
const lyricsCache = new TtlCache<string, Lyrics | null>(WEEK_MS, MAX_CACHED);
const lyricsLimit = pLimit(LYRICS_CONCURRENCY);

export interface LyricsSummaryQuery extends LyricsQuery {
  trackId: string;
}

/** Cacheable value of a lookup: data, `null` for "not found", `undefined` for "try again later". */
function toCacheable<T>(result: LookupResult<T>): T | null | undefined {
  if (result.status === 'ok') return result.data;
  return result.status === 'not_found' ? null : undefined;
}

async function loadMany<T>(
  keys: readonly string[],
  cache: TtlCache<string, T | null>,
  load: (key: string) => Promise<LookupResult<T>>,
): Promise<Record<string, T>> {
  const uniqueKeys = [...new Set(keys)];
  const values = await Promise.all(uniqueKeys.map((key) => cache.getOrLoad(key, async () => toCacheable(await load(key)))));
  const result: Record<string, T> = {};
  uniqueKeys.forEach((key, index) => {
    const value = values[index];
    if (value) result[key] = value;
  });
  return result;
}

/** MusicBrainz facts by ISRC. Unknown tracks are left out. */
export function getTrackMetadata(isrcs: readonly string[]): Promise<Record<string, TrackMetadata>> {
  return loadMany(isrcs, metadataCache, lookupRecordingByIsrc);
}

/** Where artists are from, by MusicBrainz artist ID. Unknown artists are left out. */
export function getArtistOrigins(artistIds: readonly string[]): Promise<Record<string, ArtistOrigin>> {
  return loadMany(artistIds, originCache, lookupArtistOrigin);
}

/** Lyrics for one track, or `null` when LRCLIB doesn't have them. */
export async function getLyrics(query: LyricsQuery): Promise<Lyrics | null> {
  const key = `${normalizeForMatch(query.artistName)}|${normalizeForMatch(query.title)}`;
  return (await lyricsCache.getOrLoad(key, async () => toCacheable(await fetchLyrics(query)))) ?? null;
}

/** Language and instrumental status per track, from its lyrics. Tracks without lyrics are left out. */
export async function summarizeLyrics(queries: readonly LyricsSummaryQuery[]): Promise<Record<string, LyricsSummary>> {
  const lyrics = await Promise.all(queries.map((query) => lyricsLimit(() => getLyrics(query))));
  const result: Record<string, LyricsSummary> = {};
  queries.forEach((query, index) => {
    const found = lyrics[index];
    if (!found) return;
    result[query.trackId] = {
      instrumental: found.instrumental,
      language: found.plainLyrics ? detectLanguage(found.plainLyrics) : null,
    };
  });
  return result;
}
