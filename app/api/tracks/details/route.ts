import { NextResponse } from 'next/server';
import { parseJsonBody, withSpotify } from '@/lib/http/route-handler';
import { getTrackDetails } from '@/lib/services/track-data-service';
import { trackDetailsRequestSchema } from '@/lib/validation/schemas';

export const POST = withSpotify(async ({ request }) => {
  const { isrcs } = await parseJsonBody(request, trackDetailsRequestSchema);
  return NextResponse.json({ details: await getTrackDetails(isrcs) });
});
