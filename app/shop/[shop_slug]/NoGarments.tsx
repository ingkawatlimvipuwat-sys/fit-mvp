'use client';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';

export default function NoGarments() {
  const [lang] = useLanguage();
  return <p className="rounded-[14px] border border-line bg-surface p-6 text-center text-muted">{t.noGarments[lang]}</p>;
}
