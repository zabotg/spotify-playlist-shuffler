'use client';

import { ListMusic, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { ErrorAlert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover-image';
import { Skeleton } from '@/components/ui/skeleton';
import { playlistsApi } from '@/lib/api/playlists-api';
import { useAsyncAction } from '@/lib/hooks/use-async-action';
import { pluralize } from '@/lib/utils/format';

const GRID_CLASSES = 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5';
const COVER_SIZES = '(min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw';
const SKELETON_CARD_COUNT = 10;
/** Covers in the first row of the widest layout load eagerly; one of them is the page's LCP. */
const EAGER_COVER_COUNT = 5;
const CARD_CLASSES = 'flex flex-col gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3';

function PlaylistGridSkeleton() {
  return (
    <div role="status" aria-busy className={GRID_CLASSES}>
      <span className="sr-only">Loading playlists</span>
      {Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => (
        <div key={index} className={CARD_CLASSES}>
          <Skeleton className="aspect-square w-full" />
          <div className="flex flex-col gap-2 pb-0.5">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3.5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PlaylistGrid() {
  const { data, error, isLoading, run } = useAsyncAction(playlistsApi.list);

  useEffect(() => {
    void run();
  }, [run]);

  if (error) {
    return (
      <div className="flex flex-col items-start gap-3">
        <ErrorAlert message={error} />
        <Button variant="outline" onClick={() => void run()}>
          <RefreshCw aria-hidden className="h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }
  if (isLoading || !data) return <PlaylistGridSkeleton />;
  if (data.playlists.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 px-6 py-14 text-center">
        <ListMusic aria-hidden className="h-8 w-8 text-zinc-500" />
        <p className="text-base font-medium text-zinc-200">No editable playlists found.</p>
        <p className="max-w-sm text-sm text-zinc-400">Create a playlist in Spotify, then reload this page.</p>
      </div>
    );
  }

  return (
    <ul className={GRID_CLASSES}>
      {data.playlists.map((playlist, index) => (
        <li key={playlist.id} className="min-w-0">
          <Link
            href={`/playlists/${playlist.id}`}
            className={`group h-full transition-colors duration-150 hover:border-zinc-700 hover:bg-zinc-900 ${CARD_CLASSES}`}
          >
            <CoverImage
              src={playlist.imageUrl}
              alt=""
              sizes={COVER_SIZES}
              loading={index < EAGER_COVER_COUNT ? 'eager' : 'lazy'}
              className="aspect-square w-full shadow-md shadow-black/30 transition-opacity duration-150 group-hover:opacity-90"
            />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="line-clamp-2 text-sm leading-snug font-semibold text-zinc-100 group-hover:text-white">
                {playlist.name}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-zinc-400">
                <ListMusic aria-hidden className="h-3.5 w-3.5 shrink-0" />
                {pluralize(playlist.trackCount, 'track')}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
