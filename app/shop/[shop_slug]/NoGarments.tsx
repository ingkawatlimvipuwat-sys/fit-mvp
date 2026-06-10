'use client';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';

export default function NoGarments() {
  const [lang] = useLanguage();
  return <p className="mt-6 text-gray-600">{t.noGarments[lang]}</p>;
}
