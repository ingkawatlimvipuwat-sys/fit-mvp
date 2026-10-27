'use client';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { DRAG_TYPE, dropVerdict, folderLines, type DragItem, type FolderRow } from '@/lib/catalogue/folders';
import ActionsMenu from './ActionsMenu';

export interface FolderNavProps {
  folders: FolderRow[];
  currentId: string | null;
  onOpen: (id: string | null) => void;
  onRename: (f: FolderRow) => void;
  onMove: (f: FolderRow) => void;
  onDelete: (f: FolderRow) => void;
}

export interface FolderDragProps {
  /** What the owner is dragging now (null: nothing, or a drag from outside the page). */
  dragging?: DragItem | null;
  /** The row the pointer is over: a folder id, null = All items, undefined = none. */
  hoverId?: string | null;
  onHoverTarget?: (id: string | null) => void;
  onDropOn?: (id: string | null) => void;
  /** Absent = folders cannot be picked up (touch screens). */
  onDragStartFolder?: (item: DragItem) => void;
  onDragEnd?: () => void;
}

/** The folder list beside the product grid (computer only; phones use FolderMobileNav). Rows are drop targets. */
export default function FolderSidebar({
  folders, currentId, onOpen, onRename, onMove, onDelete,
  dragging = null, hoverId, onHoverTarget, onDropOn, onDragStartFolder, onDragEnd,
}: FolderNavProps & FolderDragProps) {
  const [lang] = useLanguage();
  const verdict = (id: string | null) => (dragging ? dropVerdict(folders, dragging, id) : null);

  const rowClass = (active: boolean, id: string | null) => {
    let c = `flex items-center rounded hover:bg-gray-100 ${active ? 'bg-blue-50 font-semibold' : ''}`;
    if (hoverId !== undefined && hoverId === id) {
      const v = verdict(id);
      if (v === 'ok') c += ' bg-blue-100 ring-2 ring-blue-400';
      else if (v === 'cycle') c += ' bg-red-50 ring-2 ring-red-300';
    }
    if (dragging?.kind === 'folder' && dragging.id === id) c += ' opacity-50';
    return c;
  };

  // A row accepts a drop only when the verdict is 'ok': only then does dragover call preventDefault.
  // No dragleave handler on purpose: browsers fire it just before dragend on a refused drop.
  const dropProps = (id: string | null) => ({
    'data-drop-row': '',
    onDragOver: (e: React.DragEvent) => {
      e.stopPropagation(); // the browser's outer div clears the hover only when the pointer is off every row
      const v = verdict(id);
      if (v === null) return;
      if (hoverId !== id) onHoverTarget?.(id);
      if (v === 'ok') { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (verdict(id) === 'ok') onDropOn?.(id);
    },
  });

  return (
    <nav aria-label={t.folders[lang]} className="hidden w-48 shrink-0 space-y-0.5 text-sm sm:block">
      <div className={rowClass(currentId === null, null)} style={{ paddingLeft: 4 }} {...dropProps(null)}>
        <button type="button" onClick={() => onOpen(null)} className="min-w-0 grow truncate py-1 text-left">
          📁 {t.allItems[lang]}
        </button>
      </div>
      {folderLines(folders).map(f => (
        // No overflow-hidden on this row: it would clip the dropdown. Only the name button truncates.
        <div
          key={f.id}
          className={rowClass(f.id === currentId, f.id)}
          style={{ paddingLeft: 4 + Math.min(f.depth, 6) * 12 }}
          {...dropProps(f.id)}
          draggable={onDragStartFolder ? true : undefined}
          onDragStart={onDragStartFolder ? e => {
            e.dataTransfer.setData(DRAG_TYPE, f.id);
            e.dataTransfer.effectAllowed = 'move';
            const item: DragItem = { kind: 'folder', id: f.id, name: f.name };
            setTimeout(() => onDragStartFolder(item), 0); // a DOM change inside dragstart cancels the drag in Chrome
          } : undefined}
          onDragEnd={onDragEnd}
        >
          <button type="button" onClick={() => onOpen(f.id)} className="min-w-0 grow truncate py-1 text-left">
            📁 {f.name}
          </button>
          <ActionsMenu
            trigger="⋯"
            ariaLabel={t.moreActions[lang]}
            items={[
              { text: t.renameFolder[lang], onSelect: () => onRename(f) },
              { text: t.moveTo[lang], onSelect: () => onMove(f) },
              { text: t.deleteFolder[lang], onSelect: () => onDelete(f), danger: true },
            ]}
          />
        </div>
      ))}
    </nav>
  );
}
