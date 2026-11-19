export class SpotifyApiError extends Error {
  constructor(
    readonly status: number,
    readonly responseBody: string,
  ) {
    super(`Spotify API error ${status}`);
    this.name = 'SpotifyApiError';
  }
}

