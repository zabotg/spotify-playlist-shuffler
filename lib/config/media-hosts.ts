/**
 * Hosts allowed to serve audio previews. Used both by the Content Security Policy and to
 * validate preview URLs that come from external APIs before they reach the browser.
 */
export const PREVIEW_HOST_SUFFIXES = ['dzcdn.net', 'itunes.apple.com', 'mzstatic.com'] as const;

export const PREVIEW_CSP_SOURCES = PREVIEW_HOST_SUFFIXES.map((suffix) => `https://*.${suffix}`);

export function isAllowedPreviewUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  return PREVIEW_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(`.${suffix}`));
}
