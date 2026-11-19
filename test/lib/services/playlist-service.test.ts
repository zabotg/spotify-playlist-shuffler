import { describe, expect, it, vi } from 'vitest';
import type { SpotifyClient } from '@/lib/clients/spotify/client';
import { makeFeatures, makeTrack } from '@/test/factories';

const trackData = vi.hoisted(() => ({ getAudioFeatures: vi.fn(), peekTrackDetails: vi.fn() }));
const users = vi.hoisted(() => ({ resolveDisplayNames: vi.fn() }));
vi.mock('@/lib/services/track-data-service', () => trackData);
vi.mock('@/lib/services/user-service', () => users);

import {
  addTracks,
  createPlaylistWithTracks,
  removeTracksAt,
  getEditablePlaylists,
  loadEnrichedTracks,
  replacePlaylistOrder,
} from '@/lib/services/playlist-service';

function fakeClient(overrides: Partial<Record<keyof SpotifyClient, unknown>> = {}) {
  return {
    getAllPlaylists: vi.fn(),
    getPlaylistTracks: vi.fn(),
    moveItems: vi.fn(),
    removeTracks: vi.fn(),
    addTracksToPlaylist: vi.fn(),
    createPlaylist: vi.fn(),
    ...overrides,
  } as unknown as SpotifyClient;
}

describe('playlist service', () => {
  it('lists playlists the user owns or collaborates on', async () => {
    const playlists = [
      { id: 'mine', ownerId: 'me', collaborative: false },
      { id: 'shared', ownerId: 'other', collaborative: true },
      { id: 'theirs', ownerId: 'other', collaborative: false },
    ];
    const client = fakeClient({ getAllPlaylists: vi.fn().mockResolvedValue(playlists) });
    expect((await getEditablePlaylists(client, 'me')).map((playlist) => playlist.id)).toEqual(['mine', 'shared']);
  });

  it('enriches tracks with features, cached Deezer details and who added them', async () => {
    const withFeatures = makeTrack({ isrc: 'ISRC1' });
    const withDeezer = makeTrack({ isrc: 'ISRC2' });
    const bare = makeTrack({ isrc: null });
    const client = fakeClient({
      getPlaylistTracks: vi.fn().mockResolvedValue({
        items: [
          { track: withFeatures, addedAt: '2025-01-01', addedById: 'me' },
          { track: withDeezer, addedAt: null, addedById: 'ghost' },
          { track: bare, addedAt: null, addedById: null },
        ],
        skippedItemCount: 2,
      }),
    });
    trackData.getAudioFeatures.mockResolvedValue(new Map([[withFeatures.id, makeFeatures({ tempo: 128 })]]));
    trackData.peekTrackDetails.mockImplementation((isrc: string) =>
      isrc === 'ISRC2' ? { bpm: 90, popularity: 1000 } : undefined,
    );
    users.resolveDisplayNames.mockResolvedValue(new Map([['me', 'Me']]));

    const { tracks, skippedItemCount } = await loadEnrichedTracks(client, 'p1', { id: 'me', displayName: 'Me' });

    expect(skippedItemCount).toBe(2);
    expect(tracks[0]).toMatchObject({ addedBy: 'Me', bpm: 128, popularity: null, addedAt: '2025-01-01' });
    expect(tracks[1]).toMatchObject({ addedBy: null, features: null, bpm: 90, popularity: 1000 });
    expect(tracks[2]).toMatchObject({ addedBy: null, bpm: null, popularity: null });
    expect(users.resolveDisplayNames).toHaveBeenCalledWith(client, ['me', 'ghost'], { id: 'me', displayName: 'Me' });
  });

  const playlistOf = (...ids: string[]) => ({
    items: ids.map((id) => ({ track: makeTrack({ uri: `spotify:track:${id}` }), addedAt: null, addedById: null })),
    skippedItemCount: 0,
  });
  const uris = (...ids: string[]) => ids.map((id) => `spotify:track:${id}`);

  it('refuses to overwrite playlists with items Spotify cannot add back', async () => {
    const client = fakeClient({ getPlaylistTracks: vi.fn().mockResolvedValue({ items: [], skippedItemCount: 2 }) });
    await expect(replacePlaylistOrder(client, 'p1', uris('a'))).rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
    expect(client.moveItems).not.toHaveBeenCalled();
  });

  it('refuses when the playlist changed since it was loaded', async () => {
    const client = fakeClient({ getPlaylistTracks: vi.fn().mockResolvedValue(playlistOf('a', 'b')) });
    await expect(replacePlaylistOrder(client, 'p1', uris('a', 'c'))).rejects.toMatchObject({
      status: 409,
      message: 'The playlist changed since it was loaded. Reload the page and try again.',
    });
    expect(client.moveItems).not.toHaveBeenCalled();
  });

  it('moves tracks into the new order, chaining snapshots, without re-adding them', async () => {
    const moveItems = vi.fn().mockResolvedValueOnce('s1').mockResolvedValueOnce('s2');
    const client = fakeClient({ getPlaylistTracks: vi.fn().mockResolvedValue(playlistOf('a', 'b', 'c')), moveItems });

    expect(await replacePlaylistOrder(client, 'p1', uris('c', 'a', 'b'))).toEqual({
      playlistId: 'p1',
      playlistUrl: 'https://open.spotify.com/playlist/p1',
    });
    expect(moveItems.mock.calls).toEqual([['p1', { rangeStart: 2, rangeLength: 1, insertBefore: 0 }, undefined]]);
    expect(client.addTracksToPlaylist).not.toHaveBeenCalled();
  });

  it('makes no requests when the order did not change', async () => {
    const client = fakeClient({ getPlaylistTracks: vi.fn().mockResolvedValue(playlistOf('a', 'b')) });
    await replacePlaylistOrder(client, 'p1', uris('a', 'b'));
    expect(client.moveItems).not.toHaveBeenCalled();
  });

  it('adds tracks at a position', async () => {
    const client = fakeClient();
    await addTracks(client, 'p1', uris('a'), 3);
    expect(client.addTracksToPlaylist).toHaveBeenCalledWith('p1', uris('a'), 3);
  });

  it('removes positions and puts back other copies of the same track', async () => {
    const client = fakeClient({ getPlaylistTracks: vi.fn().mockResolvedValue(playlistOf('a', 'b', 'a')) });
    expect((await removeTracksAt(client, 'p1', [2])).playlistId).toBe('p1');
    expect(client.removeTracks).toHaveBeenCalledWith('p1', uris('a'));
    expect(client.addTracksToPlaylist).toHaveBeenCalledWith('p1', uris('a'), 0);
  });

  it('refuses removals on playlists with local files or after changes', async () => {
    const withLocal = fakeClient({ getPlaylistTracks: vi.fn().mockResolvedValue({ items: [], skippedItemCount: 1 }) });
    await expect(removeTracksAt(withLocal, 'p1', [0])).rejects.toMatchObject({ status: 409 });
    const changed = fakeClient({ getPlaylistTracks: vi.fn().mockResolvedValue(playlistOf('a')) });
    await expect(removeTracksAt(changed, 'p1', [5])).rejects.toMatchObject({ status: 409 });
    expect(changed.removeTracks).not.toHaveBeenCalled();
  });

  it('adds tracks and creates playlists', async () => {
    const client = fakeClient({ createPlaylist: vi.fn().mockResolvedValue({ id: 'new' }) });
    expect((await addTracks(client, 'p1', ['spotify:track:a'])).playlistId).toBe('p1');
    expect((await createPlaylistWithTracks(client, 'Mix', ['spotify:track:b'])).playlistId).toBe('new');
    expect(client.createPlaylist).toHaveBeenCalledWith('Mix', 'Created with Spotify Playlist Shuffler');
    expect(client.addTracksToPlaylist).toHaveBeenLastCalledWith('new', ['spotify:track:b']);
    expect(client.addTracksToPlaylist).toHaveBeenCalledWith('p1', ['spotify:track:a'], undefined);
  });
});
