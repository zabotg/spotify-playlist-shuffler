/**
 * All shuffle algorithms — pure functions, no side effects.
 * Each function takes tracks and returns a new reordered array.
 */

import type { SpotifyTrack, AudioFeatures, ShuffleOptions, MoodQuadrant } from '@/types';

export interface TrackWithFeatures {
  track: SpotifyTrack;
  features: AudioFeatures | null;
  addedAt: string;
  deezer?: { bpm: number | null; preview: string | null } | null;
}

// ── 1. Pure Random (Fisher-Yates) ─────────────────────────────────────────

export function pureRandom<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── 2. Balanced Shuffle ───────────────────────────────────────────────────
// Prevents clustering of same-artist tracks using weighted round-robin.

export function balancedShuffle(tracks: TrackWithFeatures[]): TrackWithFeatures[] {
  const buckets = new Map<string, TrackWithFeatures[]>();

  for (const t of tracks) {
    const key = t.track.artists[0]?.id ?? 'unknown';
    const existing = buckets.get(key) ?? [];
    existing.push(t);
    buckets.set(key, existing);
  }

  // Shuffle within each artist bucket
  for (const [k, v] of buckets) buckets.set(k, pureRandom(v));

  // Round-robin: pick from buckets in descending size order, cycling
  const sorted = [...buckets.values()].sort((a, b) => b.length - a.length);
  const result: TrackWithFeatures[] = [];
  let i = 0;

  while (result.length < tracks.length) {
    const bucket = sorted[i % sorted.length];
    if (bucket.length > 0) result.push(bucket.shift()!);
    i++;
    // Skip exhausted buckets
    if (sorted.every(b => b.length === 0)) break;
  }

  return result;
}

// ── 3. Artist-Aware Shuffle ───────────────────────────────────────────────
// Enforces a minimum gap of K tracks between same-artist appearances.

export function artistAwareShuffle(
  tracks: TrackWithFeatures[],
  minGap = 3
): TrackWithFeatures[] {
  // Auto-reduce gap if not enough unique artists
  const uniqueArtists = new Set(tracks.map(t => t.track.artists[0]?.id)).size;
  const effectiveGap = Math.min(minGap, Math.max(1, uniqueArtists - 1));

  const available = [...tracks];
  const result: TrackWithFeatures[] = [];
  const recentArtistIds: string[] = [];

  while (available.length > 0) {
    const forbidden = new Set(recentArtistIds.slice(-effectiveGap));
    const candidates = available.filter(t => !forbidden.has(t.track.artists[0]?.id ?? ''));
    const pool = candidates.length > 0 ? candidates : available;
    const idx = Math.floor(Math.random() * pool.length);
    const chosen = pool[idx];

    result.push(chosen);
    available.splice(available.indexOf(chosen), 1);
    recentArtistIds.push(chosen.track.artists[0]?.id ?? '');
  }

  return result;
}

// ── 4. BPM Smooth Transition ──────────────────────────────────────────────
// Minimises tempo jumps between adjacent tracks. Builds a low→high→low arc.

export function bpmSmoothShuffle(tracks: TrackWithFeatures[]): TrackWithFeatures[] {
  const withTempo = tracks.filter(t => t.features?.tempo != null);
  const noTempo = tracks.filter(t => t.features?.tempo == null);

  if (withTempo.length === 0) return pureRandom(tracks);

  // Sort ascending by BPM with slight jitter to avoid perfectly monotonic output
  const sorted = [...withTempo].sort((a, b) => {
    const diff = a.features!.tempo - b.features!.tempo;
    return diff + (Math.random() - 0.5) * 4;
  });

  // Build mountain arc: interleave from both ends → low→high→low
  const arc: TrackWithFeatures[] = [];
  let lo = 0;
  let hi = sorted.length - 1;
  let turn = 0;

  while (lo <= hi) {
    arc.push(turn % 2 === 0 ? sorted[lo++] : sorted[hi--]);
    turn++;
  }

  // Tracks without tempo data appended at end
  return [...arc, ...pureRandom(noTempo)];
}

// ── 5. Energy Curve ───────────────────────────────────────────────────────

export type EnergyProfile = 'ascending' | 'descending' | 'mountain' | 'valley' | 'wave';

export function energyCurveShuffle(
  tracks: TrackWithFeatures[],
  profile: EnergyProfile = 'mountain'
): TrackWithFeatures[] {
  const withEnergy = tracks.filter(t => t.features?.energy != null);
  const noEnergy = tracks.filter(t => t.features?.energy == null);

  if (withEnergy.length === 0) return pureRandom(tracks);

  const sorted = [...withEnergy].sort(
    (a, b) => (a.features?.energy ?? 0.5) - (b.features?.energy ?? 0.5)
  );

  let arranged: TrackWithFeatures[];

  switch (profile) {
    case 'ascending':
      arranged = sorted;
      break;
    case 'descending':
      arranged = [...sorted].reverse();
      break;
    case 'mountain': {
      const mid = Math.ceil(sorted.length / 2);
      arranged = [...sorted.slice(0, mid), ...sorted.slice(mid).reverse()];
      break;
    }
    case 'valley': {
      const mid = Math.ceil(sorted.length / 2);
      arranged = [...sorted.slice(0, mid).reverse(), ...sorted.slice(mid)];
      break;
    }
    case 'wave': {
      // Q2 → Q4 → Q1 → Q3 (creates undulating energy)
      const q = Math.ceil(sorted.length / 4);
      arranged = [
        ...sorted.slice(q, q * 2),
        ...sorted.slice(q * 3),
        ...sorted.slice(0, q),
        ...sorted.slice(q * 2, q * 3),
      ];
      break;
    }
    default:
      arranged = sorted;
  }

  return [...arranged, ...pureRandom(noEnergy)];
}

// ── 6. Mood-Based Shuffle ─────────────────────────────────────────────────
// Clusters tracks by emotional quadrant (Russell's circumplex model),
// then sequences the clusters.

function classifyMood(features: AudioFeatures | null): MoodQuadrant {
  if (!features) return 'Joyful';
  const hi = features.valence >= 0.5;
  const hie = features.energy >= 0.5;
  if (hi && hie) return 'Joyful';
  if (!hi && hie) return 'Intense';
  if (!hi && !hie) return 'Melancholic';
  return 'Calm';
}

export function moodShuffle(
  tracks: TrackWithFeatures[],
  sequence: MoodQuadrant[] = ['Calm', 'Joyful', 'Intense', 'Melancholic']
): TrackWithFeatures[] {
  const clusters = new Map<MoodQuadrant, TrackWithFeatures[]>();
  for (const q of ['Joyful', 'Intense', 'Melancholic', 'Calm'] as MoodQuadrant[]) {
    clusters.set(q, []);
  }
  for (const t of tracks) {
    clusters.get(classifyMood(t.features))!.push(t);
  }
  return sequence.flatMap(q => pureRandom(clusters.get(q) ?? []));
}

// ── 7. Popularity-Based Shuffle ───────────────────────────────────────────

export type PopularityMode = 'mainstream' | 'underground' | 'hybrid';

export function popularityShuffle(
  tracks: TrackWithFeatures[],
  mode: PopularityMode = 'hybrid'
): TrackWithFeatures[] {
  const sorted = [...tracks].sort(
    (a, b) => b.track.popularity - a.track.popularity
  );

  if (mode === 'mainstream') return weightedReservoirSample(tracks, t => t.track.popularity + 1);
  if (mode === 'underground') return weightedReservoirSample(tracks, t => 101 - t.track.popularity);

  // Hybrid: alternate 2 mainstream, 1 underground
  const mainstream = pureRandom(sorted.slice(0, Math.ceil(sorted.length * 0.6)));
  const underground = pureRandom(sorted.slice(Math.ceil(sorted.length * 0.6)));
  return interleave(mainstream, underground, 2);
}

// ── 8. Discovery Shuffle ──────────────────────────────────────────────────
// Interleaves existing playlist tracks with freshly recommended ones.

export function discoveryShuffle(
  tracks: TrackWithFeatures[],
  newTracks: TrackWithFeatures[],
  insertEvery = 5
): TrackWithFeatures[] {
  const shuffled = balancedShuffle(tracks);
  const result: TrackWithFeatures[] = [];
  let newIdx = 0;

  for (let i = 0; i < shuffled.length; i++) {
    result.push(shuffled[i]);
    if ((i + 1) % insertEvery === 0 && newIdx < newTracks.length) {
      result.push(newTracks[newIdx++]);
    }
  }

  // Append any remaining new tracks
  while (newIdx < newTracks.length) result.push(newTracks[newIdx++]);

  return result;
}

// ── Main dispatcher ───────────────────────────────────────────────────────

export function applyShuffle(
  tracks: TrackWithFeatures[],
  options: ShuffleOptions
): TrackWithFeatures[] {
  if (tracks.length === 0) return [];

  switch (options.mode) {
    case 'pure_random':
      return pureRandom(tracks);
    case 'balanced':
      return balancedShuffle(tracks);
    case 'artist_aware':
      return artistAwareShuffle(tracks, options.artistMinGap ?? 3);
    case 'bpm_smooth':
      return bpmSmoothShuffle(tracks);
    case 'energy_curve':
      return energyCurveShuffle(tracks, options.energyProfile ?? 'mountain');
    case 'mood_based':
      return moodShuffle(tracks, options.moodSequence);
    case 'popularity_based':
      return popularityShuffle(tracks, options.popularityMode ?? 'hybrid');
    case 'discovery':
      // Discovery needs new tracks injected externally before calling this
      return balancedShuffle(tracks);
    default:
      return pureRandom(tracks);
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────

function weightedReservoirSample<T>(items: T[], weight: (item: T) => number): T[] {
  // Efraimidis-Spirakis weighted reservoir sampling
  const keyed = items.map(item => ({ item, key: Math.pow(Math.random(), 1 / weight(item)) }));
  return keyed.sort((a, b) => b.key - a.key).map(k => k.item);
}

function interleave<T>(a: T[], b: T[], aPerB: number): T[] {
  const result: T[] = [];
  let ai = 0;
  let bi = 0;
  while (ai < a.length || bi < b.length) {
    for (let i = 0; i < aPerB && ai < a.length; i++) result.push(a[ai++]);
    if (bi < b.length) result.push(b[bi++]);
  }
  return result;
}
