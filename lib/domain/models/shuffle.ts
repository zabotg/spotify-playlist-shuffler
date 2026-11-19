export const SHUFFLE_MODES = [
  'pure_random',
  'balanced',
  'artist_aware',
  'bpm_smooth',
  'energy_curve',
  'mood_based',
] as const;
export type ShuffleMode = (typeof SHUFFLE_MODES)[number];

export const ENERGY_PROFILES = ['ascending', 'descending', 'mountain', 'valley', 'wave'] as const;
export type EnergyProfile = (typeof ENERGY_PROFILES)[number];

export const MOOD_QUADRANTS = ['Joyful', 'Intense', 'Melancholic', 'Calm'] as const;
export type MoodQuadrant = (typeof MOOD_QUADRANTS)[number];

export const MODES_REQUIRING_AUDIO_FEATURES: ReadonlySet<ShuffleMode> = new Set([
  'energy_curve',
  'mood_based',
]);

export const ARTIST_GAP_LIMITS = { min: 1, max: 10, default: 3 } as const;
export const DEFAULT_ENERGY_PROFILE: EnergyProfile = 'mountain';
export const DEFAULT_MOOD_SEQUENCE: MoodQuadrant[] = ['Calm', 'Joyful', 'Intense', 'Melancholic'];

export interface ShuffleOptions {
  mode: ShuffleMode;
  energyProfile?: EnergyProfile;
  moodSequence?: MoodQuadrant[];
  artistMinGap?: number;
}
