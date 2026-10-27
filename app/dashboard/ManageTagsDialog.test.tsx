// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import ManageTagsDialog from './ManageTagsDialog';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const TAGS = [{ id: 'a', name: 'Sale', count: 2 }, { id: 'o', name: 'Old typo', count: 0 }];
const mount = (p: Partial<React.ComponentProps<typeof ManageTagsDialog>> = {}) =>
  render(
    <LanguageProvider>
      <ManageTagsDialog tags={TAGS} onRename={vi.fn(async () => null)} onDelete={vi.fn(async () => null)}
        onClose={vi.fn()} {...p} />
    </LanguageProvider>,
  );

describe('ManageTagsDialog', () => {
  it('lists every tag with how many products use it, unused ones marked', () => {
    mount();
    expect(screen.getByText(t.tagUsedOn.th.replace('{n}', '2'))).toBeTruthy();
    expect(screen.getByText(t.tagUnused.th)).toBeTruthy();
  });
  it('says so when the shop has no tags', () => {
    mount({ tags: [] });
    expect(screen.getByText(t.noTagsYet.th)).toBeTruthy();
  });
  it('Rename opens a name box in the row and sends the new name', async () => {
    const onRename = vi.fn(async () => null);
    mount({ onRename });
    fireEvent.click(screen.getByLabelText(t.renameTagNamed.th.replace('{name}', 'Sale')));
    const box = screen.getByLabelText(t.tagNameLabel.th) as HTMLInputElement;
    expect(box.value).toBe('Sale');
    fireEvent.change(box, { target: { value: 'Big sale' } });
    fireEvent.submit(box.closest('form') as HTMLFormElement);
    await waitFor(() => expect(onRename).toHaveBeenCalledWith(TAGS[0], 'Big sale'));
    await waitFor(() => expect(screen.queryByLabelText(t.tagNameLabel.th)).toBeNull());
  });
  it('a refused rename keeps the box open with the message', async () => {
    mount({ onRename: vi.fn(async () => t.tagNameTaken.th.replace('{name}', 'Old typo')) });
    fireEvent.click(screen.getByLabelText(t.renameTagNamed.th.replace('{name}', 'Sale')));
    const box = screen.getByLabelText(t.tagNameLabel.th);
    fireEvent.change(box, { target: { value: 'old TYPO' } });
    fireEvent.submit(box.closest('form') as HTMLFormElement);
    expect((await screen.findByRole('alert')).textContent).toContain('Old typo');
    expect(screen.getByLabelText(t.tagNameLabel.th)).toBeTruthy();
  });
  it('Delete asks first, naming the tag and its product count; No sends nothing', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onDelete = vi.fn(async () => null);
    mount({ onDelete });
    fireEvent.click(screen.getByLabelText(t.deleteTagNamed.th.replace('{name}', 'Sale')));
    expect(confirm).toHaveBeenCalledWith(t.confirmDeleteTag.th.replace('{name}', 'Sale').replace('{n}', '2'));
    expect(onDelete).not.toHaveBeenCalled();
  });
  it('Delete after Yes calls onDelete', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onDelete = vi.fn(async () => null);
    mount({ onDelete });
    fireEvent.click(screen.getByLabelText(t.deleteTagNamed.th.replace('{name}', 'Old typo')));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(TAGS[1]));
  });
});
