import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockFetch } from '@/test/fakes';

vi.mock('@/lib/utils/async', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
  createRateLimiter: () => () => Promise.resolve(),
}));

import { getRelatedArtistTopTracks, getTrackByIsrc, searchTrack, toTrackDetails } from '@/lib/clients/deezer/client';

const quotaError = () => jsonResponse({ error: { code: 4, message: 'Quota limit exceeded' } });
const deezerTrack = (title: string, extra = {}) => ({ title, artist: { name: 'Artist' }, ...extra });

describe('Deezer client', () => {
  it('looks a track up by ISRC', async () => {
    const fetchMock = mockFetch(jsonResponse(deezerTrack('Song', { bpm: 120 })));
    expect(await getTrackByIsrc('GBAHS1600463')).toEqual({ status: 'ok', data: deezerTrack('Song', { bpm: 120 }) });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.deezer.com/track/isrc:GBAHS1600463');
  });

  it('reads Deezer error bodies as not found', async () => {
    mockFetch(jsonResponse({ error: { code: 800, message: 'no data' } }));
    expect(await getTrackByIsrc('X')).toEqual({ status: 'not_found' });
  });

  it('retries quota errors, then reports a temporary failure', async () => {
    mockFetch(quotaError(), jsonResponse(deezerTrack('Song')));
    expect((await getTrackByIsrc('X')).status).toBe('ok');

    mockFetch(quotaError(), quotaError(), quotaError(), quotaError());
    expect(await getTrackByIsrc('X')).toEqual({ status: 'failed' });
  });

  it('reports network and HTTP errors as temporary failures', async () => {
    mockFetch(new Response('', { status: 404 }));
    expect(await getTrackByIsrc('X')).toEqual({ status: 'failed' });
  });

  it('maps BPM and rank, ignoring zero values', () => {
    expect(toTrackDetails(deezerTrack('a', { bpm: 95.9, rank: 968_208 }))).toEqual({ bpm: 95.9, popularity: 968_208 });
    expect(toTrackDetails(deezerTrack('a', { bpm: 0, rank: 0 }))).toEqual({ bpm: null, popularity: null });
    expect(toTrackDetails(deezerTrack('a'))).toEqual({ bpm: null, popularity: null });
  });

  it('searches by artist and title without letting quotes break the query', async () => {
    const fetchMock = mockFetch(jsonResponse({ data: [deezerTrack('Song')] }), jsonResponse({ data: [] }), quotaError());
    expect(await searchTrack('Say "Hi"', 'The "Band"')).toEqual(deezerTrack('Song'));
    expect(decodeURIComponent(String(fetchMock.mock.calls[0][0]))).toContain('q=artist:"The Band" track:"Say Hi"');
    expect(await searchTrack('x', 'y')).toBeNull();
  });

  it('returns null when the search fails', async () => {
    mockFetch(jsonResponse({ error: { code: 800 } }));
    expect(await searchTrack('x', 'y')).toBeNull();
  });

  describe('getRelatedArtistTopTracks', () => {
    const options = { relatedArtistLimit: 2, tracksPerArtist: 1 };

    it('returns top tracks of related artists', async () => {
      mockFetch(
        jsonResponse({ data: [{ id: 1 }] }),
        jsonResponse({ data: [{ id: 2 }, { id: 3 }] }),
        jsonResponse({ data: [{ title: 'A', artist: { name: 'Two' } }] }),
        jsonResponse({ error: { code: 800 } }),
      );
      expect(await getRelatedArtistTopTracks('Seed', options)).toEqual([{ title: 'A', artistName: 'Two' }]);
    });

    it('returns nothing when the artist is unknown', async () => {
      mockFetch(jsonResponse({ data: [] }));
      expect(await getRelatedArtistTopTracks('Nobody', options)).toEqual([]);
      mockFetch(jsonResponse({ error: { code: 800 } }));
      expect(await getRelatedArtistTopTracks('Nobody', options)).toEqual([]);
    });

    it('returns nothing when related artists fail to load', async () => {
      mockFetch(jsonResponse({ data: [{ id: 1 }] }), jsonResponse({ error: { code: 800 } }));
      expect(await getRelatedArtistTopTracks('Seed', options)).toEqual([]);
    });
  });
});
