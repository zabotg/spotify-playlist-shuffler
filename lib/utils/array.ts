export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }
  return chunks;
}

export function range(start: number, end: number, step = 1): number[] {
  const values: number[] = [];
  for (let value = start; value < end; value += step) values.push(value);
  return values;
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function average(values: readonly number[]): number | null {
  return values.length > 0 ? sum(values) / values.length : null;
}

export function groupBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

export function countBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, number> {
  const counts = new Map<K, number>();
  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function uniqueBy<T, K>(items: readonly T[], keyOf: (item: T) => K): T[] {
  const seen = new Set<K>();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Takes one item from each list in turn: [a1, b1, a2, b2, ...], then the rest of the longer one. */
export function interleave<T>(first: readonly T[], second: readonly T[]): T[] {
  const result: T[] = [];
  for (let index = 0; index < Math.max(first.length, second.length); index += 1) {
    if (index < first.length) result.push(first[index]);
    if (index < second.length) result.push(second[index]);
  }
  return result;
}

export function topEntries<K>(counts: Map<K, number>, limit: number): [K, number][] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
