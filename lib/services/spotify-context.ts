import { requireSession, type AuthenticatedSession } from '@/lib/auth/session';
import { SpotifyClient } from '@/lib/spotify/client';

export interface SpotifyContext {
  session: AuthenticatedSession;
  client: SpotifyClient;
}

export async function getSpotifyContext(): Promise<SpotifyContext> {
  const session = await requireSession();
  return { session, client: await SpotifyClient.forSession(session) };
}
