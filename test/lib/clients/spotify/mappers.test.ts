import { describe, expect, it } from 'vitest';
import { toPlaylistSummary, toPlaylistTracks, toUser } from '@/lib/clients/spotify/mappers';
import type { RawTrack } from '@/lib/clients/spotify/types';

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
    const { items } = toPlaylistTracks([{ item: rawTrack() }]);
    expect(items[0]?.track).toMatchObject({ id: 'abc', isrc: 'US1234567890', imageUrl: 'https://i.scdn.co/image/1' });
  });

  it('still reads the legacy track field', () => {
    expect(toPlaylistTracks([{ track: rawTrack() }]).items).toHaveLength(1);
  });

  it('keeps who added each track and when', () => {
    const { items } = toPlaylistTracks([{ item: rawTrack(), added_at: '2025-01-23T10:00:00Z', added_by: { id: 'me' } }]);
    expect(items[0]).toMatchObject({ addedAt: '2025-01-23T10:00:00Z', addedById: 'me' });
  });

  it('counts local files, episodes and removed tracks as skipped', () => {
    const result = toPlaylistTracks([
      { item: rawTrack() },
      { item: rawTrack({ is_local: true }) },
      { item: { type: 'episode' } },
      { item: null },
    ]);
    expect(result.items).toHaveLength(1);
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

describe('mapper fallbacks', () => {
  it('handles missing optional fields', () => {
    const summary = toPlaylistSummary({
      id: 'p2',
      name: 'Old',
      description: '   ',
      owner: { id: 'me' },
      collaborative: true,
      tracks: { total: 3 },
    });
    expect(summary).toMatchObject({ description: null, ownerName: null, trackCount: 3, imageUrl: null });
    expect(
      toPlaylistSummary({ id: 'p3', name: 'Empty', description: null, owner: { id: 'me' }, collaborative: false })
        .trackCount,
    ).toBe(0);
  });

  it('maps tracks without album details, ISRC or added info', () => {
    const { items } = toPlaylistTracks([
      { item: rawTrack({ album: { name: 'A' }, external_ids: undefined }), added_by: null },
    ]);
    expect(items[0]).toMatchObject({
      track: { releaseDate: null, imageUrl: null, isrc: null },
      addedAt: null,
      addedById: null,
    });
  });

  it('maps users', () => {
    expect(toUser({ id: 'u', display_name: null })).toEqual({ id: 'u', displayName: null });
  });
});

