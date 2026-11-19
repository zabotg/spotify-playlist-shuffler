import { NextResponse } from 'next/server';
import { parseSearchParams, withSpotify } from '@/lib/http/route-handler';
import { findPreviewUrl } from '@/lib/services/track-data-service';
import { previewQuerySchema } from '@/lib/validation/schemas';

export const GET = withSpotify(async ({ request }) => {
  const { isrc, title, artist } = parseSearchParams(request, previewQuerySchema);
  return NextResponse.json({ url: await findPreviewUrl({ isrc: isrc ?? null, title, artistName: artist }) });
});
