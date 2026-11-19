const PITCH_CLASSES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;

export function formatDuration(milliseconds: number): string {
  const hours = Math.floor(milliseconds / MS_PER_HOUR);
  const minutes = Math.floor((milliseconds % MS_PER_HOUR) / MS_PER_MINUTE);
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function formatMusicalKey(key: number, mode: number): string {
  const pitch = PITCH_CLASSES[key];
  if (!pitch) return '—';
  return `${pitch} ${mode === 1 ? 'Maj' : 'min'}`;
}

export function formatDecibels(loudness: number): string {
  return `${loudness.toFixed(1)} dB`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
