'use client';
import type { ComponentProps } from 'react';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import GarmentCard from './GarmentCard';

// Derived from GarmentCard's own prop type, plus the one extra column the
// dashboard page selects (created_at) that GarmentCard doesn't need.
type Garment = ComponentProps<typeof GarmentCard>['garment'] & { created_at: string };

/** Garments that belong to no product yet. `heading="legacy"` labels the list as such. */
export default function GarmentGrid({
  garments, shopSlug, heading,
}: { garments: Garment[]; shopSlug: string | null; heading?: 'legacy' }) {
  const [lang] = useLanguage();

  if (garments.length === 0) {
    return <p className="text-gray-600">{t.noGarments[lang]}</p>;
  }

  return (
    <section className="space-y-3">
      {heading === 'legacy' && (
        <h2 className="text-sm font-medium text-gray-700">{t.legacyGarments[lang]}</h2>
      )}
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {garments.map(g => (
          <li key={g.id}>
            <GarmentCard garment={g} shopSlug={shopSlug} />
          </li>
        ))}
      </ul>
    </section>
  );
}
