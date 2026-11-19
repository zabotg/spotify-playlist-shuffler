import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { appUrl } from '@/lib/config/app-origin';
import { withErrorHandling } from '@/lib/http/route-handler';

const SEE_OTHER = 303;

export const POST = withErrorHandling(async () => {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(appUrl('/'), SEE_OTHER);
});
