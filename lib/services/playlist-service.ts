import type { SpotifyClient } from '@/lib/clients/spotify/client';
import { planReorder } from '@/lib/domain/engines/reorder';
import {
  canEditPlaylist,
  toPlaylistLink,
  type EnrichedPlaylistTracks,
  type EnrichedTrack,
  type PlaylistLink,
  type PlaylistSummary,
} from '@/lib/domain/models/playlist';
import { HttpError } from '@/lib/http/errors';
import { isDefined } from '@/lib/utils/array';
import { getAudioFeatures, peekTrackDetails } from './track-data-service';
import { resolveDisplayNames, type KnownUser } from './user-service';

const NEW_PLAYLIST_DESCRIPTION = 'Created with Spotify Playlist Shuffler';

export async function getEditablePlaylists(client: SpotifyClient, userId: string): Promise<PlaylistSummary[]> {
  const playlists = await client.getAllPlaylists();
  return playlists.filter((playlist) => canEditPlaylist(playlist, userId));
}

/**
 * Playlist tracks in their original order, with who added them and their audio features.
 * Deezer details are only included when already cached: the browser loads the rest in the
 * background, so the page never waits for Deezer's rate limit.
 */
export async function loadEnrichedTracks(
  client: SpotifyClient,
  playlistId: string,
  currentUser: KnownUser,
): Promise<EnrichedPlaylistTracks> {
  const { items, skippedItemCount } = await client.getPlaylistTracks(playlistId);
  const [featuresById, namesById] = await Promise.all([
    getAudioFeatures(items.map((item) => item.track.id)),
    resolveDisplayNames(client, items.map((item) => item.addedById).filter(isDefined), currentUser),
  ]);

  const tracks = items.map(({ track, addedAt, addedById }): EnrichedTrack => {
    const features = featuresById.get(track.id) ?? null;
    const details = track.isrc ? peekTrackDetails(track.isrc) : undefined;
    return {
      track,
      addedAt,
      addedBy: addedById ? (namesById.get(addedById) ?? null) : null,
      features,
      bpm: features?.tempo ?? details?.bpm ?? null,
      popularity: details?.popularity ?? null,
    };
  });
  return { tracks, skippedItemCount };
}

/**
 * Saves a new track order by moving tracks, never by removing and re-adding them, so each
 * track keeps its "date added". Playlists with local files or episodes are refused because
 * the app can't see where those items sit.
 */
export async function replacePlaylistOrder(
  client: SpotifyClient,
  playlistId: string,
  uris: readonly string[],
): Promise<PlaylistLink> {
  const { items, skippedItemCount } = await client.getPlaylistTracks(playlistId);
  if (skippedItemCount > 0) {
    throw new HttpError(
      409,
      'CONFLICT',
      `This playlist has ${skippedItemCount} local files, episodes or unavailable items that would be lost. Save as a new playlist instead.`,
    );
  }

  const moves = planReorder(
    items.map((item) => item.track.uri),
    uris,
  );
  if (!moves) {
    throw new HttpError(409, 'CONFLICT', 'The playlist changed since it was loaded. Reload the page and try again.');
  }

  // Moves depend on the previous ones, so they run in order, each on the latest snapshot.
  let snapshotId: string | undefined;
  for (const move of moves) snapshotId = await client.moveItems(playlistId, move, snapshotId);
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
