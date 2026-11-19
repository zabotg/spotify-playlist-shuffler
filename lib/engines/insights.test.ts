import { describe, expect, it } from 'vitest';
import { enrich, makeFeatures, makeTrack } from '@/test/factories';
import { computeInsights } from './insights';

describe('computeInsights', () => {
  it('summarizes duration, artists and release decades', () => {
    const tracks = [
      enrich(makeTrack({ artists: [{ id: 'a', name: 'A' }], releaseDate: '1995-03-01', durationMs: 60_000 })),
      enrich(makeTrack({ artists: [{ id: 'a', name: 'A' }], releaseDate: '1999', durationMs: 60_000 })),
      enrich(makeTrack({ artists: [{ id: 'b', name: 'B' }], releaseDate: '2010-06-01', explicit: true })),
    ];

    const insights = computeInsights(tracks, 1, [['rock', 'indie'], ['rock']]);

    expect(insights.trackCount).toBe(3);
    expect(insights.skippedItemCount).toBe(1);
    expect(insights.uniqueArtistCount).toBe(2);
    expect(insights.topArtists[0]).toMatchObject({ id: 'a', name: 'A', trackCount: 2 });
    expect(insights.decadeDistribution).toEqual({ '1990s': 2, '2010s': 1 });
    expect(insights.explicitRatio).toBeCloseTo(1 / 3);
    expect(insights.topGenres).toEqual(['rock', 'indie']);
  });

  it('omits audio averages and mood when no features are available', () => {
    const insights = computeInsights([enrich(makeTrack())], 0, []);
    expect(insights.audioFeatureAverages).toBeNull();
    expect(insights.mood).toBeNull();
  });

  it('derives the mood from average audio features', () => {
    const features = makeFeatures({ valence: 0.9, energy: 0.9, danceability: 0.9 });
    const insights = computeInsights([enrich(makeTrack(), { features })], 0, []);
    expect(insights.mood).toEqual({ quadrant: 'Joyful', label: 'Euphoric' });
  });

  it('averages BPM from Deezer data when audio features are missing', () => {
    const tracks = [enrich(makeTrack(), { bpm: 100 }), enrich(makeTrack(), { bpm: 120 })];
    expect(computeInsights(tracks, 0, []).averageBpm).toBe(110);
  });
});
