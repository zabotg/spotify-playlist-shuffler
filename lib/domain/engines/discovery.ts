import { primaryArtistId, type AudioFeatures, type EnrichedTrack, type Track } from '@/lib/domain/models/playlist';
import { uniqueBy } from '@/lib/utils/array';
import { shuffleArray, type RandomSource } from '@/lib/utils/random';
import { scoreTransition } from './flow';
import { profileDistance, type SoundProfile } from './similarity';

/** Artist names compared loosely: case, accents and punctuation ignored, letters of any script kept. */
function artistKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/** Whether one of the track's artists has this name. Used to reject wrong search matches. */
export function hasArtistNamed(track: Track, artistName: string): boolean {
  const wanted = artistKey(artistName);
  return track.artists.some((artist) => artistKey(artist.name) === wanted);
}

/**
 * Keeps tracks by at least one of the given artists. ReccoBeats suggests songs by sound alone
 * (a reggaeton song can have the same tempo and energy as a metal one), so its suggestions only
 * get through when they come from an artist already in the playlist or related to one on Deezer.
 */
export function keepTracksByArtists(tracks: readonly Track[], artistNames: readonly string[]): Track[] {
  const allowed = new Set(artistNames.map(artistKey));
  return tracks.filter((track) => track.artists.some((artist) => allowed.has(artistKey(artist.name))));
}

export interface CandidateSelection {
  existingTrackIds: ReadonlySet<string>;
  maxPerArtist: number;
  limit: number;
}

export function selectNewCandidates(
  candidates: readonly Track[],
  { existingTrackIds, maxPerArtist, limit }: CandidateSelection,
): Track[] {
  const countsByArtist = new Map<string, number>();
  const selected: Track[] = [];

  for (const track of uniqueBy(candidates, (candidate) => candidate.id)) {
    if (selected.length >= limit) break;
    if (existingTrackIds.has(track.id)) continue;

    const artistId = primaryArtistId(track);
    const artistCount = countsByArtist.get(artistId) ?? 0;
    if (artistCount >= maxPerArtist) continue;

    countsByArtist.set(artistId, artistCount + 1);
    selected.push(track);
  }
  return selected;
}

export interface Candidate {
  track: Track;
  features: AudioFeatures | null;
  /** Found through an artist related to the playlist's artists (a strong genre signal). */
  fromRelatedArtist: boolean;
}

/** Candidates further than this from the playlist's sound are dropped. */
const MAX_PROFILE_DISTANCE = 1.6;
/** Related-artist candidates count as this much closer, since they usually share the genre. */
const RELATED_ARTIST_BONUS = 0.5;
/** Distance assumed for related-artist candidates without audio data. */
const UNKNOWN_DISTANCE = 1;
/** Random spread so a refresh can surface different, equally good songs. */
const RANKING_NOISE = 0.15;

/**
 * Orders candidates by how well they fit the playlist's sound, best first. Candidates without
 * audio data are only kept when they come from a related artist.
 */
export function rankCandidates(
  candidates: readonly Candidate[],
  profile: SoundProfile | null,
  random: RandomSource = Math.random,
): Candidate[] {
  return candidates
    .flatMap((candidate) => {
      if (candidate.features && profile) {
        const distance = profileDistance(candidate.features, profile);
        if (distance > MAX_PROFILE_DISTANCE) return [];
        return [{ candidate, score: distance - (candidate.fromRelatedArtist ? RELATED_ARTIST_BONUS : 0) }];
      }
      return candidate.fromRelatedArtist || !profile ? [{ candidate, score: UNKNOWN_DISTANCE }] : [];
    })
    .map((entry) => ({ ...entry, score: entry.score + random() * RANKING_NOISE }))
    .sort((a, b) => a.score - b.score)
    .map(({ candidate }) => candidate);
}

/**
 * Seeds for "sounds like this playlist": a random few among the tracks closest to its average
 * sound, so they share a style instead of mixing very different songs.
 */
export function pickRepresentativeTracks(
  tracks: readonly Track[],
  featuresById: ReadonlyMap<string, AudioFeatures>,
  profile: SoundProfile | null,
  count: number,
  random: RandomSource = Math.random,
): Track[] {
  if (!profile) return shuffleArray(tracks, random).slice(0, count);
  const closest = tracks
    .flatMap((track) => {
      const features = featuresById.get(track.id);
      return features ? [{ track, distance: profileDistance(features, profile) }] : [];
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count * 2)
    .map(({ track }) => track);
  return shuffleArray(closest, random).slice(0, count);
}

/** Score used for candidates without audio data: kept, but after the ones that clearly fit. */
const UNKNOWN_BRIDGE_SCORE = 0.4;

/**
 * Orders songs by how well they fit between two tracks: the average of the transition into
 * the song and the transition out of it (tempo, key and energy). Best first.
 */
export function rankBridgeCandidates(
  from: EnrichedTrack,
  to: EnrichedTrack,
  candidates: readonly EnrichedTrack[],
): EnrichedTrack[] {
  return candidates
    .map((candidate) => {
      const scores = [scoreTransition(from, candidate).score, scoreTransition(candidate, to).score].filter(
        (score) => score !== null,
      );
      const score = scores.length > 0 ? scores.reduce((total, value) => total + value, 0) / scores.length : UNKNOWN_BRIDGE_SCORE;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ candidate }) => candidate);
}
