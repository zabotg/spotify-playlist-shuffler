'use client';

import { memo, useMemo, type ReactNode } from 'react';
import type { EnrichedTrack, Track } from '@/lib/domain/models/playlist';
import { usePreviewPlayer, type PreviewState } from '@/lib/hooks/use-preview-player';
import { ALIGN_CLASSES, findColumn, visibleColumns, type Column, type ColumnAlign, type ColumnKey } from './columns';
import { PreviewButton } from './preview-button';
import { nextSortState, sortBy, type SortState } from './sorting';

export type SortKey = 'position' | ColumnKey;
export type TrackSort = SortState<SortKey>;

export const DEFAULT_SORT: TrackSort = { key: 'position', direction: 'asc' };

export function sortTracks(tracks: readonly EnrichedTrack[], { key, direction }: TrackSort): EnrichedTrack[] {
  return sortBy(tracks, key === 'position' ? undefined : findColumn(key)?.sortValue, direction);
}

interface SortHeaderProps {
  label: ReactNode;
  title?: string;
  sortKey: SortKey;
  align: ColumnAlign;
  sort: TrackSort;
  onSortChange: (sort: TrackSort) => void;
}

function SortHeader({ label, title, sortKey, align, sort, onSortChange }: SortHeaderProps) {
  const isActive = sort.key === sortKey;
  return (
    <th
      className={`px-3 py-2.5 ${ALIGN_CLASSES[align]}`}
      aria-sort={isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <button
        type="button"
        title={title}
        onClick={() => onSortChange(nextSortState(sort, sortKey))}
        className={`text-xs font-medium whitespace-nowrap ${isActive ? 'text-spotify' : 'text-zinc-500 hover:text-zinc-300'}`}
      >
        {label}
        {isActive && <span className="ml-1 text-[10px]">{sort.direction === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  );
}

interface TrackRowProps {
  item: EnrichedTrack;
  position: number;
  columns: Column[];
  previewState: PreviewState;
  onTogglePreview: (track: Track) => Promise<void>;
}

/** Memoized so playing a preview or loading details only re-renders the rows that changed. */
const TrackRow = memo(function TrackRow({ item, position, columns, previewState, onTogglePreview }: TrackRowProps) {
  return (
    <tr className="border-b border-zinc-900 hover:bg-zinc-900/50">
      <td className="w-10 px-3 py-2 text-right text-xs text-zinc-500 tabular-nums">{position}</td>
      <td className="w-9 px-2 py-2">
        <PreviewButton state={previewState} onClick={() => void onTogglePreview(item.track)} />
      </td>
      {columns.map((column) => (
        <td
          key={column.key}
          className={`truncate px-3 py-2 tabular-nums ${ALIGN_CLASSES[column.align]} ${column.cellClassName ?? 'max-w-[200px]'}`}
        >
          {column.render(item)}
        </td>
      ))}
    </tr>
  );
});

interface TrackTableProps {
  tracks: EnrichedTrack[];
  sort: TrackSort;
  onSortChange: (sort: TrackSort) => void;
}

export function TrackTable({ tracks, sort, onSortChange }: TrackTableProps) {
  const { audioRef, toggle, stateOf, onEnded } = usePreviewPlayer();
  const columns = useMemo(() => visibleColumns(tracks), [tracks]);

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-zinc-900/60">
          <tr className="border-b border-zinc-800">
            <SortHeader label="#" sortKey="position" align="right" sort={sort} onSortChange={onSortChange} />
            <th className="w-9 px-2 py-2.5">
              <span className="sr-only">Preview</span>
            </th>
            {columns.map((column) => (
              <SortHeader
                key={column.key}
                label={column.label}
                title={column.title}
                sortKey={column.key}
                align={column.align}
                sort={sort}
                onSortChange={onSortChange}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {tracks.map((item, index) => (
            <TrackRow
              key={`${item.track.id}-${index}`}
              item={item}
              position={index + 1}
              columns={columns}
              previewState={stateOf(item.track.id)}
              onTogglePreview={toggle}
            />
          ))}
        </tbody>
      </table>
      <audio ref={audioRef} onEnded={onEnded} />
    </div>
  );
}
