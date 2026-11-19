import { describe, expect, it } from 'vitest';
import { classifyMoodQuadrant, deriveMoodLabel } from './mood';

describe('classifyMoodQuadrant', () => {
  it.each([
    [0.8, 0.8, 'Joyful'],
    [0.8, 0.2, 'Calm'],
    [0.2, 0.8, 'Intense'],
    [0.2, 0.2, 'Melancholic'],
    [0.5, 0.5, 'Joyful'],
  ] as const)('valence %d and energy %d is %s', (valence, energy, quadrant) => {
    expect(classifyMoodQuadrant(valence, energy)).toBe(quadrant);
  });
});

describe('deriveMoodLabel', () => {
  it.each([
    [0.8, 0.8, 0.8, 0.1, 'Euphoric'],
    [0.7, 0.7, 0.3, 0.1, 'Energetic'],
    [0.7, 0.3, 0.5, 0.8, 'Dreamy'],
    [0.7, 0.3, 0.5, 0.1, 'Happy'],
    [0.3, 0.8, 0.5, 0.1, 'Aggressive'],
    [0.3, 0.6, 0.5, 0.1, 'Tense'],
    [0.2, 0.3, 0.5, 0.1, 'Melancholic'],
    [0.35, 0.3, 0.5, 0.1, 'Sad'],
    [0.55, 0.3, 0.5, 0.8, 'Peaceful'],
    [0.55, 0.3, 0.5, 0.1, 'Chill'],
    [0.45, 0.2, 0.5, 0.1, 'Dark'],
    [0.5, 0.5, 0.5, 0.5, 'Balanced'],
  ] as const)('valence %d, energy %d, dance %d, acoustic %d is %s', (valence, energy, dance, acoustic, label) => {
    expect(deriveMoodLabel(valence, energy, dance, acoustic)).toBe(label);
  });
});
