import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { redirectUrl } from '@/lib/http/request-origin';
import { withErrorHandling } from '@/lib/http/route-handler';

const SEE_OTHER = 303;

export const POST = withErrorHandling(async (request) => {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(redirectUrl('/', request), SEE_OTHER);
});
