import type { AudioFeatures } from '@/lib/domain/models/playlist';

/**
 * The "sound" of a playlist as the average and spread of a few audio features, and how far a
 * track is from it. Used to rank suggestions and to find tracks that don't fit.
 */

export type ProfileDimension = 'energy' | 'valence' | 'danceability' | 'acousticness' | 'tempo';

export const PROFILE_DIMENSIONS: readonly ProfileDimension[] = [
  'energy',
  'valence',
  'danceability',
  'acousticness',
  'tempo',
];

/** Tempo is scaled so it weighs about as much as the 0-1 features. */
const TEMPO_SCALE = 200;
/** Floor for the spread, so a very uniform playlist doesn't turn tiny differences into huge ones. */
const MIN_DEVIATION = 0.05;

export interface SoundProfile {
  mean: Record<ProfileDimension, number>;
  deviation: Record<ProfileDimension, number>;
}

export function dimensionValue(features: AudioFeatures, dimension: ProfileDimension): number {
  return dimension === 'tempo' ? features.tempo / TEMPO_SCALE : features[dimension];
}

/** Average and spread of the given features, or null when there are none. */
export function buildSoundProfile(features: readonly AudioFeatures[]): SoundProfile | null {
  if (features.length === 0) return null;
  const mean = {} as Record<ProfileDimension, number>;
  const deviation = {} as Record<ProfileDimension, number>;
  for (const dimension of PROFILE_DIMENSIONS) {
    const values = features.map((item) => dimensionValue(item, dimension));
    const average = values.reduce((total, value) => total + value, 0) / values.length;
    const variance = values.reduce((total, value) => total + (value - average) ** 2, 0) / values.length;
    mean[dimension] = average;
    deviation[dimension] = Math.max(Math.sqrt(variance), MIN_DEVIATION);
  }
  return { mean, deviation };
}

/** How many standard deviations each dimension is away from the profile (signed). */
export function zScores(features: AudioFeatures, profile: SoundProfile): Record<ProfileDimension, number> {
  const scores = {} as Record<ProfileDimension, number>;
  for (const dimension of PROFILE_DIMENSIONS) {
    scores[dimension] = (dimensionValue(features, dimension) - profile.mean[dimension]) / profile.deviation[dimension];
  }
  return scores;
}

/** Overall distance from the profile (root mean square of the z-scores). 0 = right at the average. */
export function profileDistance(features: AudioFeatures, profile: SoundProfile): number {
  const scores = Object.values(zScores(features, profile));
  return Math.sqrt(scores.reduce((total, z) => total + z * z, 0) / scores.length);
}
