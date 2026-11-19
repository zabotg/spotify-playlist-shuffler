import { describe, expect, it } from 'vitest';
import { average, chunk, countBy, partition, range, topEntries, uniqueBy } from './array';

describe('array utils', () => {
  it('chunks items into fixed-size groups', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('builds a stepped range without the end value', () => {
    expect(range(100, 350, 100)).toEqual([100, 200, 300]);
  });

  it('returns null as the average of an empty list', () => {
    expect(average([])).toBeNull();
    expect(average([2, 4])).toBe(3);
  });

  it('partitions items by a predicate', () => {
    expect(partition([1, 2, 3, 4], (value) => value % 2 === 0)).toEqual([[2, 4], [1, 3]]);
  });

  it('keeps the first occurrence of each key', () => {
    expect(uniqueBy(['a', 'A', 'b'], (value) => value.toLowerCase())).toEqual(['a', 'b']);
  });

  it('returns the most frequent entries first', () => {
    expect(topEntries(countBy(['x', 'y', 'y'], (value) => value), 1)).toEqual([['y', 2]]);
  });
});
