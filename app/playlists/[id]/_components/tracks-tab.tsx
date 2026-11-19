'use client';

import { useMemo, useState } from 'react';
import type { EnrichedTrack } from '@/lib/domain/models/playlist';
import { DEFAULT_SORT, sortTracks, TrackTable, type SortState } from './track-table';

function matchesSearch(item: EnrichedTrack, query: string): boolean {
  const { track } = item;
  const haystack = [track.name, track.albumName, ...track.artists.map((artist) => artist.name)].join(' ');
  return haystack.toLowerCase().includes(query);
}

export function TracksTab({ tracks }: { tracks: EnrichedTrack[] }) {
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [search, setSearch] = useState('');

  const visibleTracks = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query ? tracks.filter((item) => matchesSearch(item, query)) : tracks;
    return sortTracks(filtered, sort);
  }, [tracks, search, sort]);

  if (tracks.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-400">This playlist has no tracks.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search title, artist or album"
          className="w-full max-w-xs rounded-full border border-zinc-700 bg-zinc-900 px-4 py-1.5 text-sm placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
        <span className="text-xs text-zinc-500">Click a column header to sort · ▶ plays a 30s preview</span>
      </div>
      <TrackTable tracks={visibleTracks} sort={sort} onSortChange={setSort} />
    </div>
  );
}
