'use client';

import {
  CircleAlert,
  CircleCheck,
  Dices,
  Disc3,
  Gauge,
  Info,
  Scale,
  Shuffle,
  Smile,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { ErrorAlert, SpotifyLinkAlert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Chip, ChipGroup } from '@/components/ui/chip';
import { playlistsApi } from '@/lib/api/playlists-api';
import type { EnrichedTrack } from '@/lib/domain/models/playlist';
import {
  ARTIST_GAP_LIMITS,
  DEFAULT_ENERGY_PROFILE,
  MODES_REQUIRING_AUDIO_FEATURES,
  SHUFFLE_MODES,
  type EnergyProfile,
  type MoodQuadrant,
  type ShuffleMode,
  type ShuffleOptions,
} from '@/lib/domain/models/shuffle';
import { shuffleAgain } from '@/lib/domain/engines/shuffle';
import { useAsyncAction } from '@/lib/hooks/use-async-action';
import { ENERGY_PROFILE_OPTIONS, MOOD_OPTIONS, SHUFFLE_MODE_DETAILS } from './labels';
import { SaveDestinationForm, type SaveDestination } from './save-destination';
import { DEFAULT_SORT, sortTracks, TrackTable, type TrackSort } from './track-table/track-table';

const DEFAULT_NEW_PLAYLIST_NAME = 'Shuffled Playlist';

const MODE_ICONS: Record<ShuffleMode, LucideIcon> = {
  pure_random: Dices,
  balanced: Scale,
  artist_aware: Users,
  bpm_smooth: Gauge,
  energy_curve: TrendingUp,
  mood_based: Smile,
  dj_mix: Disc3,
};

/** Modes that show extra controls in the settings panel. */
const MODES_WITH_SETTINGS: ReadonlySet<ShuffleMode> = new Set(['energy_curve', 'artist_aware', 'mood_based']);

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

const SETTING_LABEL_CLASSES = 'text-sm font-medium text-zinc-200';

interface ModeSettingsProps {
  settings: ShuffleSettings;
  onChange: (patch: Partial<ShuffleSettings>) => void;
}

function ModeSettings({ settings, onChange }: ModeSettingsProps) {
  if (settings.mode === 'energy_curve') {
    return (
      <div className="flex flex-col gap-2.5">
        <span className={SETTING_LABEL_CLASSES}>Energy shape</span>
        <ChipGroup
          options={ENERGY_PROFILE_OPTIONS}
          value={settings.energyProfile}
          onChange={(energyProfile) => onChange({ energyProfile })}
          ariaLabel="Energy shape"
        />
      </div>
    );
  }

  if (settings.mode === 'artist_aware') {
    return (
      <label className="flex w-full max-w-sm flex-col gap-2.5">
        <span className={`flex items-center justify-between gap-3 ${SETTING_LABEL_CLASSES}`}>
          Minimum tracks between the same artist
          <strong className="min-w-8 rounded-md bg-zinc-800 px-2 py-0.5 text-center text-white tabular-nums">
            {settings.artistMinGap}
          </strong>
        </span>
        <input
          type="range"
          min={ARTIST_GAP_LIMITS.min}
          max={ARTIST_GAP_LIMITS.max}
          value={settings.artistMinGap}
          onChange={(event) => onChange({ artistMinGap: Number(event.target.value) })}
          className="h-6 w-full accent-spotify"
        />
        <span aria-hidden className="flex justify-between text-xs text-zinc-500 tabular-nums">
          <span>{ARTIST_GAP_LIMITS.min}</span>
          <span>{ARTIST_GAP_LIMITS.max}</span>
        </span>
      </label>
    );
  }

  if (settings.mode === 'mood_based') {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-0.5">
          <span className={SETTING_LABEL_CLASSES}>Mood order</span>
          <span className="text-sm text-zinc-400">Select moods in the order they should play</span>
        </div>
        <div role="group" aria-label="Mood order" className="flex flex-wrap gap-2">
          {MOOD_OPTIONS.map(({ value, label }) => {
            const position = settings.moodSequence.indexOf(value);
            const isSelected = position >= 0;
            return (
              <Chip
                key={value}
                selected={isSelected}
                onClick={() => onChange({ moodSequence: toggleMood(settings.moodSequence, value) })}
              >
                <span
                  aria-hidden={!isSelected}
                  className={`-ml-1.5 flex h-5 w-5 items-center justify-center rounded-full text-xs tabular-nums ${
                    isSelected ? 'bg-zinc-950/20' : 'border border-dashed border-zinc-600'
                  }`}
                >
                  {isSelected && (
                    <>
                      {position + 1}
                      <span className="sr-only">.</span>
                    </>
                  )}
                </span>
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

function unavailableReason(mode: ShuffleMode, tracks: readonly EnrichedTrack[]): string | null {
  if (MODES_REQUIRING_AUDIO_FEATURES.has(mode) && !tracks.some((item) => item.features)) {
    return 'No audio data found for these tracks';
  }
  if (mode === 'bpm_smooth' && !tracks.some((item) => item.bpm)) return 'No BPM data found for these tracks';
  return null;
}

/** Explains a disabled preview button. Display only; `canPreview` decides. */
function previewBlockedReason(settings: ShuffleSettings, tracks: readonly EnrichedTrack[]): string | null {
  if (tracks.length === 0) return 'This playlist has no tracks';
  const reason = unavailableReason(settings.mode, tracks);
  if (reason) return reason;
  if (settings.mode === 'mood_based' && settings.moodSequence.length === 0) return 'Pick at least one mood';
  return null;
}

interface ModeCardProps {
  mode: ShuffleMode;
  isSelected: boolean;
  reason: string | null;
  onSelect: () => void;
}

function ModeCard({ mode, isSelected, reason, onSelect }: ModeCardProps) {
  const Icon = MODE_ICONS[mode];
  const { label, description } = SHUFFLE_MODE_DETAILS[mode];
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onSelect}
      className={`flex h-full items-start gap-3 rounded-xl border p-4 text-left transition-colors duration-150 ${
        isSelected
          ? 'border-spotify bg-spotify/10'
          : `bg-zinc-900/40 hover:border-zinc-600 hover:bg-zinc-900 ${reason ? 'border-dashed border-zinc-700' : 'border-zinc-800'}`
      }`}
    >
      <span
        aria-hidden
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ${
          isSelected ? 'bg-spotify text-zinc-950' : 'bg-zinc-800 text-zinc-300'
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-white">{label}</span>
          {isSelected && <CircleCheck aria-hidden className="h-4 w-4 shrink-0 text-spotify" />}
        </span>
        <span className="text-sm leading-snug text-zinc-400">{description}</span>
        {reason && (
          <span className="mt-1 flex items-start gap-1.5 text-sm text-amber-300">
            <CircleAlert aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {reason}
          </span>
        )}
      </span>
    </button>
  );
}

interface ShuffleTabProps {
  playlistId: string;
  tracks: EnrichedTrack[];
  canEdit: boolean;
}

export function ShuffleTab({ playlistId, tracks, canEdit }: ShuffleTabProps) {
  const [settings, setSettings] = useState<ShuffleSettings>(INITIAL_SETTINGS);
  const [sort, setSort] = useState<TrackSort>(DEFAULT_SORT);
  const [shuffled, setShuffled] = useState<EnrichedTrack[] | null>(null);
  const save = useAsyncAction((destination: SaveDestination, uris: string[]) =>
    destination.target === 'current'
      ? playlistsApi.replaceTracks(playlistId, uris)
      : playlistsApi.create(destination.name, uris),
  );
  const id = useId();

  const orderedTracks = useMemo(() => sortTracks(shuffled ?? [], sort), [shuffled, sort]);
  const canPreview =
    tracks.length > 0 &&
    !unavailableReason(settings.mode, tracks) &&
    (settings.mode !== 'mood_based' || settings.moodSequence.length > 0);
  const blockedReason = canPreview ? null : previewBlockedReason(settings, tracks);
  const SelectedIcon = MODE_ICONS[settings.mode];

  function updateSettings(patch: Partial<ShuffleSettings>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function selectMode(mode: ShuffleMode) {
    updateSettings({ mode });
    setShuffled(null);
    save.reset();
  }

  function generatePreview() {
    setSort(DEFAULT_SORT);
    save.reset();
    setShuffled((previous) => shuffleAgain(tracks, toShuffleOptions(settings), previous));
  }

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby={`${id}-modes`} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id={`${id}-modes`} className="text-lg font-semibold text-white">
            Shuffle mode
          </h2>
          <p className="text-sm text-zinc-400">Pick how the new order is built.</p>
        </div>
        <div role="group" aria-labelledby={`${id}-modes`} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {SHUFFLE_MODES.map((mode) => (
            <ModeCard
              key={mode}
              mode={mode}
              isSelected={settings.mode === mode}
              reason={unavailableReason(mode, tracks)}
              onSelect={() => selectMode(mode)}
            />
          ))}
        </div>
      </section>

      <section
        aria-label="Shuffle settings"
        className="flex flex-col gap-5 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between lg:gap-8"
      >
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center gap-2">
            <SelectedIcon aria-hidden className="h-4 w-4 text-spotify" />
            <span className="text-base font-semibold text-white">{SHUFFLE_MODE_DETAILS[settings.mode].label}</span>
          </div>
          {MODES_WITH_SETTINGS.has(settings.mode) ? (
            <ModeSettings settings={settings} onChange={updateSettings} />
          ) : (
            <p className="text-sm text-zinc-400">No extra settings for this mode.</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-start lg:items-end">
          <Button
            size="lg"
            disabled={!canPreview}
            aria-describedby={blockedReason ? `${id}-blocked` : undefined}
            onClick={generatePreview}
          >
            <Shuffle aria-hidden className="h-5 w-5" />
            {shuffled ? 'Shuffle again' : 'Preview shuffle'}
          </Button>
          {blockedReason && (
            <p id={`${id}-blocked`} className="flex items-center gap-1.5 text-sm text-amber-300">
              <CircleAlert aria-hidden className="h-3.5 w-3.5 shrink-0" />
              {blockedReason}
            </p>
          )}
        </div>
      </section>

      {orderedTracks.length > 0 && (
        <section aria-labelledby={`${id}-preview`} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id={`${id}-preview`} className="text-lg font-semibold text-white">
              Preview
            </h2>
            <p className="text-sm text-zinc-400">{orderedTracks.length} tracks · click a column header to sort</p>
          </div>
          <TrackTable tracks={orderedTracks} sort={sort} onSortChange={setSort} initialView="audio" />

          <SaveDestinationForm
            currentLabel="Overwrite this playlist"
            canSaveToCurrent={canEdit}
            defaultName={DEFAULT_NEW_PLAYLIST_NAME}
            submitLabel="Save order"
            isSaving={save.isLoading}
            onSave={(destination) => void save.run(destination, orderedTracks.map((item) => item.track.uri))}
          >
            {canEdit && (
              <p className="flex items-start gap-2 text-sm leading-relaxed text-zinc-400">
                <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Overwriting moves each track into its new place, so &quot;Date added&quot; is kept. Big playlists can
                  take a minute.
                </span>
              </p>
            )}
          </SaveDestinationForm>

          <ErrorAlert message={save.error} />
          {save.data && <SpotifyLinkAlert message="Saved!" url={save.data.playlistUrl} />}
        </section>
      )}
    </div>
  );
}
