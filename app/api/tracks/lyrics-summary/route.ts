import { NextResponse } from 'next/server';
import { parseJsonBody, withSpotify } from '@/lib/http/route-handler';
import { summarizeLyrics } from '@/lib/services/metadata-service';
import { lyricsSummaryRequestSchema } from '@/lib/validation/schemas';

export const POST = withSpotify(async ({ request }) => {
  const { tracks } = await parseJsonBody(request, lyricsSummaryRequestSchema);
  const queries = tracks.map(({ trackId, title, artist, album, durationMs }) => ({
    trackId,
    title,
    artistName: artist,
    albumName: album,
    durationMs,
  }));
  return NextResponse.json({ summaries: await summarizeLyrics(queries) });
});
