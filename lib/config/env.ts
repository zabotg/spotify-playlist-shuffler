import { z } from 'zod';

const MIN_SESSION_SECRET_LENGTH = 32;

const envSchema = z.object({
  SPOTIFY_CLIENT_ID: z.string().min(1),
  SPOTIFY_CLIENT_SECRET: z.string().min(1),
  SPOTIFY_REDIRECT_URI: z.url(),
  SESSION_SECRET: z.string().min(MIN_SESSION_SECRET_LENGTH),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

export function getEnv(): Env {
  cachedEnv ??= envSchema.parse(process.env);
  return cachedEnv;
}
