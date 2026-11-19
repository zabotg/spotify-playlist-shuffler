import { z } from 'zod';

const MAX_PLAYLIST_TRACKS = 10_000;
const MAX_PLAYLIST_NAME_LENGTH = 100;
const DEFAULT_RECOMMENDATION_COUNT = 20;
const MAX_RECOMMENDATION_COUNT = 50;
export const MAX_DETAILS_ISRCS = 50;
const MAX_GENRE_ARTISTS = 20;
const MAX_TEXT_LENGTH = 300;

const trackUriSchema = z.string().regex(/^spotify:track:[A-Za-z0-9]+$/, 'Invalid Spotify track URI');
const trackUrisSchema = z.array(trackUriSchema).min(1).max(MAX_PLAYLIST_TRACKS);

export const trackUrisRequestSchema = z.object({ uris: trackUrisSchema });

export const createPlaylistRequestSchema = z.object({
  name: z.string().trim().min(1).max(MAX_PLAYLIST_NAME_LENGTH),
  uris: trackUrisSchema,
});

export const recommendationsQuerySchema = z.object({
  count: z.coerce.number().int().min(1).max(MAX_RECOMMENDATION_COUNT).default(DEFAULT_RECOMMENDATION_COUNT),
});

export const trackDetailsRequestSchema = z.object({
  isrcs: z.array(z.string().regex(/^[A-Za-z0-9]{12}$/, 'Invalid ISRC')).min(1).max(MAX_DETAILS_ISRCS),
});

const spotifyIdSchema = z.string().regex(/^[A-Za-z0-9]{1,64}$/, 'Invalid Spotify ID');

export const previewQuerySchema = z.object({
  trackId: spotifyIdSchema,
  isrc: z.string().regex(/^[A-Za-z0-9]{12}$/).optional(),
  title: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
  artist: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
});

export const artistGenresQuerySchema = z.object({
  ids: z
    .string()
    .transform((value) => value.split(',').filter(Boolean))
    .pipe(z.array(spotifyIdSchema).min(1).max(MAX_GENRE_ARTISTS)),
});

export type CreatePlaylistRequest = z.infer<typeof createPlaylistRequestSchema>;
