import { describe, expect, it } from 'vitest';
import { average, chunk, countBy, groupBy, interleave, isDefined, range, sum, topEntries, uniqueBy } from '@/lib/utils/array';

describe('array utils', () => {
  it('chunks items into fixed-size groups', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });

  it('builds a stepped range without the end value', () => {
    expect(range(100, 350, 100)).toEqual([100, 200, 300]);
    expect(range(0, 3)).toEqual([0, 1, 2]);
  });

  it('sums and averages numbers', () => {
    expect(sum([1, 2, 3])).toBe(6);
    expect(average([])).toBeNull();
    expect(average([2, 4])).toBe(3);
  });

  it('groups items by key in insertion order', () => {
    const groups = groupBy(['apple', 'avocado', 'banana'], (word) => word[0]);
    expect([...groups.entries()]).toEqual([
      ['a', ['apple', 'avocado']],
      ['b', ['banana']],
    ]);
  });

  it('keeps the first occurrence of each key', () => {
    expect(uniqueBy(['a', 'A', 'b'], (value) => value.toLowerCase())).toEqual(['a', 'b']);
    expect(interleave(['a1', 'a2', 'a3'], ['b1'])).toEqual(['a1', 'b1', 'a2', 'a3']);
    expect(interleave(['a1'], ['b1', 'b2'])).toEqual(['a1', 'b1', 'b2']);
  });

  it('returns the most frequent entries first', () => {
    expect(topEntries(countBy(['x', 'y', 'y'], (value) => value), 1)).toEqual([['y', 2]]);
  });

  it('tells defined values apart from null and undefined', () => {
    expect([0, '', null, undefined, false].filter(isDefined)).toEqual([0, '', false]);
  });
});
