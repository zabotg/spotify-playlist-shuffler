'use client';

import { useRef, useState, type ReactNode } from 'react';
import { CoverImage } from '@/components/ui/cover-image';
import { tracksApi } from '@/lib/api/client';
import type { EnrichedTrack } from '@/lib/domain/playlist';
import {
  formatAddedDate,
  formatCompactNumber,
  formatDecibels,
  formatMusicalKey,
  formatPercent,
  formatTrackLength,
} from '@/lib/utils/format';

type ColumnKey =
  | 'name'
  | 'album'
  | 'addedBy'
  | 'addedAt'
  | 'year'
  | 'bpm'
  | 'key'
  | 'energy'
  | 'danceability'
  | 'valence'
  | 'acousticness'
  | 'instrumentalness'
  | 'loudness'
  | 'popularity'
  | 'duration';
export type SortKey = 'position' | ColumnKey;
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

export const DEFAULT_SORT: SortState = { key: 'position', direction: 'asc' };

type ColumnGroup = 'always' | 'added' | 'features';

interface Column {
  key: ColumnKey;
  label: ReactNode;
  title?: string;
  align: 'left' | 'right' | 'center';
  group: ColumnGroup;
  cellClassName?: string;
  sortValue: (item: EnrichedTrack) => number | string;
  render: (item: EnrichedTrack) => ReactNode;
}

const MISSING_VALUE = <span className="text-zinc-600">—</span>;
const MISSING_SORT_VALUE = -Infinity;
const ALIGN_CLASSES = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

function releaseYear(item: EnrichedTrack): number | null {
  const year = Number(item.track.releaseDate?.slice(0, 4));
  return year > 0 ? year : null;
}

type FeatureRatioKey = 'energy' | 'danceability' | 'valence' | 'acousticness' | 'instrumentalness';

function ratioColumn(key: FeatureRatioKey, label: string, title: string): Column {
  return {
    key,
    label,
    title,
    align: 'right',
    group: 'features',
    sortValue: (item) => item.features?.[key] ?? MISSING_SORT_VALUE,
    render: (item) => (item.features ? formatPercent(item.features[key]) : MISSING_VALUE),
  };
}

function ExplicitBadge() {
  return (
    <span
      title="Explicit"
      className="mr-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-zinc-400 text-[9px] font-bold text-black"
    >
      E
    </span>
  );
}

const COLUMNS: Column[] = [
  {
    key: 'name',
    label: 'Title',
    align: 'left',
    group: 'always',
    cellClassName: 'min-w-[220px] max-w-[320px]',
    sortValue: (item) => item.track.name,
    render: (item) => (
      <div className="flex items-center gap-3">
        <CoverImage src={item.track.imageUrl} alt="" sizes="40px" className="h-10 w-10" />
        <div className="min-w-0">
          <div className="truncate font-medium text-white">{item.track.name}</div>
          <div className="flex items-center truncate text-xs text-zinc-400">
            {item.track.explicit && <ExplicitBadge />}
            <span className="truncate">{item.track.artists.map((artist) => artist.name).join(', ')}</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    key: 'album',
    label: 'Album',
    align: 'left',
    group: 'always',
    cellClassName: 'max-w-[200px] text-zinc-400',
    sortValue: (item) => item.track.albumName,
    render: (item) => item.track.albumName,
  },
  {
    key: 'addedBy',
    label: 'Added by',
    align: 'left',
    group: 'added',
    cellClassName: 'max-w-[160px] text-zinc-400',
    sortValue: (item) => item.addedBy ?? '',
    render: (item) => item.addedBy ?? MISSING_VALUE,
  },
  {
    key: 'addedAt',
    label: 'Date added',
    align: 'left',
    group: 'added',
    cellClassName: 'text-zinc-400 whitespace-nowrap',
    sortValue: (item) => item.addedAt ?? '',
    render: (item) => (item.addedAt ? formatAddedDate(item.addedAt) : MISSING_VALUE),
  },
  {
    key: 'year',
    label: 'Year',
    title: 'Release year',
    align: 'right',
    group: 'always',
    cellClassName: 'text-zinc-400',
    sortValue: (item) => releaseYear(item) ?? MISSING_SORT_VALUE,
    render: (item) => releaseYear(item) ?? MISSING_VALUE,
  },
  {
    key: 'bpm',
    label: 'BPM',
    title: 'Tempo in beats per minute',
    align: 'right',
    group: 'always',
    sortValue: (item) => item.bpm ?? MISSING_SORT_VALUE,
    render: (item) => (item.bpm ? Math.round(item.bpm) : MISSING_VALUE),
  },
  {
    key: 'key',
    label: 'Key',
    title: 'Musical key',
    align: 'center',
    group: 'features',
    cellClassName: 'whitespace-nowrap',
    sortValue: (item) => (item.features ? item.features.key * 2 + item.features.mode : MISSING_SORT_VALUE),
    render: (item) => (item.features ? formatMusicalKey(item.features.key, item.features.mode) : MISSING_VALUE),
  },
  ratioColumn('energy', 'Energy', 'Intensity and activity'),
  ratioColumn('danceability', 'Dance', 'How suitable the track is for dancing'),
  ratioColumn('valence', 'Mood', 'Positivity: high is happy, low is sad or angry'),
  ratioColumn('acousticness', 'Acoustic', 'Confidence that the track is acoustic'),
  ratioColumn('instrumentalness', 'Instr.', 'Confidence that the track has no vocals'),
  {
    key: 'loudness',
    label: 'Loudness',
    title: 'Average loudness in decibels',
    align: 'right',
    group: 'features',
    cellClassName: 'whitespace-nowrap',
    sortValue: (item) => item.features?.loudness ?? MISSING_SORT_VALUE,
    render: (item) => (item.features ? formatDecibels(item.features.loudness) : MISSING_VALUE),
  },
  {
    key: 'popularity',
    label: 'Popularity',
    title: 'Deezer rank: higher is more popular',
    align: 'right',
    group: 'always',
    sortValue: (item) => item.popularity ?? MISSING_SORT_VALUE,
    render: (item) => (item.popularity ? formatCompactNumber(item.popularity) : MISSING_VALUE),
  },
  {
    key: 'duration',
    label: '⏱',
    title: 'Duration',
    align: 'right',
    group: 'always',
    cellClassName: 'text-zinc-400',
    sortValue: (item) => item.track.durationMs,
    render: (item) => formatTrackLength(item.track.durationMs),
  },
];

const COLUMNS_BY_KEY = new Map(COLUMNS.map((column) => [column.key, column]));

function compareValues(a: number | string, b: number | string): number {
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
  return Number(a) - Number(b);
}

export function sortTracks(tracks: readonly EnrichedTrack[], { key, direction }: SortState): EnrichedTrack[] {
  const ordered = [...tracks];
  const column = key === 'position' ? undefined : COLUMNS_BY_KEY.get(key);
  if (column) ordered.sort((a, b) => compareValues(column.sortValue(a), column.sortValue(b)));
  return direction === 'asc' ? ordered : ordered.reverse();
}

export function toggleSort(current: SortState, key: SortKey): SortState {
  if (current.key !== key) return { key, direction: 'asc' };
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

interface SortHeaderProps {
  label: ReactNode;
  title?: string;
  sortKey: SortKey;
  align: Column['align'];
  sort: SortState;
  onSortChange: (sort: SortState) => void;
}

function SortHeader({ label, title, sortKey, align, sort, onSortChange }: SortHeaderProps) {
  const isActive = sort.key === sortKey;
  return (
    <th className={`px-3 py-2.5 ${ALIGN_CLASSES[align]}`}>
      <button
        type="button"
        title={title}
        onClick={() => onSortChange(toggleSort(sort, sortKey))}
        className={`text-xs font-medium whitespace-nowrap ${isActive ? 'text-spotify' : 'text-zinc-500 hover:text-zinc-300'}`}
      >
        {label}
        {isActive && <span className="ml-1 text-[10px]">{sort.direction === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  );
}

type PreviewState = 'loading' | 'playing' | 'unavailable';

/** Plays 30 second previews, looked up on demand (Deezer first, then iTunes). */
function usePreviewPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const urlsRef = useRef(new Map<string, string | null>());
  const requestedIdRef = useRef<string | null>(null);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [unavailableIds, setUnavailableIds] = useState<ReadonlySet<string>>(new Set());

  function stop() {
    requestedIdRef.current = null;
    audioRef.current?.pause();
    setActiveTrackId(null);
    setIsLoading(false);
  }

  function markUnavailable(trackId: string) {
    setUnavailableIds((current) => new Set(current).add(trackId));
    setActiveTrackId((current) => (current === trackId ? null : current));
    setIsLoading(false);
  }

  async function toggle({ track }: EnrichedTrack) {
    const audio = audioRef.current;
    if (!audio) return;
    if (activeTrackId === track.id) {
      stop();
      return;
    }

    audio.pause();
    requestedIdRef.current = track.id;
    setActiveTrackId(track.id);
    setIsLoading(true);

    let url = urlsRef.current.get(track.id);
    if (url === undefined) {
      try {
        const result = await tracksApi.preview({
          trackId: track.id,
          isrc: track.isrc,
          title: track.name,
          artist: track.artists[0]?.name ?? '',
        });
        url = result.url;
      } catch {
        url = null;
      }
      urlsRef.current.set(track.id, url);
    }
    if (requestedIdRef.current !== track.id) return; // another track was clicked meanwhile

    if (!url) {
      markUnavailable(track.id);
      return;
    }
    audio.src = url;
    try {
      await audio.play();
      setIsLoading(false);
    } catch {
      if (requestedIdRef.current !== track.id) return; // interrupted by a click on another track
      urlsRef.current.delete(track.id); // the signed URL may have expired: fetch it again next time
      stop();
    }
  }

  function stateOf(trackId: string): PreviewState | null {
    if (unavailableIds.has(trackId)) return 'unavailable';
    if (activeTrackId !== trackId) return null;
    return isLoading ? 'loading' : 'playing';
  }

  const audioElement = <audio ref={audioRef} onEnded={() => setActiveTrackId(null)} />;
  return { toggle, stateOf, audioElement };
}

const PREVIEW_BUTTON_LABELS: Record<PreviewState | 'idle', string> = {
  idle: 'Play preview',
  loading: 'Loading preview',
  playing: 'Stop preview',
  unavailable: 'No preview available',
};

function PreviewButton({ state, onClick }: { state: PreviewState | null; onClick: () => void }) {
  const label = PREVIEW_BUTTON_LABELS[state ?? 'idle'];
  const isActive = state === 'playing' || state === 'loading';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={state === 'unavailable'}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors disabled:cursor-not-allowed disabled:bg-transparent disabled:text-zinc-600 ${
        isActive ? 'bg-spotify text-black' : 'bg-zinc-800 text-white hover:bg-spotify hover:text-black'
      }`}
    >
      {state === 'loading' ? '…' : state === 'playing' ? '■' : state === 'unavailable' ? '×' : '▶'}
    </button>
  );
}

interface TrackTableProps {
  tracks: EnrichedTrack[];
  sort: SortState;
  onSortChange: (sort: SortState) => void;
}

export function TrackTable({ tracks, sort, onSortChange }: TrackTableProps) {
  const preview = usePreviewPlayer();

  const visibleGroups = new Set<ColumnGroup>(['always']);
  if (tracks.some((item) => item.features !== null)) visibleGroups.add('features');
  if (tracks.some((item) => item.addedAt !== null)) visibleGroups.add('added');
  const visibleColumns = COLUMNS.filter((column) => visibleGroups.has(column.group));

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-zinc-900/60">
          <tr className="border-b border-zinc-800">
            <SortHeader label="#" sortKey="position" align="right" sort={sort} onSortChange={onSortChange} />
            <th className="w-9 px-2 py-2.5">
              <span className="sr-only">Preview</span>
            </th>
            {visibleColumns.map((column) => (
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
            <tr key={`${item.track.id}-${index}`} className="border-b border-zinc-900 hover:bg-zinc-900/50">
              <td className="w-10 px-3 py-2 text-right text-xs text-zinc-500 tabular-nums">{index + 1}</td>
              <td className="w-9 px-2 py-2">
                <PreviewButton state={preview.stateOf(item.track.id)} onClick={() => void preview.toggle(item)} />
              </td>
              {visibleColumns.map((column) => (
                <td
                  key={column.key}
                  className={`truncate px-3 py-2 tabular-nums ${ALIGN_CLASSES[column.align]} ${column.cellClassName ?? 'max-w-[200px]'}`}
                >
                  {column.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {preview.audioElement}
    </div>
  );
}
