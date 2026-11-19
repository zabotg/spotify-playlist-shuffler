import { describe, expect, it } from 'vitest';
import { compareSortValues, nextSortState, sortBy } from '@/app/playlists/[id]/_components/track-table/sorting';

describe('compareSortValues', () => {
  it('orders numbers and text in both directions', () => {
    expect(compareSortValues(1, 2, 'asc')).toBeLessThan(0);
    expect(compareSortValues(1, 2, 'desc')).toBeGreaterThan(0);
    expect(compareSortValues('b', 'A', 'asc')).toBeGreaterThan(0);
    expect(compareSortValues('track 2', 'track 10', 'asc')).toBeLessThan(0);
  });

  it('always puts missing values last', () => {
    expect(compareSortValues(null, 5, 'asc')).toBe(1);
    expect(compareSortValues(null, 5, 'desc')).toBe(1);
    expect(compareSortValues(5, null, 'desc')).toBe(-1);
    expect(compareSortValues(null, null, 'asc')).toBe(0);
  });
});

describe('sortBy', () => {
  const rows = [
    { id: 'a', bpm: 120 },
    { id: 'b', bpm: null },
    { id: 'c', bpm: 90 },
    { id: 'd', bpm: 120 },
  ];
  const ids = (items: typeof rows) => items.map((row) => row.id);

  it('sorts with missing values at the bottom in both directions', () => {
    expect(ids(sortBy(rows, (row) => row.bpm, 'asc'))).toEqual(['c', 'a', 'd', 'b']);
    expect(ids(sortBy(rows, (row) => row.bpm, 'desc'))).toEqual(['a', 'd', 'c', 'b']);
  });

  it('keeps the original order without a value getter', () => {
    expect(ids(sortBy(rows, undefined, 'asc'))).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(sortBy(rows, undefined, 'desc'))).toEqual(['d', 'c', 'b', 'a']);
  });

  it('does not change the input array', () => {
    const copy = [...rows];
    sortBy(rows, (row) => row.bpm, 'desc');
    expect(rows).toEqual(copy);
  });
});

describe('nextSortState', () => {
  it('starts ascending on a new column and flips on the same one', () => {
    const first = nextSortState({ key: 'position', direction: 'asc' }, 'bpm');
    expect(first).toEqual({ key: 'bpm', direction: 'asc' });
    const second = nextSortState(first, 'bpm');
    expect(second).toEqual({ key: 'bpm', direction: 'desc' });
    expect(nextSortState(second, 'bpm')).toEqual({ key: 'bpm', direction: 'asc' });
  });
});
