'use client';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import LinkButton from '@/app/components/ui/LinkButton';

export default function AddGarmentLink() {
  const [lang] = useLanguage();
  return (
    <LinkButton href="/dashboard/garment/new">
      {t.addGarment[lang]}
    </LinkButton>
  );
}
