import type { MoodLabel } from '@/lib/domain/models/insights';
import type { MoodQuadrant } from '@/lib/domain/models/shuffle';

const NEUTRAL = 0.5;

export function classifyMoodQuadrant(valence: number, energy: number): MoodQuadrant {
  const isPositive = valence >= NEUTRAL;
  const isEnergetic = energy >= NEUTRAL;
  if (isPositive) return isEnergetic ? 'Joyful' : 'Calm';
  return isEnergetic ? 'Intense' : 'Melancholic';
}

export function deriveMoodLabel(
  valence: number,
  energy: number,
  danceability: number,
  acousticness: number,
): MoodLabel {
  const isAcoustic = acousticness > NEUTRAL;
  if (valence > 0.7 && energy > 0.7 && danceability > 0.7) return 'Euphoric';
  if (valence > 0.6 && energy > 0.6) return 'Energetic';
  if (valence > 0.6 && energy < 0.5) return isAcoustic ? 'Dreamy' : 'Happy';
  if (valence < 0.4 && energy > 0.7) return 'Aggressive';
  if (valence < 0.4 && energy > 0.5) return 'Tense';
  if (valence < 0.3 && energy < 0.4) return 'Melancholic';
  if (valence < 0.4 && energy < 0.4) return 'Sad';
  if (valence > 0.5 && energy < 0.4) return isAcoustic ? 'Peaceful' : 'Chill';
  if (valence < 0.5 && energy < 0.3) return 'Dark';
  return 'Balanced';
}
