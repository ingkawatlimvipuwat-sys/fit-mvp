// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import GarmentTabs from './GarmentTabs';
import type { GarmentFabric } from '@/lib/supabase/types';

function fabric(over: Partial<GarmentFabric> = {}): GarmentFabric {
  return {
    garment_id: 'g', finish: null, thickness: null, stretch: null, feel: null,
    composition: null, weight_gsm: null, construction: null, thread_count: null,
    pore_size_mm: null, notes: null, fabric_photo_url: null,
    updated_at: '2026-09-11T00:00:00Z', ...over,
  };
}

function mount(props: Partial<React.ComponentProps<typeof GarmentTabs>> = {}) {
  return render(
    <LanguageProvider>
      <GarmentTabs colours={[]} trueColourPhotoUrl={null} fabric={null} {...props}>
        <p>FIT PANEL</p>
      </GarmentTabs>
    </LanguageProvider>,
  );
}

// @testing-library/react's auto-cleanup only fires when it detects a global
// `afterEach` (see node_modules/@testing-library/react/dist/index.js). This
// project intentionally runs vitest without `test.globals: true` (see
// vitest.config.ts), so that global never exists and the DOM from one test
// leaks into the next within this file. Register cleanup explicitly instead
// of relying on the auto-detection.
afterEach(cleanup);

describe('GarmentTabs', () => {
  it('renders NO tab bar and just the children when there is no extra data', () => {
    mount();
    expect(screen.getByText('FIT PANEL')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByText(t.tabColour.th)).toBeNull();
  });

  it('shows a Colour tab but no Fabric tab when only colours exist', () => {
    mount({ colours: [{ hex: '#112233', name: 'navy' }] });
    expect(screen.getByRole('tablist')).toBeTruthy();
    expect(screen.getByText(t.tabColour.th)).toBeTruthy();
    expect(screen.queryByText(t.tabFabric.th)).toBeNull();
  });

  it('shows a Fabric tab but no Colour tab when only fabric exists', () => {
    mount({ fabric: fabric({ finish: 'matte' }) });
    expect(screen.getByText(t.tabFabric.th)).toBeTruthy();
    expect(screen.queryByText(t.tabColour.th)).toBeNull();
  });

  it('shows no Fabric tab for a fabric row that says nothing', () => {
    mount({ colours: [{ hex: '#112233', name: 'navy' }], fabric: fabric() });
    expect(screen.queryByText(t.tabFabric.th)).toBeNull();
  });

  it('defaults to the Fit tab', () => {
    mount({ colours: [{ hex: '#112233', name: 'navy' }] });
    expect(screen.getByText('FIT PANEL').closest('[hidden]')).toBeNull();
  });

  it('keeps the Fit panel MOUNTED but hidden when another tab is active', () => {
    // FitChecker holds the shopper's typed measurements. Unmounting it would
    // silently clear a half-filled form when they tap Colour and come back.
    const { getByText } = mount({ colours: [{ hex: '#112233', name: 'navy' }] });
    fireEvent.click(getByText(t.tabColour.th));
    const fit = getByText('FIT PANEL');
    expect(fit).toBeTruthy();
    expect(fit.closest('[hidden]')).not.toBeNull();
  });
});
