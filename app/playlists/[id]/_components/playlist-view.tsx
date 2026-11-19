'use client';

import {
  AudioLines,
  ChartColumn,
  ChevronLeft,
  Compass,
  ListMusic,
  Shuffle,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ErrorAlert } from '@/components/ui/alert';
import { CoverImage } from '@/components/ui/cover-image';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { playlistsApi } from '@/lib/api/playlists-api';
import { withAnalyzedFeatures, type EnrichedTrack, type PlaylistSummary } from '@/lib/domain/models/playlist';
import { useAsyncAction } from '@/lib/hooks/use-async-action';
import { useAudioAnalysis } from '@/lib/hooks/use-audio-analysis';
import { useTrackDetails, type TrackDetailsProgress } from '@/lib/hooks/use-track-details';
import { sum } from '@/lib/utils/array';
import { formatDuration, pluralize } from '@/lib/utils/format';
import { DiscoverTab } from './discover-tab';
import { ImproveTab } from './improve-tab';
import { InsightsTab } from './insights-tab';
import { ShuffleTab } from './shuffle-tab';
import { TracksTab } from './tracks-tab';

type Tab = 'tracks' | 'shuffle' | 'improve' | 'insights' | 'discover';

const TABS: { value: Tab; label: string; icon: LucideIcon }[] = [
  { value: 'tracks', label: 'Tracks', icon: ListMusic },
  { value: 'shuffle', label: 'Shuffle', icon: Shuffle },
  { value: 'improve', label: 'Improve', icon: Sparkles },
  { value: 'insights', label: 'Insights', icon: ChartColumn },
  { value: 'discover', label: 'Discover', icon: Compass },
];

const COVER_CLASSES = 'h-32 w-32 sm:h-44 sm:w-44 lg:h-52 lg:w-52';

function ProgressNote({ label, progress }: { label: string; progress: TrackDetailsProgress }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-zinc-300">
      <Spinner className="h-3.5 w-3.5 text-spotify" />
      {label}
      <span className="text-zinc-400 tabular-nums">
        ({progress.loaded}/{progress.total})
      </span>
    </span>
  );
}

interface PlaylistHeaderProps {
  playlist: PlaylistSummary;
  tracks: EnrichedTrack[] | null;
  progress: TrackDetailsProgress;
  analysisProgress: TrackDetailsProgress;
}

function PlaylistHeader({ playlist, tracks, progress, analysisProgress }: PlaylistHeaderProps) {
  const featureCount = tracks?.filter((item) => item.features !== null).length ?? 0;
  const facts = [
    playlist.ownerName && <span className="font-semibold text-white">{playlist.ownerName}</span>,
    pluralize(tracks?.length ?? playlist.trackCount, 'track'),
    tracks && formatDuration(sum(tracks.map((item) => item.track.durationMs))),
  ].filter(Boolean);

  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-7">
      <CoverImage
        src={playlist.imageUrl}
        alt=""
        sizes="208px"
        className={`${COVER_CLASSES} rounded-lg shadow-2xl shadow-black/50`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">Playlist</span>
        <h1 className="font-display text-3xl leading-tight font-bold tracking-tight [overflow-wrap:anywhere] text-white sm:text-4xl lg:text-5xl">
          {playlist.name}
        </h1>
        {playlist.description && (
          <p className="line-clamp-2 max-w-3xl text-sm leading-relaxed text-zinc-400">{playlist.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-300">
          {facts.map((fact, index) => (
            <span key={index} className="flex items-center gap-2">
              {index > 0 && (
                <span aria-hidden className="text-zinc-600">
                  •
                </span>
              )}
              {fact}
            </span>
          ))}
          {playlist.collaborative && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-300">
              <Users aria-hidden className="h-3 w-3" />
              Collaborative
            </span>
          )}
        </div>

        {tracks && tracks.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <AudioLines aria-hidden className="h-3.5 w-3.5 text-spotify" />
              Audio data for{' '}
              <span className="text-zinc-200 tabular-nums">
                {featureCount} of {tracks.length}
              </span>{' '}
              tracks
            </span>
            {progress.isLoading && <ProgressNote label="Loading BPM and popularity from Deezer" progress={progress} />}
            {analysisProgress.isLoading && (
              <ProgressNote label="Analyzing previews of tracks without data" progress={analysisProgress} />
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function PlaylistHeaderSkeleton() {
  return (
    <div role="status" aria-busy className="flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-7">
      <span className="sr-only">Loading playlist</span>
      <Skeleton className={`${COVER_CLASSES} rounded-lg`} />
      <div className="flex flex-1 flex-col gap-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-9 w-3/4 max-w-md sm:h-11" />
        <Skeleton className="h-4 w-1/2 max-w-xs" />
        <Skeleton className="h-4 w-2/5 max-w-60" />
      </div>
    </div>
  );
}

function TracksSkeleton() {
  return (
    <div role="status" aria-busy className="flex flex-col gap-4">
      <span className="sr-only">Loading tracks</span>
      <Skeleton className="h-11 w-full max-w-sm rounded-full" />
      <div className="flex flex-col divide-y divide-zinc-900 rounded-lg border border-zinc-800">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton className="h-3 w-5" />
            <Skeleton className="h-10 w-10 shrink-0" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-2/5 max-w-60" />
              <Skeleton className="h-3 w-1/4 max-w-40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface TabBarProps {
  idPrefix: string;
  activeTab: Tab;
  onChange: (tab: Tab) => void;
}

/** Tabs follow the ARIA pattern: one tab stop, arrow keys, Home and End move between tabs. */
function TabBar({ idPrefix, activeTab, onChange }: TabBarProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = TABS.findIndex((tab) => tab.value === activeTab);
    const nextIndex = {
      ArrowRight: (current + 1) % TABS.length,
      ArrowLeft: (current - 1 + TABS.length) % TABS.length,
      Home: 0,
      End: TABS.length - 1,
    }[event.key];
    if (nextIndex === undefined) return;
    event.preventDefault();
    onChange(TABS[nextIndex].value);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Playlist sections"
      onKeyDown={handleKeyDown}
      className="flex border-b border-zinc-800"
    >
      {TABS.map(({ value, label, icon: Icon }, index) => {
        const isActive = activeTab === value;
        return (
          <button
            key={value}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            id={`${idPrefix}-tab-${value}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(value)}
            className={`-mb-px flex flex-1 flex-col items-center gap-1 border-b-2 px-2 py-2.5 text-sm font-medium transition-colors duration-150 sm:flex-none sm:flex-row sm:gap-2 sm:px-5 sm:py-3 ${
              isActive
                ? 'border-spotify text-white'
                : 'border-transparent text-zinc-400 hover:border-zinc-600 hover:text-zinc-100'
            }`}
          >
            <Icon aria-hidden className={`h-4 w-4 ${isActive ? 'text-spotify' : ''}`} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function PlaylistView({ playlistId }: { playlistId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('tracks');
  const idPrefix = useId();
  const playlist = useAsyncAction(playlistsApi.get);
  const trackList = useAsyncAction(playlistsApi.tracks);
  const serverTracks = trackList.data?.tracks ?? null;
  const { tracks: tracksWithDetails, progress } = useTrackDetails(serverTracks);
  const { featuresById, progress: analysisProgress } = useAudioAnalysis(serverTracks);
  const tracks = useMemo(
    () => tracksWithDetails && withAnalyzedFeatures(tracksWithDetails, featuresById),
    [tracksWithDetails, featuresById],
  );

  const runPlaylist = playlist.run;
  const runTracks = trackList.run;
  useEffect(() => {
    void runPlaylist(playlistId);
    void runTracks(playlistId);
  }, [runPlaylist, runTracks, playlistId]);

  const playlistData = playlist.data;
  const skippedItemCount = trackList.data?.skippedItemCount ?? 0;

  return (
    <main id="main" className="min-h-screen px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:gap-8">
        <Link
          href="/dashboard"
          className="-ml-2 inline-flex min-h-10 items-center gap-1 self-start rounded-full pr-3 pl-2 text-sm font-medium text-zinc-400 transition-colors duration-150 hover:bg-zinc-900 hover:text-white"
        >
          <ChevronLeft aria-hidden className="h-4 w-4" />
          All playlists
        </Link>

        <ErrorAlert message={playlist.error ?? trackList.error} />
        {!playlistData && !playlist.error && <PlaylistHeaderSkeleton />}

        {playlistData && (
          <>
            <PlaylistHeader
              playlist={playlistData.playlist}
              tracks={tracks}
              progress={progress}
              analysisProgress={analysisProgress}
            />

            <div className="flex flex-col gap-6">
              <TabBar idPrefix={idPrefix} activeTab={activeTab} onChange={setActiveTab} />

              <div role="tabpanel" id={`${idPrefix}-panel`} aria-labelledby={`${idPrefix}-tab-${activeTab}`}>
                {!tracks && !trackList.error && activeTab !== 'discover' && <TracksSkeleton />}

                {tracks && activeTab === 'tracks' && <TracksTab tracks={tracks} />}
                {tracks && activeTab === 'shuffle' && (
                  <ShuffleTab playlistId={playlistId} tracks={tracks} canEdit={playlistData.canEdit} />
                )}
                {tracks && activeTab === 'improve' && (
                  <ImproveTab
                    playlistId={playlistId}
                    playlistName={playlistData.playlist.name}
                    tracks={tracks}
                    canEdit={playlistData.canEdit}
                    onChanged={() => void runTracks(playlistId)}
                  />
                )}
                {tracks && activeTab === 'insights' && (
                  <InsightsTab tracks={tracks} skippedItemCount={skippedItemCount} />
                )}
                {activeTab === 'discover' && <DiscoverTab playlistId={playlistId} canEdit={playlistData.canEdit} />}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
