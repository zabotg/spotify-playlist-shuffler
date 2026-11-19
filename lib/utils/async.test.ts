import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRateLimiter, sleep } from './async';

describe('sleep', () => {
  afterEach(() => vi.useRealTimers());

  it('resolves after the given time', async () => {
    vi.useFakeTimers();
    const done = vi.fn();
    void sleep(100).then(done);
    await vi.advanceTimersByTimeAsync(99);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toHaveBeenCalled();
  });
});

describe('createRateLimiter', () => {
  afterEach(() => vi.useRealTimers());

  it('lets calls through up to the limit, then waits for the window to slide', async () => {
    vi.useFakeTimers();
    const acquire = createRateLimiter(2, 1000);
    const started: number[] = [];
    const calls = [0, 1, 2].map((index) => acquire().then(() => started.push(index)));

    await vi.advanceTimersByTimeAsync(0);
    expect(started).toEqual([0, 1]);

    await vi.advanceTimersByTimeAsync(1000);
    await Promise.all(calls);
    expect(started).toEqual([0, 1, 2]);
  });

  it('frees slots once they leave the window', async () => {
    vi.useFakeTimers();
    const acquire = createRateLimiter(1, 500);
    await acquire();
    await vi.advanceTimersByTimeAsync(600);
    const next = vi.fn();
    void acquire().then(next);
    await vi.advanceTimersByTimeAsync(0);
    expect(next).toHaveBeenCalled();
  });
});
