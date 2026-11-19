import { describe, expect, it, vi } from 'vitest';
import { fakeSession } from '@/test/fakes';

const { refreshAccessToken } = vi.hoisted(() => ({ refreshAccessToken: vi.fn() }));
vi.mock('@/lib/clients/spotify/oauth', () => ({ refreshAccessToken }));

import { ensureFreshAccessToken } from './token-refresh';

describe('ensureFreshAccessToken', () => {
  it('returns the current token while it is valid', async () => {
    const session = fakeSession();
    expect(await ensureFreshAccessToken(session)).toBe('access-token');
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(session.save).not.toHaveBeenCalled();
  });

  it('refreshes an expired token and saves the session', async () => {
    refreshAccessToken.mockResolvedValue({ access_token: 'fresh', refresh_token: 'rotated', expires_in: 3600 });
    const session = fakeSession({ accessTokenExpiresAt: 0 });
    expect(await ensureFreshAccessToken(session)).toBe('fresh');
    expect(session.refreshToken).toBe('rotated');
    expect(session.save).toHaveBeenCalled();
  });

  it('shares one refresh between concurrent requests with the same refresh token', async () => {
    let resolve!: (value: unknown) => void;
    refreshAccessToken.mockReturnValue(new Promise((r) => (resolve = r)));
    const first = fakeSession({ accessTokenExpiresAt: 0, refreshToken: 'shared' });
    const second = fakeSession({ accessTokenExpiresAt: 0, refreshToken: 'shared' });

    const pending = Promise.all([ensureFreshAccessToken(first), ensureFreshAccessToken(second)]);
    resolve({ access_token: 'once', expires_in: 3600 });

    expect(await pending).toEqual(['once', 'once']);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('lets a later refresh run again after the previous one failed', async () => {
    refreshAccessToken.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({
      access_token: 'retry',
      expires_in: 3600,
    });
    await expect(ensureFreshAccessToken(fakeSession({ accessTokenExpiresAt: 0, refreshToken: 'r' }))).rejects.toThrow(
      'down',
    );
    expect(await ensureFreshAccessToken(fakeSession({ accessTokenExpiresAt: 0, refreshToken: 'r' }))).toBe('retry');
  });
});
