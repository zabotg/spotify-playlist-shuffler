import pLimit from 'p-limit';
import * as deezer from '@/lib/clients/deezer/client';
import { findPreview as findItunesPreview } from '@/lib/clients/itunes/client';
import { analyzeAudio, getAudioFeaturesBatch, RECCOBEATS_MAX_IDS_PER_REQUEST } from '@/lib/clients/reccobeats/client';
import { fetchBytes } from '@/lib/clients/http/fetch-json';
import { isAllowedPreviewUrl } from '@/lib/config/media-hosts';
import type { AudioFeatures, TrackDetails } from '@/lib/domain/models/playlist';
import { chunk } from '@/lib/utils/array';
import { normalizeForMatch } from '@/lib/utils/text';
import { TtlCache } from '@/lib/utils/ttl-cache';

/**
 * Track data from the public APIs, cached in memory so each track is fetched once per day.
 * `null` in a cache means "the source has no data for this track" and is cached too, so it
 * isn't asked again; temporary failures are never cached.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CACHED_TRACKS = 50_000;
/** Deezer signs preview URLs for about 15 minutes, so they are kept for less than that. */
const PREVIEW_TTL_MS = 10 * 60 * 1000;
const MAX_CACHED_PREVIEWS = 5_000;
const RECCOBEATS_CONCURRENCY = 4;
const ANALYSIS_CONCURRENCY = 2;
/** Previews are about 0.5 MB; anything far bigger isn't a preview. */
const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;

const featuresCache = new TtlCache<string, AudioFeatures | null>(DAY_MS, MAX_CACHED_TRACKS);
const detailsCache = new TtlCache<string, TrackDetails | null>(DAY_MS, MAX_CACHED_TRACKS);
const previewCache = new TtlCache<string, string | null>(PREVIEW_TTL_MS, MAX_CACHED_PREVIEWS);
const reccoBeatsLimit = pLimit(RECCOBEATS_CONCURRENCY);
const analysisLimit = pLimit(ANALYSIS_CONCURRENCY);
/** Features computed from previews, by Spotify track ID. `null`: no preview to analyze. */
const analysisCache = new TtlCache<string, AudioFeatures | null>(DAY_MS, MAX_CACHED_TRACKS);

export interface PreviewQuery {
  isrc: string | null;
  title: string;
  artistName: string;
}

export interface AnalysisQuery extends PreviewQuery {
  trackId: string;
}

/** Audio features by Spotify track ID (ReccoBeats, or an earlier preview analysis). Unknown tracks are left out. */
export async function getAudioFeatures(trackIds: readonly string[]): Promise<Map<string, AudioFeatures>> {
  const uniqueIds = [...new Set(trackIds)];
  const missingIds = uniqueIds.filter((id) => !featuresCache.has(id));

  await Promise.all(
    chunk(missingIds, RECCOBEATS_MAX_IDS_PER_REQUEST).map((batch) =>
      reccoBeatsLimit(async () => {
        const found = await getAudioFeaturesBatch(batch);
        if (!found) return;
        for (const id of batch) featuresCache.set(id, found.get(id) ?? null);
      }),
    ),
  );

  const featuresById = new Map<string, AudioFeatures>();
  for (const id of uniqueIds) {
    // Tracks ReccoBeats doesn't know may already have been analyzed from their preview.
    const features = featuresCache.get(id) ?? analysisCache.get(id);
    if (features) featuresById.set(id, features);
  }
  return featuresById;
}

async function loadDetails(isrc: string): Promise<TrackDetails | null | undefined> {
  const result = await deezer.getTrackByIsrc(isrc);
  if (result.status === 'ok') return deezer.toTrackDetails(result.data);
  return result.status === 'not_found' ? null : undefined;
}

/** BPM and popularity (Deezer) by ISRC. Unknown tracks are left out of the result. */
export async function getTrackDetails(isrcs: readonly string[]): Promise<Record<string, TrackDetails>> {
  const uniqueIsrcs = [...new Set(isrcs)];
  const details = await Promise.all(uniqueIsrcs.map((isrc) => detailsCache.getOrLoad(isrc, () => loadDetails(isrc))));

  const result: Record<string, TrackDetails> = {};
  uniqueIsrcs.forEach((isrc, index) => {
    const value = details[index];
    if (value) result[isrc] = value;
  });
  return result;
}

/** Details already in the cache, without calling Deezer. */
export function peekTrackDetails(isrc: string): TrackDetails | undefined {
  return detailsCache.get(isrc) ?? undefined;
}

async function loadPreviewUrl({ isrc, title, artistName }: PreviewQuery): Promise<string | null> {
  if (isrc) {
    const result = await deezer.getTrackByIsrc(isrc);
    if (result.status === 'ok') {
      detailsCache.set(isrc, deezer.toTrackDetails(result.data));
      if (result.data.preview) return result.data.preview;
    }
  }
  const searched = await deezer.searchTrack(title, artistName);
  return searched?.preview || (await findItunesPreview(title, artistName));
}

/**
 * 30 second preview: Deezer by ISRC, then Deezer search, then iTunes. The cache key comes
 * only from the query itself, so one user's request can't change what another user hears,
 * and URLs outside the allowed audio hosts are dropped.
 */
export async function findPreviewUrl(query: PreviewQuery): Promise<string | null> {
  const key = query.isrc ?? `${normalizeForMatch(query.artistName)}|${normalizeForMatch(query.title)}`;
  const url = await previewCache.getOrLoad(key, () => loadPreviewUrl(query));
  return url && isAllowedPreviewUrl(url) ? url : null;
}

async function loadAnalysis(query: AnalysisQuery): Promise<AudioFeatures | null | undefined> {
  const url = await findPreviewUrl(query);
  if (!url) return null;
  const audio = await fetchBytes(url, { maxBytes: MAX_PREVIEW_BYTES });
  if (!audio) return undefined;
  return (await analyzeAudio(query.trackId, audio)) ?? undefined;
}

/**
 * Audio features computed from the 30 second preview, for tracks ReccoBeats doesn't know.
 * Slow (a few seconds per track), so the browser asks for a few tracks at a time.
 */
export async function analyzeTracks(queries: readonly AnalysisQuery[]): Promise<Record<string, AudioFeatures>> {
  const results = await Promise.all(
    queries.map((query) =>
      analysisLimit(() => analysisCache.getOrLoad(query.trackId, () => loadAnalysis(query))),
    ),
  );
  const featuresById: Record<string, AudioFeatures> = {};
  queries.forEach((query, index) => {
    const features = results[index];
    if (features) featuresById[query.trackId] = features;
  });
  return featuresById;
}
