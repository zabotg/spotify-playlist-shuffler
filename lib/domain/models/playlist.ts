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

export interface PlaylistItem {
  track: Track;
  addedAt: string | null;
  addedById: string | null;
}

export interface PlaylistTracks {
  items: PlaylistItem[];
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

/** Extra details from Deezer, loaded in the background because Deezer is rate limited. */
export interface TrackDetails {
  bpm: number | null;
  /** Deezer rank: a popularity score where higher means more popular. */
  popularity: number | null;
}

export interface EnrichedTrack {
  track: Track;
  addedAt: string | null;
  addedBy: string | null;
  /** Audio features from ReccoBeats (same data Spotify used to expose). */
  features: AudioFeatures | null;
  /** Tempo from the audio features, or Deezer as a fallback. */
  bpm: number | null;
  popularity: number | null;
}

export interface EnrichedPlaylistTracks {
  tracks: EnrichedTrack[];
  skippedItemCount: number;
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

const EARLIEST_VALID_YEAR = 1900;

export function releaseYear(track: Pick<Track, 'releaseDate'>): number | null {
  const year = Number(track.releaseDate?.slice(0, 4));
  return year > EARLIEST_VALID_YEAR ? year : null;
}

/** Fills in audio features computed later (e.g. from the preview) for tracks that had none. */
export function withAnalyzedFeatures(
  tracks: readonly EnrichedTrack[],
  featuresById: Readonly<Record<string, AudioFeatures>>,
): EnrichedTrack[] {
  return tracks.map((item) => {
    const features = item.features ? undefined : featuresById[item.track.id];
    return features ? { ...item, features, bpm: item.bpm ?? features.tempo } : item;
  });
}
