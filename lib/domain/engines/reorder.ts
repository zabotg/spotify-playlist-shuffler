/**
 * Turns "current order → new order" into a list of moves for Spotify's reorder endpoint.
 * Moving items (instead of removing and re-adding them) keeps each track's "date added"
 * and "added by".
 */

export interface ReorderMove {
  rangeStart: number;
  rangeLength: number;
  /** Position, in the list before the move, where the range is inserted. */
  insertBefore: number;
}

/** Applies a move to a list, the same way Spotify does. Returns a new list. */
export function applyMove<T>(items: readonly T[], { rangeStart, rangeLength, insertBefore }: ReorderMove): T[] {
  const moved = items.slice(rangeStart, rangeStart + rangeLength);
  const rest = [...items.slice(0, rangeStart), ...items.slice(rangeStart + rangeLength)];
  const insertAt = insertBefore > rangeStart ? insertBefore - rangeLength : insertBefore;
  return [...rest.slice(0, insertAt), ...moved, ...rest.slice(insertAt)];
}

function isPermutation(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const counts = new Map<string, number>();
  for (const value of a) counts.set(value, (counts.get(value) ?? 0) + 1);
  for (const value of b) {
    const count = counts.get(value);
    if (!count) return false;
    counts.set(value, count - 1);
  }
  return true;
}

/**
 * Moves that turn `current` into `target`, or `null` when `target` isn't a reordering of
 * `current` (e.g. the playlist changed after it was loaded). Items that already follow each
 * other in the target are moved together as one range, which saves requests.
 */
export function planReorder(current: readonly string[], target: readonly string[]): ReorderMove[] | null {
  if (!isPermutation(current, target)) return null;

  const moves: ReorderMove[] = [];
  let working = [...current];
  let position = 0;
  while (position < target.length) {
    if (working[position] === target[position]) {
      position += 1;
      continue;
    }
    const rangeStart = working.indexOf(target[position], position + 1);
    let rangeLength = 1;
    while (
      position + rangeLength < target.length &&
      working[rangeStart + rangeLength] === target[position + rangeLength]
    ) {
      rangeLength += 1;
    }
    const move = { rangeStart, rangeLength, insertBefore: position };
    moves.push(move);
    working = applyMove(working, move);
    position += rangeLength;
  }
  return moves;
}
