import { describe, expect, it } from 'vitest';
import {
  formatAddedDate,
  formatCompactNumber,
  formatDecibels,
  formatDuration,
  formatMusicalKey,
  formatPercent,
  formatTrackLength,
  pluralize,
} from './format';

describe('formatDuration', () => {
  it('shows minutes, and hours when there are any', () => {
    expect(formatDuration(45 * 60_000)).toBe('45min');
    expect(formatDuration(2 * 3_600_000 + 5 * 60_000)).toBe('2h 5min');
  });
});

describe('formatTrackLength', () => {
  it('formats minutes and padded seconds', () => {
    expect(formatTrackLength(255_000)).toBe('4:15');
    expect(formatTrackLength(65_000)).toBe('1:05');
  });
});

describe('formatAddedDate', () => {
  const now = Date.parse('2026-11-19T12:00:00Z');

  it('uses relative days for the last week', () => {
    expect(formatAddedDate('2026-11-19T08:00:00Z', now)).toBe('Today');
    expect(formatAddedDate('2026-11-18T08:00:00Z', now)).toBe('Yesterday');
    expect(formatAddedDate('2026-11-16T12:00:00Z', now)).toBe('3 days ago');
  });

  it('uses a short date for older or future dates', () => {
    expect(formatAddedDate('2025-01-23T12:00:00Z', now)).toBe('Jan 23, 2025');
    expect(formatAddedDate('2027-01-01T12:00:00Z', now)).toBe('Jan 1, 2027');
  });

  it('uses the current time by default and handles invalid dates', () => {
    expect(formatAddedDate(new Date().toISOString())).toBe('Today');
    expect(formatAddedDate('not a date', now)).toBe('—');
  });
});

describe('number formatting', () => {
  it('formats percentages, decibels and compact numbers', () => {
    expect(formatPercent(0.456)).toBe('46%');
    expect(formatDecibels(-5.94)).toBe('-5.9 dB');
    expect(formatCompactNumber(968_208)).toBe('968.2K');
  });

  it('formats musical keys and rejects unknown pitch classes', () => {
    expect(formatMusicalKey(1, 1)).toBe('C# Maj');
    expect(formatMusicalKey(9, 0)).toBe('A min');
    expect(formatMusicalKey(-1, 1)).toBe('—');
  });

  it('pluralizes words', () => {
    expect(pluralize(1, 'track')).toBe('1 track');
    expect(pluralize(2, 'track')).toBe('2 tracks');
    expect(pluralize(2, 'child', 'children')).toBe('2 children');
  });
});
