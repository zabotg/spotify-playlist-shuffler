import { requireSession, type AuthenticatedSession } from '@/lib/auth/session';
import { ensureFreshAccessToken } from '@/lib/auth/token-refresh';
import { SpotifyClient } from '@/lib/clients/spotify/client';

export interface SpotifyContext {
  session: AuthenticatedSession;
  client: SpotifyClient;
}

/** The signed-in user's session and a Spotify client with a valid token. Throws 401 if signed out. */
export async function getSpotifyContext(): Promise<SpotifyContext> {
  const session = await requireSession();
  return { session, client: new SpotifyClient(await ensureFreshAccessToken(session)) };
}
