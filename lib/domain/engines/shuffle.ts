import { primaryArtistId, type AudioFeatures, type EnrichedTrack } from '@/lib/domain/models/playlist';
import {
  ARTIST_GAP_LIMITS,
  DEFAULT_ENERGY_PROFILE,
  DEFAULT_MOOD_SEQUENCE,
  type EnergyProfile,
  type MoodQuadrant,
  type ShuffleMode,
  type ShuffleOptions,
} from '@/lib/domain/models/shuffle';
import { groupBy } from '@/lib/utils/array';
import { randomIndex, shuffleArray, type RandomSource } from '@/lib/utils/random';
import { scoreTransition } from './flow';
import { classifyMoodQuadrant } from './mood';

/** Random spread added before sorting, so each run differs while keeping the overall shape. */
const BPM_JITTER = 8;
const ENERGY_JITTER = 0.08;
/** How many times `shuffleAgain` retries before accepting an identical order. */
const RESHUFFLE_ATTEMPTS = 5;
/** Random bonus (0-1 scale) that lets close candidates win sometimes, so runs differ. */
const DJ_MIX_NOISE = 0.05;

type Arranger = <T>(sortedAscending: T[]) => T[];
type Shuffler = (tracks: EnrichedTrack[], options: ShuffleOptions, random: RandomSource) => EnrichedTrack[];

const artistOf = (item: EnrichedTrack) => primaryArtistId(item.track);

interface WithFeatures {
  item: EnrichedTrack;
  features: AudioFeatures;
}

/** Tracks with audio features (paired with them, so no null checks later) and tracks without. */
function splitByFeatures(tracks: readonly EnrichedTrack[]): [WithFeatures[], EnrichedTrack[]] {
  const withFeatures: WithFeatures[] = [];
  const withoutFeatures: EnrichedTrack[] = [];
  for (const item of tracks) {
    if (item.features) withFeatures.push({ item, features: item.features });
    else withoutFeatures.push(item);
  }
  return [withFeatures, withoutFeatures];
}

const evenIndexed = <T>(items: T[]) => items.filter((_, index) => index % 2 === 0);
const oddIndexed = <T>(items: T[]) => items.filter((_, index) => index % 2 === 1);

export const toMountainArc: Arranger = (sorted) => [...evenIndexed(sorted), ...oddIndexed(sorted).reverse()];

const ENERGY_ARRANGERS: Record<EnergyProfile, Arranger> = {
  ascending: (sorted) => sorted,
  descending: (sorted) => [...sorted].reverse(),
  mountain: toMountainArc,
  valley: (sorted) => toMountainArc([...sorted].reverse()),
  wave: (sorted) => [...toMountainArc(evenIndexed(sorted)), ...toMountainArc(oddIndexed(sorted))],
};

export function balancedShuffle(tracks: EnrichedTrack[], random: RandomSource = Math.random): EnrichedTrack[] {
  // Buckets are shuffled first: the sort is stable, so artists with the same number of
  // tracks end up in a random order instead of always in playlist order.
  const buckets = shuffleArray([...groupBy(tracks, artistOf).values()], random)
    .map((bucket) => shuffleArray(bucket, random))
    .sort((a, b) => b.length - a.length);
  const longestBucket = buckets[0]?.length ?? 0;

  const result: EnrichedTrack[] = [];
  for (let round = 0; round < longestBucket; round++) {
    for (const bucket of buckets) {
      if (round < bucket.length) result.push(bucket[round]);
    }
  }
  return result;
}

export function artistAwareShuffle(
  tracks: EnrichedTrack[],
  minGap: number = ARTIST_GAP_LIMITS.default,
  random: RandomSource = Math.random,
): EnrichedTrack[] {
  const uniqueArtistCount = new Set(tracks.map(artistOf)).size;
  const effectiveGap = Math.min(minGap, Math.max(1, uniqueArtistCount - 1));
  const remaining = [...tracks];
  const result: EnrichedTrack[] = [];

  while (remaining.length > 0) {
    const recentArtists = new Set(result.slice(-effectiveGap).map(artistOf));
    const eligible = remaining.filter((item) => !recentArtists.has(artistOf(item)));
    const pool = eligible.length > 0 ? eligible : remaining;
    const chosen = pool[randomIndex(pool.length, random)];
    result.push(chosen);
    remaining.splice(remaining.indexOf(chosen), 1);
  }
  return result;
}

export function bpmSmoothShuffle(tracks: EnrichedTrack[], random: RandomSource = Math.random): EnrichedTrack[] {
  const withBpm = tracks.flatMap((item) => (item.bpm === null ? [] : [{ item, bpm: item.bpm }]));
  if (withBpm.length === 0) return shuffleArray(tracks, random);

  const ascending = withBpm
    .map(({ item, bpm }) => ({ item, sortKey: bpm + (random() - 0.5) * BPM_JITTER }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ item }) => item);
  const withoutBpm = tracks.filter((item) => item.bpm === null);

  return [...toMountainArc(ascending), ...shuffleArray(withoutBpm, random)];
}

export function energyCurveShuffle(
  tracks: EnrichedTrack[],
  profile: EnergyProfile = DEFAULT_ENERGY_PROFILE,
  random: RandomSource = Math.random,
): EnrichedTrack[] {
  const [withEnergy, withoutEnergy] = splitByFeatures(tracks);
  if (withEnergy.length === 0) return shuffleArray(tracks, random);

  const ascending = withEnergy
    .map(({ item, features }) => ({ item, sortKey: features.energy + (random() - 0.5) * ENERGY_JITTER }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ item }) => item);
  return [...ENERGY_ARRANGERS[profile](ascending), ...shuffleArray(withoutEnergy, random)];
}

export function moodShuffle(
  tracks: EnrichedTrack[],
  sequence: MoodQuadrant[] = DEFAULT_MOOD_SEQUENCE,
  random: RandomSource = Math.random,
): EnrichedTrack[] {
  const [withFeatures, withoutFeatures] = splitByFeatures(tracks);
  const byMood = groupBy(withFeatures, ({ features }) => classifyMoodQuadrant(features.valence, features.energy));
  const sequenced = sequence.flatMap((mood) =>
    shuffleArray((byMood.get(mood) ?? []).map(({ item }) => item), random),
  );
  const leftovers = withFeatures.map(({ item }) => item).filter((item) => !sequenced.includes(item));
  return [...sequenced, ...shuffleArray([...leftovers, ...withoutFeatures], random)];
}

/**
 * DJ-style order: starts from a random low-energy track, then always picks the remaining track
 * that blends best (compatible key, close tempo, small energy change). Small random noise keeps
 * each run different. Tracks without audio data go at the end.
 */
export function djMixShuffle(tracks: EnrichedTrack[], random: RandomSource = Math.random): EnrichedTrack[] {
  const [withFeatures, withoutFeatures] = splitByFeatures(tracks);
  if (withFeatures.length === 0) return shuffleArray(tracks, random);

  const remaining = withFeatures.map(({ item }) => item);
  const calmest = [...withFeatures].sort((a, b) => a.features.energy - b.features.energy).map(({ item }) => item);
  const startPool = calmest.slice(0, Math.ceil(calmest.length / 4));
  let current = startPool[randomIndex(startPool.length, random)];
  const result = [current];
  remaining.splice(remaining.indexOf(current), 1);

  while (remaining.length > 0) {
    const from = current;
    const scored = remaining.map((item) => ({
      item,
      // Both tracks have audio features here, so the transition always has a score.
      score: (scoreTransition(from, item).score as number) + random() * DJ_MIX_NOISE,
    }));
    current = scored.reduce((best, candidate) => (candidate.score > best.score ? candidate : best)).item;
    result.push(current);
    remaining.splice(remaining.indexOf(current), 1);
  }
  return [...result, ...shuffleArray(withoutFeatures, random)];
}

const SHUFFLERS: Record<ShuffleMode, Shuffler> = {
  pure_random: (tracks, _options, random) => shuffleArray(tracks, random),
  balanced: (tracks, _options, random) => balancedShuffle(tracks, random),
  artist_aware: (tracks, options, random) => artistAwareShuffle(tracks, options.artistMinGap, random),
  bpm_smooth: (tracks, _options, random) => bpmSmoothShuffle(tracks, random),
  energy_curve: (tracks, options, random) => energyCurveShuffle(tracks, options.energyProfile, random),
  mood_based: (tracks, options, random) => moodShuffle(tracks, options.moodSequence, random),
  dj_mix: (tracks, _options, random) => djMixShuffle(tracks, random),
};

export function applyShuffle(
  tracks: EnrichedTrack[],
  options: ShuffleOptions,
  random: RandomSource = Math.random,
): EnrichedTrack[] {
  return SHUFFLERS[options.mode](tracks, options, random);
}

function sameOrder(a: readonly EnrichedTrack[], b: readonly EnrichedTrack[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * Shuffles again, retrying a few times when the result matches the order on screen, so the
 * "Shuffle again" button always visibly changes something when the playlist allows it.
 */
export function shuffleAgain(
  tracks: EnrichedTrack[],
  options: ShuffleOptions,
  previous: readonly EnrichedTrack[] | null,
  random: RandomSource = Math.random,
): EnrichedTrack[] {
  let result = applyShuffle(tracks, options, random);
  for (let attempt = 1; previous && attempt < RESHUFFLE_ATTEMPTS && sameOrder(result, previous); attempt++) {
    result = applyShuffle(tracks, options, random);
  }
  return result;
}
