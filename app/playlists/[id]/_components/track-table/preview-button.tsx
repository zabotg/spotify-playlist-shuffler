import { Loader2, Play, Square, VolumeX, type LucideIcon } from 'lucide-react';
import type { PreviewState } from '@/lib/hooks/use-preview-player';

const LABELS: Record<PreviewState, string> = {
  idle: 'Play preview',
  loading: 'Loading preview',
  playing: 'Stop preview',
  unavailable: 'No preview available',
};

const ICONS: Record<PreviewState, LucideIcon> = {
  idle: Play,
  loading: Loader2,
  playing: Square,
  unavailable: VolumeX,
};

interface PreviewButtonProps {
  state: PreviewState;
  onClick: () => void;
}

export function PreviewButton({ state, onClick }: PreviewButtonProps) {
  const Icon = ICONS[state];
  const isActive = state === 'playing' || state === 'loading';
  return (
    <button
      type="button"
      aria-label={LABELS[state]}
      title={LABELS[state]}
      disabled={state === 'unavailable'}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:bg-transparent disabled:text-zinc-600 ${
        isActive ? 'bg-spotify text-black' : 'bg-zinc-800 text-white hover:bg-spotify hover:text-black'
      }`}
    >
      <Icon
        aria-hidden
        className={`h-3.5 w-3.5 ${state === 'loading' ? 'animate-spin' : ''} ${state === 'idle' ? 'translate-x-px fill-current' : ''} ${state === 'playing' ? 'fill-current' : ''}`}
      />
    </button>
  );
}
