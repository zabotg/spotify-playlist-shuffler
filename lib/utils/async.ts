export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Sliding window rate limiter: `acquire()` resolves once a new call fits in the window.
 * Used for APIs with a hard quota, like Deezer (50 requests every 5 seconds).
 */
export function createRateLimiter(maxCalls: number, windowMs: number) {
  const startedAt: number[] = [];
  let queue: Promise<void> = Promise.resolve();

  async function waitForSlot(): Promise<void> {
    for (;;) {
      const now = Date.now();
      while (startedAt.length > 0 && now - startedAt[0] >= windowMs) startedAt.shift();
      if (startedAt.length < maxCalls) {
        startedAt.push(now);
        return;
      }
      await sleep(windowMs - (now - startedAt[0]));
    }
  }

  return function acquire(): Promise<void> {
    const slot = queue.then(waitForSlot);
    queue = slot;
    return slot;
  };
}
