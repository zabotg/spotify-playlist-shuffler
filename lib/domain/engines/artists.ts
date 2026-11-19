import { primaryArtistId, type Artist, type Track } from '@/lib/domain/models/playlist';
import { countBy, topEntries } from '@/lib/utils/array';

export interface RankedArtist extends Artist {
  trackCount: number;
}

export function rankArtistsByTrackCount(tracks: readonly Track[], limit: number): RankedArtist[] {
  const namesById = new Map(tracks.flatMap((track) => track.artists.slice(0, 1)).map((a) => [a.id, a.name]));
  const counts = countBy(
    tracks.filter((track) => track.artists.length > 0),
    primaryArtistId,
  );
  return topEntries(counts, limit).map(([id, trackCount]) => ({
    id,
    name: namesById.get(id) ?? id,
    trackCount,
  }));
}
