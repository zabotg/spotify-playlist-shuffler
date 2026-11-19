import { describe, expect, it } from 'vitest';
import { byArtist } from '@/test/factories';
import { selectNewCandidates } from '@/lib/domain/engines/discovery';

describe('selectNewCandidates', () => {
  it('skips tracks already in the playlist and duplicate candidates', () => {
    const existing = byArtist('a');
    const fresh = byArtist('b');

    const result = selectNewCandidates([existing, fresh, fresh], {
      existingTrackIds: new Set([existing.id]),
      maxPerArtist: 2,
      limit: 10,
    });

    expect(result).toEqual([fresh]);
  });

  it('limits tracks per artist and the total count', () => {
    const candidates = [byArtist('a'), byArtist('a'), byArtist('a'), byArtist('b'), byArtist('c')];

    const result = selectNewCandidates(candidates, { existingTrackIds: new Set(), maxPerArtist: 2, limit: 3 });

    expect(result.map((track) => track.artists[0]?.id)).toEqual(['a', 'a', 'b']);
  });
});
