import type { ReactNode } from 'react';
import { CoverImage } from '@/components/ui/cover-image';
import { releaseYear, type EnrichedTrack } from '@/lib/domain/models/playlist';
import {
  formatAddedDate,
  formatCompactNumber,
  formatDecibels,
  formatMusicalKey,
  formatPercent,
  formatTrackLength,
} from '@/lib/utils/format';
import type { SortValue } from './sorting';

export type ColumnKey =
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

/** Columns only shown when at least one track has that kind of data. */
export type ColumnGroup = 'always' | 'added' | 'features';
export type ColumnAlign = 'left' | 'right' | 'center';

export interface Column {
  key: ColumnKey;
  label: ReactNode;
  title?: string;
  align: ColumnAlign;
  group: ColumnGroup;
  cellClassName?: string;
  sortValue: (item: EnrichedTrack) => SortValue;
  render: (item: EnrichedTrack) => ReactNode;
}

export const ALIGN_CLASSES: Record<ColumnAlign, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

const MISSING_VALUE = <span className="text-zinc-600">—</span>;

function orMissing<T>(value: T | null, render: (value: T) => ReactNode): ReactNode {
  return value === null ? MISSING_VALUE : render(value);
}

type FeatureRatioKey = 'energy' | 'danceability' | 'valence' | 'acousticness' | 'instrumentalness';

function ratioColumn(key: FeatureRatioKey, label: string, title: string): Column {
  return {
    key,
    label,
    title,
    align: 'right',
    group: 'features',
    sortValue: (item) => item.features?.[key] ?? null,
    render: (item) => orMissing(item.features?.[key] ?? null, formatPercent),
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

function TitleCell({ item }: { item: EnrichedTrack }) {
  const { track } = item;
  return (
    <div className="flex items-center gap-3">
      <CoverImage src={track.imageUrl} alt="" sizes="40px" className="h-10 w-10" />
      <div className="min-w-0">
        <div className="truncate font-medium text-white">{track.name}</div>
        <div className="flex items-center truncate text-xs text-zinc-400">
          {track.explicit && <ExplicitBadge />}
          <span className="truncate">{track.artists.map((artist) => artist.name).join(', ')}</span>
        </div>
      </div>
    </div>
  );
}

export const COLUMNS: readonly Column[] = [
  {
    key: 'name',
    label: 'Title',
    align: 'left',
    group: 'always',
    cellClassName: 'min-w-[220px] max-w-[320px]',
    sortValue: (item) => item.track.name,
    render: (item) => <TitleCell item={item} />,
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
    sortValue: (item) => item.addedBy,
    render: (item) => orMissing(item.addedBy, (name) => name),
  },
  {
    key: 'addedAt',
    label: 'Date added',
    align: 'left',
    group: 'added',
    cellClassName: 'whitespace-nowrap text-zinc-400',
    sortValue: (item) => item.addedAt,
    render: (item) => orMissing(item.addedAt, (date) => formatAddedDate(date)),
  },
  {
    key: 'year',
    label: 'Year',
    title: 'Release year',
    align: 'right',
    group: 'always',
    cellClassName: 'text-zinc-400',
    sortValue: (item) => releaseYear(item.track),
    render: (item) => orMissing(releaseYear(item.track), (year) => year),
  },
  {
    key: 'bpm',
    label: 'BPM',
    title: 'Tempo in beats per minute',
    align: 'right',
    group: 'always',
    sortValue: (item) => item.bpm,
    render: (item) => orMissing(item.bpm, Math.round),
  },
  {
    key: 'key',
    label: 'Key',
    title: 'Musical key',
    align: 'center',
    group: 'features',
    cellClassName: 'whitespace-nowrap',
    sortValue: (item) => (item.features ? item.features.key * 2 + item.features.mode : null),
    render: (item) => orMissing(item.features, (features) => formatMusicalKey(features.key, features.mode)),
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
    sortValue: (item) => item.features?.loudness ?? null,
    render: (item) => orMissing(item.features?.loudness ?? null, formatDecibels),
  },
  {
    key: 'popularity',
    label: 'Popularity',
    title: 'Deezer rank: higher is more popular',
    align: 'right',
    group: 'always',
    sortValue: (item) => item.popularity,
    render: (item) => orMissing(item.popularity, formatCompactNumber),
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

export function findColumn(key: string): Column | undefined {
  return COLUMNS_BY_KEY.get(key as ColumnKey);
}

export function visibleColumns(tracks: readonly EnrichedTrack[]): Column[] {
  const groups = new Set<ColumnGroup>(['always']);
  if (tracks.some((item) => item.features !== null)) groups.add('features');
  if (tracks.some((item) => item.addedAt !== null)) groups.add('added');
  return COLUMNS.filter((column) => groups.has(column.group));
}
