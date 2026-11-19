import type { PlaylistSummary, PlaylistTracks, SpotifyUser, Track } from '@/lib/domain/playlist';
import type {
  RawImage,
  RawPlaylist,
  RawPlaylistEntry,
  RawPlaylistItem,
  RawTrack,
  RawUser,
} from '@/lib/spotify/types';

const HTML_TAG_PATTERN = /<[^>]+>/g;

function firstImageUrl(images: RawImage[] | null | undefined): string | null {
  return images?.[0]?.url ?? null;
}

function stripHtml(text: string | null): string | null {
  const plain = text?.replace(HTML_TAG_PATTERN, '').trim();
  return plain ? plain : null;
}

export function toTrack(raw: RawTrack): Track {
  return {
    id: raw.id,
    uri: raw.uri,
    name: raw.name,
    artists: raw.artists.map(({ id, name }) => ({ id, name })),
    albumName: raw.album.name,
    releaseDate: raw.album.release_date ?? null,
    imageUrl: firstImageUrl(raw.album.images),
    durationMs: raw.duration_ms,
    explicit: raw.explicit,
    isrc: raw.external_ids?.isrc ?? null,
  };
}

export function toPlaylistSummary(raw: RawPlaylist): PlaylistSummary {
  return {
    id: raw.id,
    name: raw.name,
    description: stripHtml(raw.description),
    imageUrl: firstImageUrl(raw.images),
    ownerId: raw.owner.id,
    ownerName: raw.owner.display_name ?? null,
    collaborative: raw.collaborative,
    trackCount: (raw.items ?? raw.tracks)?.total ?? 0,
  };
}

export function toUser(raw: RawUser): SpotifyUser {
  return { id: raw.id, displayName: raw.display_name };
}

function isReorderableTrack(item: RawPlaylistItem | undefined): item is RawTrack {
  return item?.type === 'track' && !item.is_local && Boolean(item.id);
}

export function toPlaylistTracks(entries: readonly RawPlaylistEntry[]): PlaylistTracks {
  const tracks = entries
    .map((entry) => entry.item ?? entry.track)
    .filter(isReorderableTrack)
    .map(toTrack);
  return { tracks, skippedItemCount: entries.length - tracks.length };
}
