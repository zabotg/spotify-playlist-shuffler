import { describe, expect, it } from 'vitest';
import { SpotifyApiError } from '@/lib/clients/spotify/errors';
import { progressStream } from '@/lib/http/progress-stream';

const eventsOf = async (response: Response) =>
  (await response.text())
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));

describe('progressStream', () => {
  it('streams progress, then the result, as one JSON object per line', async () => {
    const response = progressStream(2, async (onProgress) => {
      onProgress(1);
      onProgress(2);
      return { ok: true };
    });

    expect(response.headers.get('content-type')).toBe('application/x-ndjson; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await eventsOf(response)).toEqual([
      { type: 'progress', done: 0, total: 2 },
      { type: 'progress', done: 1, total: 2 },
      { type: 'progress', done: 2, total: 2 },
      { type: 'done', result: { ok: true } },
    ]);
  });

  it('ends with a safe error message when the work fails halfway', async () => {
    const response = progressStream(3, async (onProgress) => {
      onProgress(1);
      throw new SpotifyApiError(429, 'upstream body that must not leak');
    });

    expect(await eventsOf(response)).toEqual([
      { type: 'progress', done: 0, total: 3 },
      { type: 'progress', done: 1, total: 3 },
      { type: 'error', message: 'Spotify rate limit reached. Try again in a moment.' },
    ]);
  });

  it('keeps working after the browser goes away, so the playlist is not left half saved', async () => {
    let finish: () => void = () => {};
    let finished = false;
    const response = progressStream(1, async (onProgress) => {
      await new Promise<void>((resolve) => (finish = resolve));
      onProgress(1);
      finished = true;
      return 'saved';
    });

    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    await reader.read();
    await reader.cancel();
    finish();

    await expect.poll(() => finished).toBe(true);
  });
});
