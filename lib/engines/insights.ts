/**
 * Playlist insights computation — pure function, no I/O.
 * Input: tracks with audio features. Output: PlaylistInsights.
 */

import type {
  PlaylistInsights,
  AudioFeatureKey,
  MoodQuadrant,
  MoodLabel,
  SpotifyArtist,
} from '@/types';
import type { TrackWithFeatures } from '@/lib/engines/shuffle';

export function computeInsights(
  items: TrackWithFeatures[],
  artistDetails: SpotifyArtist[]
): PlaylistInsights {
  // Separate valid from invalid tracks
  const localTracks = items.filter(i => i.track.is_local).length;
  const unavailable = items.filter(i => i.track.is_playable === false && !i.track.is_local).length;
  const valid = items.filter(i => !i.track.is_local && i.track.is_playable !== false);

  // ── Basic ──────────────────────────────────────────────────────────────
  const totalDurationMs = valid.reduce((s, i) => s + i.track.duration_ms, 0);
  const explicitCount = valid.filter(i => i.track.explicit).length;

  // ── Artists ────────────────────────────────────────────────────────────
  const artistCount = new Map<string, { name: string; count: number }>();
  for (const item of valid) {
    const a = item.track.artists[0];
    if (!a) continue;
    const existing = artistCount.get(a.id);
    if (existing) existing.count++;
    else artistCount.set(a.id, { name: a.name, count: 1 });
  }

  const topArtists = [...artistCount.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([id, { name, count }]) => ({
      id,
      name,
      trackCount: count,
      percentage: valid.length > 0 ? count / valid.length : 0,
    }));

  const maxShare = topArtists[0]?.percentage ?? 0;
  const artistDiversityScore = 1 - maxShare;

  // ── Temporal ───────────────────────────────────────────────────────────
  const releaseYearDistribution: Record<string, number> = {};
  const decadeDistribution: Record<string, number> = {};
  const years: number[] = [];

  for (const item of valid) {
    const date = item.track.album.release_date;
    const year = parseInt(date?.slice(0, 4) ?? '0', 10);
    if (year > 1900) {
      years.push(year);
      releaseYearDistribution[year] = (releaseYearDistribution[year] ?? 0) + 1;
      const decade = `${Math.floor(year / 10) * 10}s`;
      decadeDistribution[decade] = (decadeDistribution[decade] ?? 0) + 1;
    }
  }

  const averageReleaseYear = years.length > 0 ? Math.round(avg(years)) : 0;

  // ── Popularity ─────────────────────────────────────────────────────────
  const popularities = valid.map(i => i.track.popularity);
  const averagePopularity = avg(popularities);
  const popularityDistribution = {
    underground: popularities.filter(p => p < 30).length,
    mid: popularities.filter(p => p >= 30 && p < 70).length,
    mainstream: popularities.filter(p => p >= 70).length,
  };

  // ── Audio Features ─────────────────────────────────────────────────────
  const withFeatures = valid.filter(i => i.features != null);
  const f = (key: keyof import('@/types').AudioFeatures): number =>
    withFeatures.length > 0
      ? avg(withFeatures.map(i => (i.features as any)[key] as number))
      : 0;

  // Tempo: prefer Spotify audio features, fall back to Deezer BPM
  const tempoValues = valid
    .map(i => i.features?.tempo ?? (i.deezer?.bpm ?? null))
    .filter((v): v is number => v !== null && v > 0);
  const avgTempo            = tempoValues.length > 0 ? avg(tempoValues) : 0;
  const avgEnergy           = f('energy');
  const avgDanceability     = f('danceability');
  const avgValence          = f('valence');
  const avgAcousticness     = f('acousticness');
  const avgInstrumentalness = f('instrumentalness');
  const avgLiveness         = f('liveness');
  const avgSpeechiness      = f('speechiness');

  // ── Feature Histograms (10 buckets 0–1) ───────────────────────────────
  const featureKeys: AudioFeatureKey[] = [
    'energy', 'danceability', 'valence', 'acousticness',
    'instrumentalness', 'liveness', 'speechiness',
  ];

  const featureHistograms = {} as Record<AudioFeatureKey, number[]>;
  for (const key of featureKeys) {
    const histogram = Array(10).fill(0);
    for (const item of withFeatures) {
      const val = (item.features as any)[key] as number;
      const bucket = Math.min(9, Math.floor(val * 10));
      histogram[bucket]++;
    }
    featureHistograms[key] = histogram;
  }

  // ── Mood ───────────────────────────────────────────────────────────────
  const moodQuadrant = classifyMoodQuadrant(avgValence, avgEnergy);
  const moodLabel = deriveMoodLabel(avgValence, avgEnergy, avgDanceability, avgAcousticness);

  // ── Genres (from artist details) ───────────────────────────────────────
  const genreCount = new Map<string, number>();
  for (const artist of artistDetails) {
    for (const genre of artist.genres ?? []) {
      genreCount.set(genre, (genreCount.get(genre) ?? 0) + 1);
    }
  }
  const genreEstimate = [...genreCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([g]) => g);

  return {
    totalTracks: items.length,
    validTracks: valid.length,
    localTracks,
    unavailableTracks: unavailable,
    totalDurationMs,
    explicitRatio: valid.length > 0 ? explicitCount / valid.length : 0,
    uniqueArtists: artistCount.size,
    topArtists,
    artistDiversityScore,
    releaseYearDistribution,
    decadeDistribution,
    averageReleaseYear,
    averagePopularity,
    popularityDistribution,
    avgTempo,
    avgEnergy,
    avgDanceability,
    avgValence,
    avgAcousticness,
    avgInstrumentalness,
    avgLiveness,
    avgSpeechiness,
    moodLabel,
    moodQuadrant,
    genreEstimate,
    featureHistograms,
  };
}

function classifyMoodQuadrant(valence: number, energy: number): MoodQuadrant {
  if (valence >= 0.5 && energy >= 0.5) return 'Joyful';
  if (valence < 0.5 && energy >= 0.5) return 'Intense';
  if (valence < 0.5 && energy < 0.5) return 'Melancholic';
  return 'Calm';
}

function deriveMoodLabel(
  valence: number,
  energy: number,
  danceability: number,
  acousticness: number
): MoodLabel {
  if (valence > 0.7 && energy > 0.7 && danceability > 0.7) return 'Euphoric';
  if (valence > 0.6 && energy > 0.6) return 'Energetic';
  if (valence > 0.6 && energy < 0.5) return acousticness > 0.5 ? 'Dreamy' : 'Happy';
  if (valence < 0.4 && energy > 0.7) return 'Aggressive';
  if (valence < 0.4 && energy > 0.5) return 'Tense';
  if (valence < 0.3 && energy < 0.4) return 'Melancholic';
  if (valence < 0.4 && energy < 0.4) return 'Sad';
  if (valence > 0.5 && energy < 0.4) return acousticness > 0.5 ? 'Peaceful' : 'Chill';
  if (valence < 0.5 && energy < 0.3) return 'Dark';
  return 'Balanced';
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}
