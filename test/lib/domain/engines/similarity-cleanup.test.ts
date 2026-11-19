import { describe, expect, it } from 'vitest';
import { findDuplicates, findOutliers } from '@/lib/domain/engines/cleanup';
import { findHiddenGems } from '@/lib/domain/engines/gems';
import { buildSoundProfile, dimensionValue, profileDistance, zScores } from '@/lib/domain/engines/similarity';
import { splitByMood } from '@/lib/domain/engines/split';
import { byArtist, enrich, makeFeatures, makeTrack } from '@/test/factories';

describe('sound profile', () => {
  it('averages features, scales tempo and floors the spread', () => {
    const profile = buildSoundProfile([makeFeatures({ energy: 0.4, tempo: 100 }), makeFeatures({ energy: 0.6, tempo: 140 })]);
    expect(profile?.mean.energy).toBeCloseTo(0.5);
    expect(profile?.mean.tempo).toBeCloseTo(0.6);
    expect(profile?.deviation.energy).toBeCloseTo(0.1);
    expect(profile?.deviation.valence).toBe(0.05);
    expect(dimensionValue(makeFeatures({ tempo: 200 }), 'tempo')).toBe(1);
    expect(buildSoundProfile([])).toBeNull();
  });

  it('measures distance from the profile', () => {
    const profile = buildSoundProfile([makeFeatures({ energy: 0.4 }), makeFeatures({ energy: 0.6 })])!;
    expect(profileDistance(makeFeatures({ energy: 0.5 }), profile)).toBeCloseTo(0);
    expect(zScores(makeFeatures({ energy: 0.7 }), profile).energy).toBeCloseTo(2);
  });
});

describe('findDuplicates', () => {
  it('groups the same ISRC and the same title by the same artist', () => {
    const original = makeTrack({ name: 'Song', isrc: 'ISRC1', artists: [{ id: 'a', name: 'A' }] });
    const sameIsrc = makeTrack({ name: 'Song (Live)', isrc: 'ISRC1', artists: [{ id: 'a', name: 'A' }] });
    const remaster = makeTrack({ name: 'Song - Remastered 2011', isrc: 'ISRC2', artists: [{ id: 'a', name: 'A' }] });
    const otherArtist = makeTrack({ name: 'Song', isrc: null, artists: [{ id: 'b', name: 'B' }] });
    const unique = makeTrack({ name: 'Other', isrc: null });

    const groups = findDuplicates([original, sameIsrc, unique, remaster, otherArtist].map((track) => enrich(track)));
    expect(groups).toEqual([{ positions: [0, 1, 3] }]);
  });
});

describe('findOutliers', () => {
  const steady = (energy: number) => enrich(byArtist('x'), { features: makeFeatures({ energy, valence: 0.5 }) });

  it('finds the track that does not match and says why', () => {
    const tracks = [...Array.from({ length: 9 }, (_, index) => steady(0.5 + index * 0.01)), steady(0.98), enrich(makeTrack())];
    const outliers = findOutliers(tracks, 3);
    expect(outliers[0]).toMatchObject({ position: 9, reason: 'more energetic' });
    expect(outliers.every((outlier) => outlier.distance >= 2.2)).toBe(true);
  });

  it('describes tracks below the average too', () => {
    const tracks = [...Array.from({ length: 9 }, (_, index) => steady(0.5 + index * 0.01)), steady(0.05)];
    expect(findOutliers(tracks, 1)[0]?.reason).toBe('calmer');
  });

  it('names the aspect that differs most, even when it is not energy', () => {
    const atTempo = (tempo: number) => enrich(byArtist('x'), { features: makeFeatures({ tempo }) });
    const tracks = [...Array.from({ length: 9 }, (_, index) => atTempo(100 + index)), atTempo(190)];
    expect(findOutliers(tracks, 1)[0]?.reason).toBe('faster');
  });

  it('needs enough tracks with audio data', () => {
    expect(findOutliers([steady(0.1), steady(0.9)], 5)).toEqual([]);
  });
});

describe('splitByMood', () => {
  it('groups tracks with audio data by mood, in a fixed order', () => {
    const calm = enrich(makeTrack(), { features: makeFeatures({ valence: 0.8, energy: 0.2 }) });
    const joyful = enrich(makeTrack(), { features: makeFeatures({ valence: 0.8, energy: 0.8 }) });
    const groups = splitByMood([calm, joyful, enrich(makeTrack())]);
    expect(groups).toEqual([
      { mood: 'Joyful', tracks: [joyful] },
      { mood: 'Calm', tracks: [calm] },
    ]);
  });
});

describe('findHiddenGems', () => {
  it('returns the least popular tracks once enough have popularity data', () => {
    const tracks = Array.from({ length: 10 }, (_, index) => enrich(makeTrack(), { popularity: (index + 1) * 1000 }));
    expect(findHiddenGems([...tracks, enrich(makeTrack())], 2).map((item) => item.popularity)).toEqual([1000, 2000]);
    expect(findHiddenGems(tracks.slice(0, 9), 2)).toEqual([]);
  });
});
