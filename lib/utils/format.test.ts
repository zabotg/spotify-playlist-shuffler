import { describe, expect, it } from 'vitest';
import { formatAddedDate, formatCompactNumber, formatTrackLength } from './format';

describe('formatTrackLength', () => {
  it('formats minutes and padded seconds', () => {
    expect(formatTrackLength(255_000)).toBe('4:15');
    expect(formatTrackLength(65_000)).toBe('1:05');
  });
});

describe('formatAddedDate', () => {
  const now = Date.parse('2026-11-19T12:00:00Z');

  it('uses relative days for the last week', () => {
    expect(formatAddedDate('2026-11-16T12:00:00Z', now)).toBe('3 days ago');
    expect(formatAddedDate('2026-11-19T08:00:00Z', now)).toBe('Today');
  });

  it('uses a short date for older tracks', () => {
    expect(formatAddedDate('2025-01-23T12:00:00Z', now)).toBe('Jan 23, 2025');
  });
});

describe('formatCompactNumber', () => {
  it('abbreviates large numbers', () => {
    expect(formatCompactNumber(968_208)).toBe('968.2K');
  });
});
