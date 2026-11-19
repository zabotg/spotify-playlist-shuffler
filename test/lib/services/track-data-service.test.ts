import { describe, expect, it, vi } from 'vitest';
import { makeFeatures } from '@/test/factories';

const deezer = vi.hoisted(() => ({
  getTrackByIsrc: vi.fn(),
  searchTrack: vi.fn(),
  toTrackDetails: (track: { bpm?: number; rank?: number }) => ({ bpm: track.bpm ?? null, popularity: track.rank ?? null }),
}));
const itunes = vi.hoisted(() => ({ findPreview: vi.fn(), normalizeForMatch: (text: string) => text.toLowerCase() }));
const reccobeats = vi.hoisted(() => ({ getAudioFeaturesBatch: vi.fn(), RECCOBEATS_MAX_IDS_PER_REQUEST: 2 }));
vi.mock('@/lib/clients/deezer/client', () => deezer);
vi.mock('@/lib/clients/itunes/client', () => itunes);
vi.mock('@/lib/clients/reccobeats/client', () => reccobeats);

import { findPreviewUrl, getAudioFeatures, getTrackDetails, peekTrackDetails } from '@/lib/services/track-data-service';

const DEEZER_PREVIEW = 'https://cdnt-preview.dzcdn.net/a.mp3';
const ITUNES_PREVIEW = 'https://audio-ssl.itunes.apple.com/b.m4a';

describe('getAudioFeatures', () => {
  it('fetches in batches and caches hits and misses', async () => {
    reccobeats.getAudioFeaturesBatch.mockImplementation(
      async (ids: string[]) => new Map(ids.filter((id) => id !== 'none').map((id) => [id, makeFeatures({ id })])),
    );

    const first = await getAudioFeatures(['a', 'b', 'none', 'a', 'c']);
    expect([...first.keys()]).toEqual(['a', 'b', 'c']);
    expect(reccobeats.getAudioFeaturesBatch.mock.calls).toEqual([[['a', 'b']], [['none', 'c']]]);

    reccobeats.getAudioFeaturesBatch.mockClear();
    await getAudioFeatures(['a', 'b', 'none']);
    expect(reccobeats.getAudioFeaturesBatch).not.toHaveBeenCalled();
  });

  it('does not cache failed batches', async () => {
    reccobeats.getAudioFeaturesBatch.mockResolvedValue(null);
    expect(await getAudioFeatures(['down'])).toEqual(new Map());
    await getAudioFeatures(['down']);
    expect(reccobeats.getAudioFeaturesBatch).toHaveBeenCalledTimes(2);
  });
});

describe('getTrackDetails', () => {
  it('returns details by ISRC, caches not-found results and retries failures', async () => {
    deezer.getTrackByIsrc.mockImplementation(async (isrc: string) => {
      if (isrc === 'OK1') return { status: 'ok', data: { bpm: 100, rank: 5 } };
      if (isrc === 'NF1') return { status: 'not_found' };
      return { status: 'failed' };
    });

    expect(await getTrackDetails(['OK1', 'NF1', 'FAIL1', 'OK1'])).toEqual({ OK1: { bpm: 100, popularity: 5 } });
    expect(peekTrackDetails('OK1')).toEqual({ bpm: 100, popularity: 5 });
    expect(peekTrackDetails('NF1')).toBeUndefined();
    expect(peekTrackDetails('UNKNOWN')).toBeUndefined();

    deezer.getTrackByIsrc.mockClear();
    await getTrackDetails(['OK1', 'NF1', 'FAIL1']);
    expect(deezer.getTrackByIsrc.mock.calls).toEqual([['FAIL1']]);
  });
});

describe('findPreviewUrl', () => {
  it('uses the Deezer preview found by ISRC and caches its details', async () => {
    deezer.getTrackByIsrc.mockResolvedValue({ status: 'ok', data: { bpm: 90, preview: DEEZER_PREVIEW } });
    expect(await findPreviewUrl({ isrc: 'ISRC00000001', title: 'Song', artistName: 'Band' })).toBe(DEEZER_PREVIEW);
    expect(peekTrackDetails('ISRC00000001')).toEqual({ bpm: 90, popularity: null });
    expect(deezer.searchTrack).not.toHaveBeenCalled();
  });

  it('falls back to Deezer search, then iTunes', async () => {
    deezer.getTrackByIsrc.mockResolvedValue({ status: 'ok', data: { preview: '' } });
    deezer.searchTrack.mockResolvedValueOnce({ preview: DEEZER_PREVIEW }).mockResolvedValue(null);
    itunes.findPreview.mockResolvedValue(ITUNES_PREVIEW);

    expect(await findPreviewUrl({ isrc: 'ISRC00000002', title: 'A', artistName: 'B' })).toBe(DEEZER_PREVIEW);
    expect(await findPreviewUrl({ isrc: null, title: 'C', artistName: 'D' })).toBe(ITUNES_PREVIEW);
    expect(itunes.findPreview).toHaveBeenCalledWith('C', 'D');
  });

  it('skips Deezer ISRC results that are not found', async () => {
    deezer.getTrackByIsrc.mockResolvedValue({ status: 'not_found' });
    deezer.searchTrack.mockResolvedValue(null);
    itunes.findPreview.mockResolvedValue(null);
    expect(await findPreviewUrl({ isrc: 'ISRC00000003', title: 'E', artistName: 'F' })).toBeNull();
  });

  it('caches by the query, so repeated lookups do not hit the APIs', async () => {
    deezer.searchTrack.mockResolvedValue(null);
    itunes.findPreview.mockResolvedValue(ITUNES_PREVIEW);
    await findPreviewUrl({ isrc: null, title: 'Cached', artistName: 'Song' });
    await findPreviewUrl({ isrc: null, title: 'CACHED', artistName: 'song' });
    expect(itunes.findPreview).toHaveBeenCalledTimes(1);
  });

  it('drops preview URLs outside the allowed audio hosts', async () => {
    deezer.searchTrack.mockResolvedValue({ preview: 'https://evil.com/a.mp3' });
    expect(await findPreviewUrl({ isrc: null, title: 'Evil', artistName: 'Host' })).toBeNull();
  });
});
