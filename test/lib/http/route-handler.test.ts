import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { SpotifyApiError } from '@/lib/clients/spotify/errors';
import { fakeSession } from '@/test/fakes';

const { getSpotifyContext } = vi.hoisted(() => ({ getSpotifyContext: vi.fn() }));
vi.mock('@/lib/services/spotify-context', () => ({ getSpotifyContext }));

import { HttpError } from '@/lib/http/errors';
import {
  MAX_JSON_BODY_BYTES,
  parseJsonBody,
  parseSearchParams,
  toErrorResponse,
  withErrorHandling,
  withPlaylist,
  withSpotify,
} from '@/lib/http/route-handler';

const bodyOf = (response: Response) => response.json() as Promise<{ error: string; message: string }>;
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('toErrorResponse', () => {
  it.each([
    [new HttpError(409, 'CONFLICT', 'Taken'), 409, 'CONFLICT', 'Taken'],
    [new SyntaxError('bad'), 400, 'VALIDATION_ERROR', 'Invalid JSON body.'],
    [new SpotifyApiError(401, 'secret upstream body'), 401, 'UNAUTHORIZED', 'Your Spotify session expired. Please sign in again.'],
    [new SpotifyApiError(403, ''), 403, 'FORBIDDEN', 'Spotify denied access to this resource.'],
    [new SpotifyApiError(404, ''), 404, 'NOT_FOUND', 'Resource not found on Spotify.'],
    [new SpotifyApiError(429, ''), 429, 'RATE_LIMITED', 'Spotify rate limit reached. Try again in a moment.'],
    [new SpotifyApiError(500, ''), 502, 'SPOTIFY_ERROR', 'Spotify request failed.'],
  ])('maps %o to %i %s', async (error, status, code, message) => {
    const response = toErrorResponse(error);
    expect(response.status).toBe(status);
    expect(await bodyOf(response)).toEqual({ error: code, message });
  });

  it('joins validation messages', async () => {
    const result = z.object({ a: z.string(), b: z.number() }).safeParse({});
    const response = toErrorResponse(result.error);
    expect(response.status).toBe(400);
    expect((await bodyOf(response)).message).toContain(';');
  });

  it('hides unexpected errors behind a generic 500 and logs only the message', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = toErrorResponse(new Error('db password is hunter2'));
    expect(response.status).toBe(500);
    expect(await bodyOf(response)).toEqual({ error: 'INTERNAL_ERROR', message: 'Unexpected server error.' });
    expect(log).toHaveBeenCalledWith('[api] Unexpected error', 'db password is hunter2');

    toErrorResponse('a string');
    expect(log).toHaveBeenLastCalledWith('[api] Unexpected error', 'a string');
  });
});

describe('controllers', () => {
  const request = new NextRequest('http://127.0.0.1:3000/api/x');

  it('turns thrown errors into responses', async () => {
    const handler = withErrorHandling(async () => {
      throw new HttpError(418, 'CONFLICT', 'teapot');
    });
    expect((await handler(request, {})).status).toBe(418);
  });

  it('passes the Spotify context to authenticated handlers', async () => {
    const context = { session: fakeSession(), client: {} };
    getSpotifyContext.mockResolvedValue(context);
    const handler = vi.fn(async () => new Response('ok'));
    await withSpotify(handler)(request, {});
    expect(handler).toHaveBeenCalledWith({ request, ...context });
  });

  it('answers 401 when signed out', async () => {
    getSpotifyContext.mockRejectedValue(new HttpError(401, 'UNAUTHORIZED', 'Not authenticated.'));
    expect((await withSpotify(vi.fn())(request, {})).status).toBe(401);
    expect((await withPlaylist(vi.fn())(request, params('bad-id'))).status).toBe(401);
  });

  it('validates the playlist ID after authenticating', async () => {
    getSpotifyContext.mockResolvedValue({ session: fakeSession(), client: {} });
    const handler = vi.fn(async () => new Response('ok'));

    const rejected = await withPlaylist(handler)(request, params('../me'));
    expect(rejected.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();

    await withPlaylist(handler)(request, params('abc123'));
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ playlistId: 'abc123' }));
  });
});

describe('request parsing', () => {
  const schema = z.object({ name: z.string() });
  const post = (body: string, headers: Record<string, string> = {}) =>
    new Request('http://127.0.0.1:3000/api/x', { method: 'POST', body, headers });

  it('parses and validates JSON bodies', async () => {
    expect(await parseJsonBody(post('{"name":"a"}'), schema)).toEqual({ name: 'a' });
    await expect(parseJsonBody(post('{bad'), schema)).rejects.toBeInstanceOf(SyntaxError);
    await expect(parseJsonBody(post('{"name":1}'), schema)).rejects.toBeInstanceOf(z.ZodError);
  });

  it('rejects bodies over the size limit, declared or actual', async () => {
    const declared = post('{}', { 'content-length': String(MAX_JSON_BODY_BYTES + 1) });
    await expect(parseJsonBody(declared, schema)).rejects.toMatchObject({ status: 413 });

    const actual = post(JSON.stringify({ name: 'x'.repeat(MAX_JSON_BODY_BYTES) }));
    await expect(parseJsonBody(actual, schema)).rejects.toMatchObject({ status: 413, code: 'PAYLOAD_TOO_LARGE' });
  });

  it('parses query strings', () => {
    const request = new NextRequest('http://127.0.0.1:3000/api/x?name=b');
    expect(parseSearchParams(request, schema)).toEqual({ name: 'b' });
  });
});
