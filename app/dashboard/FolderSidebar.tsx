'use client';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { folderLines, type FolderRow } from '@/lib/catalogue/folders';
import ActionsMenu from './ActionsMenu';

export interface FolderNavProps {
  folders: FolderRow[];
  currentId: string | null;
  onOpen: (id: string | null) => void;
  onRename: (f: FolderRow) => void;
  onMove: (f: FolderRow) => void;
  onDelete: (f: FolderRow) => void;
}

/** The folder list beside the product grid (computer only; phones use FolderMobileNav). */
export default function FolderSidebar({ folders, currentId, onOpen, onRename, onMove, onDelete }: FolderNavProps) {
  const [lang] = useLanguage();
  const rowClass = (active: boolean) =>
    `flex items-center rounded hover:bg-gray-100 ${active ? 'bg-blue-50 font-semibold' : ''}`;

  return (
    <nav aria-label={t.folders[lang]} className="hidden w-48 shrink-0 space-y-0.5 text-sm sm:block">
      <div className={rowClass(currentId === null)} style={{ paddingLeft: 4 }}>
        <button type="button" onClick={() => onOpen(null)} className="min-w-0 grow truncate py-1 text-left">
          📁 {t.allItems[lang]}
        </button>
      </div>
      {folderLines(folders).map(f => (
        // No overflow-hidden on this row: it would clip the dropdown. Only the name button truncates.
        <div key={f.id} className={rowClass(f.id === currentId)} style={{ paddingLeft: 4 + Math.min(f.depth, 6) * 12 }}>
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
