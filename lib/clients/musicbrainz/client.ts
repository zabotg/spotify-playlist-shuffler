import { fetchJson, UpstreamError } from '@/lib/clients/http/fetch-json';
import type { ArtistOrigin, Credit, TrackMetadata } from '@/lib/domain/models/metadata';
import { createRateLimiter } from '@/lib/utils/async';

/**
 * MusicBrainz, the open music encyclopedia (no key needed). It allows 1 request per second
 * and asks every client to identify itself with a User-Agent.
 * https://musicbrainz.org/doc/MusicBrainz_API
 */
const MUSICBRAINZ_API_URL = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'SpotifyPlaylistShuffler/0.2 (self-hosted open source app)';
const RATE_LIMIT_WINDOW_MS = 1100;
const MAX_TAGS = 10;

const acquireSlot = createRateLimiter(1, RATE_LIMIT_WINDOW_MS);

/** `failed` is temporary (network, rate limit): callers should not cache it. */
export type LookupResult<T> = { status: 'ok'; data: T } | { status: 'not_found' } | { status: 'failed' };

interface RawRecording {
  'first-release-date'?: string;
  tags?: { name: string; count: number }[];
  relations?: { type: string; artist?: { name: string } }[];
  'artist-credit'?: { artist: { id: string } }[];
}

async function musicBrainzGet<T>(path: string): Promise<LookupResult<T>> {
  await acquireSlot();
  try {
    const data = await fetchJson<T>(`${MUSICBRAINZ_API_URL}${path}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      maxRetries: 1,
    });
    return { status: 'ok', data };
  } catch (error) {
    return error instanceof UpstreamError && error.status === 404 ? { status: 'not_found' } : { status: 'failed' };
  }
}

function yearOf(date: string | undefined): number | null {
  const year = Number(date?.slice(0, 4));
  return year > 0 ? year : null;
}

/** Recording facts by ISRC. When several recordings share it, the earliest release wins. */
export async function lookupRecordingByIsrc(isrc: string): Promise<LookupResult<TrackMetadata>> {
  const result = await musicBrainzGet<{ recordings?: RawRecording[] }>(
    `/isrc/${encodeURIComponent(isrc)}?inc=artist-credits+tags+artist-rels&fmt=json`,
  );
  if (result.status !== 'ok') return result;

  const recordings = result.data.recordings ?? [];
  if (recordings.length === 0) return { status: 'not_found' };

  const years = recordings.map((recording) => yearOf(recording['first-release-date'])).filter((year) => year !== null);
  const tags = new Map<string, number>();
  const credits = new Map<string, Credit>();
  for (const recording of recordings) {
    for (const tag of recording.tags ?? []) tags.set(tag.name, (tags.get(tag.name) ?? 0) + tag.count);
    for (const relation of recording.relations ?? []) {
      if (relation.artist) credits.set(`${relation.type}:${relation.artist.name}`, { name: relation.artist.name, role: relation.type });
    }
  }

  return {
    status: 'ok',
    data: {
      originalYear: years.length > 0 ? Math.min(...years) : null,
      tags: [...tags.entries()]
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_TAGS)
        .map(([name]) => name),
      credits: [...credits.values()],
      artistId: recordings[0]['artist-credit']?.[0]?.artist.id ?? null,
    },
  };
}

/** Where an artist is from (MusicBrainz artist ID). */
export async function lookupArtistOrigin(artistId: string): Promise<LookupResult<ArtistOrigin>> {
  const result = await musicBrainzGet<{ area?: { name?: string } | null }>(
    `/artist/${encodeURIComponent(artistId)}?fmt=json`,
  );
  if (result.status !== 'ok') return result;
  return { status: 'ok', data: { country: result.data.area?.name ?? null } };
}
