import { toErrorResponse } from './route-handler';

/**
 * A long write answered as newline-delimited JSON, so the browser can show progress:
 * `progress` events while it runs, then one `done` (with the result) or `error`.
 */
export type ProgressEvent<Result> =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; result: Result }
  | { type: 'error'; message: string };

export const PROGRESS_STREAM_CONTENT_TYPE = 'application/x-ndjson';

/**
 * Runs `work` and streams its progress. Errors before this point (validation, conflicts) should
 * be thrown earlier so they stay normal HTTP errors; errors from here on arrive as an `error`
 * event, because the 200 status is already sent.
 *
 * If the browser goes away, the work still finishes: stopping halfway would leave the playlist
 * half reordered.
 */
export function progressStream<Result>(
  total: number,
  work: (onProgress: (done: number) => void) => Promise<Result>,
): Response {
  const encoder = new TextEncoder();
  let isOpen = true;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ProgressEvent<Result>) => {
        if (isOpen) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      send({ type: 'progress', done: 0, total });
      try {
        send({ type: 'done', result: await work((done) => send({ type: 'progress', done, total })) });
      } catch (error) {
        const { message } = (await toErrorResponse(error).json()) as { message: string };
        send({ type: 'error', message });
      }
      if (isOpen) controller.close();
    },
    cancel() {
      isOpen = false;
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': `${PROGRESS_STREAM_CONTENT_TYPE}; charset=utf-8`, 'Cache-Control': 'no-store' },
  });
}
