'use client';

import { Save } from 'lucide-react';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ChipGroup, type ChipOption } from '@/components/ui/chip';

export type SaveTarget = 'current' | 'new';

export interface SaveDestination {
  target: SaveTarget;
  name: string;
}

interface SaveDestinationFormProps {
  currentLabel: string;
  canSaveToCurrent: boolean;
  defaultName: string;
  submitLabel: string;
  isSaving: boolean;
  onSave: (destination: SaveDestination) => void;
  /** Heading of the save panel. */
  title?: string;
  /** Extra notes shown under the save button. */
  children?: ReactNode;
}

export function SaveDestinationForm({
  currentLabel,
  canSaveToCurrent,
  defaultName,
  submitLabel,
  isSaving,
  onSave,
  title = 'Save to Spotify',
  children,
}: SaveDestinationFormProps) {
  const [target, setTarget] = useState<SaveTarget>(canSaveToCurrent ? 'current' : 'new');
  const [name, setName] = useState('');
  const id = useId();

  const options: ChipOption<SaveTarget>[] = [
    ...(canSaveToCurrent ? [{ value: 'current' as const, label: currentLabel }] : []),
    { value: 'new', label: 'Create new playlist' },
  ];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ target, name: name.trim() || defaultName });
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5"
    >
      <h3 id={`${id}-title`} className="text-base font-semibold text-white">
        {title}
      </h3>

      <ChipGroup options={options} value={target} onChange={setTarget} ariaLabel="Where to save" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {target === 'new' && (
          <label className="flex w-full flex-col gap-1.5 text-sm text-zinc-400 sm:max-w-xs">
            Playlist name
            <input
              type="text"
              placeholder={defaultName}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 transition-colors duration-150 placeholder:text-zinc-500 hover:border-zinc-600 focus:border-zinc-500"
            />
          </label>
        )}
        <Button type="submit" variant="secondary" className="self-start sm:self-auto" isLoading={isSaving}>
          {!isSaving && <Save aria-hidden className="h-4 w-4" />}
          {isSaving ? 'Saving…' : submitLabel}
        </Button>
      </div>

      {children}
    </form>
  );
}
