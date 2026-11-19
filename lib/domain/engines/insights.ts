import {
  AUDIO_FEATURE_KEYS,
  type AudioFeatureKey,
  type PlaylistInsights,
} from '@/lib/domain/models/insights';
import { releaseYear, type AudioFeatures, type EnrichedTrack } from '@/lib/domain/models/playlist';
import { average, countBy, isDefined, sum, topEntries } from '@/lib/utils/array';
import { rankArtistsByTrackCount } from './artists';
import { classifyMoodQuadrant, deriveMoodLabel } from './mood';

const TOP_ARTIST_LIMIT = 10;
const TOP_GENRE_LIMIT = 5;

function toDecade(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}

function averageAudioFeatures(features: AudioFeatures[]): Record<AudioFeatureKey, number> | null {
  if (features.length === 0) return null;
  return Object.fromEntries(
    AUDIO_FEATURE_KEYS.map((key) => [key, sum(features.map((item) => item[key])) / features.length]),
  ) as Record<AudioFeatureKey, number>;
}

export function computeInsights(
  items: readonly EnrichedTrack[],
  skippedItemCount: number,
  artistGenres: readonly string[][],
): PlaylistInsights {
  const tracks = items.map((item) => item.track);
  const trackCount = tracks.length;

  // Ranked artists come from the tracks, so trackCount is never 0 here.
  const topArtists = rankArtistsByTrackCount(tracks, TOP_ARTIST_LIMIT).map((artist) => ({
    ...artist,
    share: artist.trackCount / trackCount,
  }));

  const years = tracks.map((track) => releaseYear(track)).filter(isDefined);
  const averageYear = average(years);

  const featureAverages = averageAudioFeatures(items.map((item) => item.features).filter(isDefined));
  const bpms = items.map((item) => item.bpm).filter(isDefined);

  return {
    trackCount,
    skippedItemCount,
    totalDurationMs: sum(tracks.map((track) => track.durationMs)),
    explicitRatio: trackCount > 0 ? tracks.filter((track) => track.explicit).length / trackCount : 0,
    uniqueArtistCount: new Set(tracks.flatMap((track) => track.artists.slice(0, 1).map((a) => a.id))).size,
    artistDiversityScore: 1 - (topArtists[0]?.share ?? 0),
    topArtists,
    decadeDistribution: Object.fromEntries(countBy(years, toDecade)),
    releaseYearDistribution: Object.fromEntries(countBy(years, String)),
    averageReleaseYear: averageYear === null ? null : Math.round(averageYear),
    averageBpm: average(bpms),
    audioFeatureAverages: featureAverages,
    mood: featureAverages && {
      quadrant: classifyMoodQuadrant(featureAverages.valence, featureAverages.energy),
      label: deriveMoodLabel(
        featureAverages.valence,
        featureAverages.energy,
        featureAverages.danceability,
        featureAverages.acousticness,
      ),
    },
    topGenres: topEntries(countBy(artistGenres.flat(), (genre) => genre), TOP_GENRE_LIMIT).map(
      ([genre]) => genre,
    ),
  };
}
