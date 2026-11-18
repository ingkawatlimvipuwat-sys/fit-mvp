// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { LanguageProvider } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import TryOn from './TryOn';

const GARMENT = 'a8ba1fbb-3990-4a47-91cb-d61cf4d552fa';

function mount() {
  return render(
    <LanguageProvider>
      <TryOn garmentId={GARMENT} />
    </LanguageProvider>,
  );
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

describe('TryOn', () => {
  it('starts with camera and upload, and the generate button disabled', () => {
    mount();
    expect(screen.getByText(t.tryOnTitle.th)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.tryOnCamera.th })).toBeTruthy();
    expect(screen.getByRole('button', { name: t.tryOnUpload.th })).toBeTruthy();
    expect(screen.getByRole('button', { name: t.tryOnSubmit.th })).toHaveProperty('disabled', true);
    expect(screen.queryByText(t.tryOnUnavailable.th)).toBeNull();
  });

  it('enables generate after a photo is chosen', () => {
    mount();
    pickPhoto();
    expect(screen.getByAltText(t.tryOnYourPhoto.th)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.tryOnSubmit.th })).toHaveProperty('disabled', false);
  });

  it('shows the generated image returned by the server', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      imageUrl: 'https://cdn.openart.ai/out.png',
    })));
    mount();
    pickPhoto();
    fireEvent.click(screen.getByRole('button', { name: t.tryOnSubmit.th }));
    const img = await screen.findByAltText(t.tryOnPhotoAlt.th);
    expect(img.getAttribute('src')).toBe('https://cdn.openart.ai/out.png');
  });

  it('says the service is temporarily unavailable when credits are gone', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ code: 'unavailable' }, 503)));
    mount();
    pickPhoto();
    fireEvent.click(screen.getByRole('button', { name: t.tryOnSubmit.th }));
    expect(await screen.findByText(t.tryOnUnavailable.th)).toBeTruthy();
    expect(screen.queryByAltText(t.tryOnPhotoAlt.th)).toBeNull();
  });

  it('polls until the generation is ready', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ historyId: 'hist123456' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'pending' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'ready', imageUrl: 'https://cdn.openart.ai/out.png' }));
    vi.stubGlobal('fetch', fetchMock);
    mount();
    pickPhoto();
    fireEvent.click(screen.getByRole('button', { name: t.tryOnSubmit.th }));
    await act(() => vi.advanceTimersByTimeAsync(2000));
    await act(() => vi.advanceTimersByTimeAsync(2000));
    const img = screen.getByAltText(t.tryOnPhotoAlt.th);
    expect(img.getAttribute('src')).toBe('https://cdn.openart.ai/out.png');
    expect(String(fetchMock.mock.calls[1][0])).toContain('id=hist123456');
  });

  it('clears the result when the shopper tries another photo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      imageUrl: 'https://cdn.openart.ai/out.png',
    })));
    mount();
    pickPhoto();
    fireEvent.click(screen.getByRole('button', { name: t.tryOnSubmit.th }));
    expect(await screen.findByAltText(t.tryOnPhotoAlt.th)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t.tryOnAgain.th }));
    expect(screen.queryByAltText(t.tryOnPhotoAlt.th)).toBeNull();
    expect(screen.getByRole('button', { name: t.tryOnSubmit.th })).toHaveProperty('disabled', true);
  });
});
