'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { ErrorAlert } from '@/components/ui/alert';
import { CoverImage } from '@/components/ui/cover-image';
import { playlistsApi } from '@/lib/api/client';
import { useAsyncAction } from '@/lib/hooks/use-async-action';
import { pluralize } from '@/lib/utils/format';

const GRID_CLASSES = 'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4';

export function PlaylistGrid() {
  const { data, error, isLoading, run } = useAsyncAction(playlistsApi.list);

  useEffect(() => {
    void run();
  }, [run]);

  if (error) return <ErrorAlert message={error} />;
  if (isLoading || !data) return <p className="text-sm text-zinc-500">Loading playlists…</p>;
  if (data.playlists.length === 0) return <p className="text-sm text-zinc-500">No editable playlists found.</p>;

  return (
    <div className={GRID_CLASSES}>
      {data.playlists.map((playlist) => (
        <Link
          key={playlist.id}
          href={`/playlists/${playlist.id}`}
          className="flex flex-col gap-2 rounded-lg bg-zinc-900 p-3 transition-colors hover:bg-zinc-800"
        >
          <CoverImage
            src={playlist.imageUrl}
            alt={playlist.name}
            sizes="(min-width: 768px) 25vw, 50vw"
            className="aspect-square w-full text-3xl"
          />
          <span className="line-clamp-2 text-sm leading-tight font-medium">{playlist.name}</span>
          <span className="text-xs text-zinc-500">{pluralize(playlist.trackCount, 'track')}</span>
        </Link>
      ))}
    </div>
  );
}
