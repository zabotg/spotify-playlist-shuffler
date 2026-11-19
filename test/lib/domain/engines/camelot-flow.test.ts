import { describe, expect, it } from 'vitest';
import { areKeysCompatible, formatCamelot, toCamelot } from '@/lib/domain/engines/camelot';
import { analyzeFlow, roughestTransitions, scoreTransition } from '@/lib/domain/engines/flow';
import { enrich, makeFeatures, makeTrack } from '@/test/factories';

describe('camelot', () => {
  it('maps keys to the Camelot wheel', () => {
    expect(toCamelot(0, 1)).toEqual({ number: 8, letter: 'B' });
    expect(toCamelot(9, 0)).toEqual({ number: 8, letter: 'A' });
    expect(formatCamelot(toCamelot(11, 1)!)).toBe('1B');
    expect(toCamelot(-1, -1)).toBeNull();
  });

  it('treats neighbours on the wheel as compatible', () => {
    const key = (number: number, letter: 'A' | 'B') => ({ number, letter });
    expect(areKeysCompatible(key(8, 'A'), key(8, 'B'))).toBe(true);
    expect(areKeysCompatible(key(8, 'A'), key(9, 'A'))).toBe(true);
    expect(areKeysCompatible(key(12, 'B'), key(1, 'B'))).toBe(true);
    expect(areKeysCompatible(key(8, 'A'), key(9, 'B'))).toBe(false);
    expect(areKeysCompatible(key(1, 'A'), key(5, 'A'))).toBe(false);
  });
});

describe('flow', () => {
  const track = (bpm: number | null, features?: Parameters<typeof makeFeatures>[0]) =>
    enrich(makeTrack(), { bpm, features: features ? makeFeatures(features) : null });

  it('scores a seamless transition as 1', () => {
    expect(scoreTransition(track(120, { key: 0, mode: 1 }), track(122, { key: 7, mode: 1 }))).toEqual({
      score: expect.closeTo(0.97, 2),
      issues: [],
    });
  });

  it('flags tempo, key and energy problems', () => {
    const result = scoreTransition(track(80, { key: 0, mode: 1, energy: 0.1 }), track(126, { key: 6, mode: 1, energy: 0.9 }));
    expect(result.issues).toEqual(['tempo', 'key', 'energy']);
    expect(result.score).toBeCloseTo(0, 5);
  });

  it('treats half and double time as close tempos', () => {
    expect(scoreTransition(track(70), track(140)).issues).toEqual([]);
    expect(scoreTransition(track(140), track(70)).issues).toEqual([]);
  });

  it('skips the key when it is unknown and returns null without any data', () => {
    expect(scoreTransition(track(null, { key: -1 }), track(null, { key: 0 })).issues).toEqual([]);
    expect(scoreTransition(track(null), track(null))).toEqual({ score: null, issues: [] });
  });

  it('averages the transitions into a 0-100 score and lists the roughest ones', () => {
    const tracks = [track(120, { energy: 0.5 }), track(121, { energy: 0.5 }), track(170, { energy: 0.5 }), track(null)];
    const analysis = analyzeFlow(tracks);
    expect(analysis.transitions.map((transition) => transition.index)).toEqual([0, 1, 2]);
    expect(analysis.score).toBeGreaterThan(0);
    expect(analysis.score).toBeLessThan(100);
    expect(roughestTransitions(analysis, 5).map((transition) => transition.index)).toEqual([1]);
    expect(analyzeFlow([track(null), track(null)]).score).toBeNull();
  });
});
