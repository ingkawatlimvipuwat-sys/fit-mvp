// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import { emptyFabricForm } from '@/lib/garment/colour-fabric';
import FabricSection from './FabricSection';

// See FabricPanel.test.tsx: no vitest globals, so testing-library needs a manual cleanup.
afterEach(cleanup);

const mount = (props: { currentPhotoUrl?: string | null; removePhoto?: boolean; onRemovePhotoChange?: (v: boolean) => void }) =>
  render(
    <LanguageProvider>
      <FabricSection
        fabric={emptyFabricForm()}
        onChange={() => {}}
        currentPhotoUrl={props.currentPhotoUrl}
        removePhoto={props.removePhoto ?? false}
        onRemovePhotoChange={props.onRemovePhotoChange ?? (() => {})}
      />
    </LanguageProvider>,
  );

describe('FabricSection remove-photo checkbox', () => {
  it('is absent when the garment has no fabric photo', () => {
    mount({ currentPhotoUrl: null });
    expect(screen.queryByLabelText(t.removeFabricPhoto.th)).toBeNull();
  });

  it('appears with a current photo and reports ticks to the parent', () => {
    const onChange = vi.fn();
    mount({ currentPhotoUrl: 'https://x/p.jpg', onRemovePhotoChange: onChange });
    fireEvent.click(screen.getByLabelText(t.removeFabricPhoto.th));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('dims the thumbnail while ticked', () => {
    const { container } = mount({ currentPhotoUrl: 'https://x/p.jpg', removePhoto: true });
    expect(container.querySelector('img')?.className).toContain('opacity-40');
  });
});
