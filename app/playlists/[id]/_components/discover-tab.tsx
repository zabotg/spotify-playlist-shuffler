'use client';

import { useState } from 'react';
import { ErrorAlert, SpotifyLinkAlert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover-image';
import { playlistsApi } from '@/lib/api/playlists-api';
import type { Track } from '@/lib/domain/models/playlist';
import { useAsyncAction } from '@/lib/hooks/use-async-action';
import { pluralize } from '@/lib/utils/format';
import { SaveDestinationForm, type SaveDestination } from './save-destination';

const RECOMMENDATION_COUNT = 20;
const DEFAULT_NEW_PLAYLIST_NAME = 'Discovered Tracks';

function toggleInSet(set: ReadonlySet<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

interface RecommendationRowProps {
  track: Track;
  isSelected: boolean;
  onToggle: () => void;
}

function RecommendationRow({ track, isSelected, onToggle }: RecommendationRowProps) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onToggle}
      className={`flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${
        isSelected ? 'border-spotify/30 bg-spotify/10' : 'border-transparent hover:bg-zinc-800'
      }`}
    >
      <CoverImage src={track.imageUrl} alt="" sizes="40px" className="h-10 w-10" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{track.name}</div>
        <div className="truncate text-xs text-zinc-400">
          {track.artists.map((artist) => artist.name).join(', ')} · {track.albumName}
        </div>
      </div>
      {isSelected && <span className="shrink-0 text-sm text-spotify">✓</span>}
    </button>
  );
}

interface DiscoverTabProps {
  playlistId: string;
  canEdit: boolean;
}

export function DiscoverTab({ playlistId, canEdit }: DiscoverTabProps) {
  const [selectedUris, setSelectedUris] = useState<ReadonlySet<string>>(new Set());
  const recommendations = useAsyncAction(playlistsApi.recommendations);
  const save = useAsyncAction((destination: SaveDestination, uris: string[]) =>
    destination.target === 'current'
      ? playlistsApi.addTracks(playlistId, uris)
      : playlistsApi.create(destination.name, uris),
  );

  function loadRecommendations() {
    setSelectedUris(new Set());
    save.reset();
    void recommendations.run(playlistId, RECOMMENDATION_COUNT);
  }

  const tracks = recommendations.data?.tracks;

  if (!tracks) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="max-w-sm text-sm text-zinc-400">Find new songs from artists similar to the ones in this playlist.</p>
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
          {selectedUris.size} of {tracks.length} selected
        </span>
        <Button variant="ghost" className="text-xs" disabled={recommendations.isLoading} onClick={loadRecommendations}>
          {recommendations.isLoading ? 'Searching…' : '↻ Refresh'}
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        {tracks.map((track) => (
          <RecommendationRow
            key={track.id}
            track={track}
            isSelected={selectedUris.has(track.uri)}
            onToggle={() => setSelectedUris((current) => toggleInSet(current, track.uri))}
          />
        ))}
      </div>

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
