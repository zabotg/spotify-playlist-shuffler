import { z } from 'zod';
import { OVERWRITE_METHODS } from '@/lib/domain/models/playlist';

const MAX_PLAYLIST_TRACKS = 10_000;
const MAX_PLAYLIST_NAME_LENGTH = 100;
const DEFAULT_RECOMMENDATION_COUNT = 20;
const MAX_RECOMMENDATION_COUNT = 50;
export const MAX_DETAILS_ISRCS = 50;
export const MAX_ANALYSIS_TRACKS = 5;
export const MAX_METADATA_ITEMS = 10;
const MAX_REMOVALS = 500;
const MAX_DURATION_MS = 60 * 60 * 1000;
const MAX_GENRE_ARTISTS = 20;
const MAX_TEXT_LENGTH = 300;

/** Spotify IDs are base62. */
const spotifyIdSchema = z.string().regex(/^[A-Za-z0-9]{1,64}$/, 'Invalid Spotify ID');
export const playlistIdSchema = spotifyIdSchema;
const isrcSchema = z.string().regex(/^[A-Za-z0-9]{12}$/, 'Invalid ISRC');

const trackUriSchema = z.string().regex(/^spotify:track:[A-Za-z0-9]+$/, 'Invalid Spotify track URI');
const trackUrisSchema = z.array(trackUriSchema).min(1).max(MAX_PLAYLIST_TRACKS);

export const trackUrisRequestSchema = z.object({
  uris: trackUrisSchema,
  /** Where to insert the tracks; omitted means at the end. */
  position: z.number().int().min(0).max(MAX_PLAYLIST_TRACKS).optional(),
});

export const overwriteTracksRequestSchema = z.object({
  uris: trackUrisSchema,
  method: z.enum(OVERWRITE_METHODS).default('move'),
});

export const removeTracksRequestSchema = z.object({
  positions: z.array(z.number().int().min(0).max(MAX_PLAYLIST_TRACKS)).min(1).max(MAX_REMOVALS),
});

export const createPlaylistRequestSchema = z.object({
  name: z.string().trim().min(1).max(MAX_PLAYLIST_NAME_LENGTH),
  uris: trackUrisSchema,
});

export const recommendationsQuerySchema = z.object({
  count: z.coerce.number().int().min(1).max(MAX_RECOMMENDATION_COUNT).default(DEFAULT_RECOMMENDATION_COUNT),
});

export const trackDetailsRequestSchema = z.object({
  isrcs: z.array(isrcSchema).min(1).max(MAX_DETAILS_ISRCS),
});

export const previewQuerySchema = z.object({
  isrc: isrcSchema.optional(),
  title: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
  artist: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
});

export const artistGenresQuerySchema = z.object({
  ids: z
    .string()
    .transform((value) => value.split(',').filter(Boolean))
    .pipe(z.array(spotifyIdSchema).min(1).max(MAX_GENRE_ARTISTS)),
});

export const trackAnalysisRequestSchema = z.object({
  tracks: z
    .array(
      z.object({
        trackId: spotifyIdSchema,
        isrc: isrcSchema.nullable(),
        title: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
        artist: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
      }),
    )
    .min(1)
    .max(MAX_ANALYSIS_TRACKS),
});

export const bridgeQuerySchema = z.object({ from: spotifyIdSchema, to: spotifyIdSchema });

const musicBrainzIdSchema = z.uuid('Invalid MusicBrainz ID');

const lyricsTrackSchema = z.object({
  title: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
  artist: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
  album: z.string().trim().max(MAX_TEXT_LENGTH),
  durationMs: z.coerce.number().int().min(0).max(MAX_DURATION_MS),
});

export const metadataRequestSchema = z.object({
  isrcs: z.array(isrcSchema).min(1).max(MAX_METADATA_ITEMS),
});

export const originsRequestSchema = z.object({
  ids: z.array(musicBrainzIdSchema).min(1).max(MAX_METADATA_ITEMS),
});

export const lyricsSummaryRequestSchema = z.object({
  tracks: z.array(lyricsTrackSchema.extend({ trackId: spotifyIdSchema })).min(1).max(MAX_METADATA_ITEMS),
});

export const lyricsQuerySchema = lyricsTrackSchema;

export type CreatePlaylistRequest = z.infer<typeof createPlaylistRequestSchema>;
