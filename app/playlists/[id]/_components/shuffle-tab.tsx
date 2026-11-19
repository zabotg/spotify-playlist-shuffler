'use client';

import { useMemo, useState } from 'react';
import { ErrorAlert, SpotifyLinkAlert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Chip, ChipGroup } from '@/components/ui/chip';
import { playlistsApi } from '@/lib/api/client';
import {
  ARTIST_GAP_LIMITS,
  DEFAULT_ENERGY_PROFILE,
  MODES_REQUIRING_AUDIO_FEATURES,
  SHUFFLE_MODES,
  type EnergyProfile,
  type MoodQuadrant,
  type ShuffleMode,
  type ShuffleOptions,
} from '@/lib/domain/shuffle';
import { useAsyncAction } from '@/lib/hooks/use-async-action';
import { ENERGY_PROFILE_OPTIONS, MOOD_OPTIONS, SHUFFLE_MODE_DETAILS } from './labels';
import { SaveDestinationForm, type SaveDestination } from './save-destination';
import { DEFAULT_SORT, sortTracks, TrackTable, type SortState } from './track-table';

const DEFAULT_NEW_PLAYLIST_NAME = 'Shuffled Playlist';

interface ShuffleSettings {
  mode: ShuffleMode;
  energyProfile: EnergyProfile;
  artistMinGap: number;
  moodSequence: MoodQuadrant[];
}

const INITIAL_SETTINGS: ShuffleSettings = {
  mode: 'balanced',
  energyProfile: DEFAULT_ENERGY_PROFILE,
  artistMinGap: ARTIST_GAP_LIMITS.default,
  moodSequence: ['Joyful', 'Intense'],
};

function toShuffleOptions({ mode, energyProfile, artistMinGap, moodSequence }: ShuffleSettings): ShuffleOptions {
  if (mode === 'energy_curve') return { mode, energyProfile };
  if (mode === 'artist_aware') return { mode, artistMinGap };
  if (mode === 'mood_based') return { mode, moodSequence };
  return { mode };
}

function toggleMood(sequence: MoodQuadrant[], mood: MoodQuadrant): MoodQuadrant[] {
  return sequence.includes(mood) ? sequence.filter((item) => item !== mood) : [...sequence, mood];
}

interface ModeSettingsProps {
  settings: ShuffleSettings;
  onChange: (patch: Partial<ShuffleSettings>) => void;
}

function ModeSettings({ settings, onChange }: ModeSettingsProps) {
  if (settings.mode === 'energy_curve') {
    return (
      <ChipGroup
        options={ENERGY_PROFILE_OPTIONS}
        value={settings.energyProfile}
        onChange={(energyProfile) => onChange({ energyProfile })}
      />
    );
  }

  if (settings.mode === 'artist_aware') {
    return (
      <label className="flex flex-col gap-1 text-xs text-zinc-400">
        Minimum tracks between the same artist: <strong className="text-white">{settings.artistMinGap}</strong>
        <input
          type="range"
          min={ARTIST_GAP_LIMITS.min}
          max={ARTIST_GAP_LIMITS.max}
          value={settings.artistMinGap}
          onChange={(event) => onChange({ artistMinGap: Number(event.target.value) })}
          className="w-48 accent-spotify"
        />
      </label>
    );
  }

  if (settings.mode === 'mood_based') {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-xs text-zinc-400">Select moods in the order they should play</span>
        <div className="flex flex-wrap gap-2">
          {MOOD_OPTIONS.map(({ value, label }) => {
            const position = settings.moodSequence.indexOf(value);
            return (
              <Chip
                key={value}
                selected={position >= 0}
                onClick={() => onChange({ moodSequence: toggleMood(settings.moodSequence, value) })}
              >
                {position >= 0 && <span className="mr-1">{position + 1}.</span>}
                {label}
              </Chip>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

interface ShuffleTabProps {
  playlistId: string;
  canEdit: boolean;
}

export function ShuffleTab({ playlistId, canEdit }: ShuffleTabProps) {
  const [settings, setSettings] = useState<ShuffleSettings>(INITIAL_SETTINGS);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const preview = useAsyncAction(playlistsApi.shuffle);
  const save = useAsyncAction((destination: SaveDestination, uris: string[]) =>
    destination.target === 'current'
      ? playlistsApi.replaceTracks(playlistId, uris)
      : playlistsApi.create(destination.name, uris),
  );

  const previewData = preview.data;
  const orderedTracks = useMemo(() => sortTracks(previewData?.tracks ?? [], sort), [previewData, sort]);
  const canPreview = settings.mode !== 'mood_based' || settings.moodSequence.length > 0;

  function updateSettings(patch: Partial<ShuffleSettings>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function selectMode(mode: ShuffleMode) {
    updateSettings({ mode });
    preview.reset();
    save.reset();
  }

  function generatePreview() {
    setSort(DEFAULT_SORT);
    save.reset();
    void preview.run(playlistId, toShuffleOptions(settings));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SHUFFLE_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={settings.mode === mode}
            onClick={() => selectMode(mode)}
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
              settings.mode === mode ? 'border-spotify bg-spotify/10' : 'border-zinc-700 hover:border-zinc-500'
            }`}
          >
            <div className="text-xs font-semibold">{SHUFFLE_MODE_DETAILS[mode].label}</div>
            <div className="mt-0.5 text-xs text-zinc-500">{SHUFFLE_MODE_DETAILS[mode].description}</div>
            {MODES_REQUIRING_AUDIO_FEATURES.has(mode) && (
              <div className="mt-1 text-[10px] text-zinc-600">Needs Spotify audio features access</div>
            )}
          </button>
        ))}
      </div>

      <ModeSettings settings={settings} onChange={updateSettings} />

      <Button className="self-start" disabled={preview.isLoading || !canPreview} onClick={generatePreview}>
        {preview.isLoading ? 'Shuffling…' : 'Preview shuffle'}
      </Button>

      <ErrorAlert message={preview.error} />

      {orderedTracks.length > 0 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-zinc-300">
            {orderedTracks.length} tracks · click a column header to sort
          </h3>
          <TrackTable tracks={orderedTracks} sort={sort} onSortChange={setSort} />

          <SaveDestinationForm
            currentLabel="Overwrite this playlist"
            canSaveToCurrent={canEdit}
            defaultName={DEFAULT_NEW_PLAYLIST_NAME}
            submitLabel="Save order"
            isSaving={save.isLoading}
            onSave={(destination) => void save.run(destination, orderedTracks.map((item) => item.track.uri))}
          />

          <ErrorAlert message={save.error} />
          {save.data && <SpotifyLinkAlert message="Saved!" url={save.data.playlistUrl} />}
        </div>
      )}
    </div>
  );
}
