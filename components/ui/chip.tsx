import type { ReactNode } from 'react';

interface ChipProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** Selected chips are filled, not just recolored, so the state does not rely on color alone. */
export function Chip({ selected, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-150 ${
        selected
          ? 'border-spotify bg-spotify text-zinc-950 hover:border-spotify-bright hover:bg-spotify-bright'
          : 'border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800/60 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface ChipGroupProps<T extends string> {
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for screen readers. */
  ariaLabel?: string;
}

export function ChipGroup<T extends string>({ options, value, onChange, ariaLabel }: ChipGroupProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Chip key={option.value} selected={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </Chip>
      ))}
    </div>
  );
}
