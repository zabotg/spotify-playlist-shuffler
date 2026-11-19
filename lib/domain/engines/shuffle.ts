import { primaryArtistId, type EnrichedTrack } from '@/lib/domain/models/playlist';
import {
  ARTIST_GAP_LIMITS,
  DEFAULT_ENERGY_PROFILE,
  DEFAULT_MOOD_SEQUENCE,
  type EnergyProfile,
  type MoodQuadrant,
  type ShuffleMode,
  type ShuffleOptions,
} from '@/lib/domain/models/shuffle';
import { groupBy, partition } from '@/lib/utils/array';
import { randomIndex, shuffleArray, type RandomSource } from '@/lib/utils/random';
import { classifyMoodQuadrant } from './mood';

const BPM_JITTER = 4;

type Arranger = <T>(sortedAscending: T[]) => T[];
type Shuffler = (tracks: EnrichedTrack[], options: ShuffleOptions, random: RandomSource) => EnrichedTrack[];

const artistOf = (item: EnrichedTrack) => primaryArtistId(item.track);

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
  const buckets = [...groupBy(tracks, artistOf).values()]
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
  const [withBpm, withoutBpm] = partition(tracks, (item) => item.bpm !== null);
  if (withBpm.length === 0) return shuffleArray(tracks, random);

  const ascending = withBpm
    .map((item) => ({ item, sortKey: (item.bpm ?? 0) + (random() - 0.5) * BPM_JITTER }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ item }) => item);

  return [...toMountainArc(ascending), ...shuffleArray(withoutBpm, random)];
}

export function energyCurveShuffle(
  tracks: EnrichedTrack[],
  profile: EnergyProfile = DEFAULT_ENERGY_PROFILE,
  random: RandomSource = Math.random,
): EnrichedTrack[] {
  const [withEnergy, withoutEnergy] = partition(tracks, (item) => item.features !== null);
  if (withEnergy.length === 0) return shuffleArray(tracks, random);

  const ascending = [...withEnergy].sort((a, b) => (a.features?.energy ?? 0) - (b.features?.energy ?? 0));
  return [...ENERGY_ARRANGERS[profile](ascending), ...shuffleArray(withoutEnergy, random)];
}

export function moodShuffle(
  tracks: EnrichedTrack[],
  sequence: MoodQuadrant[] = DEFAULT_MOOD_SEQUENCE,
  random: RandomSource = Math.random,
): EnrichedTrack[] {
  const [withFeatures, withoutFeatures] = partition(tracks, (item) => item.features !== null);
  const byMood = groupBy(withFeatures, ({ features }) =>
    classifyMoodQuadrant(features?.valence ?? 0, features?.energy ?? 0),
  );
  const sequenced = sequence.flatMap((mood) => shuffleArray(byMood.get(mood) ?? [], random));
  const leftovers = withFeatures.filter((item) => !sequenced.includes(item));
  return [...sequenced, ...shuffleArray([...leftovers, ...withoutFeatures], random)];
}

const SHUFFLERS: Record<ShuffleMode, Shuffler> = {
  pure_random: (tracks, _options, random) => shuffleArray(tracks, random),
  balanced: (tracks, _options, random) => balancedShuffle(tracks, random),
  artist_aware: (tracks, options, random) => artistAwareShuffle(tracks, options.artistMinGap, random),
  bpm_smooth: (tracks, _options, random) => bpmSmoothShuffle(tracks, random),
  energy_curve: (tracks, options, random) => energyCurveShuffle(tracks, options.energyProfile, random),
  mood_based: (tracks, options, random) => moodShuffle(tracks, options.moodSequence, random),
};

export function applyShuffle(
  tracks: EnrichedTrack[],
  options: ShuffleOptions,
  random: RandomSource = Math.random,
): EnrichedTrack[] {
  return SHUFFLERS[options.mode](tracks, options, random);
}
