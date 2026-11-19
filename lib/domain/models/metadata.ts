/** Extra facts about a recording from MusicBrainz, the open music encyclopedia. */
export interface TrackMetadata {
  /** Year the song was first released, not the year of a remaster or compilation. */
  originalYear: number | null;
  /** Community tags such as genres or moods, most voted first. */
  tags: string[];
  /** People credited on the recording, e.g. producers and engineers. */
  credits: Credit[];
  /** MusicBrainz ID of the main artist, used to look up where they are from. */
  artistId: string | null;
}

export interface Credit {
  name: string;
  role: string;
}

export interface ArtistOrigin {
  /** Country name, e.g. "United Kingdom". */
  country: string | null;
}

/** Language and instrumental status from the lyrics of one track. */
export interface LyricsSummary {
  instrumental: boolean;
  language: string | null;
}

export interface Lyrics {
  instrumental: boolean;
  plainLyrics: string | null;
}
