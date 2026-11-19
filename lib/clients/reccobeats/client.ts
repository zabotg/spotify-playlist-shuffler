import { fetchJsonOrNull } from '@/lib/clients/http/fetch-json';
import type { AudioFeatures } from '@/lib/domain/models/playlist';

/**
 * ReccoBeats is a free public API with the audio features Spotify no longer gives to new apps
 * (tempo, key, energy, danceability, valence...). It is looked up by Spotify track ID.
 * https://reccobeats.com/docs
 */
const RECCOBEATS_API_URL = 'https://api.reccobeats.com/v1';
export const RECCOBEATS_MAX_IDS_PER_REQUEST = 40;
export const RECCOBEATS_MAX_SEEDS = 5;
const MAX_RECOMMENDATIONS = 100;
const SPOTIFY_TRACK_ID_PATTERN = /open\.spotify\.com\/track\/([A-Za-z0-9]+)/;

interface RawReccoBeatsFeatures extends Omit<AudioFeatures, 'id'> {
  href: string;
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

/**
 * Audio features for up to 40 Spotify track IDs, keyed by ID. Tracks ReccoBeats doesn't know
 * are missing from the map. Returns `null` when the request itself failed.
 */
export async function getAudioFeaturesBatch(trackIds: readonly string[]): Promise<Map<string, AudioFeatures> | null> {
  if (trackIds.length === 0) return new Map();
  if (trackIds.length > RECCOBEATS_MAX_IDS_PER_REQUEST) {
    throw new RangeError(`ReccoBeats accepts at most ${RECCOBEATS_MAX_IDS_PER_REQUEST} IDs per request`);
  }

  const ids = trackIds.map(encodeURIComponent).join(',');
  const body = await fetchJsonOrNull<{ content?: RawReccoBeatsFeatures[] }>(
    `${RECCOBEATS_API_URL}/audio-features?ids=${ids}`,
  );
  if (!body) return null;

  const featuresById = new Map<string, AudioFeatures>();
  for (const raw of body.content ?? []) {
    const spotifyId = SPOTIFY_TRACK_ID_PATTERN.exec(raw.href)?.[1];
    if (spotifyId) featuresById.set(spotifyId, toAudioFeatures(spotifyId, raw));
  }
  return featuresById;
}

/** Analysis doesn't detect the key; -1 is the Spotify convention for "no key detected". */
export const UNKNOWN_KEY = -1;
const ANALYSIS_TIMEOUT_MS = 30_000;

type AnalyzedFeatures = Omit<AudioFeatures, 'id' | 'key' | 'mode'>;

/**
 * Computes audio features from an audio file (e.g. a 30 second preview), for tracks ReccoBeats
 * doesn't know. Returns `null` when the analysis fails.
 */
export async function analyzeAudio(spotifyId: string, audio: ArrayBuffer): Promise<AudioFeatures | null> {
  const form = new FormData();
  form.append('audioFile', new Blob([audio], { type: 'audio/mpeg' }), 'preview.mp3');
  const result = await fetchJsonOrNull<AnalyzedFeatures>(`${RECCOBEATS_API_URL}/analysis/audio-features`, {
    method: 'POST',
    body: form,
    timeoutMs: ANALYSIS_TIMEOUT_MS,
    maxRetries: 1,
  });
  if (!result || typeof result.tempo !== 'number') return null;
  return {
    id: spotifyId,
    tempo: result.tempo,
    energy: result.energy,
    danceability: result.danceability,
    valence: result.valence,
    acousticness: result.acousticness,
    instrumentalness: result.instrumentalness,
    liveness: result.liveness,
    speechiness: result.speechiness,
    loudness: result.loudness,
    key: UNKNOWN_KEY,
    mode: UNKNOWN_KEY,
  };
}

/**
 * Spotify IDs of tracks similar to the seed tracks (up to 5 Spotify IDs).
 * Returns `null` when the request failed.
 */
export async function getRecommendations(seedIds: readonly string[], size: number): Promise<string[] | null> {
  if (seedIds.length === 0) return [];
  const query = new URLSearchParams({
    seeds: seedIds.slice(0, RECCOBEATS_MAX_SEEDS).join(','),
    size: String(Math.min(Math.max(size, 1), MAX_RECOMMENDATIONS)),
  });
  const body = await fetchJsonOrNull<{ content?: { href: string }[] }>(
    `${RECCOBEATS_API_URL}/track/recommendation?${query}`,
  );
  if (!body) return null;
  return (body.content ?? [])
    .map((track) => SPOTIFY_TRACK_ID_PATTERN.exec(track.href)?.[1])
    .filter((id): id is string => id !== undefined);
}
