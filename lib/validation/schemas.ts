import { z } from 'zod';
import { ARTIST_GAP_LIMITS, ENERGY_PROFILES, MOOD_QUADRANTS, SHUFFLE_MODES } from '@/lib/domain/shuffle';

const MAX_PLAYLIST_TRACKS = 10_000;
const MAX_PLAYLIST_NAME_LENGTH = 100;
const DEFAULT_RECOMMENDATION_COUNT = 20;
const MAX_RECOMMENDATION_COUNT = 50;

const trackUriSchema = z.string().regex(/^spotify:track:[A-Za-z0-9]+$/, 'Invalid Spotify track URI');
const trackUrisSchema = z.array(trackUriSchema).min(1).max(MAX_PLAYLIST_TRACKS);

export const shuffleRequestSchema = z.object({
  mode: z.enum(SHUFFLE_MODES),
  energyProfile: z.enum(ENERGY_PROFILES).optional(),
  moodSequence: z.array(z.enum(MOOD_QUADRANTS)).min(1).max(MOOD_QUADRANTS.length).optional(),
  artistMinGap: z.number().int().min(ARTIST_GAP_LIMITS.min).max(ARTIST_GAP_LIMITS.max).optional(),
});

export const trackUrisRequestSchema = z.object({ uris: trackUrisSchema });

export const createPlaylistRequestSchema = z.object({
  name: z.string().trim().min(1).max(MAX_PLAYLIST_NAME_LENGTH),
  uris: trackUrisSchema,
});

export const recommendationsQuerySchema = z.object({
  count: z.coerce.number().int().min(1).max(MAX_RECOMMENDATION_COUNT).default(DEFAULT_RECOMMENDATION_COUNT),
});

export type ShuffleRequest = z.infer<typeof shuffleRequestSchema>;
export type CreatePlaylistRequest = z.infer<typeof createPlaylistRequestSchema>;
