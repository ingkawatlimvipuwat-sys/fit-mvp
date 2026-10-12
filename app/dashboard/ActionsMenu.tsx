'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';

export interface MenuItem { text: string; onSelect?: () => void; href?: string; danger?: boolean }

/**
 * A small dropdown built on <details>, so it works on phones without extra
 * code. Closes after a choice or on a click anywhere else.
 */
export default function ActionsMenu({ trigger, ariaLabel, triggerClassName, items, disabled }: {
  trigger: React.ReactNode; ariaLabel: string; triggerClassName?: string; items: MenuItem[]; disabled?: boolean;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  const close = () => { if (ref.current) ref.current.open = false; };
  const itemClass = (danger?: boolean) =>
    `block w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${danger ? 'text-red-600' : 'text-gray-900'}`;

  return (
    <details ref={ref} className="relative shrink-0">
      <summary
        aria-label={ariaLabel}
        className={`cursor-pointer list-none [&::-webkit-details-marker]:hidden ${
          disabled ? 'pointer-events-none opacity-60 ' : ''}${triggerClassName ?? 'rounded px-2 text-gray-500 hover:bg-gray-100'}`}
      >
        {trigger}
      </summary>
      <ul className="absolute right-0 z-10 mt-1 w-44 rounded border bg-white py-1 shadow-lg">
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
