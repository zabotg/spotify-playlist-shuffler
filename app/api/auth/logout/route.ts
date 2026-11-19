import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { withErrorHandling } from '@/lib/http/route-handler';

const SEE_OTHER = 303;

export const POST = withErrorHandling(async (request) => {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(new URL('/', request.url), SEE_OTHER);
});
