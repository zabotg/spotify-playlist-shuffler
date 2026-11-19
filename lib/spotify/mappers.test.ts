import { describe, expect, it } from 'vitest';
import { toPlaylistSummary, toPlaylistTracks } from './mappers';
import type { RawTrack } from './types';

function rawTrack(overrides: Partial<RawTrack> = {}): RawTrack {
  return {
    type: 'track',
    id: 'abc',
    uri: 'spotify:track:abc',
    name: 'Song',
    artists: [{ id: 'artist', name: 'Artist' }],
    album: { name: 'Album', release_date: '2001-02-03', images: [{ url: 'https://i.scdn.co/image/1' }] },
    duration_ms: 1000,
    explicit: false,
    external_ids: { isrc: 'US1234567890' },
    ...overrides,
  };
}

describe('toPlaylistTracks', () => {
  it('reads the item field used by the current Spotify API', () => {
    const { tracks } = toPlaylistTracks([{ item: rawTrack() }]);
    expect(tracks[0]).toMatchObject({ id: 'abc', isrc: 'US1234567890', imageUrl: 'https://i.scdn.co/image/1' });
  });

  it('still reads the legacy track field', () => {
    expect(toPlaylistTracks([{ track: rawTrack() }]).tracks).toHaveLength(1);
  });

  it('counts local files, episodes and removed tracks as skipped', () => {
    const result = toPlaylistTracks([
      { item: rawTrack() },
      { item: rawTrack({ is_local: true }) },
      { item: { type: 'episode' } },
      { item: null },
    ]);
    expect(result.tracks).toHaveLength(1);
    expect(result.skippedItemCount).toBe(3);
  });
});

describe('toPlaylistSummary', () => {
  it('strips html from the description and reads the renamed items total', () => {
    const summary = toPlaylistSummary({
      id: 'p1',
      name: 'Mix',
      description: '<a href="#">Best</a> songs',
      images: null,
      owner: { id: 'me', display_name: 'Me' },
      collaborative: false,
      items: { total: 42 },
    });
    expect(summary).toMatchObject({ description: 'Best songs', imageUrl: null, trackCount: 42 });
  });
});
