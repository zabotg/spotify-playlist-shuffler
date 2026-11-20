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
    const fits = byArtist('seed');
    const offStyle = byArtist('seed');
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

  it('keeps ReccoBeats suggestions only from artists in the playlist genre and rejects wrong search matches', async () => {
    const playlist = [byArtist('metallica')];
    const sameSound = makeFeatures({ energy: 0.3, valence: 0.4 });
    const reggaeton = byArtist('bad bunny');
    const byRelated = byArtist('megadeth');
    const byPlaylistArtist = byArtist('metallica');
    const wrongMatch = byArtist('someone else');
    mocks.getRecommendations.mockResolvedValue([reggaeton.id, byRelated.id, byPlaylistArtist.id]);
    mocks.getRelatedArtistTopTracks.mockResolvedValue([
      { title: 'symphony', artistName: 'Megadeth' },
      { title: 'wrong', artistName: 'Slayer' },
    ]);
    const known = { [reggaeton.id]: reggaeton, [byRelated.id]: byRelated, [byPlaylistArtist.id]: byPlaylistArtist };
    const client = setup(
      playlist,
      { ...known, wrong: wrongMatch },
      Object.fromEntries([playlist[0], ...Object.values(known)].map((track) => [track.id, { ...sameSound, id: track.id }])),
    );

    const ids = (await recommendTracks(client, 'p1', 10, seededRandom())).map((item) => item.track.id);

    expect(ids.sort()).toEqual([byRelated.id, byPlaylistArtist.id].sort());
    expect(client.searchTrack).toHaveBeenCalledWith('wrong', 'Slayer');
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
  beforeEach(() => {
    mocks.getRelatedArtistTopTracks.mockResolvedValue([]);
  });

  it('combines both seeds, each seed alone and related artists, and returns the best 3 bridges', async () => {
    const from = byArtist('a');
    const to = byArtist('b');
    const candidates = ['c1', 'c2', 'c3'].map((artist) => byArtist(artist));
    const outOfGenre = byArtist('reggaeton');
    const viaDeezer = byArtist('deezer');
    mocks.getRecommendations.mockImplementation(async (seeds: string[]) => {
      if (seeds.length === 2) return [candidates[0].id, from.id];
      return seeds[0] === from.id ? [candidates[1].id, candidates[2].id] : [outOfGenre.id];
    });
    // c1-c3 are related artists whose top tracks aren't on Spotify; ReccoBeats finds other songs of theirs.
    mocks.getRelatedArtistTopTracks.mockResolvedValue([
      { title: 'deezer', artistName: 'Deezer' },
      ...candidates.map((track) => ({ title: 'not on spotify', artistName: track.artists[0].name })),
    ]);
    const known = Object.fromEntries([...candidates, outOfGenre, from, to].map((track) => [track.id, track]));
    const features: Record<string, AudioFeatures> = {
      [from.id]: makeFeatures({ id: from.id, tempo: 100, energy: 0.3, key: 0, mode: 1 }),
      [to.id]: makeFeatures({ id: to.id, tempo: 140, energy: 0.8, key: 2, mode: 1 }),
      [candidates[0].id]: makeFeatures({ tempo: 220, energy: 0, key: 6, mode: 1 }),
      [candidates[1].id]: makeFeatures({ tempo: 120, energy: 0.55, key: 7, mode: 1 }),
      [candidates[2].id]: makeFeatures({ tempo: 118, energy: 0.5, key: 7, mode: 1 }),
      // A perfect transition on paper, but from another genre.
      [outOfGenre.id]: makeFeatures({ tempo: 120, energy: 0.55, key: 7, mode: 1 }),
    };
    const client = setup([from, to], { ...known, deezer: viaDeezer }, features);

    const result = await suggestBridgeTracks(client, 'p1', from.id, to.id);

    expect(result).toHaveLength(3);
    expect(result.slice(0, 2).map((item) => item.track.id).sort()).toEqual([candidates[1].id, candidates[2].id].sort());
    expect(result.map((item) => item.track.id)).not.toContain(from.id);
    expect(result.map((item) => item.track.id)).not.toContain(outOfGenre.id);
    expect(mocks.getRecommendations.mock.calls.map(([seeds]) => seeds)).toEqual([[from.id, to.id], [from.id], [to.id]]);
    expect(mocks.getRelatedArtistTopTracks).toHaveBeenCalledWith('a', { relatedArtistLimit: 8, tracksPerArtist: 2 });
  });

  it('still suggests songs from related artists when ReccoBeats knows neither track', async () => {
    const from = byArtist('a');
    const to = byArtist('b');
    const viaDeezer = byArtist('deezer');
    mocks.getRecommendations.mockResolvedValue(null);
    mocks.getRelatedArtistTopTracks.mockResolvedValue([{ title: 'deezer', artistName: 'Deezer' }]);
    const client = setup([from, to], { deezer: viaDeezer }, {});

    expect((await suggestBridgeTracks(client, 'p1', from.id, to.id)).map((item) => item.track.id)).toEqual([viaDeezer.id]);
  });

  it('returns unranked suggestions when the two tracks are no longer in the playlist', async () => {
    const suggestion = byArtist('s');
    mocks.getRecommendations.mockResolvedValue([suggestion.id]);
    const client = setup([byArtist('s')], { [suggestion.id]: suggestion }, {});
    expect((await suggestBridgeTracks(client, 'p1', 'gone1', 'gone2')).map((item) => item.track.id)).toEqual([suggestion.id]);
  });
});
