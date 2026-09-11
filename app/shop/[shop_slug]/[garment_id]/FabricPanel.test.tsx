// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LanguageProvider } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import FabricPanel from './FabricPanel';
import type { GarmentFabric } from '@/lib/supabase/types';

function fabric(over: Partial<GarmentFabric> = {}): GarmentFabric {
  return {
    garment_id: 'g', finish: null, thickness: null, stretch: null, feel: null,
    composition: null, weight_gsm: null, construction: null, thread_count: null,
    pore_size_mm: null, notes: null, fabric_photo_url: null,
    updated_at: '2026-09-11T00:00:00Z', ...over,
  };
}

const mount = (f: GarmentFabric) =>
  render(<LanguageProvider><FabricPanel fabric={f} /></LanguageProvider>);

// See the comment in GarmentTabs.test.tsx: this project runs vitest without
// `test.globals: true`, so @testing-library/react's auto-cleanup (which
// depends on a global `afterEach`) never fires on its own.
afterEach(cleanup);

describe('FabricPanel', () => {
  it('renders only the chips that are set', () => {
    mount(fabric({ finish: 'matte', feel: 'soft' }));
    expect(screen.getByText(t.finishMatte.th)).toBeTruthy();
    expect(screen.getByText(t.feelSoft.th)).toBeTruthy();
    expect(screen.queryByText(t.thicknessThin.th)).toBeNull();
    expect(screen.queryByText(t.stretchHigh.th)).toBeNull();
  });

  it('hides the technical details entirely when every technical field is null', () => {
    mount(fabric({ finish: 'matte' }));
    expect(screen.queryByText(t.fabricTechnicalDetails.th)).toBeNull();
  });

  it('shows only technical rows that have a value, collapsed by default', () => {
    mount(fabric({ composition: 'cotton 100%', weight_gsm: 180 }));
    const details = screen.getByText(t.fabricTechnicalDetails.th).closest('details');
    expect(details?.hasAttribute('open')).toBe(false);
    expect(screen.getByText('cotton 100%')).toBeTruthy();
    expect(screen.getByText('180')).toBeTruthy();
    expect(screen.queryByText(t.threadCount.th)).toBeNull();
  });

  it('renders the close-up photo when present', () => {
    const { container } = mount(fabric({ fabric_photo_url: 'https://example.test/f.jpg' }));
    expect(container.querySelector('img')).not.toBeNull();
  });
});
