'use client';

import { useCallback, useState } from 'react';

const FALLBACK_ERROR_MESSAGE = 'Unexpected error. Please try again.';

interface AsyncState<Result> {
  data: Result | null;
  error: string | null;
  isLoading: boolean;
}

export function useAsyncAction<Args extends unknown[], Result>(action: (...args: Args) => Promise<Result>) {
  const [state, setState] = useState<AsyncState<Result>>({ data: null, error: null, isLoading: false });

  const run = useCallback(
    async (...args: Args): Promise<Result | null> => {
      setState((previous) => ({ ...previous, error: null, isLoading: true }));
      try {
        const data = await action(...args);
        setState({ data, error: null, isLoading: false });
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : FALLBACK_ERROR_MESSAGE;
        setState((previous) => ({ ...previous, error: message, isLoading: false }));
        return null;
      }
    },
    [action],
  );

  const reset = useCallback(() => setState({ data: null, error: null, isLoading: false }), []);

  return { ...state, run, reset };
}
