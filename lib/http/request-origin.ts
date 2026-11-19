/**
 * Origin the browser actually used for this request.
 *
 * Next.js normalizes `request.url` / `request.nextUrl` from 127.0.0.1 to localhost, so building
 * redirects from them can bounce the user to a different host, where the session cookie
 * (bound to the original host) is not sent.
 */
export function getRequestOrigin(request: Request): string {
  const firstValue = (name: string) => request.headers.get(name)?.split(',')[0]?.trim();
  const host = firstValue('x-forwarded-host') ?? firstValue('host');
  if (!host) return new URL(request.url).origin;

  const protocol = firstValue('x-forwarded-proto') ?? new URL(request.url).protocol.replace(/:$/, '');
  return `${protocol}://${host}`;
}

export function redirectUrl(path: string, request: Request): URL {
  return new URL(path, getRequestOrigin(request));
}
