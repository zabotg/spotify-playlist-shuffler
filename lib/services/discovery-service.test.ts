import { describe, expect, it, vi } from 'vitest';
import type { SpotifyClient } from '@/lib/clients/spotify/client';
import { byArtist } from '@/test/factories';

const { getRelatedArtistTopTracks } = vi.hoisted(() => ({ getRelatedArtistTopTracks: vi.fn() }));
vi.mock('@/lib/clients/deezer/client', () => ({ getRelatedArtistTopTracks }));

import { recommendTracks } from './discovery-service';

describe('recommendTracks', () => {
  it('matches related artists on Spotify and leaves out tracks already in the playlist', async () => {
    const existing = byArtist('seed');
    const fresh = byArtist('related');
    getRelatedArtistTopTracks.mockResolvedValue([
      { title: 'New', artistName: 'Related' },
      { title: 'new', artistName: 'related' },
      { title: 'Old', artistName: 'Seed' },
      { title: 'Missing', artistName: 'Nobody' },
    ]);
    const searchTrack = vi.fn(async (title: string) => ({ New: fresh, Old: existing })[title] ?? null);
    const client = {
      getPlaylistTracks: vi.fn().mockResolvedValue({ items: [{ track: existing }], skippedItemCount: 0 }),
      searchTrack,
    } as unknown as SpotifyClient;

    expect(await recommendTracks(client, 'p1', 10)).toEqual([fresh]);
    expect(getRelatedArtistTopTracks).toHaveBeenCalledWith('seed', { relatedArtistLimit: 5, tracksPerArtist: 2 });
    expect(searchTrack).toHaveBeenCalledTimes(3);
  });
});
