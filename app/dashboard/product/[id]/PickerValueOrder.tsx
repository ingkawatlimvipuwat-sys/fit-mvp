'use client';
import { useEffect, useRef, useState } from 'react';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { moveItem } from '@/lib/catalogue/picks';

/**
 * The order shoppers see one picker's values in, with ↑ ↓ buttons (phone and
 * computer). Each click shows the new order at once and saves the whole list.
 * Clicks made while a save runs are sent together when it finishes (latest wins),
 * so responses can never arrive out of order.
 */
export default function PickerValueOrder({ values, onSave }: {
  /** Current order from the server (orderedValues). */
  values: string[];
  /** Save the whole list; resolve null on success or the error text. */
  onSave: (order: string[]) => Promise<string | null>;
}) {
  const [lang] = useLanguage();
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState(values);
  const [error, setError] = useState<string | null>(null);
  const queued = useRef<string[] | null>(null);
  const sending = useRef(false);
  const saved = useRef(values);
  saved.current = values;

  // router.refresh() after a save brings the server's list: adopt it unless more clicks are waiting.
  const valuesKey = values.join('\u0000');
  useEffect(() => { if (!sending.current) setOrder(saved.current); }, [valuesKey]);

  if (values.length < 2) return null;

  async function flush() {
    if (sending.current) return;
    sending.current = true;
    while (queued.current) {
      const next = queued.current;
      queued.current = null;
      const err = await onSave(next);
      if (err) { queued.current = null; setError(err); setOrder(saved.current); break; }
    }
    sending.current = false;
  }

  function move(i: number, delta: -1 | 1) {
    const next = moveItem(order, i, delta);
    setError(null);
    setOrder(next);
    queued.current = next;
    void flush();
  }

  const arrow = 'h-9 w-9 shrink-0 rounded border border-gray-300 bg-white text-base disabled:opacity-30';
  return (
    <div className="pl-1 text-xs text-gray-600">
      {!open ? (
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="break-words">{t.valueOrderLabel[lang]}: {order.join(' · ')}</span>
          <button type="button" onClick={() => setOpen(true)} className="py-1 text-blue-700 underline">
            {t.reorderValues[lang]}
          </button>
        </div>
      ) : (
        <div className="max-w-xs space-y-1">
          <div>{t.valueOrderLabel[lang]}</div>
          <ol className="space-y-1">
            {order.map((value, i) => (
              <li key={value} className="flex items-center gap-2">
                <span className="min-w-0 grow break-words text-sm text-gray-900">{value}</span>
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)}
                  aria-label={t.moveValueUp[lang].replace('{value}', value)} className={arrow}>↑</button>
                <button type="button" disabled={i === order.length - 1} onClick={() => move(i, 1)}
                  aria-label={t.moveValueDown[lang].replace('{value}', value)} className={arrow}>↓</button>
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => setOpen(false)} className="py-1 text-blue-700 underline">
            {t.doneReorder[lang]}
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-red-600">{error}</p>}
    </div>
  );
}
