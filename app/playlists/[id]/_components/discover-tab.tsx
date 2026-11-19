'use client';

import { RefreshCw } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { ErrorAlert, SpotifyLinkAlert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { playlistsApi } from '@/lib/api/playlists-api';
import { useAsyncAction } from '@/lib/hooks/use-async-action';
import { pluralize } from '@/lib/utils/format';
import { SaveDestinationForm, type SaveDestination } from './save-destination';
import { DEFAULT_SORT, sortTracks, TrackTable, type TrackSort } from './track-table/track-table';

const RECOMMENDATION_COUNT = 20;
const DEFAULT_NEW_PLAYLIST_NAME = 'Discovered Tracks';

function toggleInSet(set: ReadonlySet<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

interface DiscoverTabProps {
  playlistId: string;
  canEdit: boolean;
}

export function DiscoverTab({ playlistId, canEdit }: DiscoverTabProps) {
  const [selectedUris, setSelectedUris] = useState<ReadonlySet<string>>(new Set());
  const [sort, setSort] = useState<TrackSort>(DEFAULT_SORT);
  const recommendations = useAsyncAction(playlistsApi.recommendations);
  const save = useAsyncAction((destination: SaveDestination, uris: string[]) =>
    destination.target === 'current'
      ? playlistsApi.addTracks(playlistId, uris)
      : playlistsApi.create(destination.name, uris),
  );

  const toggleSelected = useCallback((uri: string) => setSelectedUris((current) => toggleInSet(current, uri)), []);
  const selection = useMemo(() => ({ selected: selectedUris, onToggle: toggleSelected }), [selectedUris, toggleSelected]);
  const tracks = recommendations.data?.tracks;
  const orderedTracks = useMemo(() => sortTracks(tracks ?? [], sort), [tracks, sort]);

  function loadRecommendations() {
    setSelectedUris(new Set());
    setSort(DEFAULT_SORT);
    save.reset();
    void recommendations.run(playlistId, RECOMMENDATION_COUNT);
  }

  if (!tracks) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="max-w-sm text-sm text-zinc-400">
          Find new songs that sound like this playlist. Listen to a preview and compare their tempo, key and mood
          before adding them.
        </p>
        <Button disabled={recommendations.isLoading} onClick={loadRecommendations}>
          {recommendations.isLoading ? 'Searching…' : 'Discover songs'}
        </Button>
        <ErrorAlert message={recommendations.error} />
      </div>
    );
  }

  if (tracks.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-400">No recommendations found.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">
          {selectedUris.size} of {tracks.length} selected · press play for a 30s preview
        </span>
        <Button variant="ghost" className="text-xs" disabled={recommendations.isLoading} onClick={loadRecommendations}>
          {recommendations.isLoading ? 'Searching…' : <>
            <RefreshCw aria-hidden className="mr-1 inline h-3.5 w-3.5" />
            Refresh
          </>}
        </Button>
      </div>

      <TrackTable tracks={orderedTracks} sort={sort} onSortChange={setSort} selection={selection} initialView="audio" />

      {selectedUris.size > 0 && (
        <SaveDestinationForm
          currentLabel="Add to this playlist"
          canSaveToCurrent={canEdit}
          defaultName={DEFAULT_NEW_PLAYLIST_NAME}
          submitLabel={`Add ${pluralize(selectedUris.size, 'song')}`}
          isSaving={save.isLoading}
          onSave={(destination) => void save.run(destination, [...selectedUris])}
        />
      )}

      <ErrorAlert message={save.error} />
      {save.data && <SpotifyLinkAlert message="Added!" url={save.data.playlistUrl} />}
    </div>
  );
}
