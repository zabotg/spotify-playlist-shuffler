'use client';

import { ListMusic, Search, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { EnrichedTrack } from '@/lib/domain/models/playlist';
import { DEFAULT_SORT, sortTracks, TrackTable, type TrackSort } from './track-table/track-table';

function matchesSearch(item: EnrichedTrack, query: string): boolean {
  const { track } = item;
  const haystack = [track.name, track.albumName, ...track.artists.map((artist) => artist.name)].join(' ');
  return haystack.toLowerCase().includes(query);
}

export function TracksTab({ tracks }: { tracks: EnrichedTrack[] }) {
  const [sort, setSort] = useState<TrackSort>(DEFAULT_SORT);
  const [search, setSearch] = useState('');

  const visibleTracks = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query ? tracks.filter((item) => matchesSearch(item, query)) : tracks;
    return sortTracks(filtered, sort);
  }, [tracks, search, sort]);

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 px-6 py-14 text-center">
        <ListMusic aria-hidden className="h-8 w-8 text-zinc-500" />
        <p className="text-base text-zinc-300">This playlist has no tracks.</p>
      </div>
    );
  }

  const isFiltering = search.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-zinc-500"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, artist or album"
            aria-label="Search tracks"
            className="h-11 w-full rounded-full border border-zinc-800 bg-zinc-900 pr-4 pl-10 text-sm text-zinc-100 transition-colors duration-150 placeholder:text-zinc-500 hover:border-zinc-700 focus:border-zinc-500"
          />
        </div>
        <p aria-live="polite" className="text-sm text-zinc-400">
          {isFiltering ? (
            <>
              <span className="font-medium text-zinc-200 tabular-nums">{visibleTracks.length}</span> of{' '}
              {tracks.length} tracks match
            </>
          ) : (
            'Click a column header to sort · press play for a 30s preview'
          )}
        </p>
      </div>

      {visibleTracks.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 px-6 py-14 text-center">
          <SearchX aria-hidden className="h-8 w-8 text-zinc-500" />
          <p className="text-base text-zinc-300">No tracks match &quot;{search.trim()}&quot;.</p>
          <Button variant="outline" onClick={() => setSearch('')}>
            Clear search
          </Button>
        </div>
      )}
      {/* Hidden rather than unmounted, so the chosen view and a playing preview survive an empty search. */}
      <div className={visibleTracks.length === 0 ? 'hidden' : undefined}>
        <TrackTable tracks={visibleTracks} sort={sort} onSortChange={setSort} />
      </div>
    </div>
  );
}
