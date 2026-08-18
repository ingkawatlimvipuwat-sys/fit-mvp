'use client';
import type { ComponentProps } from 'react';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import GarmentCard from './GarmentCard';

// Derived from GarmentCard's own prop type, plus the one extra column the
// dashboard page selects (created_at) that GarmentCard doesn't need.
type Garment = ComponentProps<typeof GarmentCard>['garment'] & { created_at: string };

export default function GarmentGrid({
  garments, shopSlug,
}: { garments: Garment[]; shopSlug: string | null }) {
  const [lang] = useLanguage();

  if (garments.length === 0) {
    return <p className="text-gray-600">{t.noGarments[lang]}</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {garments.map(g => (
        <li key={g.id}>
          <GarmentCard garment={g} shopSlug={shopSlug} />
        </li>
      ))}
    </ul>
  );
}
