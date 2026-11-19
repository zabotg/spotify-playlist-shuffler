import { fetchJsonOrNull } from '@/lib/clients/http/fetch-json';

/**
 * Public iTunes Search API (no key needed), used as a fallback source of 30 second previews.
 * It only allows about 20 requests per minute, so it is called on demand, one track at a time.
 * https://performance-partners.apple.com/search-api
 */
const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';
const SEARCH_RESULT_LIMIT = 5;

interface RawItunesSong {
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
}

/** Lowercase, no accents, no "(feat. ...)" / "- Remastered" suffixes, letters and digits only. */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)|\[.*?\]|\s-\s.*$/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function looselyEqual(a: string, b: string): boolean {
  return Boolean(a && b) && (a.includes(b) || b.includes(a));
}

function matches(song: RawItunesSong, title: string, artistName: string): boolean {
  return (
    looselyEqual(normalizeForMatch(song.trackName ?? ''), normalizeForMatch(title)) &&
    looselyEqual(normalizeForMatch(song.artistName ?? ''), normalizeForMatch(artistName))
  );
}

export async function findPreview(title: string, artistName: string): Promise<string | null> {
  const query = new URLSearchParams({
    term: `${artistName} ${title}`,
    media: 'music',
    entity: 'song',
    limit: String(SEARCH_RESULT_LIMIT),
  });
  const body = await fetchJsonOrNull<{ results?: RawItunesSong[] }>(`${ITUNES_SEARCH_URL}?${query}`, {
    maxRetries: 0,
  });
  const song = body?.results?.find((result) => result.previewUrl && matches(result, title, artistName));
  return song?.previewUrl ?? null;
}
