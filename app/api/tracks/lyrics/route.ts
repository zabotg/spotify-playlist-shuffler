import { NextResponse } from 'next/server';
import { parseSearchParams, withSpotify } from '@/lib/http/route-handler';
import { getLyrics } from '@/lib/services/metadata-service';
import { lyricsQuerySchema } from '@/lib/validation/schemas';

export const GET = withSpotify(async ({ request }) => {
  const { title, artist, album, durationMs } = parseSearchParams(request, lyricsQuerySchema);
  return NextResponse.json({ lyrics: await getLyrics({ title, artistName: artist, albumName: album, durationMs }) });
});
