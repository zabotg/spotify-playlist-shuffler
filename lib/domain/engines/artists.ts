import type { Artist, Track } from '@/lib/domain/models/playlist';

export interface RankedArtist extends Artist {
  trackCount: number;
}

/** The most frequent primary artists, most tracks first. */
export function rankArtistsByTrackCount(tracks: readonly Track[], limit: number): RankedArtist[] {
  const byId = new Map<string, RankedArtist>();
  for (const track of tracks) {
    const [artist] = track.artists;
    if (!artist) continue;
    const ranked = byId.get(artist.id) ?? { id: artist.id, name: artist.name, trackCount: 0 };
    ranked.trackCount += 1;
    byId.set(artist.id, ranked);
  }
  return [...byId.values()].sort((a, b) => b.trackCount - a.trackCount).slice(0, limit);
}
