'use client';

import { useEffect, useState } from 'react';
import { chunk } from '@/lib/utils/array';

export interface BatchProgress {
  loaded: number;
  total: number;
  isLoading: boolean;
}

const IDLE: BatchProgress = { loaded: 0, total: 0, isLoading: false };

/**
 * Loads data for many items in the background, a batch at a time, and merges each batch's
 * results as it arrives. Failed batches are skipped: this is used for optional extra data.
 * `load` must be a stable function (e.g. defined at module level).
 */
export function useBatchedLoader<Item, Value>(
  items: readonly Item[],
  batchSize: number,
  load: (batch: Item[]) => Promise<Record<string, Value>>,
  enabled = true,
) {
  const [results, setResults] = useState<Record<string, Value>>({});
  const [progress, setProgress] = useState<BatchProgress>(IDLE);

  useEffect(() => {
    if (!enabled || items.length === 0) return;
    let cancelled = false;

    async function loadAll() {
      setProgress({ loaded: 0, total: items.length, isLoading: true });
      let loaded = 0;
      for (const batch of chunk(items, batchSize)) {
        if (cancelled) return;
        try {
          const batchResults = await load(batch);
          if (cancelled) return;
          setResults((current) => ({ ...current, ...batchResults }));
        } catch {
          // Optional data: keep going with the next batch.
        }
        loaded += batch.length;
        setProgress({ loaded, total: items.length, isLoading: loaded < items.length });
      }
    }

    void loadAll();
    return () => {
      cancelled = true;
    };
  }, [items, batchSize, load, enabled]);

  return { results, progress };
}
