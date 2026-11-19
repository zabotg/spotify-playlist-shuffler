import { NextResponse } from 'next/server';
import { parseSearchParams, withSpotify } from '@/lib/http/route-handler';
import { artistGenresQuerySchema } from '@/lib/validation/schemas';

export const GET = withSpotify(async ({ request, client }) => {
  const { ids } = parseSearchParams(request, artistGenresQuerySchema);
  return NextResponse.json({ genres: await client.getArtistGenres(ids) });
});
