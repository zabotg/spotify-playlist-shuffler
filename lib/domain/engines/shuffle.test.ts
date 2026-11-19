import { describe, expect, it } from 'vitest';
import type { EnrichedTrack } from '@/lib/domain/models/playlist';
import { SHUFFLE_MODES } from '@/lib/domain/models/shuffle';
import { byArtist, enrich, makeFeatures, makeTrack, seededRandom } from '@/test/factories';
import {
  applyShuffle,
  artistAwareShuffle,
  balancedShuffle,
  bpmSmoothShuffle,
  energyCurveShuffle,
  moodShuffle,
  toMountainArc,
} from './shuffle';

const ids = (items: EnrichedTrack[]) => items.map((item) => item.track.id).sort();
const artistSequence = (items: EnrichedTrack[]) => items.map((item) => item.track.artists[0]?.id);

function hasAdjacentRepeats(sequence: (string | undefined)[]): boolean {
  return sequence.some((value, index) => index > 0 && value === sequence[index - 1]);
}

describe('toMountainArc', () => {
  it('rises to the highest value and falls back down', () => {
    expect(toMountainArc([1, 2, 3, 4, 5])).toEqual([1, 3, 5, 4, 2]);
  });
});

describe('applyShuffle', () => {
  const tracks = ['a', 'b', 'c', 'a', 'b', 'c'].map((artist) =>
    enrich(byArtist(artist), { bpm: 100, features: makeFeatures() }),
  );

  it.each(SHUFFLE_MODES)('keeps every track exactly once in %s mode', (mode) => {
    const result = applyShuffle(tracks, { mode }, seededRandom());
    expect(ids(result)).toEqual(ids(tracks));
  });
});

describe('balancedShuffle', () => {
  it('never plays the same artist twice in a row when artists are evenly split', () => {
    const tracks = ['a', 'a', 'b', 'b', 'c', 'c'].map((artist) => enrich(byArtist(artist)));
    const result = balancedShuffle(tracks, seededRandom());
    expect(hasAdjacentRepeats(artistSequence(result))).toBe(false);
  });
});

describe('artistAwareShuffle', () => {
  it('respects the minimum gap between tracks from the same artist', () => {
    const tracks = ['a', 'a', 'b', 'b', 'c', 'c', 'd', 'd'].map((artist) => enrich(byArtist(artist)));
    const result = artistSequence(artistAwareShuffle(tracks, 2, seededRandom()));
    result.forEach((artist, index) => {
      expect(result.slice(Math.max(0, index - 2), index)).not.toContain(artist);
    });
  });

  it('still returns every track when only one artist exists', () => {
    const tracks = [1, 2, 3].map(() => enrich(byArtist('solo')));
    expect(artistAwareShuffle(tracks, 3, seededRandom())).toHaveLength(3);
  });
});

describe('bpmSmoothShuffle', () => {
  it('builds a tempo arc and puts tracks without BPM at the end', () => {
    const withBpm = [80, 100, 120, 140, 160].map((bpm) => enrich(makeTrack(), { bpm }));
    const withoutBpm = enrich(makeTrack());
    const result = bpmSmoothShuffle([withoutBpm, ...withBpm], () => 0.5);

    expect(result.map((item) => item.bpm)).toEqual([80, 120, 160, 140, 100, null]);
  });

  it('falls back to a random order when no track has BPM data', () => {
    const tracks = [enrich(makeTrack()), enrich(makeTrack())];
    expect(ids(bpmSmoothShuffle(tracks, seededRandom()))).toEqual(ids(tracks));
  });
});

describe('energyCurveShuffle', () => {
  const tracks = [0.9, 0.1, 0.5].map((energy) => enrich(makeTrack(), { features: makeFeatures({ energy }) }));
  const energies = (items: EnrichedTrack[]) => items.map((item) => item.features?.energy);

  it('orders tracks by rising energy', () => {
    expect(energies(energyCurveShuffle(tracks, 'ascending'))).toEqual([0.1, 0.5, 0.9]);
  });

  it('orders tracks by falling energy', () => {
    expect(energies(energyCurveShuffle(tracks, 'descending'))).toEqual([0.9, 0.5, 0.1]);
  });
});

describe('moodShuffle', () => {
  it('plays moods in the requested order', () => {
    const calm = enrich(makeTrack(), { features: makeFeatures({ valence: 0.8, energy: 0.2 }) });
    const intense = enrich(makeTrack(), { features: makeFeatures({ valence: 0.2, energy: 0.9 }) });
    const result = moodShuffle([calm, intense], ['Intense', 'Calm'], seededRandom());
    expect(result).toEqual([intense, calm]);
  });

  it('keeps tracks whose mood is not in the sequence', () => {
    const joyful = enrich(makeTrack(), { features: makeFeatures({ valence: 0.9, energy: 0.9 }) });
    const noFeatures = enrich(makeTrack());
    expect(moodShuffle([joyful, noFeatures], ['Calm'], seededRandom())).toHaveLength(2);
  });
});

describe('shuffle edge cases', () => {
  const withEnergy = (energy: number) => enrich(makeTrack({ name: `e${energy}` }), { features: makeFeatures({ energy }) });
  const energies = (items: EnrichedTrack[]) => items.map((item) => item.features?.energy ?? null);
  const curve = [0.1, 0.2, 0.3, 0.4, 0.5].map(withEnergy);

  it.each([
    ['ascending', [0.1, 0.2, 0.3, 0.4, 0.5]],
    ['descending', [0.5, 0.4, 0.3, 0.2, 0.1]],
    ['mountain', [0.1, 0.3, 0.5, 0.4, 0.2]],
    ['valley', [0.5, 0.3, 0.1, 0.2, 0.4]],
    ['wave', [0.1, 0.5, 0.3, 0.2, 0.4]],
  ] as const)('arranges energy as a %s', (profile, expected) => {
    expect(energies(energyCurveShuffle(curve, profile, seededRandom()))).toEqual(expected);
  });

  it('puts tracks without data after the arranged ones', () => {
    const bare = enrich(makeTrack());
    expect(energyCurveShuffle([bare, ...curve], 'ascending', seededRandom()).at(-1)).toBe(bare);
    expect(bpmSmoothShuffle([bare, enrich(makeTrack(), { bpm: 100 })], seededRandom()).at(-1)).toBe(bare);
  });

  it('falls back to a random order when no track has the needed data', () => {
    const bare = [enrich(makeTrack()), enrich(makeTrack())];
    expect(ids(energyCurveShuffle(bare, 'mountain', seededRandom()))).toEqual(ids(bare));
    expect(ids(bpmSmoothShuffle(bare, seededRandom()))).toEqual(ids(bare));
  });

  it('plays moods in order and appends moods that were not selected', () => {
    const joyful = enrich(makeTrack(), { features: makeFeatures({ valence: 0.9, energy: 0.9 }) });
    const calm = enrich(makeTrack(), { features: makeFeatures({ valence: 0.9, energy: 0.1 }) });
    const sad = enrich(makeTrack(), { features: makeFeatures({ valence: 0.1, energy: 0.1 }) });
    const result = moodShuffle([sad, joyful, calm], ['Calm', 'Joyful', 'Intense'], seededRandom());
    expect(result).toEqual([calm, joyful, sad]);
  });

  it('handles empty playlists and uses the default random source and options', () => {
    expect(balancedShuffle([])).toEqual([]);
    expect(artistAwareShuffle([])).toEqual([]);
    const tracks = [enrich(byArtist('a')), enrich(byArtist('b'))];
    expect(ids(applyShuffle(tracks, { mode: 'pure_random' }))).toEqual(ids(tracks));
    expect(ids(energyCurveShuffle(tracks))).toEqual(ids(tracks));
    expect(ids(moodShuffle(tracks))).toEqual(ids(tracks));
    expect(ids(bpmSmoothShuffle(tracks))).toEqual(ids(tracks));
    expect(ids(balancedShuffle(tracks))).toEqual(ids(tracks));
  });
});
