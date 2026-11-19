import { describe, expect, it } from 'vitest';
import { jsonResponse, mockFetch } from '@/test/fakes';
import { getAudioFeaturesBatch, RECCOBEATS_MAX_IDS_PER_REQUEST } from '@/lib/clients/reccobeats/client';

const raw = (spotifyId: string) => ({
  id: 'recco-id',
  href: `https://open.spotify.com/track/${spotifyId}`,
  tempo: 120,
  energy: 0.5,
  danceability: 0.6,
  valence: 0.7,
  acousticness: 0.1,
  instrumentalness: 0,
  liveness: 0.1,
  speechiness: 0.05,
  key: 1,
  mode: 1,
  loudness: -5,
});

describe('getAudioFeaturesBatch', () => {
  it('maps features to Spotify IDs taken from the href', async () => {
    const fetchMock = mockFetch(jsonResponse({ content: [raw('abc'), { ...raw('x'), href: 'https://other.site/1' }] }));
    const features = await getAudioFeaturesBatch(['abc', 'missing']);

    expect([...(features?.keys() ?? [])]).toEqual(['abc']);
    expect(features?.get('abc')).toMatchObject({ id: 'abc', tempo: 120, key: 1, valence: 0.7 });
    expect(features?.get('abc')).not.toHaveProperty('href');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.reccobeats.com/v1/audio-features?ids=abc,missing');
  });

  it('handles empty input, empty content and failed requests', async () => {
    expect(await getAudioFeaturesBatch([])).toEqual(new Map());
    mockFetch(jsonResponse({}), new Response('', { status: 400 }));
    expect(await getAudioFeaturesBatch(['a'])).toEqual(new Map());
    expect(await getAudioFeaturesBatch(['a'])).toBeNull();
  });

  it('refuses batches over the API limit', async () => {
    const ids = Array.from({ length: RECCOBEATS_MAX_IDS_PER_REQUEST + 1 }, (_, index) => `id${index}`);
    await expect(getAudioFeaturesBatch(ids)).rejects.toBeInstanceOf(RangeError);
  });
});
