import type { ChipOption } from '@/components/ui/chip';
import type { AudioFeatureKey } from '@/lib/domain/insights';
import {
  ENERGY_PROFILES,
  MOOD_QUADRANTS,
  type EnergyProfile,
  type MoodQuadrant,
  type ShuffleMode,
} from '@/lib/domain/shuffle';

export const SHUFFLE_MODE_DETAILS: Record<ShuffleMode, { label: string; description: string }> = {
  pure_random: { label: 'Pure random', description: 'Completely random order.' },
  balanced: { label: 'Balanced', description: 'Spreads artists evenly across the playlist.' },
  artist_aware: { label: 'Artist spacing', description: 'Keeps a minimum gap between the same artist.' },
  bpm_smooth: { label: 'Smooth BPM', description: 'Gradual tempo changes that peak in the middle.' },
  energy_curve: { label: 'Energy curve', description: 'Shapes how energy rises and falls.' },
  mood_based: { label: 'Mood sequence', description: 'Plays moods in the order you choose.' },
};

const ENERGY_PROFILE_LABELS: Record<EnergyProfile, string> = {
  ascending: 'Rising',
  descending: 'Falling',
  mountain: 'Peak',
  valley: 'Valley',
  wave: 'Wave',
};

export const ENERGY_PROFILE_OPTIONS: ChipOption<EnergyProfile>[] = ENERGY_PROFILES.map((value) => ({
  value,
  label: ENERGY_PROFILE_LABELS[value],
}));

export const MOOD_LABELS: Record<MoodQuadrant, string> = {
  Joyful: 'Joyful',
  Intense: 'Intense',
  Melancholic: 'Melancholic',
  Calm: 'Calm',
};

export const MOOD_OPTIONS = MOOD_QUADRANTS.map((value) => ({ value, label: MOOD_LABELS[value] }));

export const AUDIO_FEATURE_DISPLAY: Record<AudioFeatureKey, { label: string; color: string }> = {
  energy: { label: 'Energy', color: '#1db954' },
  danceability: { label: 'Danceability', color: '#1ed760' },
  valence: { label: 'Positivity', color: '#ffd700' },
  acousticness: { label: 'Acoustic', color: '#7c9db3' },
  instrumentalness: { label: 'Instrumental', color: '#9b59b6' },
  liveness: { label: 'Live', color: '#e74c3c' },
  speechiness: { label: 'Spoken word', color: '#f39c12' },
};
