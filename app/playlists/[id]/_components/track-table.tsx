'use client';

import { useRef, useState, type ReactNode } from 'react';
import { CoverImage } from '@/components/ui/cover-image';
import type { EnrichedTrack } from '@/lib/domain/playlist';
import { formatDecibels, formatMusicalKey, formatPercent } from '@/lib/utils/format';

type ColumnKey = 'name' | 'artist' | 'bpm' | 'key' | 'energy' | 'danceability' | 'valence' | 'loudness';
export type SortKey = 'position' | ColumnKey;
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

export const DEFAULT_SORT: SortState = { key: 'position', direction: 'asc' };

interface Column {
  key: ColumnKey;
  label: string;
  align: 'left' | 'right' | 'center';
  requiresAudioFeatures: boolean;
  sortValue: (item: EnrichedTrack) => number | string;
  render: (item: EnrichedTrack) => ReactNode;
}

const MISSING_VALUE = <span className="text-zinc-600">—</span>;
const MISSING_SORT_VALUE = -Infinity;
const ALIGN_CLASSES = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

function ratioColumn(key: 'energy' | 'danceability' | 'valence', label: string): Column {
  return {
    key,
    label,
    align: 'right',
    requiresAudioFeatures: true,
    sortValue: (item) => item.features?.[key] ?? MISSING_SORT_VALUE,
    render: (item) => (item.features ? formatPercent(item.features[key]) : MISSING_VALUE),
  };
}

const COLUMNS: Column[] = [
  {
    key: 'name',
    label: 'Title',
    align: 'left',
    requiresAudioFeatures: false,
    sortValue: (item) => item.track.name,
    render: (item) => (
      <div className="flex items-center gap-2">
        <CoverImage src={item.track.imageUrl} alt="" sizes="32px" className="h-8 w-8" />
        <span className="truncate font-medium">{item.track.name}</span>
      </div>
    ),
  },
  {
    key: 'artist',
    label: 'Artist',
    align: 'left',
    requiresAudioFeatures: false,
    sortValue: (item) => item.track.artists[0]?.name ?? '',
    render: (item) => item.track.artists.map((artist) => artist.name).join(', '),
  },
  {
    key: 'bpm',
    label: 'BPM',
    align: 'right',
    requiresAudioFeatures: false,
    sortValue: (item) => item.bpm ?? MISSING_SORT_VALUE,
    render: (item) => (item.bpm ? Math.round(item.bpm) : MISSING_VALUE),
  },
  {
    key: 'key',
    label: 'Key',
    align: 'center',
    requiresAudioFeatures: true,
    sortValue: (item) => (item.features ? item.features.key * 2 + item.features.mode : MISSING_SORT_VALUE),
    render: (item) => (item.features ? formatMusicalKey(item.features.key, item.features.mode) : MISSING_VALUE),
  },
  ratioColumn('energy', 'Energy'),
  ratioColumn('danceability', 'Dance'),
  ratioColumn('valence', 'Mood'),
  {
    key: 'loudness',
    label: 'Loudness',
    align: 'right',
    requiresAudioFeatures: true,
    sortValue: (item) => item.features?.loudness ?? MISSING_SORT_VALUE,
    render: (item) => (item.features ? formatDecibels(item.features.loudness) : MISSING_VALUE),
  },
];

const COLUMNS_BY_KEY = new Map(COLUMNS.map((column) => [column.key, column]));

function compareValues(a: number | string, b: number | string): number {
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
  return Number(a) - Number(b);
}

export function sortTracks(tracks: EnrichedTrack[], { key, direction }: SortState): EnrichedTrack[] {
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
  label: string;
  sortKey: SortKey;
  align: Column['align'];
  sort: SortState;
  onSortChange: (sort: SortState) => void;
}

function SortHeader({ label, sortKey, align, sort, onSortChange }: SortHeaderProps) {
  const isActive = sort.key === sortKey;
  return (
    <th className={`px-3 py-2.5 ${ALIGN_CLASSES[align]}`}>
      <button
        type="button"
        onClick={() => onSortChange(toggleSort(sort, sortKey))}
        className={`text-xs font-medium whitespace-nowrap ${isActive ? 'text-spotify' : 'text-zinc-500 hover:text-zinc-300'}`}
      >
        {label}
        {isActive && <span className="ml-1 text-[10px]">{sort.direction === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  );
}

interface TrackTableProps {
  tracks: EnrichedTrack[];
  sort: SortState;
  onSortChange: (sort: SortState) => void;
}

export function TrackTable({ tracks, sort, onSortChange }: TrackTableProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);

  const hasAudioFeatures = tracks.some((item) => item.features !== null);
  const visibleColumns = COLUMNS.filter((column) => hasAudioFeatures || !column.requiresAudioFeatures);

  function togglePreview(item: EnrichedTrack) {
    const audio = audioRef.current;
    if (!audio || !item.previewUrl) return;
    if (playingTrackId === item.track.id) {
      audio.pause();
      setPlayingTrackId(null);
      return;
    }
    audio.src = item.previewUrl;
    void audio.play();
    setPlayingTrackId(item.track.id);
  }

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
                sortKey={column.key}
                align={column.align}
                sort={sort}
                onSortChange={onSortChange}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {tracks.map((item, index) => {
            const isPlaying = playingTrackId === item.track.id;
            return (
              <tr key={`${item.track.id}-${index}`} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                <td className="w-10 px-3 py-2 text-right text-xs text-zinc-500">{index + 1}</td>
                <td className="w-9 px-2 py-2">
                  {item.previewUrl && (
                    <button
                      type="button"
                      aria-label={isPlaying ? 'Stop preview' : 'Play preview'}
                      onClick={() => togglePreview(item)}
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors ${
                        isPlaying ? 'bg-spotify text-black' : 'bg-zinc-700 text-white hover:bg-spotify hover:text-black'
                      }`}
                    >
                      {isPlaying ? '■' : '▶'}
                    </button>
                  )}
                </td>
                {visibleColumns.map((column) => (
                  <td
                    key={column.key}
                    className={`max-w-[200px] truncate px-3 py-2 tabular-nums ${ALIGN_CLASSES[column.align]}`}
                  >
                    {column.render(item)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <audio ref={audioRef} onEnded={() => setPlayingTrackId(null)} />
    </div>
  );
}
