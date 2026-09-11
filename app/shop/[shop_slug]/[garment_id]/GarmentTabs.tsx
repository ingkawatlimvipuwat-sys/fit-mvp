'use client';
import { useState } from 'react';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import { showColourTab, showFabricTab } from '@/lib/garment/colour-fabric-view';
import ColourPanel from './ColourPanel';
import FabricPanel from './FabricPanel';
import type { GarmentFabric } from '@/lib/supabase/types';

type Tab = 'fit' | 'colour' | 'fabric';

export default function GarmentTabs({
  children, colours, trueColourPhotoUrl, fabric,
}: {
  /** The Fit panel — FitChecker, rendered by the server page. */
  children: React.ReactNode;
  colours: { hex: string; name: string }[];
  trueColourPhotoUrl: string | null;
  fabric: GarmentFabric | null;
}) {
  const [lang] = useLanguage();
  const [tab, setTab] = useState<Tab>('fit');

  const hasColour = showColourTab(colours, trueColourPhotoUrl);
  const hasFabric = showFabricTab(fabric);

  // Nothing extra to show: no tab bar at all, page identical to before this
  // feature existed.
  if (!hasColour && !hasFabric) return <>{children}</>;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'fit', label: t.tabFit[lang] },
    ...(hasColour ? [{ key: 'colour' as Tab, label: t.tabColour[lang] }] : []),
    ...(hasFabric ? [{ key: 'fabric' as Tab, label: t.tabFabric[lang] }] : []),
  ];

  return (
    <div className="mt-4">
      <div role="tablist" className="flex gap-1 border-b">
        {tabs.map(x => (
          <button
            key={x.key}
            role="tab"
            type="button"
            aria-selected={tab === x.key}
            onClick={() => setTab(x.key)}
            className={`px-4 py-2 text-sm ${
              tab === x.key
                ? 'border-b-2 border-gray-900 font-medium text-gray-900'
                : 'text-gray-500'
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {/*
        Always mounted, hidden when inactive. FitChecker keeps the shopper's
        typed measurements in local state, so unmounting would clear a
        half-filled form. Tailwind preflight gives [hidden] display:none — do
        not add a flex/grid class to these wrappers or it overrides that.
      */}
      <div hidden={tab !== 'fit'}>{children}</div>
      {hasColour && (
        <div hidden={tab !== 'colour'}>
          <ColourPanel colours={colours} trueColourPhotoUrl={trueColourPhotoUrl} />
        </div>
      )}
      {hasFabric && fabric && (
        <div hidden={tab !== 'fabric'}>
          <FabricPanel fabric={fabric} />
        </div>
      )}
    </div>
  );
}
