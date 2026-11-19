import { NextResponse, type NextRequest } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { SpotifyApiError } from '@/lib/clients/spotify/errors';
import { getSpotifyContext, type SpotifyContext } from '@/lib/services/spotify-context';
import { playlistIdSchema } from '@/lib/validation/schemas';
import { HttpError, type ApiErrorBody, type ErrorCode } from './errors';

/** Request bodies are small JSON documents; anything bigger is rejected before parsing. */
export const MAX_JSON_BODY_BYTES = 1024 * 1024;

export interface PlaylistRouteContext {
  params: Promise<{ id: string }>;
}

type ErrorMapping = [status: number, code: ErrorCode, message: string];

const SPOTIFY_ERROR_MAPPINGS: Record<number, ErrorMapping> = {
  401: [401, 'UNAUTHORIZED', 'Your Spotify session expired. Please sign in again.'],
  403: [403, 'FORBIDDEN', 'Spotify denied access to this resource.'],
  404: [404, 'NOT_FOUND', 'Resource not found on Spotify.'],
  429: [429, 'RATE_LIMITED', 'Spotify rate limit reached. Try again in a moment.'],
};
const DEFAULT_SPOTIFY_ERROR: ErrorMapping = [502, 'SPOTIFY_ERROR', 'Spotify request failed.'];

function errorResponse([status, code, message]: ErrorMapping): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: code, message }, { status });
}

/** Maps any error to a safe JSON response. Upstream bodies and stack traces never reach the client. */
export function toErrorResponse(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof HttpError) return errorResponse([error.status, error.code, error.message]);
  if (error instanceof ZodError) {
    return errorResponse([400, 'VALIDATION_ERROR', error.issues.map((issue) => issue.message).join('; ')]);
  }
  if (error instanceof SyntaxError) return errorResponse([400, 'VALIDATION_ERROR', 'Invalid JSON body.']);
  if (error instanceof SpotifyApiError) {
    return errorResponse(SPOTIFY_ERROR_MAPPINGS[error.status] ?? DEFAULT_SPOTIFY_ERROR);
  }

  console.error('[api] Unexpected error', error instanceof Error ? error.message : error);
  return errorResponse([500, 'INTERNAL_ERROR', 'Unexpected server error.']);
}

export function withErrorHandling<Context>(
  handler: (request: NextRequest, context: Context) => Promise<Response>,
) {
  return async (request: NextRequest, context: Context): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export interface AuthenticatedRequest extends SpotifyContext {
  request: NextRequest;
}

export interface PlaylistRequest extends AuthenticatedRequest {
  playlistId: string;
}

/** Controller for routes that need the signed-in user: answers 401 when signed out. */
export function withSpotify(handler: (input: AuthenticatedRequest) => Promise<Response>) {
  return withErrorHandling(async (request: NextRequest) => handler({ request, ...(await getSpotifyContext()) }));
}

/** Controller for `/api/playlists/:id/...` routes: requires a session, then validates the ID. */
export function withPlaylist(handler: (input: PlaylistRequest) => Promise<Response>) {
  return withErrorHandling(async (request: NextRequest, { params }: PlaylistRouteContext) => {
    const context = await getSpotifyContext();
    const playlistId = playlistIdSchema.parse((await params).id);
    return handler({ request, playlistId, ...context });
  });
}

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const declaredLength = Number(request.headers.get('content-length'));
  if (declaredLength > MAX_JSON_BODY_BYTES) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BODY_BYTES) {
    throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
  }
  return schema.parse(JSON.parse(text));
}

export function parseSearchParams<T>(request: NextRequest, schema: ZodType<T>): T {
  return schema.parse(Object.fromEntries(request.nextUrl.searchParams));
}
