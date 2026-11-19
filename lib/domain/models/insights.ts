import type { MoodQuadrant } from './shuffle';

export const AUDIO_FEATURE_KEYS = [
  'energy',
  'danceability',
  'valence',
  'acousticness',
  'instrumentalness',
  'liveness',
  'speechiness',
] as const;
export type AudioFeatureKey = (typeof AUDIO_FEATURE_KEYS)[number];

export type MoodLabel =
  | 'Euphoric'
  | 'Energetic'
  | 'Happy'
  | 'Dreamy'
  | 'Aggressive'
  | 'Tense'
  | 'Melancholic'
  | 'Sad'
  | 'Peaceful'
  | 'Chill'
  | 'Dark'
  | 'Balanced';

export interface ArtistShare {
  id: string;
  name: string;
  trackCount: number;
  share: number;
}

export interface PlaylistInsights {
  trackCount: number;
  skippedItemCount: number;
  totalDurationMs: number;
  explicitRatio: number;
  uniqueArtistCount: number;
  artistDiversityScore: number;
  topArtists: ArtistShare[];
  decadeDistribution: Record<string, number>;
  releaseYearDistribution: Record<string, number>;
  averageReleaseYear: number | null;
  averageBpm: number | null;
  audioFeatureAverages: Record<AudioFeatureKey, number> | null;
  mood: { quadrant: MoodQuadrant; label: MoodLabel } | null;
  topGenres: string[];
}
