import { describe, expect, it } from 'vitest';
import { byArtist, makeTrack } from '@/test/factories';
import { rankArtistsByTrackCount } from '@/lib/domain/engines/artists';

describe('rankArtistsByTrackCount', () => {
  it('counts primary artists, most tracks first, and ignores tracks without artists', () => {
    const tracks = [byArtist('a'), byArtist('b'), byArtist('b'), makeTrack({ artists: [] })];
    expect(rankArtistsByTrackCount(tracks, 5)).toEqual([
      { id: 'b', name: 'b', trackCount: 2 },
      { id: 'a', name: 'a', trackCount: 1 },
    ]);
    expect(rankArtistsByTrackCount(tracks, 1)).toHaveLength(1);
  });
});
