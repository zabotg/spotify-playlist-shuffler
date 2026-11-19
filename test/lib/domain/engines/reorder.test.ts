import { describe, expect, it } from 'vitest';
import { applyMove, planReorder } from '@/lib/domain/engines/reorder';
import { shuffleArray } from '@/lib/utils/random';
import { seededRandom } from '@/test/factories';

function applyAll(current: string[], target: string[]): string[] {
  const moves = planReorder(current, target);
  if (!moves) throw new Error('expected a plan');
  return moves.reduce<string[]>((list, move) => applyMove(list, move), current);
}

describe('applyMove', () => {
  it('moves a range backwards and forwards like Spotify does', () => {
    const list = ['a', 'b', 'c', 'd', 'e'];
    expect(applyMove(list, { rangeStart: 3, rangeLength: 2, insertBefore: 0 })).toEqual(['d', 'e', 'a', 'b', 'c']);
    expect(applyMove(list, { rangeStart: 0, rangeLength: 1, insertBefore: 5 })).toEqual(['b', 'c', 'd', 'e', 'a']);
    expect(applyMove(list, { rangeStart: 1, rangeLength: 2, insertBefore: 4 })).toEqual(['a', 'd', 'b', 'c', 'e']);
  });
});

describe('planReorder', () => {
  it('needs no moves for the same order', () => {
    expect(planReorder(['a', 'b'], ['a', 'b'])).toEqual([]);
  });

  it('moves consecutive items together as one range', () => {
    expect(planReorder(['a', 'b', 'c', 'd'], ['c', 'd', 'a', 'b'])).toEqual([
      { rangeStart: 2, rangeLength: 2, insertBefore: 0 },
    ]);
  });

  it('handles duplicate tracks', () => {
    expect(applyAll(['a', 'b', 'a', 'c'], ['a', 'a', 'c', 'b'])).toEqual(['a', 'a', 'c', 'b']);
  });

  it('refuses a target that is not a reordering of the current list', () => {
    expect(planReorder(['a', 'b'], ['a', 'c'])).toBeNull();
    expect(planReorder(['a', 'b'], ['a'])).toBeNull();
    expect(planReorder(['a', 'a'], ['a', 'b'])).toBeNull();
  });

  it('always reaches the target order (200 random shuffles)', () => {
    const random = seededRandom(11);
    for (let run = 0; run < 200; run++) {
      const size = 1 + Math.floor(random() * 40);
      const current = Array.from({ length: size }, (_, index) => `t${index % Math.max(1, size - 3)}`);
      const target = shuffleArray(current, random);
      expect(applyAll(current, target)).toEqual(target);
    }
  });
});
