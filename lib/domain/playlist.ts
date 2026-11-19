export interface Artist {
  id: string;
  name: string;
}

export interface Track {
  id: string;
  uri: string;
  name: string;
  artists: Artist[];
  albumName: string;
  releaseDate: string | null;
  imageUrl: string | null;
  durationMs: number;
  explicit: boolean;
  isrc: string | null;
}

export interface PlaylistSummary {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  ownerId: string;
  ownerName: string | null;
  collaborative: boolean;
  trackCount: number;
}

export interface PlaylistTracks {
  tracks: Track[];
  skippedItemCount: number;
}

export interface AudioFeatures {
  id: string;
  tempo: number;
  energy: number;
  danceability: number;
  valence: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  speechiness: number;
  key: number;
  mode: number;
  loudness: number;
}

export interface EnrichedTrack {
  track: Track;
  features: AudioFeatures | null;
  bpm: number | null;
  previewUrl: string | null;
}

export interface SpotifyUser {
  id: string;
  displayName: string | null;
}

export interface PlaylistLink {
  playlistId: string;
  playlistUrl: string;
}

export function canEditPlaylist(playlist: PlaylistSummary, userId: string): boolean {
  return playlist.ownerId === userId || playlist.collaborative;
}

export function toPlaylistLink(playlistId: string): PlaylistLink {
  return { playlistId, playlistUrl: `https://open.spotify.com/playlist/${playlistId}` };
}

export function primaryArtistId(track: Track): string {
  return track.artists[0]?.id ?? 'unknown';
}
