import { NextResponse } from 'next/server';
import { parseJsonBody, withSpotify } from '@/lib/http/route-handler';
import { analyzeTracks } from '@/lib/services/track-data-service';
import { trackAnalysisRequestSchema } from '@/lib/validation/schemas';

export const POST = withSpotify(async ({ request }) => {
  const { tracks } = await parseJsonBody(request, trackAnalysisRequestSchema);
  const queries = tracks.map(({ trackId, isrc, title, artist }) => ({ trackId, isrc, title, artistName: artist }));
  return NextResponse.json({ features: await analyzeTracks(queries) });
});
