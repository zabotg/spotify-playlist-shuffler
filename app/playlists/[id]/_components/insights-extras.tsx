'use client';

import { Gem, Globe2, Library, Loader2, MicVocal } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { HorizontalBarChart, StatCard } from '@/components/ui/charts';
import { Button } from '@/components/ui/button';
import { artistsApi } from '@/lib/api/artists-api';
import { tracksApi, type LyricsRequest } from '@/lib/api/tracks-api';
import { findHiddenGems } from '@/lib/domain/engines/gems';
import { summarizeMetadata } from '@/lib/domain/engines/metadata-insights';
import type { EnrichedTrack } from '@/lib/domain/models/playlist';
import { useBatchedLoader, type BatchProgress } from '@/lib/hooks/use-batched-loader';
import { countBy, isDefined, topEntries } from '@/lib/utils/array';
import { formatCompactNumber, formatPercent } from '@/lib/utils/format';

const HIDDEN_GEM_LIMIT = 5;
/** Must match MAX_METADATA_ITEMS in the API validation. */
const METADATA_BATCH = 10;
const TOP_ORIGIN_ARTISTS = 10;
/** MusicBrainz answers about one request per second. */
const SECONDS_PER_METADATA_LOOKUP = 1.1;
const TOP_LANGUAGES = 8;

const loadMetadata = async (isrcs: string[]) => (await tracksApi.metadata(isrcs)).metadata;
const loadOrigins = async (ids: string[]) => (await artistsApi.origins(ids)).origins;
const loadLyrics = async (batch: (LyricsRequest & { trackId: string })[]) =>
  (await tracksApi.lyricsSummary(batch)).summaries;

const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });

function Panel({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
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

function ProgressLine({ progress, label }: { progress: BatchProgress; label: string }) {
  if (!progress.isLoading) return null;
  return (
    <p className="flex items-center gap-2 text-sm text-zinc-400">
      <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
      {label} ({progress.loaded}/{progress.total})
    </p>
  );
}

function TagList({ items }: { items: { label: string; count: number }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ label, count }) => (
        <span key={label} className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300">
          {label} <span className="text-zinc-500">· {count}</span>
        </span>
      ))}
    </div>
  );
}

export function HiddenGems({ tracks }: { tracks: EnrichedTrack[] }) {
  const gems = useMemo(() => findHiddenGems(tracks, HIDDEN_GEM_LIMIT), [tracks]);
  if (gems.length === 0) return null;
  return (
    <Panel
      icon={<Gem className="h-5 w-5" />}
      title="Hidden gems"
      description="The least known songs in this playlist, by Deezer popularity."
    >
      <ol className="flex flex-col gap-1.5">
        {gems.map(({ track, popularity }) => (
          <li key={track.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              <span className="font-medium">{track.name}</span>{' '}
              <span className="text-zinc-400">· {track.artists.map((artist) => artist.name).join(', ')}</span>
            </span>
            <span className="shrink-0 text-xs text-zinc-500 tabular-nums">{formatCompactNumber(popularity as number)}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function sortedBars(distribution: Record<string, number>) {
  return Object.entries(distribution)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label, value }));
}

/** Real release years, community tags, credits and artist origins from MusicBrainz. */
export function DeepInsights({ tracks }: { tracks: EnrichedTrack[] }) {
  const [enabled, setEnabled] = useState(false);
  const isrcs = useMemo(() => [...new Set(tracks.map(({ track }) => track.isrc).filter(isDefined))], [tracks]);
  const metadata = useBatchedLoader(isrcs, METADATA_BATCH, loadMetadata, enabled);

  const entries = useMemo(() => Object.values(metadata.results), [metadata.results]);
  const summary = useMemo(() => summarizeMetadata(entries), [entries]);
  const topArtistIds = useMemo(
    () =>
      metadata.progress.isLoading
        ? []
        : topEntries(countBy(entries.map((entry) => entry.artistId).filter(isDefined), (id) => id), TOP_ORIGIN_ARTISTS).map(
            ([id]) => id,
          ),
    [entries, metadata.progress.isLoading],
  );
  const origins = useBatchedLoader(topArtistIds, METADATA_BATCH, loadOrigins, enabled);
  const countries = useMemo(() => {
    const names = Object.values(origins.results).map((origin) => origin.country).filter(isDefined);
    return topEntries(countBy(names, (name) => name), TOP_ORIGIN_ARTISTS).map(([label, value]) => ({ label, value }));
  }, [origins.results]);

  const minutes = Math.max(1, Math.round((isrcs.length * SECONDS_PER_METADATA_LOOKUP) / 60));

  return (
    <Panel
      icon={<Library className="h-5 w-5" />}
      title="Go deeper"
      description="Original release years (not remaster dates), community tags, credits and where the main artists are from. Data from MusicBrainz."
    >
      {!enabled ? (
        <Button variant="secondary" className="self-start" disabled={isrcs.length === 0} onClick={() => setEnabled(true)}>
          Load details · about {minutes} min
        </Button>
      ) : (
        <>
          <ProgressLine progress={metadata.progress} label="Looking up tracks on MusicBrainz" />
          <ProgressLine progress={origins.progress} label="Looking up artists" />
          {entries.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-medium text-zinc-300">Decades (original release)</h4>
                <HorizontalBarChart data={sortedBars(summary.originalDecadeDistribution)} />
              </div>
              {countries.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h4 className="flex items-center gap-1.5 text-sm font-medium text-zinc-300">
                    <Globe2 aria-hidden className="h-4 w-4" /> Where the main artists are from
                  </h4>
                  <HorizontalBarChart data={countries} />
                </div>
              )}
              {summary.topTags.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-medium text-zinc-300">Community tags</h4>
                  <TagList items={summary.topTags.map(({ tag, tracks: count }) => ({ label: tag, count }))} />
                </div>
              )}
              {summary.topCredits.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-medium text-zinc-300">Behind the songs</h4>
                  <TagList
                    items={summary.topCredits.map(({ name, role, tracks: count }) => ({ label: `${name} (${role})`, count }))}
                  />
                </div>
              )}
            </div>
          )}
          {!metadata.progress.isLoading && entries.length === 0 && (
            <p className="text-sm text-zinc-500">MusicBrainz doesn&apos;t have these tracks.</p>
          )}
        </>
      )}
    </Panel>
  );
}

/** Languages sung in the playlist and how much of it is instrumental, from LRCLIB lyrics. */
export function LyricsInsights({ tracks }: { tracks: EnrichedTrack[] }) {
  const [enabled, setEnabled] = useState(false);
  const requests = useMemo(
    () =>
      tracks.map(({ track }) => ({
        trackId: track.id,
        title: track.name,
        artist: track.artists[0]?.name ?? '',
        album: track.albumName,
        durationMs: track.durationMs,
      })),
    [tracks],
  );
  const lyrics = useBatchedLoader(requests, METADATA_BATCH, loadLyrics, enabled);

  const summaries = Object.values(lyrics.results);
  const instrumental = summaries.filter((summary) => summary.instrumental).length;
  const languages = topEntries(
    countBy(summaries.map((summary) => summary.language).filter(isDefined), (code) => code),
    TOP_LANGUAGES,
  ).map(([code, value]) => ({ label: languageNames.of(code) as string, value }));

  return (
    <Panel
      icon={<MicVocal className="h-5 w-5" />}
      title="Lyrics"
      description="Which languages are sung in this playlist and how much of it is instrumental. Lyrics from LRCLIB."
    >
      {!enabled ? (
        <Button variant="secondary" className="self-start" onClick={() => setEnabled(true)}>
          Analyze lyrics
        </Button>
      ) : (
        <>
          <ProgressLine progress={lyrics.progress} label="Reading lyrics" />
          {summaries.length > 0 && (
            <div className="grid gap-6 md:grid-cols-[200px_1fr]">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
                <StatCard label="Tracks with lyrics found" value={`${summaries.length} / ${tracks.length}`} />
                <StatCard label="Instrumental" value={formatPercent(instrumental / summaries.length)} />
              </div>
              {languages.length > 0 && <HorizontalBarChart data={languages} />}
            </div>
          )}
          {!lyrics.progress.isLoading && summaries.length === 0 && (
            <p className="text-sm text-zinc-500">No lyrics found for these tracks.</p>
          )}
        </>
      )}
    </Panel>
  );
}
