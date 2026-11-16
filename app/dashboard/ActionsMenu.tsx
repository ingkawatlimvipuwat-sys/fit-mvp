'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { DotsIcon } from './icons';

export interface MenuItem { text: string; onSelect?: () => void; href?: string; danger?: boolean }

/**
 * A small dropdown built on <details>, so it works on phones without extra
 * code. Closes after a choice or on a click anywhere else.
 */
export default function ActionsMenu({ trigger, ariaLabel, triggerClassName, items, disabled }: {
  trigger?: React.ReactNode; ariaLabel: string; triggerClassName?: string; items: MenuItem[]; disabled?: boolean;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function onClick(e: PointerEvent) {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    }
    document.addEventListener('pointerdown', onClick);
    return () => document.removeEventListener('pointerdown', onClick);
  }, []);
  const close = () => { if (ref.current) ref.current.open = false; };
  const itemClass = (danger?: boolean) =>
    `flex min-h-[44px] w-full items-center px-3 py-2 text-left text-sm hover:bg-page ${danger ? 'text-verdict-tight-fg' : 'text-ink'}`;

  return (
    <details ref={ref} className="relative shrink-0">
      <summary
        aria-label={ariaLabel}
        className={`cursor-pointer list-none [&::-webkit-details-marker]:hidden ${
          disabled ? 'pointer-events-none opacity-60 ' : ''}${triggerClassName ?? 'inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-page'}`}
      >
        {trigger ?? <DotsIcon />}
      </summary>
      <ul className="absolute right-0 z-10 mt-1 w-40 rounded-xl border border-line bg-surface py-1 shadow-lg">
        {items.map(i => (
          <li key={i.text}>
            {i.href ? (
              <Link href={i.href} onClick={close} className={itemClass(i.danger)}>{i.text}</Link>
            ) : (
              <button type="button" onClick={() => { close(); i.onSelect?.(); }} className={itemClass(i.danger)}>
                {i.text}
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
