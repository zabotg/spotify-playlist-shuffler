import { primaryArtistId, type EnrichedTrack } from '@/lib/domain/models/playlist';
import { normalizeForMatch } from '@/lib/utils/text';
import {
  buildSoundProfile,
  PROFILE_DIMENSIONS,
  zScores,
  type ProfileDimension,
  type SoundProfile,
} from './similarity';

/** Finds repeated songs and songs that don't match the rest of the playlist. */

export interface DuplicateGroup {
  /** Positions in the playlist, first occurrence first. */
  positions: number[];
}

export type OutlierReason =
  | 'more energetic'
  | 'calmer'
  | 'happier'
  | 'sadder'
  | 'more danceable'
  | 'less danceable'
  | 'more acoustic'
  | 'more electronic'
  | 'faster'
  | 'slower';

export interface Outlier {
  position: number;
  /** How far the track's most different aspect is from the playlist average, in standard deviations. */
  distance: number;
  reason: OutlierReason;
}

const MIN_TRACKS_FOR_OUTLIERS = 8;
/** A track is out of place when one aspect of its sound is this many standard deviations away. */
const OUTLIER_THRESHOLD = 2.2;

const REASONS: Record<ProfileDimension, { above: OutlierReason; below: OutlierReason }> = {
  energy: { above: 'more energetic', below: 'calmer' },
  valence: { above: 'happier', below: 'sadder' },
  danceability: { above: 'more danceable', below: 'less danceable' },
  acousticness: { above: 'more acoustic', below: 'more electronic' },
  tempo: { above: 'faster', below: 'slower' },
};

function matchKeys({ track }: EnrichedTrack): string[] {
  const titleKey = `song:${primaryArtistId(track)}|${normalizeForMatch(track.name)}`;
  return track.isrc ? [`isrc:${track.isrc}`, titleKey] : [titleKey];
}

/** Same recording (ISRC) or the same title by the same artist, e.g. a remaster or live version. */
export function findDuplicates(tracks: readonly EnrichedTrack[]): DuplicateGroup[] {
  const groupByKey = new Map<string, number[]>();
  const groups: number[][] = [];

  tracks.forEach((item, position) => {
    const keys = matchKeys(item);
    const group = keys.map((key) => groupByKey.get(key)).find((found) => found !== undefined);
    if (group) group.push(position);
    else groups.push([position]);
    const target = group ?? (groups.at(-1) as number[]);
    for (const key of keys) groupByKey.set(key, target);
  });

  return groups.filter((positions) => positions.length > 1).map((positions) => ({ positions }));
}

/** Tracks with one aspect of their sound far from the playlist average, most different first. */
export function findOutliers(tracks: readonly EnrichedTrack[], limit: number): Outlier[] {
  const withFeatures = tracks.flatMap((item, position) => (item.features ? [{ position, features: item.features }] : []));
  if (withFeatures.length < MIN_TRACKS_FOR_OUTLIERS) return [];
  const profile = buildSoundProfile(withFeatures.map(({ features }) => features)) as SoundProfile;

  return withFeatures
    .map(({ position, features }) => {
      const scores = zScores(features, profile);
      const strongest = PROFILE_DIMENSIONS.reduce((best, dimension) =>
        Math.abs(scores[dimension]) > Math.abs(scores[best]) ? dimension : best,
      );
      const reasons = REASONS[strongest];
      return {
        position,
        distance: Math.abs(scores[strongest]),
        reason: scores[strongest] >= 0 ? reasons.above : reasons.below,
      };
    })
    .filter((outlier) => outlier.distance >= OUTLIER_THRESHOLD)
    .sort((a, b) => b.distance - a.distance)
    .slice(0, limit);
}
