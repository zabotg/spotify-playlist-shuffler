import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpotifyClient } from '@/lib/clients/spotify/client';
import type { AudioFeatures, Track } from '@/lib/domain/models/playlist';
import { byArtist, makeFeatures, seededRandom } from '@/test/factories';

const mocks = vi.hoisted(() => ({
  getRelatedArtistTopTracks: vi.fn(),
  getRecommendations: vi.fn(),
  getAudioFeatures: vi.fn(),
}));
vi.mock('@/lib/clients/deezer/client', () => ({ getRelatedArtistTopTracks: mocks.getRelatedArtistTopTracks }));
vi.mock('@/lib/clients/reccobeats/client', () => ({ getRecommendations: mocks.getRecommendations }));
vi.mock('@/lib/services/track-data-service', () => ({ getAudioFeatures: mocks.getAudioFeatures }));

import { recommendTracks, suggestBridgeTracks } from '@/lib/services/discovery-service';

const calm = (id: string) => makeFeatures({ id, energy: 0.3, valence: 0.4 });
const loud = (id: string) => makeFeatures({ id, energy: 0.95, valence: 0.95, danceability: 0.95, acousticness: 0, tempo: 180 });

function setup(playlist: Track[], known: Record<string, Track>, features: Record<string, AudioFeatures>) {
  mocks.getAudioFeatures.mockImplementation(
    async (ids: string[]) => new Map(ids.filter((id) => features[id]).map((id) => [id, features[id]])),
  );
  const client = {
    getPlaylistTracks: vi.fn().mockResolvedValue({ items: playlist.map((track) => ({ track })), skippedItemCount: 0 }),
    getTrack: vi.fn(async (id: string) => {
      if (!known[id]) throw new Error('404');
      return known[id];
    }),
    searchTrack: vi.fn(async (title: string) => known[title] ?? null),
  };
  return client as unknown as SpotifyClient & typeof client;
}

describe('recommendTracks', () => {
  beforeEach(() => {
    mocks.getRelatedArtistTopTracks.mockResolvedValue([]);
    mocks.getRecommendations.mockResolvedValue([]);
  });

  it('ranks suggestions by how close they sound to the playlist and drops the ones that do not fit', async () => {
    const playlist = [byArtist('seed'), byArtist('seed')];
    const fits = byArtist('fits');
    const offStyle = byArtist('off');
    const related = byArtist('related');
    mocks.getRecommendations.mockResolvedValue([fits.id, offStyle.id, 'missing', playlist[0].id]);
    mocks.getRelatedArtistTopTracks.mockResolvedValue([{ title: 'related', artistName: 'Related' }]);
    const client = setup(
      playlist,
      { [fits.id]: fits, [offStyle.id]: offStyle, [playlist[0].id]: playlist[0], related },
      {
        [playlist[0].id]: calm(playlist[0].id),
        [playlist[1].id]: calm(playlist[1].id),
        [fits.id]: calm(fits.id),
        [offStyle.id]: loud(offStyle.id),
      },
    );

    const result = await recommendTracks(client, 'p1', 10, seededRandom());

    expect(result.map((item) => item.track.id).sort()).toEqual([fits.id, related.id].sort());
    expect(result.find((item) => item.track.id === fits.id)).toMatchObject({ bpm: 120, addedAt: null });
    expect(mocks.getRecommendations).toHaveBeenCalledWith([expect.any(String)], 10);
  });

  it('works when the playlist has no audio data and when sources fail', async () => {
    const playlist = [byArtist('a')];
    const suggestion = byArtist('b');
    mocks.getRecommendations.mockResolvedValueOnce(null);
    mocks.getRelatedArtistTopTracks.mockResolvedValue([{ title: 'b', artistName: 'B' }]);
    const client = setup(playlist, { b: suggestion }, {});

    expect((await recommendTracks(client, 'p1', 5)).map((item) => item.track.id)).toEqual([suggestion.id]);
  });
});

describe('suggestBridgeTracks', () => {
  it('suggests songs between two tracks, one per artist, without repeats', async () => {
    const playlist = [byArtist('a'), byArtist('b')];
    const first = byArtist('c');
    const sameArtist = { ...byArtist('c') };
    mocks.getRecommendations.mockResolvedValue([first.id, sameArtist.id, playlist[0].id]);
    const client = setup(playlist, { [first.id]: first, [sameArtist.id]: sameArtist, [playlist[0].id]: playlist[0] }, {});

    const result = await suggestBridgeTracks(client, 'p1', playlist[0].id, playlist[1].id);
    expect(result.map((item) => item.track.id)).toEqual([first.id]);
    expect(mocks.getRecommendations).toHaveBeenCalledWith([playlist[0].id, playlist[1].id], 10);

    mocks.getRecommendations.mockResolvedValueOnce(null);
    expect(await suggestBridgeTracks(client, 'p1', 'x', 'y')).toEqual([]);
  });
});
