import { PREVIEW_CSP_SOURCES } from '@/lib/config/media-hosts';

const isProduction = process.env.NODE_ENV === 'production';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // Next.js needs inline scripts for hydration (and eval in development for fast refresh).
  isProduction ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.scdn.co https://*.spotifycdn.com",
  "connect-src 'self'",
  `media-src ${PREVIEW_CSP_SOURCES.join(' ')}`,
  "font-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.spotify.com",
  ...(isProduction ? ['upgrade-insecure-requests'] : []),
].join('; ');

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  ...(isProduction ? { 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains' } : {}),
};

export function withSecurityHeaders<T extends Response>(response: T): T {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
  return response;
}
