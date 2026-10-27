// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import PickerValueOrder from './PickerValueOrder';

afterEach(cleanup);
const mount = (values: string[], onSave: (o: string[]) => Promise<string | null>) =>
  render(<LanguageProvider><PickerValueOrder values={values} onSave={onSave} /></LanguageProvider>);
const items = () => screen.getAllByRole('listitem').map(li => li.textContent?.replace(/[↑↓]/g, '').trim());

describe('PickerValueOrder', () => {
  it('shows nothing for fewer than two values', () => {
    const { container } = mount(['S'], vi.fn());
    expect(container.textContent).toBe('');
  });
  it('shows the order as one line until Reorder is pressed', () => {
    mount(['S', 'M', 'L'], vi.fn());
    expect(screen.getByText(/S · M · L/)).toBeTruthy();
    expect(screen.queryByRole('listitem')).toBeNull();
    fireEvent.click(screen.getByText(t.reorderValues.th));
    expect(items()).toEqual(['S', 'M', 'L']);
  });
  it('the first ↑ and the last ↓ are disabled', () => {
    mount(['S', 'M', 'L'], vi.fn());
    fireEvent.click(screen.getByText(t.reorderValues.th));
    expect((screen.getByLabelText(t.moveValueUp.th.replace('{value}', 'S')) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText(t.moveValueDown.th.replace('{value}', 'L')) as HTMLButtonElement).disabled).toBe(true);
  });
  it('a click shows the new order at once and saves the whole list', async () => {
    const onSave = vi.fn(async () => null);
    mount(['S', 'M', 'L'], onSave);
    fireEvent.click(screen.getByText(t.reorderValues.th));
    fireEvent.click(screen.getByLabelText(t.moveValueUp.th.replace('{value}', 'L')));
    expect(items()).toEqual(['S', 'L', 'M']);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(['S', 'L', 'M']));
  });
  it('clicks made while a save runs are sent together afterwards (latest wins)', async () => {
    let release: (v: string | null) => void = () => {};
    const onSave = vi.fn(() => new Promise<string | null>(r => { release = r; }));
    mount(['S', 'M', 'L'], onSave);
    fireEvent.click(screen.getByText(t.reorderValues.th));
    fireEvent.click(screen.getByLabelText(t.moveValueUp.th.replace('{value}', 'L')));   // S L M (sending)
    fireEvent.click(screen.getByLabelText(t.moveValueUp.th.replace('{value}', 'L')));   // L S M (queued)
    fireEvent.click(screen.getByLabelText(t.moveValueDown.th.replace('{value}', 'S'))); // L M S (replaces queued)
    release(null);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave).toHaveBeenLastCalledWith(['L', 'M', 'S']);
  });
  it('a failed save shows the error and goes back to the saved order', async () => {
    mount(['S', 'M', 'L'], vi.fn(async () => 'บันทึกไม่สำเร็จ'));
    fireEvent.click(screen.getByText(t.reorderValues.th));
    fireEvent.click(screen.getByLabelText(t.moveValueDown.th.replace('{value}', 'S')));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(items()).toEqual(['S', 'M', 'L']);
  });
});
