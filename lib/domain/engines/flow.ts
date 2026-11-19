import type { EnrichedTrack } from '@/lib/domain/models/playlist';
import { average } from '@/lib/utils/array';
import { areKeysCompatible, toCamelot } from './camelot';

/**
 * How smoothly one track leads into the next, based on tempo, key and energy.
 * Each part only counts when both tracks have that data.
 */

export type FlowIssue = 'tempo' | 'key' | 'energy';

export interface TransitionScore {
  /** 0 (rough) to 1 (seamless), or null when there is no data to compare. */
  score: number | null;
  issues: FlowIssue[];
}

export interface Transition extends TransitionScore {
  /** Position of the first track; the transition goes to `index + 1`. */
  index: number;
}

export interface FlowAnalysis {
  /** 0-100 average over the transitions that could be scored, or null when none could. */
  score: number | null;
  transitions: Transition[];
}

/** BPM differences up to this feel natural. */
const TEMPO_TOLERANCE_BPM = 12;
/** A difference this large counts as a full tempo penalty. */
const TEMPO_MAX_BPM = 30;
const ENERGY_TOLERANCE = 0.3;
const ENERGY_MAX = 0.5;
const WEIGHTS: Record<FlowIssue, number> = { tempo: 0.4, key: 0.3, energy: 0.3 };

/** Tempo distance that treats half and double time as close (e.g. 70 and 140 BPM mix well). */
function tempoDistance(a: number, b: number): number {
  return Math.min(Math.abs(a - b), Math.abs(a - 2 * b), Math.abs(2 * a - b));
}

export function scoreTransition(from: EnrichedTrack, to: EnrichedTrack): TransitionScore {
  const penalties: { issue: FlowIssue; penalty: number; isIssue: boolean }[] = [];

  if (from.bpm !== null && to.bpm !== null) {
    const distance = tempoDistance(from.bpm, to.bpm);
    penalties.push({
      issue: 'tempo',
      penalty: Math.min(distance / TEMPO_MAX_BPM, 1),
      isIssue: distance > TEMPO_TOLERANCE_BPM,
    });
  }

  if (from.features && to.features) {
    const fromKey = toCamelot(from.features.key, from.features.mode);
    const toKey = toCamelot(to.features.key, to.features.mode);
    if (fromKey && toKey) {
      const compatible = areKeysCompatible(fromKey, toKey);
      penalties.push({ issue: 'key', penalty: compatible ? 0 : 1, isIssue: !compatible });
    }

    const energyJump = Math.abs(from.features.energy - to.features.energy);
    penalties.push({
      issue: 'energy',
      penalty: Math.min(energyJump / ENERGY_MAX, 1),
      isIssue: energyJump > ENERGY_TOLERANCE,
    });
  }

  if (penalties.length === 0) return { score: null, issues: [] };

  const totalWeight = penalties.reduce((total, { issue }) => total + WEIGHTS[issue], 0);
  const weightedPenalty = penalties.reduce((total, { issue, penalty }) => total + WEIGHTS[issue] * penalty, 0);
  return {
    score: 1 - weightedPenalty / totalWeight,
    issues: penalties.filter(({ isIssue }) => isIssue).map(({ issue }) => issue),
  };
}

export function analyzeFlow(tracks: readonly EnrichedTrack[]): FlowAnalysis {
  const transitions = tracks.slice(1).map((to, offset) => ({ index: offset, ...scoreTransition(tracks[offset], to) }));
  const scores = transitions.map((transition) => transition.score).filter((score) => score !== null);
  const averageScore = average(scores);
  return { score: averageScore === null ? null : Math.round(averageScore * 100), transitions };
}

/** The roughest scored transitions, worst first. */
export function roughestTransitions(analysis: FlowAnalysis, limit: number): Transition[] {
  return analysis.transitions
    .filter((transition) => transition.score !== null && transition.issues.length > 0)
    .sort((a, b) => (a.score as number) - (b.score as number))
    .slice(0, limit);
}
