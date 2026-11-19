export type SortDirection = 'asc' | 'desc';
export type SortValue = number | string | null;

export interface SortState<Key extends string> {
  key: Key;
  direction: SortDirection;
}

/**
 * Compares two values for the given direction. Missing values (`null`) always go last,
 * whichever direction is chosen, so tracks without data never jump to the top.
 */
export function compareSortValues(a: SortValue, b: SortValue, direction: SortDirection): number {
  if (a === null || b === null) {
    if (a === b) return 0;
    return a === null ? 1 : -1;
  }
  const order =
    typeof a === 'string' && typeof b === 'string'
      ? a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
      : Number(a) - Number(b);
  return direction === 'asc' ? order : -order;
}

/**
 * Stable sort by a value getter. Without a getter the original order is kept
 * (reversed for descending), which is how the position column works.
 */
export function sortBy<T>(
  items: readonly T[],
  valueOf: ((item: T) => SortValue) | undefined,
  direction: SortDirection,
): T[] {
  if (!valueOf) return direction === 'asc' ? [...items] : [...items].reverse();

  return items
    .map((item, index) => ({ item, index, value: valueOf(item) }))
    .sort((a, b) => compareSortValues(a.value, b.value, direction) || a.index - b.index)
    .map(({ item }) => item);
}

/** The first click on a column sorts ascending, the next one flips the direction. */
export function nextSortState<Key extends string>(current: SortState<Key>, key: Key): SortState<Key> {
  if (current.key !== key) return { key, direction: 'asc' };
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}
