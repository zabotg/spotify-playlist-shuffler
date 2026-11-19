'use client';

import { ArrowRight, Copy, Shuffle, Sparkles, Split, TriangleAlert, Waves } from 'lucide-react';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ErrorAlert, SpotifyLinkAlert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { playlistsApi } from '@/lib/api/playlists-api';
import { toCamelot, formatCamelot } from '@/lib/domain/engines/camelot';
import { findDuplicates, findOutliers, type Outlier } from '@/lib/domain/engines/cleanup';
import { analyzeFlow, roughestTransitions, type FlowIssue, type Transition } from '@/lib/domain/engines/flow';
import { splitByMood } from '@/lib/domain/engines/split';
import type { EnrichedTrack } from '@/lib/domain/models/playlist';
import { useAsyncAction } from '@/lib/hooks/use-async-action';
import { pluralize } from '@/lib/utils/format';
import { MOOD_LABELS } from './labels';
import { DEFAULT_SORT, TrackTable, type TrackSort } from './track-table/track-table';

const ROUGH_TRANSITION_LIMIT = 5;
const OUTLIER_LIMIT = 10;

const FLOW_LABELS: { min: number; label: string }[] = [
  { min: 85, label: 'Seamless' },
  { min: 70, label: 'Smooth' },
  { min: 50, label: 'A bit bumpy' },
  { min: 0, label: 'Rough' },
];

function Card({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 text-spotify">{icon}</span>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-zinc-400">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function TrackLabel({ item, position }: { item: EnrichedTrack; position: number }) {
  return (
    <span className="min-w-0 truncate">
      <span className="text-zinc-500 tabular-nums">#{position + 1}</span>{' '}
      <span className="font-medium">{item.track.name}</span>{' '}
      <span className="text-zinc-400">· {item.track.artists.map((artist) => artist.name).join(', ')}</span>
    </span>
  );
}

function describeIssue(issue: FlowIssue, from: EnrichedTrack, to: EnrichedTrack): string {
  if (issue === 'tempo') return `Tempo ${Math.round(from.bpm ?? 0)} → ${Math.round(to.bpm ?? 0)} BPM`;
  if (issue === 'energy') {
    const change = (to.features?.energy ?? 0) - (from.features?.energy ?? 0);
    return change > 0 ? 'Energy jumps up' : 'Energy drops';
  }
  const fromKey = from.features && toCamelot(from.features.key, from.features.mode);
  const toKey = to.features && toCamelot(to.features.key, to.features.mode);
  return fromKey && toKey ? `Key clash ${formatCamelot(fromKey)} → ${formatCamelot(toKey)}` : 'Key clash';
}

interface EditProps {
  playlistId: string;
  canEdit: boolean;
  onChanged: () => void;
}

function BridgeFinder({ transition, tracks, playlistId, canEdit, onChanged }: EditProps & { transition: Transition; tracks: EnrichedTrack[] }) {
  const from = tracks[transition.index];
  const to = tracks[transition.index + 1];
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [sort, setSort] = useState<TrackSort>(DEFAULT_SORT);
  const suggestions = useAsyncAction(playlistsApi.bridge);
  const insert = useAsyncAction((uris: string[]) => playlistsApi.addTracks(playlistId, uris, transition.index + 1));
  const toggle = useCallback(
    (uri: string) =>
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(uri)) next.delete(uri);
        else next.add(uri);
        return next;
      }),
    [],
  );
  const selection = useMemo(() => ({ selected, onToggle: toggle }), [selected, toggle]);

  async function insertSelected() {
    if (await insert.run([...selected])) onChanged();
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-zinc-800 p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <TrackLabel item={from} position={transition.index} />
        <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-zinc-500" />
        <TrackLabel item={to} position={transition.index + 1} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {transition.issues.map((issue) => (
          <span key={issue} className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs text-amber-300">
            {describeIssue(issue, from, to)}
          </span>
        ))}
        {!suggestions.data && (
          <Button
            variant="ghost"
            className="ml-auto text-xs"
            disabled={suggestions.isLoading}
            onClick={() => void suggestions.run(playlistId, from.track.id, to.track.id)}
          >
            {suggestions.isLoading ? 'Searching…' : 'Find bridge songs'}
          </Button>
        )}
      </div>
      <ErrorAlert message={suggestions.error} />
      {suggestions.data && suggestions.data.tracks.length === 0 && (
        <p className="text-xs text-zinc-500">No new songs found to put between these two.</p>
      )}
      {suggestions.data && suggestions.data.tracks.length > 0 && (
        <div className="flex flex-col gap-3">
          <TrackTable
            tracks={suggestions.data.tracks}
            sort={sort}
            onSortChange={setSort}
            selection={canEdit ? selection : undefined}
            initialView="audio"
          />
          {canEdit && (
            <Button
              variant="secondary"
              className="self-start"
              disabled={selected.size === 0 || insert.isLoading}
              onClick={() => void insertSelected()}
            >
              {insert.isLoading ? 'Adding…' : `Insert ${pluralize(selected.size, 'song')} between them`}
            </Button>
          )}
          <ErrorAlert message={insert.error} />
        </div>
      )}
    </li>
  );
}

function FlowCard({ tracks, ...edit }: EditProps & { tracks: EnrichedTrack[] }) {
  const analysis = useMemo(() => analyzeFlow(tracks), [tracks]);
  const rough = useMemo(() => roughestTransitions(analysis, ROUGH_TRANSITION_LIMIT), [analysis]);
  const label = analysis.score === null ? null : FLOW_LABELS.find(({ min }) => (analysis.score as number) >= min)?.label;

  return (
    <Card
      icon={<Waves className="h-5 w-5" />}
      title="Flow"
      description="How smoothly each song leads into the next, based on tempo, key and energy."
    >
      {analysis.score === null ? (
        <p className="text-sm text-zinc-500">Not enough audio data to rate the flow yet.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold tabular-nums">{analysis.score}</span>
            <span className="text-sm text-zinc-400">/ 100 · {label}</span>
          </div>
          {rough.length === 0 ? (
            <p className="text-sm text-zinc-400">No rough transitions. Nice.</p>
          ) : (
            <>
              <p className="text-sm text-zinc-400">
                Roughest transitions. Insert a song that sounds like both, or try the{' '}
                <Shuffle aria-hidden className="inline h-3.5 w-3.5" /> DJ mix mode in the Shuffle tab.
              </p>
              <ul className="flex flex-col gap-2">
                {rough.map((transition) => (
                  <BridgeFinder key={transition.index} transition={transition} tracks={tracks} {...edit} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Card>
  );
}

function useRemoval({ playlistId, onChanged }: EditProps) {
  const removal = useAsyncAction((positions: number[]) => playlistsApi.removeTracks(playlistId, positions));
  async function remove(positions: number[], description: string) {
    if (!window.confirm(`Remove ${description} from the playlist in Spotify?`)) return;
    if (await removal.run(positions)) onChanged();
  }
  return { remove, isRemoving: removal.isLoading, error: removal.error };
}

function DuplicatesCard({ tracks, ...edit }: EditProps & { tracks: EnrichedTrack[] }) {
  const groups = useMemo(() => findDuplicates(tracks), [tracks]);
  const { remove, isRemoving, error } = useRemoval(edit);

  return (
    <Card
      icon={<Copy className="h-5 w-5" />}
      title="Duplicates"
      description="The same song more than once, including remasters and live versions."
    >
      {groups.length === 0 ? (
        <p className="text-sm text-zinc-400">No duplicates found.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map(({ positions }) => (
            <li key={positions.join()} className="flex flex-col gap-2 rounded-lg border border-zinc-800 p-3 text-sm">
              {positions.map((position) => (
                <TrackLabel key={position} item={tracks[position]} position={position} />
              ))}
              {edit.canEdit && (
                <Button
                  variant="ghost"
                  className="self-start text-xs"
                  disabled={isRemoving}
                  onClick={() => void remove(positions.slice(1), pluralize(positions.length - 1, 'extra copy', 'extra copies'))}
                >
                  Keep the first, remove the rest
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ErrorAlert message={error} />
    </Card>
  );
}

const OUTLIER_REASONS: Record<Outlier['reason'], string> = {
  'more energetic': 'Much more energetic',
  calmer: 'Much calmer',
  happier: 'Much happier',
  sadder: 'Much sadder',
  'more danceable': 'Much more danceable',
  'less danceable': 'Much less danceable',
  'more acoustic': 'Much more acoustic',
  'more electronic': 'Much more electronic',
  faster: 'Much faster',
  slower: 'Much slower',
};

function OutliersCard({ tracks, ...edit }: EditProps & { tracks: EnrichedTrack[] }) {
  const outliers = useMemo(() => findOutliers(tracks, OUTLIER_LIMIT), [tracks]);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const { remove, isRemoving, error } = useRemoval(edit);

  function toggle(position: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(position)) next.delete(position);
      else next.add(position);
      return next;
    });
  }

  return (
    <Card
      icon={<TriangleAlert className="h-5 w-5" />}
      title="Doesn't fit"
      description="Songs that sound very different from the rest of the playlist."
    >
      {outliers.length === 0 ? (
        <p className="text-sm text-zinc-400">Every song fits the playlist&apos;s sound.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-1">
            {outliers.map(({ position, reason }) => (
              <li key={position}>
                <label className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-zinc-900">
                  {edit.canEdit && (
                    <input
                      type="checkbox"
                      checked={selected.has(position)}
                      onChange={() => toggle(position)}
                      className="h-4 w-4 accent-spotify"
                    />
                  )}
                  <TrackLabel item={tracks[position]} position={position} />
                  <span className="ml-auto shrink-0 rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300">
                    {OUTLIER_REASONS[reason]}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {edit.canEdit && (
            <Button
              variant="ghost"
              className="self-start text-xs"
              disabled={selected.size === 0 || isRemoving}
              onClick={() => void remove([...selected], pluralize(selected.size, 'song'))}
            >
              Remove selected
            </Button>
          )}
        </>
      )}
      <ErrorAlert message={error} />
    </Card>
  );
}

function SplitCard({ tracks, playlistName }: { tracks: EnrichedTrack[]; playlistName: string }) {
  const groups = useMemo(() => splitByMood(tracks), [tracks]);
  const save = useAsyncAction((name: string, uris: string[]) => playlistsApi.create(name, uris));

  return (
    <Card
      icon={<Split className="h-5 w-5" />}
      title="Split by mood"
      description="Turn one big playlist into smaller ones you can pick by mood."
    >
      {groups.length === 0 ? (
        <p className="text-sm text-zinc-500">Not enough audio data to split by mood yet.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {groups.map(({ mood, tracks: moodTracks }) => (
            <li key={mood} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 p-3">
              <div>
                <div className="font-medium">{MOOD_LABELS[mood]}</div>
                <div className="text-xs text-zinc-500">{pluralize(moodTracks.length, 'track')}</div>
              </div>
              <Button
                variant="ghost"
                className="text-xs"
                disabled={save.isLoading}
                onClick={() => void save.run(`${playlistName} · ${MOOD_LABELS[mood]}`, moodTracks.map(({ track }) => track.uri))}
              >
                Save as playlist
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ErrorAlert message={save.error} />
      {save.data && <SpotifyLinkAlert message="Playlist created!" url={save.data.playlistUrl} />}
    </Card>
  );
}

interface ImproveTabProps extends EditProps {
  tracks: EnrichedTrack[];
  playlistName: string;
}

/** Suggestions to make the playlist better: smoother flow, no duplicates, no odd ones out. */
export function ImproveTab({ tracks, playlistName, ...edit }: ImproveTabProps) {
  return (
    <div className="flex flex-col gap-4">
      {!edit.canEdit && (
        <p className="flex items-center gap-2 text-sm text-zinc-400">
          <Sparkles aria-hidden className="h-4 w-4" /> You can&apos;t edit this playlist, so changes are read-only here.
        </p>
      )}
      <FlowCard tracks={tracks} {...edit} />
      <DuplicatesCard tracks={tracks} {...edit} />
      <OutliersCard tracks={tracks} {...edit} />
      <SplitCard tracks={tracks} playlistName={playlistName} />
    </div>
  );
}
