import { fetchJsonOrNull } from '@/lib/clients/http/fetch-json';
import type { AudioFeatures } from '@/lib/domain/models/playlist';

/**
 * ReccoBeats is a free public API with the audio features Spotify no longer gives to new apps
 * (tempo, key, energy, danceability, valence...). It is looked up by Spotify track ID.
 * https://reccobeats.com/docs
 */
const RECCOBEATS_API_URL = 'https://api.reccobeats.com/v1';
export const RECCOBEATS_MAX_IDS_PER_REQUEST = 40;
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
