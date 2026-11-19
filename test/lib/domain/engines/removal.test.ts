import { describe, expect, it } from 'vitest';
import { planRemoval } from '@/lib/domain/engines/removal';

describe('planRemoval', () => {
  it('removes unique tracks without re-adding anything', () => {
    expect(planRemoval(['a', 'b', 'c'], [1])).toEqual({ removeUris: ['b'], reinsert: [] });
  });

  it('puts back the copies of a duplicate that should stay', () => {
    expect(planRemoval(['a', 'b', 'a', 'c', 'a'], [2, 4])).toEqual({
      removeUris: ['a'],
      reinsert: [{ uri: 'a', position: 0 }],
    });
    expect(planRemoval(['x', 'a', 'b', 'a'], [1])).toEqual({ removeUris: ['a'], reinsert: [{ uri: 'a', position: 2 }] });
  });

  it('refuses positions that do not exist', () => {
    expect(planRemoval(['a'], [1])).toBeNull();
    expect(planRemoval(['a'], [-1])).toBeNull();
    expect(planRemoval(['a'], [0.5])).toBeNull();
  });
});
