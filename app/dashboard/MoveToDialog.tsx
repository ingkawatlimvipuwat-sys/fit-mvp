'use client';
import { useEffect } from 'react';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import type { MoveTarget } from '@/lib/catalogue/folders';

/** The "Move to…" chooser, used for products and folders. Disabled rows are the current place and, for a folder, itself and everything below it. */
export default function MoveToDialog({ title, targets, busy, onChoose, onClose }: {
  title: string; targets: MoveTarget[]; busy: boolean; onChoose: (id: string | null) => void; onClose: () => void;
}) {
  const [lang] = useLanguage();

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-t bg-white p-4 sm:rounded"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="mb-3 font-semibold">{t.moveTo[lang]} “{title}”</h2>
        <ul className="space-y-0.5">
          {targets.map(r => (
            <li key={r.id ?? 'top'}>
              <button
                type="button"
                disabled={r.disabled || busy}
                onClick={() => onChoose(r.id)}
                style={{ paddingLeft: 8 + Math.min(r.depth, 7) * 12 }}
                className="block w-full rounded py-2 pr-2 text-left text-sm hover:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-transparent"
              >
                {r.id === null ? t.topLevel[lang] : `📁 ${r.name}`}
                {r.current ? ` · ${t.currentPlace[lang]}` : ''}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onClose} className="mt-3 text-sm text-gray-600 underline">
          {t.cancel[lang]}
        </button>
      </div>
    </div>
  );
}
