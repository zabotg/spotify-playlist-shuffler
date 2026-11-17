/**
 * Discovery engine — builds recommendation seeds and filters results.
 */

import type { PlaylistInsights, SpotifyTrack } from '@/types';
import type { TrackWithFeatures } from '@/lib/engines/shuffle';

export interface RecommendationSeeds {
  seed_tracks: string[];
  seed_artists: string[];
  seed_genres: string[];
}

export interface TargetFeatures {
  target_energy?: number;
  target_danceability?: number;
  target_valence?: number;
  target_tempo?: number;
  target_acousticness?: number;
  min_popularity: number;
}

/**
 * Builds up to 5 seeds (Spotify limit) from playlist insights.
 * Prioritises diversity: 2 artists + 2 tracks + 1 genre.
 */
export function buildSeeds(
  insights: PlaylistInsights,
  tracks: TrackWithFeatures[]
): RecommendationSeeds {
  const seedArtists = insights.topArtists.slice(0, 2).map(a => a.id);

  // Pick 2 tracks closest to the playlist's average audio features
  const representative = findRepresentativeTracks(tracks, 2);

  // Limit to remaining seed slots (max 5 total)
  const remaining = 5 - seedArtists.length - representative.length;
  const seedGenres = insights.genreEstimate.slice(0, Math.max(0, remaining));

  return {
    seed_artists: seedArtists,
    seed_tracks: representative,
    seed_genres: seedGenres,
  };
}

export function buildTargetFeatures(insights: PlaylistInsights): TargetFeatures {
  return {
    target_energy: round(insights.avgEnergy),
    target_danceability: round(insights.avgDanceability),
    target_valence: round(insights.avgValence),
    target_tempo: Math.round(insights.avgTempo),
    target_acousticness: round(insights.avgAcousticness),
    min_popularity: 10,
  };
}

/**
 * Removes tracks already in the playlist and limits same-artist duplicates.
 */
export function filterRecommendations(
  recommendations: SpotifyTrack[],
  existingTrackIds: Set<string>,
  market?: string | null
): SpotifyTrack[] {
  const artistCount = new Map<string, number>();

  return recommendations.filter(track => {
    // Already in playlist
    if (existingTrackIds.has(track.id)) return false;

    // Not available in user's market
    if (market && track.is_playable === false) return false;

    // Max 2 recommendations per artist
    const artistId = track.artists[0]?.id ?? '';
    const count = artistCount.get(artistId) ?? 0;
    if (count >= 2) return false;

    artistCount.set(artistId, count + 1);
    return true;
  });
}

function findRepresentativeTracks(tracks: TrackWithFeatures[], n: number): string[] {
  const withFeatures = tracks.filter(t => t.features != null);
  if (withFeatures.length === 0) return tracks.slice(0, n).map(t => t.track.id);

  const avgEnergy = avg(withFeatures.map(t => t.features!.energy));
  const avgValence = avg(withFeatures.map(t => t.features!.valence));

  return [...withFeatures]
    .sort((a, b) => {
      const dA = euclidean(a.features!.energy, a.features!.valence, avgEnergy, avgValence);
      const dB = euclidean(b.features!.energy, b.features!.valence, avgEnergy, avgValence);
      return dA - dB;
    })
    .slice(0, n)
    .map(t => t.track.id);
}

function euclidean(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
