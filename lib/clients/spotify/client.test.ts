import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockFetch } from '@/test/fakes';
import { SpotifyClient } from './client';
import { SpotifyApiError } from './errors';
import type { RawTrack } from './types';

vi.mock('@/lib/utils/async', () => ({ sleep: vi.fn().mockResolvedValue(undefined) }));

const rawTrack = (id: string): RawTrack => ({
  type: 'track',
  id,
  uri: `spotify:track:${id}`,
  name: `Song ${id}`,
  artists: [{ id: 'a', name: 'Artist' }],
  album: { name: 'Album' },
  duration_ms: 1000,
  explicit: false,
});

const rawPlaylist = (id: string, ownerId = 'me') => ({
  id,
  name: id,
  description: null,
  owner: { id: ownerId },
  collaborative: false,
  items: { total: 1 },
});

const urlOf = (fetchMock: ReturnType<typeof mockFetch>, call: number) => String(fetchMock.mock.calls[call][0]);
const initOf = (fetchMock: ReturnType<typeof mockFetch>, call: number) => fetchMock.mock.calls[call][1];

describe('SpotifyClient', () => {
  const client = new SpotifyClient('token');

  it('sends the bearer token and maps the current user', async () => {
    const fetchMock = mockFetch(jsonResponse({ id: 'me', display_name: 'Me' }));
    expect(await client.getCurrentUser()).toEqual({ id: 'me', displayName: 'Me' });
    expect(urlOf(fetchMock, 0)).toBe('https://api.spotify.com/v1/me');
    expect(initOf(fetchMock, 0)?.headers).toEqual({ Authorization: 'Bearer token' });
  });

  it('encodes user IDs', async () => {
    const fetchMock = mockFetch(jsonResponse({ id: 'a/b', display_name: null }));
    await client.getUser('a/b');
    expect(urlOf(fetchMock, 0)).toBe('https://api.spotify.com/v1/users/a%2Fb');
  });

  it('fetches every page of playlists in parallel and drops null entries', async () => {
    const fetchMock = mockFetch(
      jsonResponse({ items: [rawPlaylist('p1'), null], total: 120 }),
      jsonResponse({ items: [rawPlaylist('p2')], total: 120 }),
      jsonResponse({ items: [rawPlaylist('p3')], total: 120 }),
    );
    const playlists = await client.getAllPlaylists();
    expect(playlists.map((playlist) => playlist.id)).toEqual(['p1', 'p2', 'p3']);
    expect(urlOf(fetchMock, 1)).toContain('/me/playlists?limit=50&offset=50');
    expect(urlOf(fetchMock, 2)).toContain('offset=100');
  });

  it('gets one playlist and its tracks', async () => {
    const fetchMock = mockFetch(
      jsonResponse(rawPlaylist('p1')),
      jsonResponse({ items: [{ item: rawTrack('t1'), added_at: '2025-01-01T00:00:00Z' }], total: 1 }),
    );
    expect((await client.getPlaylist('p1')).id).toBe('p1');
    const { items } = await client.getPlaylistTracks('p1');
    expect(items[0]).toMatchObject({ track: { id: 't1' }, addedAt: '2025-01-01T00:00:00Z' });
    expect(urlOf(fetchMock, 1)).toBe('https://api.spotify.com/v1/playlists/p1/items?limit=100&offset=0');
  });

  it('gets artist genres, defaulting to none', async () => {
    mockFetch(jsonResponse({ id: 'a', name: 'A', genres: ['rock'] }), jsonResponse({ id: 'b', name: 'B' }));
    expect(await client.getArtistGenres(['a', 'b'])).toEqual([['rock'], []]);
  });

  it('searches for a track and returns null without a match', async () => {
    const fetchMock = mockFetch(
      jsonResponse({ tracks: { items: [rawTrack('t1')] } }),
      jsonResponse({ tracks: { items: [] } }),
    );
    expect((await client.searchTrack('Song', 'Artist'))?.id).toBe('t1');
    expect(await client.searchTrack('Nothing', 'Nobody')).toBeNull();
    expect(new URL(urlOf(fetchMock, 0)).searchParams.get('q')).toBe('track:Song artist:Artist');
  });

  it('creates private playlists', async () => {
    const fetchMock = mockFetch(jsonResponse(rawPlaylist('new')));
    expect((await client.createPlaylist('Mix', 'desc')).id).toBe('new');
    expect(initOf(fetchMock, 0)).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ name: 'Mix', description: 'desc', public: false }),
    });
  });

  it('replaces tracks in batches of 100, keeping their order', async () => {
    const uris = Array.from({ length: 250 }, (_, index) => `spotify:track:t${index}`);
    const fetchMock = mockFetch(jsonResponse({}), jsonResponse({}), jsonResponse({}));
    await client.replacePlaylistTracks('p1', uris);

    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).uris as string[]);
    expect(fetchMock.mock.calls.map(([, init]) => init?.method)).toEqual(['PUT', 'POST', 'POST']);
    expect(bodies.map((batch) => batch.length)).toEqual([100, 100, 50]);
    expect(bodies.flat()).toEqual(uris);
  });

  it('clears the playlist when replacing with no tracks', async () => {
    const fetchMock = mockFetch(jsonResponse({}));
    await client.replacePlaylistTracks('p1', []);
    expect(initOf(fetchMock, 0)).toMatchObject({ method: 'PUT', body: '{"uris":[]}' });
  });

  it('throws SpotifyApiError for failed requests', async () => {
    mockFetch(new Response('forbidden', { status: 403 }));
    const error = await client.getCurrentUser().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SpotifyApiError);
    expect(error).toMatchObject({ status: 403, responseBody: 'forbidden', message: 'Spotify API error 403' });
  });
});
