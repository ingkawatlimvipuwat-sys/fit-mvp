'use client';
import { useMemo, useState } from 'react';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import {
  availableValues, normPick, orderedValues, resolveVersion,
  type PickerDef, type Picks,
} from '@/lib/catalogue/picks';
import Chip from '@/app/components/ui/Chip';
import FitChecker from '../../[garment_id]/FitChecker';
import GarmentTabs from '../../[garment_id]/GarmentTabs';
import TryOn from '../../[garment_id]/TryOn';
import SizeBadge from '../../[garment_id]/SizeBadge';
import type { GarmentFabric } from '@/lib/supabase/types';

type DimInfo = { key: string; labelTh: string; hintTh: string; labelEn: string; hintEn: string };

export interface ShopperVersion {
  id: string;
  created_at: string;
  picks: Picks;
  photo_url: string;
  size_label: string | null;
  true_colour_photo_url: string | null;
  colours: { hex: string; name: string }[];
  fabric: GarmentFabric | null;
  dims: DimInfo[];
}

export default function ProductView({
  name, pickers, versions,
}: { name: string; pickers: PickerDef[]; versions: ShopperVersion[] }) {
  const [lang] = useLanguage();
  const [selection, setSelection] = useState<Picks>({});

  const pickerIds = useMemo(() => pickers.map(p => p.id), [pickers]);
  const selected = resolveVersion(versions, selection, pickerIds);
  const missing = pickers.filter(p => normPick(selection[p.id]) === '').map(p => p.name);
  const shown = selected ?? versions[0];

  function toggle(pickerId: string, value: string) {
    setSelection(prev => {
      const next = { ...prev };
      if (normPick(prev[pickerId]) === normPick(value)) delete next[pickerId];
      else next[pickerId] = value;
      return next;
    });
  }

  return (
    <>
      <div className="mt-1 aspect-square overflow-hidden rounded-2xl bg-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shown.photo_url} alt={name} className="h-full w-full object-cover" />
      </div>
      <h1 className="mt-4 text-[22px] font-semibold leading-snug">{name}</h1>
      <SizeBadge sizeLabel={selected?.size_label ?? null} />

      {pickers.map(p => {
        const ok = availableValues(versions, pickerIds, selection, p.id);
        return (
          <div key={p.id} className="mt-4">
            <div className="text-[13px] font-semibold text-muted">{p.name}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {orderedValues(versions, p.id, p.value_order).map(value => {
                const chosen = normPick(selection[p.id]) === normPick(value);
                const enabled = ok.has(normPick(value));
                return (
                  <Chip
                    key={value}
                    disabled={!enabled && !chosen}
                    selected={chosen}
                    onClick={() => toggle(p.id, value)}
                    className={!enabled && !chosen ? '!border-dashed !bg-page !text-muted line-through' : ''}
                  >
                    {value}
                  </Chip>
                );
              })}
            </div>
          </div>
        );
      })}

      <GarmentTabs
        stable={pickers.length > 0}
        pickFirst={selected ? null : t.pickFirst[lang].replace('{names}', missing.join(', '))}
        colours={selected?.colours ?? []}
        trueColourPhotoUrl={selected?.true_colour_photo_url ?? null}
        fabric={selected?.fabric ?? null}
      >
        {/* One FitChecker for the page's whole life, never keyed by version:
            it holds the shopper's typed measurements. */}
        <FitChecker
          garmentId={selected?.id ?? null}
          dimensions={(selected ?? shown).dims}
          sizeLabel={selected?.size_label ?? null}
        />
      </GarmentTabs>

      <TryOn />
    </>
  );
}
