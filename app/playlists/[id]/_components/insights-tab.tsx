'use client';

import { ErrorAlert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { HorizontalBarChart, RatioBar, StatCard } from '@/components/ui/charts';
import { playlistsApi } from '@/lib/api/client';
import { AUDIO_FEATURE_KEYS, type PlaylistInsights } from '@/lib/domain/insights';
import { useAsyncAction } from '@/lib/hooks/use-async-action';
import { formatDuration, formatPercent } from '@/lib/utils/format';
import { AUDIO_FEATURE_DISPLAY } from './labels';

const MISSING = '—';

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
          <p className="text-xs text-zinc-500 italic">Requires Spotify extended API access.</p>
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

export function InsightsTab({ playlistId }: { playlistId: string }) {
  const { data, error, isLoading, run } = useAsyncAction(playlistsApi.insights);

  if (data) {
    return data.insights ? (
      <InsightsReport insights={data.insights} />
    ) : (
      <p className="py-8 text-center text-sm text-zinc-400">This playlist has no tracks to analyze.</p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="max-w-sm text-sm text-zinc-400">
        Analyze the artists, release decades and audio characteristics of this playlist.
      </p>
      <Button disabled={isLoading} onClick={() => void run(playlistId)}>
        {isLoading ? 'Analyzing…' : 'Analyze playlist'}
      </Button>
      <ErrorAlert message={error} />
    </div>
  );
}
