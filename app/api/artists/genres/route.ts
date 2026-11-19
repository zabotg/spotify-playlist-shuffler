import { NextResponse } from 'next/server';
import { parseSearchParams, withErrorHandling } from '@/lib/http/route-handler';
import { getSpotifyContext } from '@/lib/services/spotify-context';
import { artistGenresQuerySchema } from '@/lib/validation/schemas';

export const GET = withErrorHandling(async (request) => {
  const { client } = await getSpotifyContext();
  const { ids } = parseSearchParams(request, artistGenresQuerySchema);
  return NextResponse.json({ genres: await client.getArtistGenres(ids) });
});
