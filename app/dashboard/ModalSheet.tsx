'use client';
import { useEffect } from 'react';

/**
 * The dashboard's dialog shell: dark backdrop; Escape or a click outside closes it.
 * On a phone, 'bottom' rises from the bottom edge (lists); 'top' sits near the top
 * so the on-screen keyboard cannot cover a name box. On a computer both are centred.
 */
export default function ModalSheet({ title, onClose, align = 'bottom', children }: {
  title: string; onClose: () => void; align?: 'bottom' | 'top'; children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`fixed inset-0 z-20 flex justify-center bg-black/40 sm:items-center sm:p-0 ${
        align === 'top' ? 'items-start px-4 pt-[12vh]' : 'items-end'}`}
      onClick={onClose}
    >
      <div
        className={`max-h-[80vh] w-full max-w-sm overflow-y-auto bg-white p-4 sm:rounded ${align === 'top' ? 'rounded' : 'rounded-t'}`}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="mb-3 font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
