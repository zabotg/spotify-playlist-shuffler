import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockFetch } from '@/test/fakes';

vi.mock('@/lib/utils/async', () => ({ sleep: vi.fn().mockResolvedValue(undefined) }));

import { sleep } from '@/lib/utils/async';
import { fetchJson, fetchJsonOrNull, UpstreamError } from '@/lib/clients/http/fetch-json';

describe('fetchJson', () => {
  it('parses JSON and sends safe defaults', async () => {
    const fetchMock = mockFetch(jsonResponse({ ok: true }));
    expect(await fetchJson('https://api.test/x')).toEqual({ ok: true });

    const [, init] = fetchMock.mock.calls[0];
    expect(init).toMatchObject({ method: 'GET', cache: 'no-store', redirect: 'error' });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('serializes JSON bodies with the right content type', async () => {
    const fetchMock = mockFetch(jsonResponse({}));
    await fetchJson('https://api.test/x', { method: 'POST', json: { a: 1 }, headers: { Authorization: 'x' } });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      body: '{"a":1}',
      headers: { Authorization: 'x', 'Content-Type': 'application/json' },
    });
  });

  it('returns undefined for empty responses', async () => {
    mockFetch(new Response('', { status: 201 }));
    expect(await fetchJson('https://api.test/x', { body: 'raw' })).toBeUndefined();
  });

  it('throws an UpstreamError with the status, or a custom error', async () => {
    mockFetch(new Response('nope', { status: 404 }), new Response('bad', { status: 400 }));
    await expect(fetchJson('https://api.test/x')).rejects.toMatchObject({ status: 404, responseBody: 'nope' });
    await expect(
      fetchJson('https://api.test/x', { toError: (status) => new RangeError(`custom ${status}`) }),
    ).rejects.toThrow('custom 400');
    expect(new UpstreamError(500, '').name).toBe('UpstreamError');
  });

  it('retries server errors with backoff, then gives up', async () => {
    const fetchMock = mockFetch(
      new Response('', { status: 503 }),
      new Response('', { status: 502 }),
      new Response('down', { status: 500 }),
    );
    await expect(fetchJson('https://api.test/x', { maxRetries: 2 })).rejects.toMatchObject({ status: 500 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(vi.mocked(sleep).mock.calls.map(([ms]) => ms)).toEqual([400, 800]);
  });

  it('honors a short Retry-After on 429', async () => {
    mockFetch(new Response('', { status: 429, headers: { 'Retry-After': '2' } }), jsonResponse({ ok: 1 }));
    expect(await fetchJson('https://api.test/x')).toEqual({ ok: 1 });
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('uses backoff when a 429 has no usable Retry-After', async () => {
    mockFetch(new Response('', { status: 429 }), jsonResponse({ ok: 1 }));
    expect(await fetchJson('https://api.test/x')).toEqual({ ok: 1 });
    expect(sleep).toHaveBeenCalledWith(400);
  });

  it('fails fast instead of waiting for a long Retry-After', async () => {
    const fetchMock = mockFetch(new Response('slow down', { status: 429, headers: { 'Retry-After': '3600' } }));
    await expect(fetchJson('https://api.test/x')).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries network errors and timeouts, but not other errors', async () => {
    mockFetch(new TypeError('fetch failed'), new DOMException('timed out', 'TimeoutError'), jsonResponse({ ok: 1 }));
    expect(await fetchJson('https://api.test/x')).toEqual({ ok: 1 });

    mockFetch(new TypeError('fetch failed'));
    await expect(fetchJson('https://api.test/x', { maxRetries: 0 })).rejects.toThrow('fetch failed');

    mockFetch(new Error('unexpected'));
    await expect(fetchJson('https://api.test/x')).rejects.toThrow('unexpected');
  });
});

describe('fetchJsonOrNull', () => {
  it('returns null instead of throwing', async () => {
    mockFetch(jsonResponse({ a: 1 }), new Response('', { status: 404 }));
    expect(await fetchJsonOrNull('https://api.test/x')).toEqual({ a: 1 });
    expect(await fetchJsonOrNull('https://api.test/x')).toBeNull();
  });
});
