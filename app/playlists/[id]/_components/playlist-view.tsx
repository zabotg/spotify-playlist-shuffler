'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ErrorAlert } from '@/components/ui/alert';
import { CoverImage } from '@/components/ui/cover-image';
import { playlistsApi } from '@/lib/api/playlists-api';
import { withAnalyzedFeatures, type EnrichedTrack, type PlaylistSummary } from '@/lib/domain/models/playlist';
import { useAsyncAction } from '@/lib/hooks/use-async-action';
import { useAudioAnalysis } from '@/lib/hooks/use-audio-analysis';
import { useTrackDetails, type TrackDetailsProgress } from '@/lib/hooks/use-track-details';
import { sum } from '@/lib/utils/array';
import { formatDuration, pluralize } from '@/lib/utils/format';
import { DiscoverTab } from './discover-tab';
import { InsightsTab } from './insights-tab';
import { ShuffleTab } from './shuffle-tab';
import { TracksTab } from './tracks-tab';

type Tab = 'tracks' | 'shuffle' | 'insights' | 'discover';

const TABS: { value: Tab; label: string }[] = [
  { value: 'tracks', label: 'Tracks' },
  { value: 'shuffle', label: 'Shuffle' },
  { value: 'insights', label: 'Insights' },
  { value: 'discover', label: 'Discover' },
];

interface PlaylistHeaderProps {
  playlist: PlaylistSummary;
  tracks: EnrichedTrack[] | null;
  progress: TrackDetailsProgress;
  analysisProgress: TrackDetailsProgress;
}

function PlaylistHeader({ playlist, tracks, progress, analysisProgress }: PlaylistHeaderProps) {
  const featureCount = tracks?.filter((item) => item.features !== null).length ?? 0;
  const facts = [
    playlist.ownerName,
    pluralize(tracks?.length ?? playlist.trackCount, 'track'),
    tracks && formatDuration(sum(tracks.map((item) => item.track.durationMs))),
    playlist.collaborative && 'Collaborative',
  ].filter(Boolean);

  return (
    <div className="flex items-end gap-5">
      <CoverImage src={playlist.imageUrl} alt={playlist.name} sizes="160px" className="h-32 w-32 shadow-lg sm:h-40 sm:w-40" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-400">Playlist</span>
        <h1 className="text-2xl leading-tight font-bold sm:text-4xl">{playlist.name}</h1>
        {playlist.description && <p className="line-clamp-2 text-sm text-zinc-400">{playlist.description}</p>}
        <p className="text-sm text-zinc-300">{facts.join(' · ')}</p>
        {tracks && tracks.length > 0 && (
          <p className="text-xs text-zinc-500">
            Audio data for {featureCount} of {tracks.length} tracks
            {progress.isLoading && ` · loading BPM and popularity from Deezer (${progress.loaded}/${progress.total})`}
            {analysisProgress.isLoading &&
              ` · analyzing previews of tracks without data (${analysisProgress.loaded}/${analysisProgress.total})`}
          </p>
        )}
      </div>
    </div>
  );
}

export function PlaylistView({ playlistId }: { playlistId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('tracks');
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
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <Link href="/dashboard" className="self-start text-sm text-zinc-400 transition-colors hover:text-white">
          <ArrowLeft aria-hidden className="mr-1 inline h-4 w-4" />
          Back
        </Link>

        <ErrorAlert message={playlist.error ?? trackList.error} />
        {!playlistData && !playlist.error && <p className="text-sm text-zinc-500">Loading playlist…</p>}

        {playlistData && (
          <>
            <PlaylistHeader
              playlist={playlistData.playlist}
              tracks={tracks}
              progress={progress}
              analysisProgress={analysisProgress}
            />

            <div role="tablist" className="flex border-b border-zinc-800">
              {TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`-mb-px border-b-2 px-5 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === tab.value
                      ? 'border-spotify text-white'
                      : 'border-transparent text-zinc-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {!tracks && !trackList.error && <p className="text-sm text-zinc-500">Loading tracks…</p>}

            {tracks && activeTab === 'tracks' && <TracksTab tracks={tracks} />}
            {tracks && activeTab === 'shuffle' && (
              <ShuffleTab playlistId={playlistId} tracks={tracks} canEdit={playlistData.canEdit} />
            )}
            {tracks && activeTab === 'insights' && <InsightsTab tracks={tracks} skippedItemCount={skippedItemCount} />}
            {activeTab === 'discover' && <DiscoverTab playlistId={playlistId} canEdit={playlistData.canEdit} />}
          </>
        )}
      </div>
    </main>
  );
}
