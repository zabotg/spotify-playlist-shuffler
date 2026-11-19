import { MOOD_QUADRANTS, type MoodQuadrant } from '@/lib/domain/models/shuffle';
import type { EnrichedTrack } from '@/lib/domain/models/playlist';
import { classifyMoodQuadrant } from './mood';

export interface MoodGroup {
  mood: MoodQuadrant;
  tracks: EnrichedTrack[];
}

/** Splits the tracks that have audio data into one group per mood, keeping playlist order. */
export function splitByMood(tracks: readonly EnrichedTrack[]): MoodGroup[] {
  const groups = MOOD_QUADRANTS.map((mood): MoodGroup => ({ mood, tracks: [] }));
  for (const item of tracks) {
    if (!item.features) continue;
    const mood = classifyMoodQuadrant(item.features.valence, item.features.energy);
    groups[MOOD_QUADRANTS.indexOf(mood)].tracks.push(item);
  }
  return groups.filter((group) => group.tracks.length > 0);
}
