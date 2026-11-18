'use client';
import { useEffect, useState } from 'react';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { CheckIcon, LinkIcon } from './icons';

export default function CopyPublicLink({ slug }: { slug: string }) {
  const [lang] = useLanguage();
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState(`/shop/${slug}`);
  useEffect(() => { setLink(`${window.location.origin}/shop/${slug}`); }, [slug]);
  return (
    <button
      type="button"
      title={t.publicLink[lang]}
      onClick={async () => {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-[10px] border border-control bg-surface px-3 text-sm font-medium text-ink hover:bg-page sm:px-3.5 sm:text-base"
    >
      {copied ? <CheckIcon /> : <LinkIcon />}
      {t.copyLink[lang]}
    </button>
  );
}
