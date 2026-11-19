import { describe, expect, it } from 'vitest';
import { enrich, makeFeatures, makeTrack } from '@/test/factories';
import {
  canEditPlaylist,
  primaryArtistId,
  releaseYear,
  toPlaylistLink,
  withAnalyzedFeatures,
} from '@/lib/domain/models/playlist';

describe('playlist model helpers', () => {
  it('lets owners and collaborators edit', () => {
    const playlist = { ownerId: 'me', collaborative: false } as Parameters<typeof canEditPlaylist>[0];
    expect(canEditPlaylist(playlist, 'me')).toBe(true);
    expect(canEditPlaylist(playlist, 'you')).toBe(false);
    expect(canEditPlaylist({ ...playlist, collaborative: true }, 'you')).toBe(true);
  });

  it('builds the Spotify link', () => {
    expect(toPlaylistLink('p1').playlistUrl).toBe('https://open.spotify.com/playlist/p1');
  });

  it('uses a placeholder when a track has no artist', () => {
    expect(primaryArtistId(makeTrack({ artists: [{ id: 'x', name: 'X' }] }))).toBe('x');
    expect(primaryArtistId(makeTrack({ artists: [] }))).toBe('unknown');
  });

  it('reads valid release years only', () => {
    expect(releaseYear({ releaseDate: '1999-05-01' })).toBe(1999);
    expect(releaseYear({ releaseDate: '0000' })).toBeNull();
    expect(releaseYear({ releaseDate: null })).toBeNull();
  });
});

describe('withAnalyzedFeatures', () => {
  it('fills features and BPM only for tracks that had no audio data', () => {
    const known = enrich(makeTrack(), { features: makeFeatures({ tempo: 90 }), bpm: 90 });
    const withDeezerBpm = enrich(makeTrack(), { bpm: 101 });
    const bare = enrich(makeTrack());
    const analyzed = makeFeatures({ tempo: 140 });
    const result = withAnalyzedFeatures([known, withDeezerBpm, bare], {
      [known.track.id]: analyzed,
      [withDeezerBpm.track.id]: analyzed,
      [bare.track.id]: analyzed,
    });
    expect(result[0]).toBe(known);
    expect(result[1]).toMatchObject({ features: analyzed, bpm: 101 });
    expect(result[2]).toMatchObject({ features: analyzed, bpm: 140 });
    expect(withAnalyzedFeatures([bare], {})[0]).toBe(bare);
  });
});
