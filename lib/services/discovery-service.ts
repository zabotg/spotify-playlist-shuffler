import { getRelatedArtistTopTracks } from '@/lib/clients/deezer/client';
import type { SpotifyClient } from '@/lib/clients/spotify/client';
import { rankArtistsByTrackCount } from '@/lib/domain/engines/artists';
import { selectNewCandidates } from '@/lib/domain/engines/discovery';
import type { Track } from '@/lib/domain/models/playlist';
import { isDefined, uniqueBy } from '@/lib/utils/array';

const SEED_ARTIST_LIMIT = 3;
const RELATED_ARTIST_LIMIT = 5;
const TRACKS_PER_RELATED_ARTIST = 2;
const MAX_TRACKS_PER_ARTIST = 2;

/**
 * Songs from artists related to the playlist's top artists (Deezer), matched on Spotify,
 * without tracks the playlist already has.
 */
export async function recommendTracks(client: SpotifyClient, playlistId: string, count: number): Promise<Track[]> {
  const { items } = await client.getPlaylistTracks(playlistId);
  const tracks = items.map((item) => item.track);
  const seedArtists = rankArtistsByTrackCount(tracks, SEED_ARTIST_LIMIT);

  const references = await Promise.all(
    seedArtists.map((artist) =>
      getRelatedArtistTopTracks(artist.name, {
        relatedArtistLimit: RELATED_ARTIST_LIMIT,
        tracksPerArtist: TRACKS_PER_RELATED_ARTIST,
      }),
    ),
  );
  const uniqueReferences = uniqueBy(references.flat(), (ref) => `${ref.title}|${ref.artistName}`.toLowerCase());
  const matches = await Promise.all(uniqueReferences.map((ref) => client.searchTrack(ref.title, ref.artistName)));

  return selectNewCandidates(matches.filter(isDefined), {
    existingTrackIds: new Set(tracks.map((track) => track.id)),
    maxPerArtist: MAX_TRACKS_PER_ARTIST,
    limit: count,
  });
}
