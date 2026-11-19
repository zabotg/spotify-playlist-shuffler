import type { AudioFeatures, EnrichedTrack, Track } from '@/lib/domain/playlist';
import type { RandomSource } from '@/lib/utils/random';

let nextId = 0;

export function makeTrack(overrides: Partial<Track> = {}): Track {
  nextId += 1;
  return {
    id: `track-${nextId}`,
    uri: `spotify:track:track${nextId}`,
    name: `Track ${nextId}`,
    artists: [{ id: 'artist-a', name: 'Artist A' }],
    albumName: 'Album',
    releaseDate: '2020-01-01',
    imageUrl: null,
    durationMs: 180_000,
    explicit: false,
    isrc: null,
    ...overrides,
  };
}

export function makeFeatures(overrides: Partial<AudioFeatures> = {}): AudioFeatures {
  return {
    id: 'features',
    tempo: 120,
    energy: 0.5,
    danceability: 0.5,
    valence: 0.5,
    acousticness: 0.5,
    instrumentalness: 0,
    liveness: 0.1,
    speechiness: 0.05,
    key: 0,
    mode: 1,
    loudness: -6,
    ...overrides,
  };
}

export function enrich(track: Track, extra: Partial<Omit<EnrichedTrack, 'track'>> = {}): EnrichedTrack {
  return { track, features: null, bpm: null, previewUrl: null, ...extra };
}

export function byArtist(artistId: string): Track {
  return makeTrack({ artists: [{ id: artistId, name: artistId }] });
}

export function seededRandom(seed = 42): RandomSource {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 2 ** 32;
    return state / 2 ** 32;
  };
}
