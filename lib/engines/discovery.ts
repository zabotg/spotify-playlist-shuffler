import { primaryArtistId, type Track } from '@/lib/domain/playlist';
import { uniqueBy } from '@/lib/utils/array';

export interface CandidateSelection {
  existingTrackIds: ReadonlySet<string>;
  maxPerArtist: number;
  limit: number;
}

export function selectNewCandidates(
  candidates: readonly Track[],
  { existingTrackIds, maxPerArtist, limit }: CandidateSelection,
): Track[] {
  const countsByArtist = new Map<string, number>();
  const selected: Track[] = [];

  for (const track of uniqueBy(candidates, (candidate) => candidate.id)) {
    if (selected.length >= limit) break;
    if (existingTrackIds.has(track.id)) continue;

    const artistId = primaryArtistId(track);
    const artistCount = countsByArtist.get(artistId) ?? 0;
    if (artistCount >= maxPerArtist) continue;

    countsByArtist.set(artistId, artistCount + 1);
    selected.push(track);
  }
  return selected;
}
