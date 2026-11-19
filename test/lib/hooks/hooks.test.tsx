// @vitest-environment jsdom
import '@/test/dom';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAsyncAction } from '@/lib/hooks/use-async-action';
import { useBatchedLoader } from '@/lib/hooks/use-batched-loader';

describe('useBatchedLoader', () => {
  it('loads in batches, merges results, reports progress and skips failed batches', async () => {
    const load = vi.fn(async (batch: number[]) => {
      if (batch.includes(3)) throw new Error('down');
      return Object.fromEntries(batch.map((item) => [String(item), item * 10]));
    });
    const items = [1, 2, 3, 4, 5];
    const { result } = renderHook(() => useBatchedLoader(items, 2, load));

    await waitFor(() => expect(result.current.progress).toEqual({ loaded: 5, total: 5, isLoading: false }));
    expect(result.current.results).toEqual({ 1: 10, 2: 20, 5: 50 });
    expect(load.mock.calls.map(([batch]) => batch)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('waits until enabled and does nothing without items', async () => {
    const load = vi.fn(async () => ({}));
    const items = [1];
    const { result, rerender } = renderHook(({ enabled }) => useBatchedLoader(items, 5, load, enabled), {
      initialProps: { enabled: false },
    });
    expect(load).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.progress).toEqual({ loaded: 1, total: 1, isLoading: false }));
    expect(load).toHaveBeenCalledTimes(1);

    const empty: number[] = [];
    renderHook(() => useBatchedLoader(empty, 5, load));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('stops when the component unmounts', async () => {
    let release!: () => void;
    const load = vi.fn(() => new Promise<Record<string, number>>((resolve) => (release = () => resolve({ a: 1 }))));
    const items = [1, 2];
    const { unmount } = renderHook(() => useBatchedLoader(items, 1, load));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    unmount();
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('useAsyncAction', () => {
  it('tracks loading, data and errors, and can reset', async () => {
    const action = vi.fn().mockResolvedValueOnce('ok').mockRejectedValueOnce(new Error('Nope')).mockRejectedValueOnce('weird');
    const { result } = renderHook(() => useAsyncAction(action));

    await act(() => result.current.run());
    expect(result.current).toMatchObject({ data: 'ok', error: null, isLoading: false });
    await act(() => result.current.run());
    expect(result.current).toMatchObject({ data: 'ok', error: 'Nope' });
    await act(() => result.current.run());
    expect(result.current.error).toBe('Unexpected error. Please try again.');
    act(() => result.current.reset());
    expect(result.current).toMatchObject({ data: null, error: null });
  });
});
