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

  private read(key: K): Entry<V> | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt > Date.now()) return entry;
    this.entries.delete(key);
    return undefined;
  }
}
