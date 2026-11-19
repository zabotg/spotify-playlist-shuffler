export interface RawImage {
  url: string;
}

export interface RawArtist {
  id: string;
  name: string;
  genres?: string[];
}

export interface RawTrack {
  type: 'track';
  id: string;
  uri: string;
  name: string;
  artists: RawArtist[];
  album: { name: string; release_date?: string; images?: RawImage[] };
  duration_ms: number;
  explicit: boolean;
  is_local?: boolean;
  external_ids?: { isrc?: string };
}

export interface RawEpisode {
  type: 'episode';
}

export type RawPlaylistItem = RawTrack | RawEpisode | null;

export interface RawPlaylistEntry {
  item?: RawPlaylistItem;
  track?: RawPlaylistItem;
}

export interface RawPlaylist {
  id: string;
  name: string;
  description: string | null;
  images?: RawImage[] | null;
  owner: { id: string; display_name?: string | null };
  collaborative: boolean;
  items?: { total: number };
  tracks?: { total: number };
}

export interface RawUser {
  id: string;
  display_name: string | null;
}

export interface RawPage<T> {
  items: T[];
  total: number;
}
