import { primaryArtistId, type AudioFeatures, type EnrichedTrack, type Track } from '@/lib/domain/models/playlist';
import { uniqueBy } from '@/lib/utils/array';
import { shuffleArray, type RandomSource } from '@/lib/utils/random';
import { scoreTransition } from './flow';
import { profileDistance, type SoundProfile } from './similarity';

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
