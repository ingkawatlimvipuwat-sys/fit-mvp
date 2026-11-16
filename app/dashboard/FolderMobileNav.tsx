'use client';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { childFolders } from '@/lib/catalogue/folders';
import ActionsMenu from './ActionsMenu';
import { ChevronLeftIcon, FolderIcon } from './icons';
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
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-[10px] pr-2 text-sm font-medium text-accent hover:text-accent-dark"
          >
            <ChevronLeftIcon />
            {parentName}
          </button>
          <span className="min-w-0 grow truncate font-semibold text-ink">{current.name}</span>
          <ActionsMenu
            ariaLabel={t.moreActions[lang]}
            items={[
              { text: t.renameFolder[lang], onSelect: () => onRename(current) },
              { text: t.moveTo[lang], onSelect: () => onMove(current) },
              { text: t.deleteFolder[lang], onSelect: () => onDelete(current), danger: true },
            ]}
          />
        </div>
      ) : (
        <h2 className="font-semibold text-ink">{t.allItems[lang]}</h2>
      )}
      {childFolders(folders, currentId).map(f => (
        <button
          key={f.id}
          type="button"
          onClick={() => onOpen(f.id)}
          className="flex min-h-[44px] w-full items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-left text-base font-medium text-ink"
        >
          <FolderIcon />
          <span className="truncate">{f.name}</span>
        </button>
      ))}
    </div>
  );
}
