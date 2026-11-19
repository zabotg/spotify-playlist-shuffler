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

const MS_PER_SECOND = 1000;
const MS_PER_DAY = 86_400_000;
const RELATIVE_DATE_DAYS = 7;

/** Track length like Spotify shows it: 4:15 */
export function formatTrackLength(milliseconds: number): string {
  const totalSeconds = Math.round(milliseconds / MS_PER_SECOND);
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

/** "3 days ago" for the last week, otherwise "Jan 23, 2025". */
export function formatAddedDate(isoDate: string, now = Date.now()): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '—';
  const days = Math.floor((now - date.getTime()) / MS_PER_DAY);
  if (days >= 0 && days < RELATIVE_DATE_DAYS) {
    if (days === 0) return 'Today';
    return days === 1 ? 'Yesterday' : `${days} days ago`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Compact number: 968208 → 968K */
export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}
