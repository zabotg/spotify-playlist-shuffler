import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockFetch } from '@/test/fakes';

vi.mock('@/lib/utils/async', () => ({ sleep: vi.fn().mockResolvedValue(undefined) }));

import { getLyrics } from '@/lib/clients/lrclib/client';

const query = { title: 'Song', artistName: 'Band', albumName: 'Album', durationMs: 233_400 };

describe('LRCLIB client', () => {
  it('gets lyrics by exact match', async () => {
    const fetchMock = mockFetch(jsonResponse({ instrumental: false, plainLyrics: 'la la' }));
    expect(await getLyrics(query)).toEqual({ status: 'ok', data: { instrumental: false, plainLyrics: 'la la' } });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe('/api/get');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      track_name: 'Song',
      artist_name: 'Band',
      album_name: 'Album',
      duration: '233',
    });
  });

  it('falls back to a search for a recording of about the same length', async () => {
    mockFetch(
      new Response('', { status: 404 }),
      jsonResponse([
        { duration: 300, plainLyrics: 'wrong length' },
        { duration: 235, plainLyrics: null },
        { duration: 234, instrumental: true, plainLyrics: '' },
      ]),
    );
    expect(await getLyrics(query)).toEqual({ status: 'ok', data: { instrumental: true, plainLyrics: null } });
  });

  it('reports not found and temporary failures', async () => {
    mockFetch(new Response('', { status: 404 }), jsonResponse([{ plainLyrics: 'no duration' }]));
    expect(await getLyrics(query)).toEqual({ status: 'not_found' });

    mockFetch(new Response('', { status: 404 }), new Response('', { status: 500 }), new Response('', { status: 500 }));
    expect(await getLyrics(query)).toEqual({ status: 'failed' });

    mockFetch(new Response('', { status: 500 }), new Response('', { status: 500 }));
    expect(await getLyrics(query)).toEqual({ status: 'failed' });
  });
});
