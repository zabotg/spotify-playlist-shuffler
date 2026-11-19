/**
 * Spotify removes playlist items by URI, which takes out every copy of that track. To remove
 * only some positions, every copy is removed and the copies to keep are inserted back in place.
 * Only those re-inserted copies get a new "date added".
 */

export interface RemovalPlan {
  /** Every copy of these tracks is removed. */
  removeUris: string[];
  /** Copies that must come back, in ascending position order. */
  reinsert: { uri: string; position: number }[];
}

/** Plan for removing the given positions, or `null` if a position doesn't exist. */
export function planRemoval(current: readonly string[], positions: readonly number[]): RemovalPlan | null {
  const removed = new Set(positions);
  if ([...removed].some((position) => !Number.isInteger(position) || position < 0 || position >= current.length)) {
    return null;
  }

  const removeUris = [...new Set([...removed].map((position) => current[position]))];
  const affected = new Set(removeUris);
  const remaining = current.filter((_, position) => !removed.has(position));
  const reinsert = remaining.flatMap((uri, position) => (affected.has(uri) ? [{ uri, position }] : []));
  return { removeUris, reinsert };
}
