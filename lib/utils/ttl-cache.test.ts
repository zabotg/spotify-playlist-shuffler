import { afterEach, describe, expect, it, vi } from 'vitest';
import { TtlCache } from './ttl-cache';

describe('TtlCache', () => {
  afterEach(() => vi.useRealTimers());

  it('returns values until they expire', () => {
    vi.useFakeTimers();
    const cache = new TtlCache<string, number>(1000, 10);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    vi.advanceTimersByTime(1001);
    expect(cache.has('a')).toBe(false);
  });

  it('can store null to remember misses', () => {
    const cache = new TtlCache<string, number | null>(1000, 10);
    cache.set('missing', null);
    expect(cache.has('missing')).toBe(true);
    expect(cache.get('missing')).toBeNull();
  });

  it('evicts the oldest entry when full', () => {
    const cache = new TtlCache<string, number>(1000, 2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.has('a')).toBe(false);
    expect(cache.get('c')).toBe(3);
  });
});
