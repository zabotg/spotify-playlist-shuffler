import { describe, expect, it } from 'vitest';
import { AUDIO_FEATURE_KEYS } from '@/lib/domain/models/insights';
import { ENERGY_PROFILES, MOOD_QUADRANTS, SHUFFLE_MODES } from '@/lib/domain/models/shuffle';
import {
  AUDIO_FEATURE_DISPLAY,
  ENERGY_PROFILE_OPTIONS,
  MOOD_LABELS,
  MOOD_OPTIONS,
  SHUFFLE_MODE_DETAILS,
} from '@/app/playlists/[id]/_components/labels';

describe('labels', () => {
  it('has a label for every shuffle mode, energy profile, mood and audio feature', () => {
    for (const mode of SHUFFLE_MODES) expect(SHUFFLE_MODE_DETAILS[mode].label).toBeTruthy();
    expect(ENERGY_PROFILE_OPTIONS.map((option) => option.value)).toEqual([...ENERGY_PROFILES]);
    expect(MOOD_OPTIONS.map((option) => option.value)).toEqual([...MOOD_QUADRANTS]);
    for (const mood of MOOD_QUADRANTS) expect(MOOD_LABELS[mood]).toBeTruthy();
    for (const key of AUDIO_FEATURE_KEYS) expect(AUDIO_FEATURE_DISPLAY[key].color).toMatch(/^#/);
  });
});
