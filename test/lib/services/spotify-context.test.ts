import { describe, expect, it, vi } from 'vitest';
import { fakeSession } from '@/test/fakes';

const auth = vi.hoisted(() => ({ requireSession: vi.fn(), ensureFreshAccessToken: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ requireSession: auth.requireSession }));
vi.mock('@/lib/auth/token-refresh', () => ({ ensureFreshAccessToken: auth.ensureFreshAccessToken }));

import { SpotifyClient } from '@/lib/clients/spotify/client';
import { getSpotifyContext } from '@/lib/services/spotify-context';

describe('getSpotifyContext', () => {
  it('returns the session and a client with a fresh token', async () => {
    const session = fakeSession();
    auth.requireSession.mockResolvedValue(session);
    auth.ensureFreshAccessToken.mockResolvedValue('fresh-token');

    const context = await getSpotifyContext();
    expect(context.session).toBe(session);
    expect(context.client).toBeInstanceOf(SpotifyClient);
    expect(auth.ensureFreshAccessToken).toHaveBeenCalledWith(session);
  });
});
