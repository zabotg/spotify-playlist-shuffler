import { getRelatedArtistTopTracks } from '@/lib/clients/deezer/client';
import { getRecommendations } from '@/lib/clients/reccobeats/client';
import type { SpotifyClient } from '@/lib/clients/spotify/client';
import { rankArtistsByTrackCount } from '@/lib/domain/engines/artists';
import {
  hasArtistNamed,
  keepTracksByArtists,
  pickRepresentativeTracks,
  rankBridgeCandidates,
  rankCandidates,
  selectNewCandidates,
} from '@/lib/domain/engines/discovery';
import { buildSoundProfile } from '@/lib/domain/engines/similarity';
import type { EnrichedTrack, Track } from '@/lib/domain/models/playlist';
import { interleave, isDefined, uniqueBy } from '@/lib/utils/array';
import type { RandomSource } from '@/lib/utils/random';
import { getAudioFeatures } from './track-data-service';

const SEED_ARTIST_LIMIT = 5;
const RELATED_ARTIST_LIMIT = 5;
const TRACKS_PER_RELATED_ARTIST = 2;
const MAX_TRACKS_PER_ARTIST = 2;
const SEED_TRACK_COUNT = 5;
const SIMILAR_PER_SEED = 10;
const BRIDGE_SUGGESTIONS = 3;
const BRIDGE_PER_SEED = 10;
/** The bridge only has the two tracks' artists to start from, so it looks a bit wider. */
const BRIDGE_RELATED_ARTIST_LIMIT = 8;
/** Candidates scored before keeping the best few. */
const BRIDGE_CANDIDATE_LIMIT = 30;

/** Full Spotify tracks for IDs, skipping any that fail to load. */
async function loadTracks(client: SpotifyClient, trackIds: readonly string[]): Promise<Track[]> {
  const tracks = await Promise.all(trackIds.map((id) => client.getTrack(id).catch(() => null)));
  return tracks.filter(isDefined);
}

/** Suggestions with their audio data, so they can be compared and previewed like playlist tracks. */
async function withAudioData(tracks: readonly Track[]): Promise<EnrichedTrack[]> {
  const featuresById = await getAudioFeatures(tracks.map((track) => track.id));
  return tracks.map((track) => {
    const features = featuresById.get(track.id) ?? null;
    return { track, addedAt: null, addedBy: null, features, bpm: features?.tempo ?? null, popularity: null };
  });
}

/** Tracks that sound like each seed (ReccoBeats), one request per seed so styles don't blend. */
async function similarTracks(client: SpotifyClient, seeds: readonly Track[]): Promise<Track[]> {
  const idLists = await Promise.all(seeds.map((seed) => getRecommendations([seed.id], SIMILAR_PER_SEED)));
  return loadTracks(client, [...new Set(idLists.flatMap((ids) => ids ?? []))]);
}

interface RelatedArtists {
  /** Their top tracks, matched on Spotify. */
  tracks: Track[];
  /** Every related artist found, matched or not. */
  artistNames: string[];
}

/** Artists related to the main artists of these tracks (Deezer) and their top tracks. */
async function findRelatedArtists(
  client: SpotifyClient,
  tracks: readonly Track[],
  relatedArtistLimit = RELATED_ARTIST_LIMIT,
): Promise<RelatedArtists> {
  const seedArtists = rankArtistsByTrackCount(tracks, SEED_ARTIST_LIMIT);
  const references = await Promise.all(
    seedArtists.map((artist) =>
      getRelatedArtistTopTracks(artist.name, { relatedArtistLimit, tracksPerArtist: TRACKS_PER_RELATED_ARTIST }),
    ),
  );
  const uniqueReferences = uniqueBy(references.flat(), (ref) => `${ref.title}|${ref.artistName}`.toLowerCase());
  const matches = await Promise.all(
    uniqueReferences.map(async (ref) => {
      // Spotify search returns its best guess even when the song isn't there, often by someone else.
      // One failed search (e.g. rate limited) only loses that song, not the whole suggestion list.
      const match = await client.searchTrack(ref.title, ref.artistName).catch(() => null);
      return match && hasArtistNamed(match, ref.artistName) ? match : null;
    }),
  );
  return { tracks: matches.filter(isDefined), artistNames: uniqueReferences.map((ref) => ref.artistName) };
}

/** Artists whose songs fit the playlist's genre: the ones in it and the ones related to them. */
function genreArtistNames(playlistTracks: readonly Track[], related: RelatedArtists): string[] {
  return [...playlistTracks.flatMap((track) => track.artists.map((artist) => artist.name)), ...related.artistNames];
}

/**
 * New songs for a playlist. Candidates come from artists related to its main artists (Deezer)
 * and from tracks that sound like its most typical songs (ReccoBeats), keeping only the latter
 * by artists in the playlist's genre. They are then ranked by how close they are to the
 * playlist's sound, and tracks it already has are left out.
 */
export async function recommendTracks(
  client: SpotifyClient,
  playlistId: string,
  count: number,
  random: RandomSource = Math.random,
): Promise<EnrichedTrack[]> {
  const { items } = await client.getPlaylistTracks(playlistId);
  const tracks = items.map((item) => item.track);
  const existingTrackIds = new Set(tracks.map((track) => track.id));

  const playlistFeatures = await getAudioFeatures(tracks.map((track) => track.id));
  const profile = buildSoundProfile([...playlistFeatures.values()]);
  const seeds = pickRepresentativeTracks(tracks, playlistFeatures, profile, SEED_TRACK_COUNT, random);

  const [related, similar] = await Promise.all([findRelatedArtists(client, tracks), similarTracks(client, seeds)]);
  const pool = uniqueBy(
    [
      ...related.tracks.map((track) => ({ track, fromRelatedArtist: true })),
      ...keepTracksByArtists(similar, genreArtistNames(tracks, related)).map((track) => ({
        track,
        fromRelatedArtist: false,
      })),
    ],
    (candidate) => candidate.track.id,
  ).filter((candidate) => !existingTrackIds.has(candidate.track.id));

  const candidateFeatures = await getAudioFeatures(pool.map((candidate) => candidate.track.id));
  const ranked = rankCandidates(
    pool.map((candidate) => ({ ...candidate, features: candidateFeatures.get(candidate.track.id) ?? null })),
    profile,
    random,
  );
  const selected = selectNewCandidates(
    ranked.map((candidate) => candidate.track),
    { existingTrackIds, maxPerArtist: MAX_TRACKS_PER_ARTIST, limit: count },
  );
  return withAudioData(selected);
}

/**
 * About 3 songs to place between two tracks to smooth a rough transition. Candidates come from
 * artists related to both tracks' artists (Deezer), then from ReccoBeats (seeded with both
 * tracks and with each one, since it may not know one of them) when they are by an artist in
 * the playlist's genre. They are ranked by how well they lead from the first track into the second.
 */
export async function suggestBridgeTracks(
  client: SpotifyClient,
  playlistId: string,
  fromTrackId: string,
  toTrackId: string,
): Promise<EnrichedTrack[]> {
  const { items } = await client.getPlaylistTracks(playlistId);
  const playlistTracks = items.map((item) => item.track);
  const ends = [fromTrackId, toTrackId].map((id) => playlistTracks.find((track) => track.id === id)).filter(isDefined);

  const [idLists, related] = await Promise.all([
    Promise.all(
      [[fromTrackId, toTrackId], [fromTrackId], [toTrackId]].map((seeds) => getRecommendations(seeds, BRIDGE_PER_SEED)),
    ),
    findRelatedArtists(client, ends, BRIDGE_RELATED_ARTIST_LIMIT),
  ]);
  const similar = await loadTracks(client, [...new Set(idLists.flatMap((ids) => ids ?? []))]);
  const similarInGenre = keepTracksByArtists(similar, genreArtistNames(playlistTracks, related));

  const existingTrackIds = new Set(playlistTracks.map((track) => track.id));
  // Both sources get a fair share of the candidate limit before ranking picks the best.
  const candidates = selectNewCandidates(interleave(related.tracks, similarInGenre), {
    existingTrackIds,
    maxPerArtist: 1,
    limit: BRIDGE_CANDIDATE_LIMIT,
  });
  const [withData, endsWithData] = await Promise.all([withAudioData(candidates), withAudioData(ends)]);
  const [from, to] = endsWithData;
  const ranked = from && to ? rankBridgeCandidates(from, to, withData) : withData;
  return ranked.slice(0, BRIDGE_SUGGESTIONS);
}
