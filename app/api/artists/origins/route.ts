import { NextResponse } from 'next/server';
import { parseJsonBody, withSpotify } from '@/lib/http/route-handler';
import { getArtistOrigins } from '@/lib/services/metadata-service';
import { originsRequestSchema } from '@/lib/validation/schemas';

export const POST = withSpotify(async ({ request }) => {
  const { ids } = await parseJsonBody(request, originsRequestSchema);
  return NextResponse.json({ origins: await getArtistOrigins(ids) });
});
