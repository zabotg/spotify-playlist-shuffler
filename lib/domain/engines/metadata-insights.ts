import type { Credit, TrackMetadata } from '@/lib/domain/models/metadata';
import { countBy, topEntries } from '@/lib/utils/array';

/** Insights built from MusicBrainz metadata: real release decades, community tags, credits. */

export interface MetadataInsights {
  /** Tracks that had metadata. */
  coveredTracks: number;
  originalDecadeDistribution: Record<string, number>;
  topTags: { tag: string; tracks: number }[];
  topCredits: { name: string; role: string; tracks: number }[];
}

const TOP_TAG_LIMIT = 12;
const TOP_CREDIT_LIMIT = 8;
/** A tag or credit must show up on at least this many tracks to be shown. */
const MIN_TRACKS = 2;
const CREDIT_ROLES = new Set(['producer', 'mix', 'engineer', 'composer', 'writer', 'arranger']);

export function summarizeMetadata(entries: readonly TrackMetadata[]): MetadataInsights {
  const years = entries.map((entry) => entry.originalYear).filter((year) => year !== null);
  const tags = entries.flatMap((entry) => [...new Set(entry.tags)]);
  const creditByKey = new Map<string, Credit>();
  const creditKeys = entries.flatMap((entry) => {
    const keys = new Set<string>();
    for (const credit of entry.credits.filter(({ role }) => CREDIT_ROLES.has(role))) {
      const key = `${credit.role}:${credit.name}`;
      creditByKey.set(key, credit);
      keys.add(key);
    }
    return [...keys];
  });

  return {
    coveredTracks: entries.length,
    originalDecadeDistribution: Object.fromEntries(countBy(years, (year) => `${Math.floor(year / 10) * 10}s`)),
    topTags: topEntries(countBy(tags, (tag) => tag), TOP_TAG_LIMIT)
      .filter(([, count]) => count >= MIN_TRACKS)
      .map(([tag, count]) => ({ tag, tracks: count })),
    topCredits: topEntries(countBy(creditKeys, (key) => key), TOP_CREDIT_LIMIT)
      .filter(([, count]) => count >= MIN_TRACKS)
      .map(([key, count]) => ({ ...(creditByKey.get(key) as Credit), tracks: count })),
  };
}
