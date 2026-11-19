import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { parseSearchParams, withErrorHandling } from '@/lib/http/route-handler';
import { findPreviewUrl } from '@/lib/services/playlist-service';
import { previewQuerySchema } from '@/lib/validation/schemas';

export const GET = withErrorHandling(async (request) => {
  await requireSession();
  const { trackId, isrc, title, artist } = parseSearchParams(request, previewQuerySchema);
  const url = await findPreviewUrl({ trackId, isrc: isrc ?? null, title, artistName: artist });
  return NextResponse.json({ url });
});
