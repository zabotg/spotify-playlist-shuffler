'use client';

import { useEffect, useMemo } from 'react';
import { HorizontalBarChart, RatioBar, StatCard } from '@/components/ui/charts';
import { artistsApi } from '@/lib/api/client';
import { AUDIO_FEATURE_KEYS, type PlaylistInsights } from '@/lib/domain/insights';
import type { EnrichedTrack } from '@/lib/domain/playlist';
import { rankArtistsByTrackCount } from '@/lib/engines/artists';
import { computeInsights } from '@/lib/engines/insights';
import { useAsyncAction } from '@/lib/hooks/use-async-action';
import { formatDuration, formatPercent } from '@/lib/utils/format';
import { AUDIO_FEATURE_DISPLAY } from './labels';

const MISSING = '—';
const GENRE_SAMPLE_ARTIST_LIMIT = 10;
const NO_GENRES: string[][] = [];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function sortedDistribution(distribution: Record<string, number>) {
  return Object.entries(distribution)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label, value }));
}

function InsightsReport({ insights }: { insights: PlaylistInsights }) {
  const stats = [
    { label: 'Tracks', value: insights.trackCount },
    { label: 'Unique artists', value: insights.uniqueArtistCount },
    { label: 'Total duration', value: formatDuration(insights.totalDurationMs) },
    { label: 'Artist diversity', value: formatPercent(insights.artistDiversityScore) },
    { label: 'Average year', value: insights.averageReleaseYear ?? MISSING },
    { label: 'Average BPM', value: insights.averageBpm ? Math.round(insights.averageBpm) : MISSING },
    { label: 'Explicit', value: formatPercent(insights.explicitRatio) },
    { label: 'Mood', value: insights.mood?.label ?? MISSING },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      {insights.skippedItemCount > 0 && (
        <p className="text-xs text-zinc-500">
          {insights.skippedItemCount} local files, episodes or unavailable items were not analyzed.
        </p>
      )}

      <Section title="Audio characteristics">
        {insights.audioFeatureAverages ? (
          <div className="flex flex-col gap-2">
            {AUDIO_FEATURE_KEYS.map((key) => (
              <RatioBar
                key={key}
                label={AUDIO_FEATURE_DISPLAY[key].label}
                color={AUDIO_FEATURE_DISPLAY[key].color}
                ratio={insights.audioFeatureAverages?.[key] ?? 0}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500 italic">No audio data found for these tracks.</p>
        )}
      </Section>

      <Section title="By decade">
        <HorizontalBarChart data={sortedDistribution(insights.decadeDistribution)} />
      </Section>

      <Section title="Top artists">
        <HorizontalBarChart
          data={insights.topArtists.map((artist) => ({ label: artist.name, value: artist.trackCount }))}
        />
      </Section>

      {insights.topGenres.length > 0 && (
        <Section title="Top genres">
          <div className="flex flex-wrap gap-2">
            {insights.topGenres.map((genre) => (
              <span key={genre} className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
                {genre}
              </span>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

interface InsightsTabProps {
  tracks: EnrichedTrack[];
  skippedItemCount: number;
}

export function InsightsTab({ tracks, skippedItemCount }: InsightsTabProps) {
  const genres = useAsyncAction(artistsApi.genres);
  const sampleArtistIds = useMemo(
    () => rankArtistsByTrackCount(tracks.map((item) => item.track), GENRE_SAMPLE_ARTIST_LIMIT).map((artist) => artist.id),
    [tracks],
  );
  const sampleKey = sampleArtistIds.join(',');

  const runGenres = genres.run;
  useEffect(() => {
    if (sampleKey) void runGenres(sampleKey.split(','));
  }, [runGenres, sampleKey]);

  const artistGenres = genres.data?.genres ?? NO_GENRES;
  const insights = useMemo(
    () => (tracks.length > 0 ? computeInsights(tracks, skippedItemCount, artistGenres) : null),
    [tracks, skippedItemCount, artistGenres],
  );

  if (!insights) {
    return <p className="py-8 text-center text-sm text-zinc-400">This playlist has no tracks to analyze.</p>;
  }
  return <InsightsReport insights={insights} />;
}
