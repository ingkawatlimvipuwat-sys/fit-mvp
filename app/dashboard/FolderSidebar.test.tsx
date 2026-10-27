// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import { DRAG_TYPE, type DragItem, type FolderRow } from '@/lib/catalogue/folders';
import FolderSidebar from './FolderSidebar';

afterEach(cleanup);
const FOLDERS: FolderRow[] = [
  { id: 'shirts', name: 'Shirts', parent_id: null },
  { id: 'linen', name: 'Linen', parent_id: 'shirts' },
  { id: 'trousers', name: 'Trousers', parent_id: null },
];
const dt = () => ({ dropEffect: 'none', effectAllowed: 'all', types: [DRAG_TYPE], setData: vi.fn() });
function mount(dragging: DragItem | null, extra: { hoverId?: string | null } = {}) {
  const spies = { onHoverTarget: vi.fn(), onDropOn: vi.fn(), onDragStartFolder: vi.fn(), onDragEnd: vi.fn() };
  render(
    <LanguageProvider>
      <FolderSidebar folders={FOLDERS} currentId={null} onOpen={vi.fn()} onRename={vi.fn()} onMove={vi.fn()}
        onDelete={vi.fn()} dragging={dragging} hoverId={extra.hoverId} {...spies} />
    </LanguageProvider>,
  );
  return spies;
}
const row = (name: string) => screen.getByText(`📁 ${name}`).closest('[data-drop-row]') as HTMLElement;
const product: DragItem = { kind: 'product', id: 'p', name: 'P', folderId: 'linen' };
const shirts: DragItem = { kind: 'folder', id: 'shirts', name: 'Shirts' };

describe('FolderSidebar drag-and-drop', () => {
  it('a folder row accepts a product (dragover default prevented) and reports the hover', () => {
    const s = mount(product);
    expect(fireEvent.dragOver(row('Trousers'), { dataTransfer: dt() })).toBe(false);
    expect(s.onHoverTarget).toHaveBeenCalledWith('trousers');
  });
  it('dropping a product on a folder moves it there; on All items, to the top level', () => {
    const s = mount(product);
    fireEvent.drop(row('Trousers'), { dataTransfer: dt() });
    fireEvent.drop(row(t.allItems.th), { dataTransfer: dt() });
    expect(s.onDropOn.mock.calls).toEqual([['trousers'], [null]]);
  });
  it("the product's own folder does not accept it", () => {
    const s = mount(product);
    expect(fireEvent.dragOver(row('Linen'), { dataTransfer: dt() })).toBe(true);
    fireEvent.drop(row('Linen'), { dataTransfer: dt() });
    expect(s.onDropOn).not.toHaveBeenCalled();
  });
  it('a folder is refused by its own subfolder, which turns red while hovered', () => {
    const s = mount(shirts, { hoverId: 'linen' });
    expect(fireEvent.dragOver(row('Linen'), { dataTransfer: dt() })).toBe(true);
    expect(row('Linen').className).toContain('ring-red-300');
    fireEvent.drop(row('Linen'), { dataTransfer: dt() });
    expect(s.onDropOn).not.toHaveBeenCalled();
  });
  it('an accepted row turns blue while hovered', () => {
    mount(shirts, { hoverId: 'trousers' });
    expect(row('Trousers').className).toContain('ring-blue-400');
  });
  it('with nothing being dragged, rows ignore drags (e.g. a file from the desktop)', () => {
    const s = mount(null);
    expect(fireEvent.dragOver(row('Trousers'), { dataTransfer: dt() })).toBe(true);
    expect(s.onHoverTarget).not.toHaveBeenCalled();
  });
  it('folder rows can be picked up; All items cannot', () => {
    mount(null);
    expect(row('Shirts').getAttribute('draggable')).toBe('true');
    expect(row(t.allItems.th).getAttribute('draggable')).not.toBe('true');
  });
});
