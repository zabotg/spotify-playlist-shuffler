/**
 * Camelot wheel: the key notation DJs use for harmonic mixing. Keys next to each other on
 * the wheel (same number, or ±1 with the same letter) blend without clashing.
 */

/** Camelot number for each pitch class (C = 0 ... B = 11), major keys ("B" side). */
const MAJOR_NUMBERS = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1];
/** Camelot number for each pitch class, minor keys ("A" side). */
const MINOR_NUMBERS = [5, 12, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10];
const WHEEL_SIZE = 12;

export interface CamelotKey {
  number: number;
  letter: 'A' | 'B';
}

/** Spotify-style key (pitch class 0-11, mode 1 = major, 0 = minor) to Camelot, or null if unknown. */
export function toCamelot(key: number, mode: number): CamelotKey | null {
  const number = (mode === 1 ? MAJOR_NUMBERS : MINOR_NUMBERS)[key];
  return number === undefined ? null : { number, letter: mode === 1 ? 'B' : 'A' };
}

export function formatCamelot({ number, letter }: CamelotKey): string {
  return `${number}${letter}`;
}

export function areKeysCompatible(a: CamelotKey, b: CamelotKey): boolean {
  if (a.number === b.number) return true;
  if (a.letter !== b.letter) return false;
  const distance = Math.abs(a.number - b.number);
  return distance === 1 || distance === WHEEL_SIZE - 1;
}
