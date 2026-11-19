export class SpotifyApiError extends Error {
  constructor(
    readonly status: number,
    readonly responseBody: string,
  ) {
    super(`Spotify API error ${status}`);
    this.name = 'SpotifyApiError';
  }
}

const ACCESS_RESTRICTED_STATUSES = new Set([403, 404]);

export function isAccessRestricted(error: unknown): boolean {
  return error instanceof SpotifyApiError && ACCESS_RESTRICTED_STATUSES.has(error.status);
}
