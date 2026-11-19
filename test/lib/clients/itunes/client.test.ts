import { describe, expect, it } from 'vitest';
import { jsonResponse, mockFetch } from '@/test/fakes';
import { findPreview, normalizeForMatch } from '@/lib/clients/itunes/client';

const song = (trackName: string, artistName: string, previewUrl?: string) => ({ trackName, artistName, previewUrl });

describe('normalizeForMatch', () => {
  it('drops case, accents, featured artists and version suffixes', () => {
    expect(normalizeForMatch('Café (feat. Someone)')).toBe('cafe');
    expect(normalizeForMatch('Song - Remastered 2011')).toBe('song');
    expect(normalizeForMatch('AC/DC [Live]')).toBe('acdc');
  });
});

describe('findPreview', () => {
  it('returns the preview of the first matching song', async () => {
    const fetchMock = mockFetch(
      jsonResponse({
        results: [
          song('Other Song', 'Khruangbin', 'https://x.mzstatic.com/other.m4a'),
          song('Midnight', 'Khruangbin & Leon Bridges'),
          song('Midnight (Live)', 'Khruangbin & Leon Bridges', 'https://x.mzstatic.com/midnight.m4a'),
        ],
      }),
    );
    expect(await findPreview('Midnight', 'Khruangbin')).toBe('https://x.mzstatic.com/midnight.m4a');
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ term: 'Khruangbin Midnight', entity: 'song' });
  });

  it('returns null without a match or when the request fails', async () => {
    mockFetch(
      jsonResponse({ results: [song('', '', 'https://x.mzstatic.com/a.m4a')] }),
      jsonResponse({}),
      new Response('', { status: 403 }),
    );
    expect(await findPreview('Song', 'Band')).toBeNull();
    expect(await findPreview('Song', 'Band')).toBeNull();
    expect(await findPreview('Song', 'Band')).toBeNull();
  });

  it('handles results with missing fields', async () => {
    mockFetch(
      jsonResponse({ results: [{ previewUrl: 'https://x.mzstatic.com/a.m4a' }] }),
      jsonResponse({ results: [{ trackName: 'Song', previewUrl: 'https://x.mzstatic.com/a.m4a' }] }),
    );
    expect(await findPreview('Song', 'Band')).toBeNull();
    expect(await findPreview('Song', 'Band')).toBeNull();
  });
});
