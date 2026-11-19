import { describe, expect, it, vi } from 'vitest';
import type { SpotifyClient } from '@/lib/clients/spotify/client';
import { makeFeatures, makeTrack } from '@/test/factories';

const trackData = vi.hoisted(() => ({ getAudioFeatures: vi.fn(), peekTrackDetails: vi.fn() }));
const users = vi.hoisted(() => ({ resolveDisplayNames: vi.fn() }));
vi.mock('./track-data-service', () => trackData);
vi.mock('./user-service', () => users);

import {
  addTracks,
  createPlaylistWithTracks,
  getEditablePlaylists,
  loadEnrichedTracks,
  replacePlaylistOrder,
} from './playlist-service';

function fakeClient(overrides: Partial<Record<keyof SpotifyClient, unknown>> = {}) {
  return {
    getAllPlaylists: vi.fn(),
    getPlaylistTracks: vi.fn(),
    replacePlaylistTracks: vi.fn(),
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

  it('refuses to overwrite playlists with items Spotify cannot add back', async () => {
    const client = fakeClient({ getPlaylistTracks: vi.fn().mockResolvedValue({ items: [], skippedItemCount: 2 }) });
    await expect(replacePlaylistOrder(client, 'p1', ['spotify:track:a'])).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
    });
    expect(client.replacePlaylistTracks).not.toHaveBeenCalled();
  });

  it('replaces the order when it is safe', async () => {
    const client = fakeClient({ getPlaylistTracks: vi.fn().mockResolvedValue({ items: [], skippedItemCount: 0 }) });
    expect(await replacePlaylistOrder(client, 'p1', ['spotify:track:a'])).toEqual({
      playlistId: 'p1',
      playlistUrl: 'https://open.spotify.com/playlist/p1',
    });
    expect(client.replacePlaylistTracks).toHaveBeenCalledWith('p1', ['spotify:track:a']);
  });

  it('adds tracks and creates playlists', async () => {
    const client = fakeClient({ createPlaylist: vi.fn().mockResolvedValue({ id: 'new' }) });
    expect((await addTracks(client, 'p1', ['spotify:track:a'])).playlistId).toBe('p1');
    expect((await createPlaylistWithTracks(client, 'Mix', ['spotify:track:b'])).playlistId).toBe('new');
    expect(client.createPlaylist).toHaveBeenCalledWith('Mix', 'Created with Spotify Playlist Shuffler');
    expect(client.addTracksToPlaylist).toHaveBeenLastCalledWith('new', ['spotify:track:b']);
  });
});
