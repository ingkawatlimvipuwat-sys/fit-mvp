// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { LanguageProvider } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import TryOn, { TRYON_FAKE_DELAY_MS, TRYON_RESULT_SRC } from './TryOn';

function mount() {
  return render(
    <LanguageProvider>
      <TryOn />
    </LanguageProvider>,
  );
}

function galleryInput(): HTMLInputElement {
  const el = document.querySelector('input[type="file"]:not([capture])');
  if (!(el instanceof HTMLInputElement)) throw new Error('gallery input missing');
  return el;
}

function pickPhoto() {
  const file = new File(['fake-bytes'], 'me.png', { type: 'image/png' });
  fireEvent.change(galleryInput(), { target: { files: [file] } });
}

// See GarmentTabs.test.tsx: vitest runs without globals, so auto-cleanup never arms.
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('TryOn', () => {
  it('starts with camera and upload, and the generate button disabled', () => {
    mount();
    expect(screen.getByText(t.tryOnTitle.th)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.tryOnCamera.th })).toBeTruthy();
    expect(screen.getByRole('button', { name: t.tryOnUpload.th })).toBeTruthy();
    expect(screen.getByRole('button', { name: t.tryOnSubmit.th })).toHaveProperty('disabled', true);
    expect(screen.queryByAltText(t.tryOnPhotoAlt.th)).toBeNull();
  });

  it('enables generate after a photo is chosen', () => {
    mount();
    pickPhoto();
    expect(screen.getByAltText(t.tryOnYourPhoto.th)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.tryOnSubmit.th })).toHaveProperty('disabled', false);
  });

  it('shows the hardcoded result image after generate', async () => {
    vi.useFakeTimers();
    mount();
    pickPhoto();
    fireEvent.click(screen.getByRole('button', { name: t.tryOnSubmit.th }));
    await act(() => vi.advanceTimersByTimeAsync(TRYON_FAKE_DELAY_MS));
    const img = screen.getByAltText(t.tryOnPhotoAlt.th);
    expect(img.getAttribute('src')).toBe(TRYON_RESULT_SRC);
  });

  it('clears the result when the shopper tries another photo', async () => {
    vi.useFakeTimers();
    mount();
    pickPhoto();
    fireEvent.click(screen.getByRole('button', { name: t.tryOnSubmit.th }));
    await act(() => vi.advanceTimersByTimeAsync(TRYON_FAKE_DELAY_MS));
    fireEvent.click(screen.getByRole('button', { name: t.tryOnAgain.th }));
    expect(screen.queryByAltText(t.tryOnPhotoAlt.th)).toBeNull();
    expect(screen.getByRole('button', { name: t.tryOnSubmit.th })).toHaveProperty('disabled', true);
  });
});
