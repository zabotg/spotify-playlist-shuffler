import { vi } from 'vitest';
import type { AuthenticatedSession } from '@/lib/auth/session';

/** JSON response like fetch would return it. */
export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

/** Replaces global fetch with a mock that answers with the given responses, in order. */
export function mockFetch(...responses: (Response | Error)[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) {
    if (response instanceof Error) fetchMock.mockRejectedValueOnce(response);
    else fetchMock.mockResolvedValueOnce(response);
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function fakeSession(overrides: Partial<AuthenticatedSession> = {}): AuthenticatedSession {
  return {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    accessTokenExpiresAt: Date.now() + 3_600_000,
    userId: 'me',
    displayName: 'Me',
    save: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    updateConfig: vi.fn(),
    ...overrides,
  } as AuthenticatedSession;
}
