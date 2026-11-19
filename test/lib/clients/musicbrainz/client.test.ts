import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockFetch } from '@/test/fakes';

vi.mock('@/lib/utils/async', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
  createRateLimiter: () => () => Promise.resolve(),
}));

import { lookupArtistOrigin, lookupRecordingByIsrc } from '@/lib/clients/musicbrainz/client';

describe('MusicBrainz client', () => {
  it('merges recordings sharing an ISRC: earliest year, summed tags, unique credits', async () => {
    const fetchMock = mockFetch(
      jsonResponse({
        recordings: [
          {
            'first-release-date': '2017-01-06',
            tags: [
              { name: 'pop', count: 3 },
              { name: 'bad', count: 0 },
            ],
            relations: [{ type: 'producer', artist: { name: 'Steve Mac' } }, { type: 'mix' }],
            'artist-credit': [{ artist: { id: 'artist-1' } }],
          },
          {
            'first-release-date': '2016',
            tags: [{ name: 'dance-pop', count: 5 }, { name: 'pop', count: 3 }],
            relations: [{ type: 'producer', artist: { name: 'Steve Mac' } }],
          },
          {},
        ],
      }),
    );

    expect(await lookupRecordingByIsrc('GBAHS1600463')).toEqual({
      status: 'ok',
      data: {
        originalYear: 2016,
        tags: ['pop', 'dance-pop'],
        credits: [{ name: 'Steve Mac', role: 'producer' }],
        artistId: 'artist-1',
      },
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://musicbrainz.org/ws/2/isrc/GBAHS1600463?inc=artist-credits+tags+artist-rels&fmt=json');
    expect(init?.headers).toMatchObject({ 'User-Agent': expect.stringContaining('SpotifyPlaylistShuffler') });
  });

  it('handles missing data, unknown ISRCs and failures', async () => {
    mockFetch(
      jsonResponse({ recordings: [{}] }),
      jsonResponse({ recordings: [] }),
      jsonResponse({}),
      new Response('', { status: 404 }),
      new Response('', { status: 503 }),
      new Response('', { status: 503 }),
    );
    expect(await lookupRecordingByIsrc('A')).toEqual({
      status: 'ok',
      data: { originalYear: null, tags: [], credits: [], artistId: null },
    });
    expect(await lookupRecordingByIsrc('B')).toEqual({ status: 'not_found' });
    expect(await lookupRecordingByIsrc('C')).toEqual({ status: 'not_found' });
    expect(await lookupRecordingByIsrc('D')).toEqual({ status: 'not_found' });
    expect(await lookupRecordingByIsrc('E')).toEqual({ status: 'failed' });
  });

  it('looks up where an artist is from', async () => {
    mockFetch(jsonResponse({ area: { name: 'United Kingdom' } }), jsonResponse({ area: null }), new Response('', { status: 404 }));
    expect(await lookupArtistOrigin('a1')).toEqual({ status: 'ok', data: { country: 'United Kingdom' } });
    expect(await lookupArtistOrigin('a2')).toEqual({ status: 'ok', data: { country: null } });
    expect(await lookupArtistOrigin('a3')).toEqual({ status: 'not_found' });
  });
});
