import { getRelatedArtistTopTracks, getTrackAudioByIsrc } from '@/lib/deezer/client';
import type { PlaylistInsights } from '@/lib/domain/insights';
import {
  canEditPlaylist,
  toPlaylistLink,
  type EnrichedTrack,
  type PlaylistLink,
  type PlaylistSummary,
  type Track,
} from '@/lib/domain/playlist';
import type { ShuffleOptions } from '@/lib/domain/shuffle';
import { rankArtistsByTrackCount } from '@/lib/engines/artists';
import { selectNewCandidates } from '@/lib/engines/discovery';
import { computeInsights } from '@/lib/engines/insights';
import { applyShuffle } from '@/lib/engines/shuffle';
import { HttpError } from '@/lib/http/errors';
import type { SpotifyClient } from '@/lib/spotify/client';
import { isDefined, uniqueBy } from '@/lib/utils/array';

const NEW_PLAYLIST_DESCRIPTION = 'Created with Spotify Playlist Shuffler';
const GENRE_SAMPLE_ARTIST_LIMIT = 10;
const DISCOVERY_SEED_ARTIST_LIMIT = 3;
const DISCOVERY_RELATED_ARTIST_LIMIT = 5;
const DISCOVERY_TRACKS_PER_ARTIST = 2;
const DISCOVERY_MAX_TRACKS_PER_ARTIST = 2;

export interface EnrichedPlaylistTracks {
  tracks: EnrichedTrack[];
  skippedItemCount: number;
}

export async function getEditablePlaylists(client: SpotifyClient, userId: string): Promise<PlaylistSummary[]> {
  const playlists = await client.getAllPlaylists();
  return playlists.filter((playlist) => canEditPlaylist(playlist, userId));
}

export async function loadEnrichedTracks(client: SpotifyClient, playlistId: string): Promise<EnrichedPlaylistTracks> {
  const { tracks, skippedItemCount } = await client.getPlaylistTracks(playlistId);
  const [featuresById, deezerAudioByIsrc] = await Promise.all([
    client.getAudioFeatures(tracks.map((track) => track.id)),
    getTrackAudioByIsrc(tracks.map((track) => track.isrc).filter(isDefined)),
  ]);

  const enriched = tracks.map((track): EnrichedTrack => {
    const features = featuresById.get(track.id) ?? null;
    const deezerAudio = track.isrc ? deezerAudioByIsrc.get(track.isrc) : undefined;
    return {
      track,
      features,
      bpm: features?.tempo ?? deezerAudio?.bpm ?? null,
      previewUrl: deezerAudio?.previewUrl ?? null,
    };
  });
  return { tracks: enriched, skippedItemCount };
}

export async function shufflePlaylist(
  client: SpotifyClient,
  playlistId: string,
  options: ShuffleOptions,
): Promise<EnrichedTrack[]> {
  const { tracks } = await loadEnrichedTracks(client, playlistId);
  if (tracks.length === 0) {
    throw new HttpError(422, 'EMPTY_PLAYLIST', 'This playlist has no tracks that can be reordered.');
  }
  return applyShuffle(tracks, options);
}

export async function getPlaylistInsights(
  client: SpotifyClient,
  playlistId: string,
): Promise<PlaylistInsights | null> {
  const { tracks, skippedItemCount } = await loadEnrichedTracks(client, playlistId);
  if (tracks.length === 0) return null;

  const sampleArtists = rankArtistsByTrackCount(
    tracks.map((item) => item.track),
    GENRE_SAMPLE_ARTIST_LIMIT,
  );
  const artistGenres = await client.getArtistGenres(sampleArtists.map((artist) => artist.id));
  return computeInsights(tracks, skippedItemCount, artistGenres);
}

export async function recommendTracks(client: SpotifyClient, playlistId: string, count: number): Promise<Track[]> {
  const { tracks } = await client.getPlaylistTracks(playlistId);
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
