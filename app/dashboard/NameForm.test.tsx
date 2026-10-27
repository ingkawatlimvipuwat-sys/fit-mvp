// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import NameForm from './NameForm';

afterEach(cleanup);
const mount = (p: { initial?: string; onSubmit?: (n: string) => Promise<string | null>; onCancel?: () => void }) =>
  render(
    <LanguageProvider>
      <NameForm label="ชื่อโฟลเดอร์" initial={p.initial} maxLength={60} submitText="สร้าง"
        onSubmit={p.onSubmit ?? vi.fn(async () => null)} onCancel={p.onCancel ?? vi.fn()} />
    </LanguageProvider>,
  );
const box = () => screen.getByLabelText('ชื่อโฟลเดอร์') as HTMLInputElement;
const submitButton = () => screen.getByRole('button', { name: 'สร้าง' }) as HTMLButtonElement;

describe('NameForm', () => {
  it('starts focused with the current name, which is selected for retyping', () => {
    mount({ initial: 'Shirts' });
    expect(document.activeElement).toBe(box());
    expect(box().value).toBe('Shirts');
    expect([box().selectionStart, box().selectionEnd]).toEqual([0, 6]);
  });
  it('cannot submit a blank name', () => {
    const onSubmit = vi.fn(async () => null);
    mount({ onSubmit });
    fireEvent.change(box(), { target: { value: '   ' } });
    expect(submitButton().disabled).toBe(true);
    fireEvent.submit(box().closest('form') as HTMLFormElement);
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('Enter submits the trimmed name', () => {
    const onSubmit = vi.fn(async () => null);
    mount({ onSubmit });
    fireEvent.change(box(), { target: { value: '  Linen ' } });
    fireEvent.submit(box().closest('form') as HTMLFormElement);
    expect(onSubmit).toHaveBeenCalledWith('Linen');
  });
  it('an unchanged name just closes, without a request', () => {
    const onSubmit = vi.fn(async () => null);
    const onCancel = vi.fn();
    mount({ initial: 'Shirts', onSubmit, onCancel });
    fireEvent.submit(box().closest('form') as HTMLFormElement);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });
  it("shows the server's error and stays open with the text", async () => {
    mount({ onSubmit: vi.fn(async () => t.invalidFolderName.th) });
    fireEvent.change(box(), { target: { value: 'x' } });
    fireEvent.submit(box().closest('form') as HTMLFormElement);
    expect((await screen.findByRole('alert')).textContent).toBe(t.invalidFolderName.th);
    expect(box().value).toBe('x');
  });
  it('Escape and Cancel both cancel', () => {
    const onCancel = vi.fn();
    mount({ onCancel });
    fireEvent.keyDown(box(), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: t.cancel.th }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
