interface Entry<V> {
  value: V;
  expiresAt: number;
}

/**
 * Small in-memory cache with expiry and a size cap (oldest entries are evicted first).
 * It lives in the server process, so it is shared by every request while the app runs.
 */
export class TtlCache<K, V> {
  private readonly entries = new Map<K, Entry<V>>();
  private readonly inFlight = new Map<K, Promise<V | undefined>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
  ) {}

  has(key: K): boolean {
    return this.read(key) !== undefined;
  }

  get(key: K): V | undefined {
    return this.read(key)?.value;
  }

  set(key: K, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    if (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as K;
      this.entries.delete(oldestKey);
    }
  }

  /**
   * Returns the cached value, or runs `load` once even if many callers ask at the same time.
   * When `load` resolves to `undefined` the result is not cached (e.g. a temporary failure).
   */
  async getOrLoad(key: K, load: () => Promise<V | undefined>): Promise<V | undefined> {
    const cached = this.read(key);
    if (cached) return cached.value;

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const promise = load()
      .then((value) => {
        if (value !== undefined) this.set(key, value);
        return value;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    return promise;
  }

  private read(key: K): Entry<V> | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt > Date.now()) return entry;
    this.entries.delete(key);
    return undefined;
  }
}
