'use client';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { DRAG_TYPE, dropVerdict, folderLines, type DragItem, type FolderRow } from '@/lib/catalogue/folders';
import ActionsMenu from './ActionsMenu';
import { FolderIcon } from './icons';

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
    let c = `flex min-h-[44px] items-center rounded-[10px] hover:bg-page ${active ? 'bg-accent-tint font-semibold' : 'font-medium'}`;
    if (hoverId !== undefined && hoverId === id) {
      const v = verdict(id);
      if (v === 'ok') c += ' bg-accent-tint ring-2 ring-accent';
      else if (v === 'cycle') c += ' bg-verdict-tight-bg ring-2 ring-verdict-tight-fg';
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
    <nav aria-label={t.folders[lang]} className="hidden h-fit w-60 shrink-0 space-y-0.5 rounded-[14px] border border-line bg-surface p-2.5 text-base text-ink sm:block">
      <div className={rowClass(currentId === null, null)} style={{ paddingLeft: 10 }} {...dropProps(null)}>
        <button type="button" onClick={() => onOpen(null)} className="flex min-h-[44px] min-w-0 grow items-center gap-2 text-left">
          <FolderIcon />
          <span className="truncate">{t.allItems[lang]}</span>
        </button>
      </div>
      {folderLines(folders).map(f => (
        // No overflow-hidden on this row: it would clip the dropdown. Only the name button truncates.
        <div
          key={f.id}
          className={rowClass(f.id === currentId, f.id)}
          style={{ paddingLeft: 10 + Math.min(f.depth, 6) * 18 }}
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
          <button type="button" onClick={() => onOpen(f.id)} className="flex min-h-[44px] min-w-0 grow items-center gap-2 text-left">
            <FolderIcon />
            <span className="truncate">{f.name}</span>
          </button>
          <ActionsMenu
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
