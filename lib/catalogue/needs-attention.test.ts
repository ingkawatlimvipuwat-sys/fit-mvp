import { describe, it, expect } from 'vitest';
import { attentionReasons } from './needs-attention';
import { dimensionsForCategory } from '@/lib/config/dimensions';

const full = Object.fromEntries(dimensionsForCategory('top').map(d => [d.key, 50]));
const ver = (over: Record<string, unknown> = {}) =>
  ({ category: 'top' as const, measurements: full, picks: { size: 'L' }, ...over });

describe('attentionReasons (§5.5)', () => {
  it('flags a product with no versions', () => {
    expect(attentionReasons([], ['size'])).toEqual(['no_versions']);
  });
  it('is clean for a complete version', () => {
    expect(attentionReasons([ver()], ['size'])).toEqual([]);
  });
  it('flags a missing measurement for the garment type', () => {
    const rest = { ...full };
    delete rest[Object.keys(full)[0]];
    expect(attentionReasons([ver({ measurements: rest })], ['size'])).toEqual(['missing_measurement']);
  });
  it('flags a missing pick', () => {
    expect(attentionReasons([ver({ picks: {} })], ['size'])).toEqual(['missing_pick']);
  });
  it('reports each reason once', () => {
    const r = attentionReasons([ver({ picks: {}, measurements: {} }), ver({ picks: {} })], ['size']);
    expect([...r].sort()).toEqual(['missing_measurement', 'missing_pick']);
  });
});
