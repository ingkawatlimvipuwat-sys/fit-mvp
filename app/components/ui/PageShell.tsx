import type { ReactNode } from 'react';

/** Centered content for the public pages (home, not-found, error): a white card on the page background. */
export default function PageShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-12 sm:py-20">
      <div className={`rounded-2xl border border-line bg-surface p-6 sm:p-8 ${className}`}>{children}</div>
    </main>
  );
}
