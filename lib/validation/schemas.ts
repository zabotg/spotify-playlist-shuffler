/**
 * Zod v4 schemas for all API inputs.
 * Every external input (request body, query params) is validated here.
 */

import { z } from 'zod';

export const ShuffleModeSchema = z.enum([
  'pure_random',
  'balanced',
  'artist_aware',
  'bpm_smooth',
  'energy_curve',
  'mood_based',
  'popularity_based',
  'discovery',
]);

export const EnergyProfileSchema = z.enum([
  'ascending',
  'descending',
  'mountain',
  'valley',
  'wave',
]);

export const PopularityModeSchema = z.enum(['mainstream', 'underground', 'hybrid']);

export const MoodQuadrantSchema = z.enum(['Joyful', 'Intense', 'Melancholic', 'Calm']);

export const ShuffleRequestSchema = z.object({
  mode: ShuffleModeSchema,
  preview: z.boolean().default(true),
  energyProfile: EnergyProfileSchema.optional(),
  popularityMode: PopularityModeSchema.optional(),
  moodSequence: z.array(MoodQuadrantSchema).min(1).max(4).optional(),
  artistMinGap: z.number().int().min(1).max(10).optional(),
});

export const ApplyRequestSchema = z.object({
  // Ordered list of Spotify track URIs (spotify:track:xxx)
  uris: z.array(z.string().startsWith('spotify:track:')).min(1).max(10_000),
  target: z.enum(['overwrite', 'new']),
  newName: z.string().min(1).max(100).optional(),
  playlistId: z.string().min(1).optional(),
});

export const DiscoverAddSchema = z.object({
  trackUris: z.array(z.string().startsWith('spotify:track:')).min(1).max(50),
  target: z.enum(['existing', 'new']),
  playlistId: z.string().optional(),
  newName: z.string().min(1).max(100).optional(),
});

export const DiscoverQuerySchema = z.object({
  count: z.coerce.number().int().min(1).max(50).default(20),
});

export type ShuffleRequest = z.infer<typeof ShuffleRequestSchema>;
export type ApplyRequest = z.infer<typeof ApplyRequestSchema>;
export type DiscoverAddRequest = z.infer<typeof DiscoverAddSchema>;
