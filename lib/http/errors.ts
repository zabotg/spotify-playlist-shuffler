export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'EMPTY_PLAYLIST'
  | 'RATE_LIMITED'
  | 'SPOTIFY_ERROR'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  error: ErrorCode;
  message: string;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
