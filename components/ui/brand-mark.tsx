import { Shuffle } from 'lucide-react';

export function BrandMark() {
  return (
    <span className="inline-flex items-center gap-2.5 font-display text-base font-semibold tracking-tight text-white">
      <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-spotify text-zinc-950">
        <Shuffle className="h-4 w-4" strokeWidth={2.5} />
      </span>
      Playlist Shuffler
    </span>
  );
}
