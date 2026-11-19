'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ErrorAlert } from '@/components/ui/alert';
import { CoverImage } from '@/components/ui/cover-image';
import { playlistsApi } from '@/lib/api/client';
import type { PlaylistSummary } from '@/lib/domain/playlist';
import { useAsyncAction } from '@/lib/hooks/use-async-action';
import { pluralize } from '@/lib/utils/format';
import { DiscoverTab } from './discover-tab';
import { InsightsTab } from './insights-tab';
import { ShuffleTab } from './shuffle-tab';

type Tab = 'shuffle' | 'insights' | 'discover';

const TABS: { value: Tab; label: string }[] = [
  { value: 'shuffle', label: 'Shuffle' },
  { value: 'insights', label: 'Insights' },
  { value: 'discover', label: 'Discover' },
];

function PlaylistHeader({ playlist }: { playlist: PlaylistSummary }) {
  return (
    <div className="flex items-start gap-4">
      <CoverImage src={playlist.imageUrl} alt={playlist.name} sizes="96px" className="h-24 w-24 text-4xl" />
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl leading-tight font-bold">{playlist.name}</h1>
        {playlist.description && <p className="line-clamp-2 text-sm text-zinc-400">{playlist.description}</p>}
        <p className="text-sm text-zinc-500">
          {pluralize(playlist.trackCount, 'track')}
          {playlist.ownerName && ` · ${playlist.ownerName}`}
        </p>
      </div>
    </div>
  );
}

export function PlaylistView({ playlistId }: { playlistId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('shuffle');
  const { data, error, run } = useAsyncAction(playlistsApi.get);

  useEffect(() => {
    void run(playlistId);
  }, [run, playlistId]);

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Link href="/dashboard" className="self-start text-sm text-zinc-400 transition-colors hover:text-white">
          ← Back
        </Link>

        <ErrorAlert message={error} />
        {!data && !error && <p className="text-sm text-zinc-500">Loading playlist…</p>}

        {data && (
          <>
            <PlaylistHeader playlist={data.playlist} />

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

            {activeTab === 'shuffle' && <ShuffleTab playlistId={playlistId} canEdit={data.canEdit} />}
            {activeTab === 'insights' && <InsightsTab playlistId={playlistId} />}
            {activeTab === 'discover' && <DiscoverTab playlistId={playlistId} canEdit={data.canEdit} />}
          </>
        )}
      </div>
    </main>
  );
}
