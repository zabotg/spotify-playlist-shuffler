import type { SpotifyClient } from '@/lib/clients/spotify/client';
import { TtlCache } from '@/lib/utils/ttl-cache';

const NAME_TTL_MS = 60 * 60 * 1000;
const MAX_CACHED_NAMES = 5_000;

/** `null` means Spotify didn't return the profile; the ID is shown instead. */
const displayNames = new TtlCache<string, string | null>(NAME_TTL_MS, MAX_CACHED_NAMES);

export interface KnownUser {
  id: string;
  displayName?: string;
}

/** Display names for Spotify user IDs. The signed-in user is known already and costs no request. */
export async function resolveDisplayNames(
  client: SpotifyClient,
  userIds: readonly string[],
  currentUser: KnownUser,
): Promise<Map<string, string>> {
  if (currentUser.displayName) displayNames.set(currentUser.id, currentUser.displayName);
  const uniqueIds = [...new Set(userIds)];

  const names = await Promise.all(
    uniqueIds.map((id) =>
      displayNames.getOrLoad(id, async () => {
        try {
          return (await client.getUser(id)).displayName;
        } catch {
          return null;
        }
      }),
    ),
  );
  return new Map(uniqueIds.map((id, index) => [id, names[index] ?? id]));
}
