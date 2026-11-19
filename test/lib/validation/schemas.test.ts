import { describe, expect, it } from 'vitest';
import {
  artistGenresQuerySchema,
  createPlaylistRequestSchema,
  playlistIdSchema,
  previewQuerySchema,
  recommendationsQuerySchema,
  trackDetailsRequestSchema,
  trackUrisRequestSchema,
} from '@/lib/validation/schemas';

describe('validation schemas', () => {
  it('accepts base62 playlist IDs only', () => {
    expect(playlistIdSchema.parse('37i9dQZF1DXcBWIGoYBM5M')).toBe('37i9dQZF1DXcBWIGoYBM5M');
    for (const bad of ['', '../me', 'abc-def', 'a'.repeat(65), 'id?x=1']) {
      expect(playlistIdSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('accepts Spotify track URIs only', () => {
    expect(trackUrisRequestSchema.parse({ uris: ['spotify:track:abc123'] }).uris).toHaveLength(1);
    expect(trackUrisRequestSchema.safeParse({ uris: [] }).success).toBe(false);
    expect(trackUrisRequestSchema.safeParse({ uris: ['spotify:episode:abc'] }).success).toBe(false);
    expect(trackUrisRequestSchema.safeParse({ uris: ['https://evil.com'] }).success).toBe(false);
  });

  it('trims playlist names and limits their length', () => {
    const uris = ['spotify:track:abc'];
    expect(createPlaylistRequestSchema.parse({ name: '  Mix  ', uris }).name).toBe('Mix');
    expect(createPlaylistRequestSchema.safeParse({ name: '   ', uris }).success).toBe(false);
    expect(createPlaylistRequestSchema.safeParse({ name: 'x'.repeat(101), uris }).success).toBe(false);
  });

  it('defaults and bounds the recommendation count', () => {
    expect(recommendationsQuerySchema.parse({}).count).toBe(20);
    expect(recommendationsQuerySchema.parse({ count: '5' }).count).toBe(5);
    expect(recommendationsQuerySchema.safeParse({ count: '500' }).success).toBe(false);
  });

  it('validates ISRC batches', () => {
    expect(trackDetailsRequestSchema.parse({ isrcs: ['GBAHS1600463'] }).isrcs).toEqual(['GBAHS1600463']);
    expect(trackDetailsRequestSchema.safeParse({ isrcs: ['bad'] }).success).toBe(false);
    expect(trackDetailsRequestSchema.safeParse({ isrcs: Array(51).fill('GBAHS1600463') }).success).toBe(false);
  });

  it('validates preview queries', () => {
    expect(previewQuerySchema.parse({ title: ' Song ', artist: 'Band' })).toEqual({ title: 'Song', artist: 'Band' });
    expect(previewQuerySchema.safeParse({ title: 'x', artist: 'y', isrc: 'bad' }).success).toBe(false);
    expect(previewQuerySchema.safeParse({ title: 'x'.repeat(301), artist: 'y' }).success).toBe(false);
  });

  it('splits and validates artist IDs', () => {
    expect(artistGenresQuerySchema.parse({ ids: 'a,b,,c' }).ids).toEqual(['a', 'b', 'c']);
    expect(artistGenresQuerySchema.safeParse({ ids: '' }).success).toBe(false);
    expect(artistGenresQuerySchema.safeParse({ ids: 'a,b-c' }).success).toBe(false);
    expect(artistGenresQuerySchema.safeParse({ ids: Array(21).fill('a').join(',') }).success).toBe(false);
  });
});
