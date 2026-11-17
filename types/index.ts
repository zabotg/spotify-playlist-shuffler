// ── Spotify API response types ────────────────────────────────────────────

export interface SpotifyUser {
  id: string;
  email: string;
  display_name: string;
  country: string;
  images: Array<{ url: string; width: number; height: number }>;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  popularity: number;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ id: string; name: string }>;
  album: {
    id: string;
    name: string;
    release_date: string;
    images: Array<{ url: string }>;
  };
  duration_ms: number;
  popularity: number;
  explicit: boolean;
  preview_url: string | null;
  is_local: boolean;
  is_playable?: boolean;
  uri: string;
  external_ids?: { isrc?: string };
}

export interface AudioFeatures {
  id: string;
  tempo: number;
  energy: number;
  danceability: number;
  valence: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  speechiness: number;
  key: number;
  mode: number;
  time_signature: number;
  loudness: number;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  images: Array<{ url: string }>;
  owner: { id: string; display_name: string };
  public: boolean;
  collaborative: boolean;
  tracks: { total: number };
  snapshot_id: string;
  uri: string;
}

// ── Insights ──────────────────────────────────────────────────────────────

export type AudioFeatureKey =
  | 'energy'
  | 'danceability'
  | 'valence'
  | 'acousticness'
  | 'instrumentalness'
  | 'liveness'
  | 'speechiness';

export interface PlaylistInsights {
  totalTracks: number;
  validTracks: number;
  localTracks: number;
  unavailableTracks: number;
  totalDurationMs: number;
  explicitRatio: number;

  uniqueArtists: number;
  topArtists: Array<{ id: string; name: string; trackCount: number; percentage: number }>;
  artistDiversityScore: number;

  releaseYearDistribution: Record<string, number>;
  decadeDistribution: Record<string, number>;
  averageReleaseYear: number;

  averagePopularity: number;
  popularityDistribution: { underground: number; mid: number; mainstream: number };

  avgTempo: number;
  avgEnergy: number;
  avgDanceability: number;
  avgValence: number;
  avgAcousticness: number;
  avgInstrumentalness: number;
  avgLiveness: number;
  avgSpeechiness: number;

  moodLabel: MoodLabel;
  moodQuadrant: MoodQuadrant;
  genreEstimate: string[];

  featureHistograms: Record<AudioFeatureKey, number[]>;
}

export type MoodQuadrant = 'Joyful' | 'Intense' | 'Melancholic' | 'Calm';
export type MoodLabel =
  | 'Euphoric' | 'Energetic' | 'Happy' | 'Aggressive'
  | 'Tense' | 'Dark' | 'Sad' | 'Melancholic'
  | 'Peaceful' | 'Dreamy' | 'Chill' | 'Balanced';

// ── Shuffle ───────────────────────────────────────────────────────────────

export type ShuffleMode =
  | 'pure_random'
  | 'balanced'
  | 'artist_aware'
  | 'bpm_smooth'
  | 'energy_curve'
  | 'mood_based'
  | 'popularity_based'
  | 'discovery';

export type EnergyProfile = 'ascending' | 'descending' | 'mountain' | 'valley' | 'wave';
export type PopularityMode = 'mainstream' | 'underground' | 'hybrid';

export interface ShuffleOptions {
  mode: ShuffleMode;
  energyProfile?: EnergyProfile;
  popularityMode?: PopularityMode;
  moodSequence?: MoodQuadrant[];
  artistMinGap?: number;
  insertRatio?: number;
}

// ── API responses ─────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  message?: string;
  retryAfter?: number;
}
