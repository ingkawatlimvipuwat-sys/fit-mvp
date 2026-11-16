'use client';
import { useEffect, useState } from 'react';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';

export default function CopyPublicLink({ slug }: { slug: string }) {
  const [lang] = useLanguage();
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState(`/shop/${slug}`);
  useEffect(() => { setLink(`${window.location.origin}/shop/${slug}`); }, [slug]);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border bg-white p-3 text-sm sm:flex-nowrap">
      <span className="w-full text-gray-600 sm:w-auto sm:shrink-0">{t.publicLink[lang]}:</span>
      <code className="min-w-0 flex-1 truncate">{link}</code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="shrink-0 whitespace-nowrap rounded border px-2 py-1"
      >
        {copied ? '✓' : t.copyLink[lang]}
      </button>
    </div>
  );
}
