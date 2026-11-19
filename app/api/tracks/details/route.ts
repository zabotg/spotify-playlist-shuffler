import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { parseJsonBody, withErrorHandling } from '@/lib/http/route-handler';
import { getTrackDetails } from '@/lib/services/playlist-service';
import { trackDetailsRequestSchema } from '@/lib/validation/schemas';

export const POST = withErrorHandling(async (request) => {
  await requireSession();
  const { isrcs } = await parseJsonBody(request, trackDetailsRequestSchema);
  return NextResponse.json({ details: await getTrackDetails(isrcs) });
});
