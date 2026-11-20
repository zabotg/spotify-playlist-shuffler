import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeSession } from '@/test/fakes';

const client = vi.hoisted(() => ({ getPlaylist: vi.fn(), getArtistGenres: vi.fn() }));
const services = vi.hoisted(() => ({
  getEditablePlaylists: vi.fn(),
  createPlaylistWithTracks: vi.fn(),
  loadEnrichedTracks: vi.fn(),
  planPlaylistOverwrite: vi.fn(),
  addTracks: vi.fn(),
  recommendTracks: vi.fn(),
  getTrackDetails: vi.fn(),
  findPreviewUrl: vi.fn(),
  analyzeTracks: vi.fn(),
  suggestBridgeTracks: vi.fn(),
  removeTracksAt: vi.fn(),
  getTrackMetadata: vi.fn(),
  getArtistOrigins: vi.fn(),
  getLyrics: vi.fn(),
  summarizeLyrics: vi.fn(),
}));
vi.mock('@/lib/services/spotify-context', () => ({
  getSpotifyContext: vi.fn(async () => ({ client, session: fakeSession() })),
}));
vi.mock('@/lib/services/playlist-service', () => services);
vi.mock('@/lib/services/discovery-service', () => services);
vi.mock('@/lib/services/track-data-service', () => services);
vi.mock('@/lib/services/metadata-service', () => services);

import { GET as getGenres } from '@/app/api/artists/genres/route';
import { GET as getBridge } from '@/app/api/playlists/[id]/bridge/route';
import { POST as analyze } from '@/app/api/tracks/analysis/route';
import { GET as getRecommendations } from '@/app/api/playlists/[id]/recommendations/route';
import { GET as getPlaylist } from '@/app/api/playlists/[id]/route';
import {
  DELETE as removeTracks,
  GET as getTracks,
  POST as addPlaylistTracks,
  PUT as replaceTracks,
} from '@/app/api/playlists/[id]/tracks/route';
import { POST as getOrigins } from '@/app/api/artists/origins/route';
import { GET as getLyrics } from '@/app/api/tracks/lyrics/route';
import { POST as summarizeLyrics } from '@/app/api/tracks/lyrics-summary/route';
import { POST as getMetadata } from '@/app/api/tracks/metadata/route';
import { GET as listPlaylists, POST as createPlaylist } from '@/app/api/playlists/route';
import { POST as getDetails } from '@/app/api/tracks/details/route';
import { GET as getPreview } from '@/app/api/tracks/preview/route';

const BASE = 'http://127.0.0.1:3000';
const get = (path: string) => new NextRequest(`${BASE}${path}`);
const send = (path: string, method: string, body: unknown) =>
  new NextRequest(`${BASE}${path}`, { method, body: JSON.stringify(body) });
const params = (id = 'p1') => ({ params: Promise.resolve({ id }) });
const uris = ['spotify:track:abc'];

describe('API routes', () => {
  beforeEach(() => {
    for (const mock of Object.values(services)) mock.mockResolvedValue({ ok: true });
  });

  it('GET /api/playlists lists editable playlists', async () => {
    services.getEditablePlaylists.mockResolvedValue([{ id: 'p1' }]);
    const response = await listPlaylists(get('/api/playlists'), {});
    expect(await response.json()).toEqual({ playlists: [{ id: 'p1' }] });
    expect(services.getEditablePlaylists).toHaveBeenCalledWith(client, 'me');
  });

  it('POST /api/playlists creates a playlist and answers 201', async () => {
    const response = await createPlaylist(send('/api/playlists', 'POST', { name: 'Mix', uris }), {});
    expect(response.status).toBe(201);
    expect(services.createPlaylistWithTracks).toHaveBeenCalledWith(client, 'Mix', uris);
  });

  it('POST /api/playlists validates the body', async () => {
    const response = await createPlaylist(send('/api/playlists', 'POST', { name: '', uris: ['bad'] }), {});
    expect(response.status).toBe(400);
    expect(services.createPlaylistWithTracks).not.toHaveBeenCalled();
  });

  it('GET /api/playlists/:id says whether the user can edit it', async () => {
    client.getPlaylist.mockResolvedValue({ id: 'p1', ownerId: 'me', collaborative: false });
    const response = await getPlaylist(get('/api/playlists/p1'), params());
    expect(await response.json()).toMatchObject({ canEdit: true, playlist: { id: 'p1' } });
  });

  it('GET /api/playlists/:id/tracks loads enriched tracks for the current user', async () => {
    await getTracks(get('/api/playlists/p1/tracks'), params());
    expect(services.loadEnrichedTracks).toHaveBeenCalledWith(client, 'p1', { id: 'me', displayName: 'Me' });
  });

  it('PUT /api/playlists/:id/tracks streams the overwrite progress, moving by default', async () => {
    const link = { playlistId: 'p1', playlistUrl: 'https://open.spotify.com/playlist/p1' };
    services.planPlaylistOverwrite.mockResolvedValue({
      total: 2,
      run: async (onProgress: (done: number) => void) => {
        onProgress(1);
        onProgress(2);
        return link;
      },
    });

    const response = await replaceTracks(send('/api/playlists/p1/tracks', 'PUT', { uris }), params());

    expect(response.headers.get('content-type')).toContain('application/x-ndjson');
    const events = (await response.text()).trim().split('\n').map((line) => JSON.parse(line));
    expect(events).toEqual([
      { type: 'progress', done: 0, total: 2 },
      { type: 'progress', done: 1, total: 2 },
      { type: 'progress', done: 2, total: 2 },
      { type: 'done', result: link },
    ]);
    expect(services.planPlaylistOverwrite).toHaveBeenCalledWith(client, 'p1', uris, 'move');

    await replaceTracks(send('/api/playlists/p1/tracks', 'PUT', { uris, method: 'replace' }), params());
    expect(services.planPlaylistOverwrite).toHaveBeenLastCalledWith(client, 'p1', uris, 'replace');
  });

  it('PUT /api/playlists/:id/tracks answers a normal error when the save is refused up front', async () => {
    const { HttpError } = await import('@/lib/http/errors');
    services.planPlaylistOverwrite.mockRejectedValue(new HttpError(409, 'CONFLICT', 'The playlist changed.'));
    const response = await replaceTracks(send('/api/playlists/p1/tracks', 'PUT', { uris }), params());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'CONFLICT', message: 'The playlist changed.' });
  });

  it('POST /api/playlists/:id/tracks adds tracks', async () => {
    await addPlaylistTracks(send('/api/playlists/p1/tracks', 'POST', { uris }), params());
    expect(services.addTracks).toHaveBeenCalledWith(client, 'p1', uris, undefined);
  });

  it('GET /api/playlists/:id/recommendations uses the requested count', async () => {
    services.recommendTracks.mockResolvedValue([]);
    const response = await getRecommendations(get('/api/playlists/p1/recommendations?count=5'), params());
    expect(await response.json()).toEqual({ tracks: [] });
    expect(services.recommendTracks).toHaveBeenCalledWith(client, 'p1', 5);
  });

  it('rejects invalid playlist IDs', async () => {
    const response = await getTracks(get('/api/playlists/x/tracks'), params('../../me'));
    expect(response.status).toBe(400);
  });

  it('POST /api/tracks/details returns Deezer details', async () => {
    services.getTrackDetails.mockResolvedValue({ GBAHS1600463: { bpm: 96, popularity: 1 } });
    const response = await getDetails(send('/api/tracks/details', 'POST', { isrcs: ['GBAHS1600463'] }), {});
    expect(await response.json()).toEqual({ details: { GBAHS1600463: { bpm: 96, popularity: 1 } } });
  });

  it('GET /api/tracks/preview looks the preview up with or without an ISRC', async () => {
    services.findPreviewUrl.mockResolvedValue('https://cdnt-preview.dzcdn.net/a.mp3');
    const withIsrc = await getPreview(get('/api/tracks/preview?title=Song&artist=Band&isrc=GBAHS1600463'), {});
    expect(await withIsrc.json()).toEqual({ url: 'https://cdnt-preview.dzcdn.net/a.mp3' });
    expect(services.findPreviewUrl).toHaveBeenCalledWith({ isrc: 'GBAHS1600463', title: 'Song', artistName: 'Band' });

    await getPreview(get('/api/tracks/preview?title=Song&artist=Band'), {});
    expect(services.findPreviewUrl).toHaveBeenLastCalledWith({ isrc: null, title: 'Song', artistName: 'Band' });
  });

  it('GET /api/artists/genres returns genres per artist', async () => {
    client.getArtistGenres.mockResolvedValue([['rock']]);
    const response = await getGenres(get('/api/artists/genres?ids=a1'), {});
    expect(await response.json()).toEqual({ genres: [['rock']] });
    expect(client.getArtistGenres).toHaveBeenCalledWith(['a1']);
  });

  it('POST /api/tracks/analysis analyzes up to 5 tracks', async () => {
    services.analyzeTracks.mockResolvedValue({ t1: { tempo: 100 } });
    const body = { tracks: [{ trackId: 't1', isrc: null, title: 'Song', artist: 'Band' }] };
    const response = await analyze(send('/api/tracks/analysis', 'POST', body), {});
    expect(await response.json()).toEqual({ features: { t1: { tempo: 100 } } });
    expect(services.analyzeTracks).toHaveBeenCalledWith([{ trackId: 't1', isrc: null, title: 'Song', artistName: 'Band' }]);
  });

  it('GET /api/playlists/:id/bridge suggests songs between two tracks', async () => {
    services.suggestBridgeTracks.mockResolvedValue([]);
    const response = await getBridge(get('/api/playlists/p1/bridge?from=a1&to=b2'), params());
    expect(await response.json()).toEqual({ tracks: [] });
    expect(services.suggestBridgeTracks).toHaveBeenCalledWith(client, 'p1', 'a1', 'b2');
  });

  it('POST and DELETE /api/playlists/:id/tracks insert at a position and remove positions', async () => {
    await addPlaylistTracks(send('/api/playlists/p1/tracks', 'POST', { uris, position: 4 }), params());
    expect(services.addTracks).toHaveBeenCalledWith(client, 'p1', uris, 4);
    await removeTracks(send('/api/playlists/p1/tracks', 'DELETE', { positions: [1, 2] }), params());
    expect(services.removeTracksAt).toHaveBeenCalledWith(client, 'p1', [1, 2]);
  });

  it('serves MusicBrainz metadata, artist origins and lyrics', async () => {
    services.getTrackMetadata.mockResolvedValue({});
    services.getArtistOrigins.mockResolvedValue({});
    services.getLyrics.mockResolvedValue(null);
    services.summarizeLyrics.mockResolvedValue({});
    const mbid = '8f3f4d27-fb26-4c3e-9f2a-1c9b2a7f6e11';

    expect(await (await getMetadata(send('/api/tracks/metadata', 'POST', { isrcs: ['GBAHS1600463'] }), {})).json()).toEqual({ metadata: {} });
    expect(await (await getOrigins(send('/api/artists/origins', 'POST', { ids: [mbid] }), {})).json()).toEqual({ origins: {} });
    expect(await (await getLyrics(get('/api/tracks/lyrics?title=A&artist=B&album=C&durationMs=1000'), {})).json()).toEqual({ lyrics: null });
    expect(services.getLyrics).toHaveBeenCalledWith({ title: 'A', artistName: 'B', albumName: 'C', durationMs: 1000 });

    const body = { tracks: [{ trackId: 't1', title: 'A', artist: 'B', album: '', durationMs: 1 }] };
    expect(await (await summarizeLyrics(send('/api/tracks/lyrics-summary', 'POST', body), {})).json()).toEqual({ summaries: {} });
    expect(services.summarizeLyrics).toHaveBeenCalledWith([
      { trackId: 't1', title: 'A', artistName: 'B', albumName: '', durationMs: 1 },
    ]);
    expect((await getOrigins(send('/api/artists/origins', 'POST', { ids: ['not-a-uuid'] }), {})).status).toBe(400);
  });
});
