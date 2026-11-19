import { describe, expect, it } from 'vitest';
import { byArtist, enrich, makeFeatures, seededRandom } from '@/test/factories';
import { buildSoundProfile } from '@/lib/domain/engines/similarity';
import {
  pickRepresentativeTracks,
  rankBridgeCandidates,
  rankCandidates,
  selectNewCandidates,
} from '@/lib/domain/engines/discovery';

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

describe('rankCandidates', () => {
  const profile = buildSoundProfile([makeFeatures({ energy: 0.4 }), makeFeatures({ energy: 0.6 })]);

  it('orders by closeness, prefers related artists and drops what does not fit', () => {
    const close = { track: byArtist('close'), features: makeFeatures({ energy: 0.5 }), fromRelatedArtist: false };
    const relatedFar = { track: byArtist('rel'), features: makeFeatures({ energy: 0.6 }), fromRelatedArtist: true };
    const far = { track: byArtist('far'), features: makeFeatures({ energy: 1, valence: 1, tempo: 220 }), fromRelatedArtist: false };
    const relatedUnknown = { track: byArtist('unk'), features: null, fromRelatedArtist: true };
    const unknown = { track: byArtist('none'), features: null, fromRelatedArtist: false };

    const ranked = rankCandidates([far, unknown, relatedUnknown, close, relatedFar], profile, () => 0);
    expect(ranked).toEqual([relatedFar, close, relatedUnknown]);
  });

  it('keeps everything when the playlist has no audio data', () => {
    const unknown = { track: byArtist('none'), features: null, fromRelatedArtist: false };
    expect(rankCandidates([unknown], null)).toEqual([unknown]);
  });
});

describe('pickRepresentativeTracks', () => {
  it('picks among the tracks closest to the average sound', () => {
    const typical = byArtist('typical');
    const odd = byArtist('odd');
    const noData = byArtist('none');
    const features = new Map([
      [typical.id, makeFeatures({ energy: 0.5 })],
      [odd.id, makeFeatures({ energy: 1 })],
    ]);
    const profile = buildSoundProfile([...features.values()]);
    expect(pickRepresentativeTracks([odd, typical, noData], features, profile, 1, seededRandom())).toEqual([typical]);
  });

  it('picks random tracks without audio data', () => {
    const tracks = [byArtist('a'), byArtist('b'), byArtist('c')];
    expect(pickRepresentativeTracks(tracks, new Map(), null, 2)).toHaveLength(2);
  });
});

describe('rankBridgeCandidates', () => {
  const at = (bpm: number, energy: number, key = 0) =>
    enrich(byArtist(`${bpm}`), { bpm, features: makeFeatures({ tempo: bpm, energy, key, mode: 1 }) });

  it('prefers songs that lead smoothly from the first track into the second', () => {
    const from = at(100, 0.3);
    const to = at(140, 0.8, 2);
    const middle = at(120, 0.55, 7);
    const far = at(200, 0.05, 6);
    const unknown = enrich(byArtist('none'));
    expect(rankBridgeCandidates(from, to, [far, unknown, middle])).toEqual([middle, unknown, far]);
  });
});
