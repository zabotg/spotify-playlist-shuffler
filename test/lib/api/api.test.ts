import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockFetch } from '@/test/fakes';
import { artistsApi } from '@/lib/api/artists-api';
import { playlistsApi } from '@/lib/api/playlists-api';
import { ApiRequestError, apiRequest } from '@/lib/api/request';
import { tracksApi } from '@/lib/api/tracks-api';

const assign = vi.fn();

describe('apiRequest', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { assign } });
  });

  it('sends JSON bodies with same-origin credentials', async () => {
    const fetchMock = mockFetch(jsonResponse({ ok: 1 }));
    expect(await apiRequest('/api/x', { method: 'POST', body: { a: 1 } })).toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledWith('/api/x', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"a":1}',
      credentials: 'same-origin',
    });
  });

  it('throws the server message on errors', async () => {
    mockFetch(jsonResponse({ error: 'CONFLICT', message: 'Taken' }, { status: 409 }));
    const error = await apiRequest('/api/x').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 409, message: 'Taken', name: 'ApiRequestError' });
  });

  it('uses a fallback message when the body is not JSON', async () => {
    mockFetch(new Response('<html>', { status: 502 }));
    await expect(apiRequest('/api/x')).rejects.toThrow('Something went wrong. Please try again.');
  });

  it('sends the user to the login page on 401', async () => {
    mockFetch(jsonResponse({ error: 'UNAUTHORIZED', message: 'Not authenticated.' }, { status: 401 }));
    await expect(apiRequest('/api/x')).rejects.toThrow('Not authenticated.');
    expect(assign).toHaveBeenCalledWith('/');
  });
});

describe('resource clients', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { assign } });
  });

  it('build the right paths and methods', async () => {
    const fetchMock = mockFetch(...Array.from({ length: 13 }, () => jsonResponse({})));
    await playlistsApi.list();
    await playlistsApi.get('p/1');
    await playlistsApi.tracks('p1');
    await playlistsApi.recommendations('p1', 5);
    await playlistsApi.replaceTracks('p1', ['u']);
    await playlistsApi.addTracks('p1', ['u']);
    await playlistsApi.create('Mix', ['u']);
    await tracksApi.details(['ISRC']);
    await tracksApi.preview({ isrc: 'GBAHS1600463', title: 'A&B', artist: 'C' });
    await tracksApi.preview({ isrc: null, title: 'A', artist: 'C' });
    await artistsApi.genres(['a', 'b/c']);
    await tracksApi.analyze([{ trackId: 't', isrc: null, title: 'A', artist: 'B' }]);
    await playlistsApi.bridge('p1', 'a', 'b');

    const calls = fetchMock.mock.calls.map(([path, init]) => `${init?.method} ${path}`);
    expect(calls).toEqual([
      'GET /api/playlists',
      'GET /api/playlists/p%2F1',
      'GET /api/playlists/p1/tracks',
      'GET /api/playlists/p1/recommendations?count=5',
      'PUT /api/playlists/p1/tracks',
      'POST /api/playlists/p1/tracks',
      'POST /api/playlists',
      'POST /api/tracks/details',
      'GET /api/tracks/preview?title=A%26B&artist=C&isrc=GBAHS1600463',
      'GET /api/tracks/preview?title=A&artist=C',
      'GET /api/artists/genres?ids=a,b%2Fc',
      'POST /api/tracks/analysis',
      'GET /api/playlists/p1/bridge?from=a&to=b',
    ]);
  });
});
