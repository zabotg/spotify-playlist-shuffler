import pLimit from 'p-limit';
import type { AudioFeatures } from '@/lib/domain/models/playlist';
import { chunk } from '@/lib/utils/array';
import { sleep } from '@/lib/utils/async';
import { TtlCache } from '@/lib/utils/ttl-cache';

/**
 * ReccoBeats is a free public API with the audio features Spotify no longer gives to new apps
 * (tempo, key, energy, danceability, valence...). It is looked up by Spotify track ID.
 * https://reccobeats.com/docs
 */
const RECCOBEATS_API_URL = 'https://api.reccobeats.com/v1';
const MAX_IDS_PER_REQUEST = 40;
const MAX_CONCURRENT_REQUESTS = 4;
const MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 1000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 50_000;
const SPOTIFY_TRACK_ID_PATTERN = /track\/([A-Za-z0-9]+)/;

const limit = pLimit(MAX_CONCURRENT_REQUESTS);
/** `null` means ReccoBeats has no data for the track, so it is not asked again. */
const cache = new TtlCache<string, AudioFeatures | null>(CACHE_TTL_MS, CACHE_MAX_ENTRIES);

interface RawReccoBeatsFeatures extends Omit<AudioFeatures, 'id'> {
  href: string;
}

async function fetchBatch(trackIds: readonly string[], attempt = 0): Promise<RawReccoBeatsFeatures[] | null> {
  try {
    const response = await fetch(`${RECCOBEATS_API_URL}/audio-features?ids=${trackIds.join(',')}`, {
      cache: 'no-store',
    });
    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfterSeconds = Number(response.headers.get('Retry-After'));
      await sleep(retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : DEFAULT_RETRY_DELAY_MS);
      return fetchBatch(trackIds, attempt + 1);
    }
    if (!response.ok) return null;
    const body = (await response.json()) as { content?: RawReccoBeatsFeatures[] };
    return body.content ?? [];
  } catch {
    return null;
  }
}

function toAudioFeatures(spotifyId: string, raw: RawReccoBeatsFeatures): AudioFeatures {
  return {
    id: spotifyId,
    tempo: raw.tempo,
    energy: raw.energy,
    danceability: raw.danceability,
    valence: raw.valence,
    acousticness: raw.acousticness,
    instrumentalness: raw.instrumentalness,
    liveness: raw.liveness,
    speechiness: raw.speechiness,
    key: raw.key,
    mode: raw.mode,
    loudness: raw.loudness,
  };
}

/** Audio features by Spotify track ID. Tracks ReccoBeats doesn't know are left out. */
export async function getAudioFeatures(trackIds: readonly string[]): Promise<Map<string, AudioFeatures>> {
  const uniqueIds = [...new Set(trackIds)];
  const missingIds = uniqueIds.filter((id) => !cache.has(id));

  await Promise.all(
    chunk(missingIds, MAX_IDS_PER_REQUEST).map((batch) =>
      limit(async () => {
        const results = await fetchBatch(batch);
        if (!results) return; // network or server error: don't cache, try again next time

        const found = new Map<string, AudioFeatures>();
        for (const raw of results) {
          const spotifyId = SPOTIFY_TRACK_ID_PATTERN.exec(raw.href)?.[1];
          if (spotifyId) found.set(spotifyId, toAudioFeatures(spotifyId, raw));
        }
        for (const id of batch) cache.set(id, found.get(id) ?? null);
      }),
    ),
  );

  const featuresById = new Map<string, AudioFeatures>();
  for (const id of uniqueIds) {
    const features = cache.get(id);
    if (features) featuresById.set(id, features);
  }
  return featuresById;
}
