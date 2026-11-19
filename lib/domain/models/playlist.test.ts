import { describe, expect, it } from 'vitest';
import { makeTrack } from '@/test/factories';
import { canEditPlaylist, primaryArtistId, releaseYear, toPlaylistLink } from './playlist';

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
