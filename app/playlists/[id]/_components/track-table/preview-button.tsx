import type { PreviewState } from '@/lib/hooks/use-preview-player';

const LABELS: Record<PreviewState, string> = {
  idle: 'Play preview',
  loading: 'Loading preview',
  playing: 'Stop preview',
  unavailable: 'No preview available',
};

const ICONS: Record<PreviewState, string> = {
  idle: '▶',
  loading: '…',
  playing: '■',
  unavailable: '×',
};

interface PreviewButtonProps {
  state: PreviewState;
  onClick: () => void;
}

export function PreviewButton({ state, onClick }: PreviewButtonProps) {
  const isActive = state === 'playing' || state === 'loading';
  return (
    <button
      type="button"
      aria-label={LABELS[state]}
      title={LABELS[state]}
      disabled={state === 'unavailable'}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors disabled:cursor-not-allowed disabled:bg-transparent disabled:text-zinc-600 ${
        isActive ? 'bg-spotify text-black' : 'bg-zinc-800 text-white hover:bg-spotify hover:text-black'
      }`}
    >
      {ICONS[state]}
    </button>
  );
}
