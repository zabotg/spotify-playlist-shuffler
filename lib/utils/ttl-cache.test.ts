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
    expect(cache.get('a')).toBeUndefined();
  });

  it('can store null to remember misses', () => {
    const cache = new TtlCache<string, number | null>(1000, 10);
    cache.set('missing', null);
    expect(cache.has('missing')).toBe(true);
    expect(cache.get('missing')).toBeNull();
  });

  it('evicts the oldest entry when full and refreshes position on set', () => {
    const cache = new TtlCache<string, number>(1000, 2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 10);
    cache.set('c', 3);
    expect(cache.has('b')).toBe(false);
    expect(cache.get('a')).toBe(10);
    expect(cache.get('c')).toBe(3);
  });

  describe('getOrLoad', () => {
    it('loads once and serves later calls from the cache', async () => {
      const cache = new TtlCache<string, number>(1000, 10);
      const load = vi.fn().mockResolvedValue(42);
      expect(await cache.getOrLoad('k', load)).toBe(42);
      expect(await cache.getOrLoad('k', load)).toBe(42);
      expect(load).toHaveBeenCalledTimes(1);
    });

    it('shares one load between concurrent callers', async () => {
      const cache = new TtlCache<string, number>(1000, 10);
      const load = vi.fn().mockResolvedValue(7);
      const results = await Promise.all([cache.getOrLoad('k', load), cache.getOrLoad('k', load)]);
      expect(results).toEqual([7, 7]);
      expect(load).toHaveBeenCalledTimes(1);
    });

    it('does not cache undefined results, so failures are retried', async () => {
      const cache = new TtlCache<string, number>(1000, 10);
      const load = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(5);
      expect(await cache.getOrLoad('k', load)).toBeUndefined();
      expect(await cache.getOrLoad('k', load)).toBe(5);
      expect(load).toHaveBeenCalledTimes(2);
    });

    it('clears the in-flight entry when the load fails', async () => {
      const cache = new TtlCache<string, number>(1000, 10);
      await expect(cache.getOrLoad('k', () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
      expect(await cache.getOrLoad('k', async () => 1)).toBe(1);
    });
  });
});
