'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { EnrichedTrack, Track } from '@/lib/domain/models/playlist';
import { usePreviewPlayer, type PreviewState } from '@/lib/hooks/use-preview-player';
import {
  ALIGN_CLASSES,
  findColumn,
  visibleColumns,
  type Column,
  type ColumnAlign,
  type ColumnKey,
  type TableView,
} from './columns';
import { PreviewButton } from './preview-button';
import { TrackDetailsPanel } from './track-details-panel';
import { nextSortState, sortBy, type SortState } from './sorting';

export type SortKey = 'position' | ColumnKey;
export type TrackSort = SortState<SortKey>;

export const DEFAULT_SORT: TrackSort = { key: 'position', direction: 'asc' };

export function sortTracks(tracks: readonly EnrichedTrack[], { key, direction }: TrackSort): EnrichedTrack[] {
  return sortBy(tracks, key === 'position' ? undefined : findColumn(key)?.sortValue, direction);
}

const VIEWS: { value: TableView; label: string; hint: string }[] = [
  { value: 'overview', label: 'Overview', hint: 'Album, who added it, when, popularity and length' },
  { value: 'audio', label: 'Audio', hint: 'BPM, key, energy, danceability, mood and more' },
  { value: 'all', label: 'All columns', hint: 'Everything at once (scroll sideways)' },
];

/** Leading columns stay in place while scrolling sideways, so you always know which track a row is. */
const STICKY = {
  select: 'sticky left-0 w-10 min-w-10',
  position: (withSelect: boolean) => `sticky ${withSelect ? 'left-10' : 'left-0'} w-11 min-w-11`,
  preview: (withSelect: boolean) => `sticky ${withSelect ? 'left-[84px]' : 'left-11'} w-10 min-w-10`,
  title: (withSelect: boolean) => `sticky ${withSelect ? 'left-[124px]' : 'left-[84px]'} z-10 shadow-[1px_0_0_#27272a]`,
};
const STICKY_BG = 'bg-zinc-950 group-hover:bg-zinc-900';

/** Shows a fade on the right edge while there are more columns to scroll to. */
function useHorizontalOverflow() {
  const ref = useRef<HTMLDivElement>(null);
  const [hasMoreRight, setHasMoreRight] = useState(false);

  const update = useCallback(() => {
    // On unmount React clears the ref before the effect cleanup disconnects the observer, and
    // removing the element resizes it, so the observer can still fire once with no element.
    const element = ref.current;
    if (!element) return;
    setHasMoreRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const element = ref.current as HTMLDivElement;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [update]);

  return { ref, hasMoreRight, onScroll: update };
}

interface SortHeaderProps {
  label: ReactNode;
  title?: string;
  sortKey: SortKey;
  align: ColumnAlign;
  sort: TrackSort;
  onSortChange: (sort: TrackSort) => void;
  className?: string;
}

function SortHeader({ label, title, sortKey, align, sort, onSortChange, className = '' }: SortHeaderProps) {
  const isActive = sort.key === sortKey;
  return (
    <th
      className={`bg-zinc-950 px-3 py-2.5 ${ALIGN_CLASSES[align]} ${className}`}
      aria-sort={isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <button
        type="button"
        title={title}
        onClick={() => onSortChange(nextSortState(sort, sortKey))}
        className={`text-xs font-medium whitespace-nowrap transition-colors ${isActive ? 'text-spotify' : 'text-zinc-400 hover:text-white'}`}
      >
        {label}
        {isActive && <span className="ml-1 text-[10px]">{sort.direction === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  );
}

/** Optional checkboxes, e.g. to pick suggestions to add. Keyed by track URI. */
export interface TrackSelection {
  selected: ReadonlySet<string>;
  onToggle: (uri: string) => void;
}

interface TrackRowProps {
  item: EnrichedTrack;
  position: number;
  columns: Column[];
  previewState: PreviewState;
  onTogglePreview: (track: Track) => Promise<void>;
  /** `undefined` when the table has no selection column. */
  isSelected?: boolean;
  onToggleSelected?: (uri: string) => void;
  onOpenDetails: (item: EnrichedTrack) => void;
}

/** Memoized so playing a preview or loading details only re-renders the rows that changed. */
const TrackRow = memo(function TrackRow({
  item,
  position,
  columns,
  previewState,
  onTogglePreview,
  isSelected,
  onToggleSelected,
  onOpenDetails,
}: TrackRowProps) {
  const withSelect = onToggleSelected !== undefined;
  return (
    <tr className="group border-b border-zinc-900">
      {onToggleSelected && (
        <td className={`${STICKY.select} ${STICKY_BG} px-3 py-2`}>
          <input
            type="checkbox"
            aria-label={`Select ${item.track.name}`}
            checked={isSelected}
            onChange={() => onToggleSelected(item.track.uri)}
            className="h-4 w-4 accent-spotify"
          />
        </td>
      )}
      <td className={`${STICKY.position(withSelect)} ${STICKY_BG} px-3 py-2 text-right text-xs text-zinc-500 tabular-nums`}>
        {position}
      </td>
      <td className={`${STICKY.preview(withSelect)} ${STICKY_BG} py-2`}>
        <PreviewButton state={previewState} onClick={() => void onTogglePreview(item.track)} />
      </td>
      {columns.map((column, index) => (
        <td
          key={column.key}
          className={`truncate px-3 py-2 tabular-nums ${ALIGN_CLASSES[column.align]} ${column.cellClassName ?? 'max-w-[200px]'} ${
            index === 0 ? `${STICKY.title(withSelect)} ${STICKY_BG}` : 'group-hover:bg-zinc-900/60'
          }`}
        >
          {index === 0 ? (
            <button
              type="button"
              title="Show details, credits and lyrics"
              onClick={() => onOpenDetails(item)}
              className="block w-full rounded text-left hover:underline"
            >
              {column.render(item)}
            </button>
          ) : (
            column.render(item)
          )}
        </td>
      ))}
    </tr>
  );
});

interface TrackTableProps {
  tracks: EnrichedTrack[];
  sort: TrackSort;
  onSortChange: (sort: TrackSort) => void;
  selection?: TrackSelection;
  /** The view shown first; the user can switch. */
  initialView?: TableView;
}

export function TrackTable({ tracks, sort, onSortChange, selection, initialView = 'overview' }: TrackTableProps) {
  const { audioRef, toggle, stateOf, onEnded } = usePreviewPlayer();
  const [view, setView] = useState<TableView>(initialView);
  const columns = useMemo(() => visibleColumns(tracks, view), [tracks, view]);
  const { ref: scrollRef, hasMoreRight, onScroll } = useHorizontalOverflow();
  const withSelect = selection !== undefined;
  const [detailsItem, setDetailsItem] = useState<EnrichedTrack | null>(null);
  const closeDetails = useCallback(() => setDetailsItem(null), []);

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Columns to show" className="flex flex-wrap gap-1 self-start rounded-full bg-zinc-900 p-1">
        {VIEWS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={view === option.value}
            title={option.hint}
            onClick={() => setView(option.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              view === option.value ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="max-h-[75vh] overflow-auto rounded-lg border border-zinc-800"
        >
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-zinc-800">
                {selection && (
                  <th className={`${STICKY.select} bg-zinc-950 px-3 py-2.5`}>
                    <span className="sr-only">Select</span>
                  </th>
                )}
                <SortHeader
                  label="#"
                  sortKey="position"
                  align="right"
                  sort={sort}
                  onSortChange={onSortChange}
                  className={STICKY.position(withSelect)}
                />
                <th className={`${STICKY.preview(withSelect)} bg-zinc-950 py-2.5`}>
                  <span className="sr-only">Preview</span>
                </th>
                {columns.map((column, index) => (
                  <SortHeader
                    key={column.key}
                    label={column.label}
                    title={column.title}
                    sortKey={column.key}
                    align={column.align}
                    sort={sort}
                    onSortChange={onSortChange}
                    className={index === 0 ? STICKY.title(withSelect) : ''}
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
                  isSelected={selection?.selected.has(item.track.uri)}
                  onToggleSelected={selection?.onToggle}
                  onOpenDetails={setDetailsItem}
                />
              ))}
            </tbody>
          </table>
        </div>
        {hasMoreRight && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-px right-px w-12 rounded-r-lg bg-gradient-to-l from-black to-transparent"
          />
        )}
      </div>
      <audio ref={audioRef} onEnded={onEnded} />
      {detailsItem && <TrackDetailsPanel item={detailsItem} onClose={closeDetails} />}
    </div>
  );
}
