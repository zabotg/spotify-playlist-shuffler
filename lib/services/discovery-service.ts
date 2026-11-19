import { getRelatedArtistTopTracks } from '@/lib/clients/deezer/client';
import { getRecommendations } from '@/lib/clients/reccobeats/client';
import type { SpotifyClient } from '@/lib/clients/spotify/client';
import { rankArtistsByTrackCount } from '@/lib/domain/engines/artists';
import {
  pickRepresentativeTracks,
  rankBridgeCandidates,
  rankCandidates,
  selectNewCandidates,
} from '@/lib/domain/engines/discovery';
import { buildSoundProfile } from '@/lib/domain/engines/similarity';
import type { EnrichedTrack, Track } from '@/lib/domain/models/playlist';
import { isDefined, uniqueBy } from '@/lib/utils/array';
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

/** Top tracks of artists related to the playlist's main artists (Deezer), matched on Spotify. */
async function relatedArtistTracks(client: SpotifyClient, tracks: readonly Track[]): Promise<Track[]> {
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
  return matches.filter(isDefined);
}

/**
 * New songs for a playlist. Candidates come from artists related to its main artists (Deezer)
 * and from tracks that sound like its most typical songs (ReccoBeats). They are then ranked by
 * how close they are to the playlist's sound, and tracks it already has are left out.
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

  const [related, similar] = await Promise.all([relatedArtistTracks(client, tracks), similarTracks(client, seeds)]);
  const pool = uniqueBy(
    [
      ...related.map((track) => ({ track, fromRelatedArtist: true })),
      ...similar.map((track) => ({ track, fromRelatedArtist: false })),
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
 * ReccoBeats (seeded with both tracks and with each one, since it may not know one of them)
 * and from artists related to both tracks' artists, so there are options even when ReccoBeats
 * knows neither. They are ranked by how well they lead from the first track into the second.
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
    relatedArtistTracks(client, ends),
  ]);
  const similar = await loadTracks(client, [...new Set(idLists.flatMap((ids) => ids ?? []))]);

  const existingTrackIds = new Set(playlistTracks.map((track) => track.id));
  const candidates = selectNewCandidates([...similar, ...related], {
    existingTrackIds,
    maxPerArtist: 1,
    limit: BRIDGE_CANDIDATE_LIMIT,
  });
  const [withData, endsWithData] = await Promise.all([withAudioData(candidates), withAudioData(ends)]);
  const [from, to] = endsWithData;
  const ranked = from && to ? rankBridgeCandidates(from, to, withData) : withData;
  return ranked.slice(0, BRIDGE_SUGGESTIONS);
}
