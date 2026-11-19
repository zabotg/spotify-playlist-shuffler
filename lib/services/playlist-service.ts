import { findDeezerPreview, getRelatedArtistTopTracks, getTrackDetailsByIsrc, peekTrackDetails } from '@/lib/deezer/client';
import {
  canEditPlaylist,
  toPlaylistLink,
  type EnrichedPlaylistTracks,
  type EnrichedTrack,
  type PlaylistItem,
  type PlaylistLink,
  type PlaylistSummary,
  type Track,
  type TrackDetails,
} from '@/lib/domain/playlist';
import { rankArtistsByTrackCount } from '@/lib/engines/artists';
import { selectNewCandidates } from '@/lib/engines/discovery';
import { HttpError } from '@/lib/http/errors';
import { findItunesPreview } from '@/lib/itunes/client';
import { getAudioFeatures } from '@/lib/reccobeats/client';
import type { SpotifyClient } from '@/lib/spotify/client';
import { isDefined, uniqueBy } from '@/lib/utils/array';
import { TtlCache } from '@/lib/utils/ttl-cache';

const NEW_PLAYLIST_DESCRIPTION = 'Created with Spotify Playlist Shuffler';
const DISCOVERY_SEED_ARTIST_LIMIT = 3;
const DISCOVERY_RELATED_ARTIST_LIMIT = 5;
const DISCOVERY_TRACKS_PER_ARTIST = 2;
const DISCOVERY_MAX_TRACKS_PER_ARTIST = 2;
const USER_NAME_CACHE_TTL_MS = 60 * 60 * 1000;
const USER_NAME_CACHE_MAX_ENTRIES = 5_000;
const PREVIEW_CACHE_TTL_MS = 10 * 60 * 1000;
const PREVIEW_CACHE_MAX_ENTRIES = 5_000;

const userNames = new TtlCache<string, string | null>(USER_NAME_CACHE_TTL_MS, USER_NAME_CACHE_MAX_ENTRIES);
const previewUrls = new TtlCache<string, string | null>(PREVIEW_CACHE_TTL_MS, PREVIEW_CACHE_MAX_ENTRIES);

export interface CurrentUser {
  id: string;
  displayName?: string;
}

export interface PreviewLookup {
  trackId: string;
  isrc: string | null;
  title: string;
  artistName: string;
}

export async function getEditablePlaylists(client: SpotifyClient, userId: string): Promise<PlaylistSummary[]> {
  const playlists = await client.getAllPlaylists();
  return playlists.filter((playlist) => canEditPlaylist(playlist, userId));
}

/** Display names for the people who added tracks. Failures fall back to no name. */
async function resolveUserNames(
  client: SpotifyClient,
  items: readonly PlaylistItem[],
  currentUser: CurrentUser,
): Promise<Map<string, string>> {
  if (currentUser.displayName) userNames.set(currentUser.id, currentUser.displayName);
  const userIds = [...new Set(items.map((item) => item.addedById).filter(isDefined))];

  await Promise.all(
    userIds
      .filter((id) => !userNames.has(id))
      .map(async (id) => {
        try {
          userNames.set(id, (await client.getUser(id)).displayName);
        } catch {
          userNames.set(id, null);
        }
      }),
  );

  const names = new Map<string, string>();
  for (const id of userIds) names.set(id, userNames.get(id) ?? id);
  return names;
}

/**
 * Playlist tracks in their original order, with who added them and their audio features.
 * Deezer details are only included when they are already cached: the browser loads the rest
 * in the background with {@link getTrackDetails}, so the page doesn't wait for Deezer's quota.
 */
export async function loadEnrichedTracks(
  client: SpotifyClient,
  playlistId: string,
  currentUser: CurrentUser,
): Promise<EnrichedPlaylistTracks> {
  const { items, skippedItemCount } = await client.getPlaylistTracks(playlistId);
  const [featuresById, userNamesById] = await Promise.all([
    getAudioFeatures(items.map((item) => item.track.id)),
    resolveUserNames(client, items, currentUser),
  ]);

  const tracks = items.map(({ track, addedAt, addedById }): EnrichedTrack => {
    const features = featuresById.get(track.id) ?? null;
    const details = track.isrc ? peekTrackDetails(track.isrc) : undefined;
    return {
      track,
      addedAt,
      addedBy: addedById ? (userNamesById.get(addedById) ?? null) : null,
      features,
      bpm: features?.tempo ?? details?.bpm ?? null,
      popularity: details?.popularity ?? null,
    };
  });
  return { tracks, skippedItemCount };
}

export async function getTrackDetails(isrcs: readonly string[]): Promise<Record<string, TrackDetails>> {
  return Object.fromEntries(await getTrackDetailsByIsrc(isrcs));
}

/** 30 second preview: Deezer first, then the iTunes Search API. */
export async function findPreviewUrl({ trackId, isrc, title, artistName }: PreviewLookup): Promise<string | null> {
  const cached = previewUrls.get(trackId);
  if (cached !== undefined) return cached;

  const url = (await findDeezerPreview(isrc, title, artistName)) ?? (await findItunesPreview(title, artistName));
  previewUrls.set(trackId, url);
  return url;
}

export async function recommendTracks(client: SpotifyClient, playlistId: string, count: number): Promise<Track[]> {
  const { items } = await client.getPlaylistTracks(playlistId);
  const tracks = items.map((item) => item.track);
  const seedArtists = rankArtistsByTrackCount(tracks, DISCOVERY_SEED_ARTIST_LIMIT);

  const references = await Promise.all(
    seedArtists.map((artist) =>
      getRelatedArtistTopTracks(artist.name, {
        relatedArtistLimit: DISCOVERY_RELATED_ARTIST_LIMIT,
        tracksPerArtist: DISCOVERY_TRACKS_PER_ARTIST,
      }),
    ),
  );
  const uniqueReferences = uniqueBy(references.flat(), (ref) => `${ref.title}|${ref.artistName}`.toLowerCase());
  const matches = await Promise.all(uniqueReferences.map((ref) => client.searchTrack(ref.title, ref.artistName)));

  return selectNewCandidates(matches.filter(isDefined), {
    existingTrackIds: new Set(tracks.map((track) => track.id)),
    maxPerArtist: DISCOVERY_MAX_TRACKS_PER_ARTIST,
    limit: count,
  });
}

export async function replacePlaylistOrder(
  client: SpotifyClient,
  playlistId: string,
  uris: readonly string[],
): Promise<PlaylistLink> {
  const { skippedItemCount } = await client.getPlaylistTracks(playlistId);
  if (skippedItemCount > 0) {
    throw new HttpError(
      409,
      'CONFLICT',
      `This playlist has ${skippedItemCount} local files, episodes or unavailable items that would be lost. Save as a new playlist instead.`,
    );
  }
  await client.replacePlaylistTracks(playlistId, uris);
  return toPlaylistLink(playlistId);
}

export async function addTracks(
  client: SpotifyClient,
  playlistId: string,
  uris: readonly string[],
): Promise<PlaylistLink> {
  await client.addTracksToPlaylist(playlistId, uris);
  return toPlaylistLink(playlistId);
}

export async function createPlaylistWithTracks(
  client: SpotifyClient,
  name: string,
  uris: readonly string[],
): Promise<PlaylistLink> {
  const playlist = await client.createPlaylist(name, NEW_PLAYLIST_DESCRIPTION);
  await client.addTracksToPlaylist(playlist.id, uris);
  return toPlaylistLink(playlist.id);
}
