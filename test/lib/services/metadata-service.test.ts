import { describe, expect, it, vi } from 'vitest';

const clients = vi.hoisted(() => ({
  lookupRecordingByIsrc: vi.fn(),
  lookupArtistOrigin: vi.fn(),
  getLyrics: vi.fn(),
}));
vi.mock('@/lib/clients/musicbrainz/client', () => ({
  lookupRecordingByIsrc: clients.lookupRecordingByIsrc,
  lookupArtistOrigin: clients.lookupArtistOrigin,
}));
vi.mock('@/lib/clients/lrclib/client', () => ({ getLyrics: clients.getLyrics }));

import { getArtistOrigins, getLyrics, getTrackMetadata, summarizeLyrics } from '@/lib/services/metadata-service';

const facts = { originalYear: 1999, tags: [], credits: [], artistId: null };
const english = Array(6).fill('I love you and you know that it is the way that we go on').join('\n');

describe('metadata service', () => {
  it('caches found and not-found tracks, and retries failures', async () => {
    clients.lookupRecordingByIsrc.mockImplementation(async (isrc: string) =>
      isrc === 'OK' ? { status: 'ok', data: facts } : isrc === 'NF' ? { status: 'not_found' } : { status: 'failed' },
    );
    expect(await getTrackMetadata(['OK', 'NF', 'FAIL', 'OK'])).toEqual({ OK: facts });
    clients.lookupRecordingByIsrc.mockClear();
    await getTrackMetadata(['OK', 'NF', 'FAIL']);
    expect(clients.lookupRecordingByIsrc.mock.calls).toEqual([['FAIL']]);
  });

  it('looks up artist origins', async () => {
    clients.lookupArtistOrigin.mockResolvedValue({ status: 'ok', data: { country: 'Brazil' } });
    expect(await getArtistOrigins(['x'])).toEqual({ x: { country: 'Brazil' } });
  });

  it('gets lyrics once per song and returns null when missing', async () => {
    clients.getLyrics.mockResolvedValueOnce({ status: 'ok', data: { instrumental: false, plainLyrics: 'hi' } });
    const query = { title: 'Song', artistName: 'Band', albumName: '', durationMs: 1 };
    expect(await getLyrics(query)).toEqual({ instrumental: false, plainLyrics: 'hi' });
    expect(await getLyrics({ ...query, title: 'SONG' })).toEqual({ instrumental: false, plainLyrics: 'hi' });
    expect(clients.getLyrics).toHaveBeenCalledTimes(1);

    clients.getLyrics.mockResolvedValueOnce({ status: 'not_found' });
    expect(await getLyrics({ ...query, title: 'Missing' })).toBeNull();
  });

  it('summarizes language and instrumental status per track', async () => {
    clients.getLyrics.mockImplementation(async ({ title }: { title: string }) => {
      if (title === 'Sung') return { status: 'ok', data: { instrumental: false, plainLyrics: english } };
      if (title === 'Instrumental') return { status: 'ok', data: { instrumental: true, plainLyrics: null } };
      return { status: 'not_found' };
    });
    const base = { artistName: 'Band', albumName: '', durationMs: 1 };
    expect(
      await summarizeLyrics([
        { ...base, trackId: 't1', title: 'Sung' },
        { ...base, trackId: 't2', title: 'Instrumental' },
        { ...base, trackId: 't3', title: 'Nothing' },
      ]),
    ).toEqual({
      t1: { instrumental: false, language: 'en' },
      t2: { instrumental: true, language: null },
    });
  });
});
