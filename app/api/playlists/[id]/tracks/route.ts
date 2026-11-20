import { NextResponse } from 'next/server';
import { parseJsonBody, withPlaylist } from '@/lib/http/route-handler';
import { progressStream } from '@/lib/http/progress-stream';
import { addTracks, loadEnrichedTracks, planPlaylistOverwrite, removeTracksAt } from '@/lib/services/playlist-service';
import {
  overwriteTracksRequestSchema,
  removeTracksRequestSchema,
  trackUrisRequestSchema,
} from '@/lib/validation/schemas';

export const GET = withPlaylist(async ({ client, session, playlistId }) => {
  const currentUser = { id: session.userId, displayName: session.displayName };
  return NextResponse.json(await loadEnrichedTracks(client, playlistId, currentUser));
});

/** Overwrites the track order. Answers with a progress stream, since moving can take minutes. */
export const PUT = withPlaylist(async ({ request, client, playlistId }) => {
  const { uris, method } = await parseJsonBody(request, overwriteTracksRequestSchema);
  const overwrite = await planPlaylistOverwrite(client, playlistId, uris, method);
  return progressStream(overwrite.total, overwrite.run);
});

export const POST = withPlaylist(async ({ request, client, playlistId }) => {
  const { uris, position } = await parseJsonBody(request, trackUrisRequestSchema);
  return NextResponse.json(await addTracks(client, playlistId, uris, position));
});

export const DELETE = withPlaylist(async ({ request, client, playlistId }) => {
  const { positions } = await parseJsonBody(request, removeTracksRequestSchema);
  return NextResponse.json(await removeTracksAt(client, playlistId, positions));
});
