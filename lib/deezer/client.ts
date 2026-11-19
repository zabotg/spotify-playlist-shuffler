import pLimit from 'p-limit';
import { uniqueBy } from '@/lib/utils/array';

const DEEZER_API_URL = 'https://api.deezer.com';
const CACHE_TTL_SECONDS = 86_400;
const MAX_CONCURRENT_REQUESTS = 8;

const limit = pLimit(MAX_CONCURRENT_REQUESTS);

interface DeezerList<T> {
  data: T[];
}

interface RawDeezerTrack {
  title: string;
  bpm?: number;
  preview?: string;
  artist: { name: string };
}

export interface DeezerTrackAudio {
  bpm: number | null;
  previewUrl: string | null;
}

export interface TrackReference {
  title: string;
  artistName: string;
}

export interface RelatedTracksOptions {
  relatedArtistLimit: number;
  tracksPerArtist: number;
}

function deezerGet<T>(path: string): Promise<T | null> {
  return limit(async () => {
    try {
      const response = await fetch(`${DEEZER_API_URL}${path}`, { next: { revalidate: CACHE_TTL_SECONDS } });
      if (!response.ok) return null;
      const data = (await response.json()) as T & { error?: unknown };
      return data.error ? null : data;
    } catch {
      return null;
    }
  });
}

export async function getTrackAudioByIsrc(isrcs: readonly string[]): Promise<Map<string, DeezerTrackAudio>> {
  const uniqueIsrcs = uniqueBy(isrcs, (isrc) => isrc);
  const tracks = await Promise.all(
    uniqueIsrcs.map((isrc) => deezerGet<RawDeezerTrack>(`/track/isrc:${encodeURIComponent(isrc)}`)),
  );

  const audioByIsrc = new Map<string, DeezerTrackAudio>();
  uniqueIsrcs.forEach((isrc, index) => {
    const track = tracks[index];
    if (!track) return;
    audioByIsrc.set(isrc, {
      bpm: track.bpm && track.bpm > 0 ? track.bpm : null,
      previewUrl: track.preview || null,
    });
  });
  return audioByIsrc;
}

export async function getRelatedArtistTopTracks(
  artistName: string,
  { relatedArtistLimit, tracksPerArtist }: RelatedTracksOptions,
): Promise<TrackReference[]> {
  const search = await deezerGet<DeezerList<{ id: number }>>(
    `/search/artist?q=${encodeURIComponent(artistName)}&limit=1`,
  );
  const artistId = search?.data[0]?.id;
  if (!artistId) return [];

  const related = await deezerGet<DeezerList<{ id: number }>>(
    `/artist/${artistId}/related?limit=${relatedArtistLimit}`,
  );
  const topTracks = await Promise.all(
    (related?.data ?? []).map((artist) =>
      deezerGet<DeezerList<RawDeezerTrack>>(`/artist/${artist.id}/top?limit=${tracksPerArtist}`),
    ),
  );

  return topTracks
    .flatMap((list) => list?.data ?? [])
    .map((track) => ({ title: track.title, artistName: track.artist.name }));
}
