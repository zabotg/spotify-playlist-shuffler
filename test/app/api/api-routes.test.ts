import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeSession } from '@/test/fakes';

const client = vi.hoisted(() => ({ getPlaylist: vi.fn(), getArtistGenres: vi.fn() }));
const services = vi.hoisted(() => ({
  getEditablePlaylists: vi.fn(),
  createPlaylistWithTracks: vi.fn(),
  loadEnrichedTracks: vi.fn(),
  replacePlaylistOrder: vi.fn(),
  addTracks: vi.fn(),
  recommendTracks: vi.fn(),
  getTrackDetails: vi.fn(),
  findPreviewUrl: vi.fn(),
}));
vi.mock('@/lib/services/spotify-context', () => ({
  getSpotifyContext: vi.fn(async () => ({ client, session: fakeSession() })),
}));
vi.mock('@/lib/services/playlist-service', () => services);
vi.mock('@/lib/services/discovery-service', () => services);
vi.mock('@/lib/services/track-data-service', () => services);

import { GET as getGenres } from '@/app/api/artists/genres/route';
import { GET as getRecommendations } from '@/app/api/playlists/[id]/recommendations/route';
import { GET as getPlaylist } from '@/app/api/playlists/[id]/route';
import { GET as getTracks, POST as addPlaylistTracks, PUT as replaceTracks } from '@/app/api/playlists/[id]/tracks/route';
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

  it('PUT and POST /api/playlists/:id/tracks replace or add tracks', async () => {
    await replaceTracks(send('/api/playlists/p1/tracks', 'PUT', { uris }), params());
    await addPlaylistTracks(send('/api/playlists/p1/tracks', 'POST', { uris }), params());
    expect(services.replacePlaylistOrder).toHaveBeenCalledWith(client, 'p1', uris);
    expect(services.addTracks).toHaveBeenCalledWith(client, 'p1', uris);
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
});
