import { NextResponse } from 'next/server';
import { parseSearchParams, withPlaylist } from '@/lib/http/route-handler';
import { recommendTracks } from '@/lib/services/discovery-service';
import { recommendationsQuerySchema } from '@/lib/validation/schemas';

export const GET = withPlaylist(async ({ request, client, playlistId }) => {
  const { count } = parseSearchParams(request, recommendationsQuerySchema);
  return NextResponse.json({ tracks: await recommendTracks(client, playlistId, count) });
});
