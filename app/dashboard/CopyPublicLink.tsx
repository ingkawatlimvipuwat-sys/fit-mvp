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
    <div className="flex items-center gap-3 rounded border bg-white p-3 text-sm">
      <span className="text-gray-600">{t.publicLink[lang]}:</span>
      <code className="grow truncate">{link}</code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="rounded border px-2 py-1"
      >
        {copied ? '✓' : t.copyLink[lang]}
      </button>
    </div>
  );
}
