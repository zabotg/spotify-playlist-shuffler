'use client';

import { useState } from 'react';
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
}

export function SaveDestinationForm({
  currentLabel,
  canSaveToCurrent,
  defaultName,
  submitLabel,
  isSaving,
  onSave,
}: SaveDestinationFormProps) {
  const [target, setTarget] = useState<SaveTarget>(canSaveToCurrent ? 'current' : 'new');
  const [name, setName] = useState('');

  const options: ChipOption<SaveTarget>[] = [
    ...(canSaveToCurrent ? [{ value: 'current' as const, label: currentLabel }] : []),
    { value: 'new', label: 'Create new playlist' },
  ];

  return (
    <div className="flex flex-col gap-3 border-t border-zinc-800 pt-3">
      <ChipGroup options={options} value={target} onChange={setTarget} />
      {target === 'new' && (
        <input
          type="text"
          placeholder={defaultName}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="max-w-xs rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none focus:border-zinc-500"
        />
      )}
      <Button
        variant="secondary"
        className="self-start"
        disabled={isSaving}
        onClick={() => onSave({ target, name: name.trim() || defaultName })}
      >
        {isSaving ? 'Saving…' : submitLabel}
      </Button>
    </div>
  );
}
