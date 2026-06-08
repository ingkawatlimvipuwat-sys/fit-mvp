'use client';
import { useState } from 'react';
import { t } from '@/lib/i18n/strings';

export default function CopyPublicLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== 'undefined' ? `${window.location.origin}/shop/${slug}` : `/shop/${slug}`;
  return (
    <div className="flex items-center gap-3 rounded border bg-white p-3 text-sm">
      <span className="text-gray-600">{t.publicLink.th}:</span>
      <code className="grow truncate">{link}</code>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="rounded border px-2 py-1"
      >
        {copied ? '✓' : t.copyLink.th}
      </button>
    </div>
  );
}
