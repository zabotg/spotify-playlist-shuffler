import { NextResponse } from 'next/server';
import { parseSearchParams, withPlaylist } from '@/lib/http/route-handler';
import { suggestBridgeTracks } from '@/lib/services/discovery-service';
import { bridgeQuerySchema } from '@/lib/validation/schemas';

export const GET = withPlaylist(async ({ request, client, playlistId }) => {
  const { from, to } = parseSearchParams(request, bridgeQuerySchema);
  return NextResponse.json({ tracks: await suggestBridgeTracks(client, playlistId, from, to) });
});
