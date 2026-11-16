'use client';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import type { MoveTarget } from '@/lib/catalogue/folders';
import Button from '../components/ui/Button';
import { FolderIcon } from './icons';
import ModalSheet from './ModalSheet';

/** The "Move to…" chooser, used for products and folders. Disabled rows are the current place and, for a folder, itself and everything below it. */
export default function MoveToDialog({ title, targets, busy, onChoose, onClose }: {
  title: string; targets: MoveTarget[]; busy: boolean; onChoose: (id: string | null) => void; onClose: () => void;
}) {
  const [lang] = useLanguage();

  return (
    <ModalSheet title={`${t.moveTo[lang]} “${title}”`} onClose={onClose}>
      <ul className="space-y-0.5">
        {targets.map(r => (
          <li key={r.id ?? 'top'}>
            <button
              type="button"
              disabled={r.disabled || busy}
              onClick={() => onChoose(r.id)}
              style={{ paddingLeft: 10 + Math.min(r.depth, 7) * 14 }}
              className="flex min-h-[44px] w-full items-center gap-2 rounded-[10px] pr-2 text-left text-base text-ink hover:bg-page disabled:text-muted disabled:opacity-60 disabled:hover:bg-transparent"
            >
              {r.id !== null && <FolderIcon />}
              <span className="min-w-0 break-words">
                {r.id === null ? t.topLevel[lang] : r.name}
                {r.current ? ` · ${t.currentPlace[lang]}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Button variant="ghost" onClick={onClose} className="mt-2">
        {t.cancel[lang]}
      </Button>
    </ModalSheet>
  );
}
