'use client';
import { useEffect, useRef, useState } from 'react';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { moveItem } from '@/lib/catalogue/picks';
import TextButton from '@/app/components/ui/TextButton';
import Notice from '@/app/components/ui/Notice';

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

  const arrow = 'h-11 w-11 shrink-0 rounded-[10px] border border-control bg-surface text-base text-ink hover:bg-page disabled:opacity-30';
  return (
    <div className="text-sm text-muted">
      {!open ? (
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="break-words">{t.valueOrderLabel[lang]}: {order.join(' · ')}</span>
          <TextButton onClick={() => setOpen(true)} className="px-0">
            {t.reorderValues[lang]}
          </TextButton>
        </div>
      ) : (
        <div className="max-w-xs space-y-2">
          <div>{t.valueOrderLabel[lang]}</div>
          <ol className="space-y-1">
            {order.map((value, i) => (
              <li key={value} className="flex items-center gap-2">
                <span className="min-w-0 grow break-words text-base text-ink">{value}</span>
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)}
                  aria-label={t.moveValueUp[lang].replace('{value}', value)} className={arrow}>↑</button>
                <button type="button" disabled={i === order.length - 1} onClick={() => move(i, 1)}
                  aria-label={t.moveValueDown[lang].replace('{value}', value)} className={arrow}>↓</button>
              </li>
            ))}
          </ol>
          <TextButton onClick={() => setOpen(false)} className="px-0">
            {t.doneReorder[lang]}
          </TextButton>
        </div>
      )}
      {error && <Notice role="alert" className="mt-1">{error}</Notice>}
    </div>
  );
}
