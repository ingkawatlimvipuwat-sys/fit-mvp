'use client';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { childFolders } from '@/lib/catalogue/folders';
import ActionsMenu from './ActionsMenu';
import type { FolderNavProps } from './FolderSidebar';

/** Phone only (spec §5.1): the folder list becomes a "‹ back" header plus the folders directly inside. */
export default function FolderMobileNav({ folders, currentId, onOpen, onRename, onMove, onDelete }: FolderNavProps) {
  const [lang] = useLanguage();
  const current = currentId ? folders.find(f => f.id === currentId) : undefined;
  const parentName = current
    ? folders.find(f => f.id === current.parent_id)?.name ?? t.allItems[lang]
    : null;

  return (
    <div className="space-y-2 sm:hidden">
      {current ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpen(current.parent_id)}
            className="shrink-0 rounded px-2 py-1 text-sm text-blue-700"
          >
            ‹ {parentName}
          </button>
          <span className="min-w-0 grow truncate font-semibold">{current.name}</span>
          <ActionsMenu
            trigger="⋯"
            ariaLabel={t.moreActions[lang]}
            items={[
              { text: t.renameFolder[lang], onSelect: () => onRename(current) },
              { text: t.moveTo[lang], onSelect: () => onMove(current) },
              { text: t.deleteFolder[lang], onSelect: () => onDelete(current), danger: true },
            ]}
          />
        </div>
      ) : (
        <h2 className="font-semibold">{t.allItems[lang]}</h2>
      )}
      {childFolders(folders, currentId).map(f => (
        <button
          key={f.id}
          type="button"
          onClick={() => onOpen(f.id)}
          className="block w-full truncate rounded border bg-white px-3 py-2 text-left text-sm"
        >
          📁 {f.name}
        </button>
      ))}
    </div>
  );
}
