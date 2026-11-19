import { NextResponse } from 'next/server';
import { parseJsonBody, withSpotify } from '@/lib/http/route-handler';
import { getTrackMetadata } from '@/lib/services/metadata-service';
import { metadataRequestSchema } from '@/lib/validation/schemas';

export const POST = withSpotify(async ({ request }) => {
  const { isrcs } = await parseJsonBody(request, metadataRequestSchema);
  return NextResponse.json({ metadata: await getTrackMetadata(isrcs) });
});
