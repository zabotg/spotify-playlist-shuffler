import { describe, expect, it, vi } from 'vitest';
import type { SpotifyClient } from '@/lib/clients/spotify/client';
import { resolveDisplayNames } from '@/lib/services/user-service';

describe('resolveDisplayNames', () => {
  it('uses the signed-in user name, looks others up once and falls back to the ID', async () => {
    const getUser = vi.fn(async (id: string) => {
      if (id === 'broken') throw new Error('403');
      return { id, displayName: id === 'nameless' ? null : `Name of ${id}` };
    });
    const client = { getUser } as unknown as SpotifyClient;

    const names = await resolveDisplayNames(client, ['me', 'friend', 'friend', 'broken', 'nameless'], {
      id: 'me',
      displayName: 'Me',
    });

    expect(Object.fromEntries(names)).toEqual({
      me: 'Me',
      friend: 'Name of friend',
      broken: 'broken',
      nameless: 'nameless',
    });
    expect(getUser).not.toHaveBeenCalledWith('me');
    expect(getUser).toHaveBeenCalledTimes(3);

    await resolveDisplayNames(client, ['friend'], { id: 'other' });
    expect(getUser).toHaveBeenCalledTimes(3);
  });
});
