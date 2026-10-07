import { describe, it, expect } from 'vitest';
import { summariseProducts } from './summary';
import { dimensionsForCategory } from '@/lib/config/dimensions';

const full = Object.fromEntries(dimensionsForCategory('top').map(d => [d.key, 50]));
const prod = (id: string, created_at: string, name = id) => ({ id, name, created_at });
const g = (id: string, product_id: string, created_at: string, over: Record<string, unknown> = {}) => ({
  id, product_id, created_at, category: 'top' as const, measurements: full, picks: { s: 'L' },
  photo_url: `photo-${id}`, ...over,
});

describe('summariseProducts', () => {
  const pickers = [{ id: 's', product_id: 'P1', name: 'Size', position: 0 }];

  it('counts versions, borrows the first-added version photo, keeps product order', () => {
    const out = summariseProducts(
      [prod('P1', '2026-02-01'), prod('P2', '2026-01-01')],
      pickers,
      [g('b', 'P1', '2026-01-02'), g('a', 'P1', '2026-01-01'), g('c', 'P2', '2026-01-01', { picks: {} })],
    );
    expect(out.map(p => p.id)).toEqual(['P1', 'P2']);
    expect(out[0]).toMatchObject({ versionCount: 2, photo_url: 'photo-a', needsAttention: false });
  });
  it('flags a product with no versions', () => {
    const [p] = summariseProducts([prod('P1', '2026-02-01')], pickers, []);
    expect(p).toMatchObject({ versionCount: 0, photo_url: null, needsAttention: true });
  });
  it('flags a version missing a pick', () => {
    const [p] = summariseProducts([prod('P1', '2026-02-01')], pickers, [g('a', 'P1', '2026-01-01', { picks: {} })]);
    expect(p.needsAttention).toBe(true);
  });
  it('ignores pickers of other products', () => {
    const [p] = summariseProducts([prod('P2', '2026-02-01')], pickers, [g('a', 'P2', '2026-01-01', { picks: {} })]);
    expect(p.needsAttention).toBe(false);
  });
});
