import type { EnrichedTrack } from '@/lib/domain/models/playlist';

/** Below this many tracks with popularity data, "least known" isn't meaningful. */
const MIN_TRACKS_WITH_POPULARITY = 10;

/** The least known tracks of the playlist (lowest Deezer rank), least known first. */
export function findHiddenGems(tracks: readonly EnrichedTrack[], limit: number): EnrichedTrack[] {
  const ranked = tracks.filter((item) => item.popularity !== null);
  if (ranked.length < MIN_TRACKS_WITH_POPULARITY) return [];
  return [...ranked].sort((a, b) => (a.popularity as number) - (b.popularity as number)).slice(0, limit);
}
