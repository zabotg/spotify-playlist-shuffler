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

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)|\[.*?\]|-.*$/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function matches(song: RawItunesSong, title: string, artistName: string): boolean {
  const songTitle = normalize(song.trackName ?? '');
  const songArtist = normalize(song.artistName ?? '');
  const wantedTitle = normalize(title);
  const wantedArtist = normalize(artistName);
  const titleMatches = songTitle.includes(wantedTitle) || wantedTitle.includes(songTitle);
  const artistMatches = songArtist.includes(wantedArtist) || wantedArtist.includes(songArtist);
  return Boolean(songTitle && songArtist) && titleMatches && artistMatches;
}

export async function findItunesPreview(title: string, artistName: string): Promise<string | null> {
  const query = new URLSearchParams({
    term: `${artistName} ${title}`,
    media: 'music',
    entity: 'song',
    limit: String(SEARCH_RESULT_LIMIT),
  });
  try {
    const response = await fetch(`${ITUNES_SEARCH_URL}?${query}`, { cache: 'no-store' });
    if (!response.ok) return null;
    const { results = [] } = (await response.json()) as { results?: RawItunesSong[] };
    return results.find((song) => song.previewUrl && matches(song, title, artistName))?.previewUrl ?? null;
  } catch {
    return null;
  }
}
