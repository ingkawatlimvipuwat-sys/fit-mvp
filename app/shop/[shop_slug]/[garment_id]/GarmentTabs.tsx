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
  children, colours, trueColourPhotoUrl, fabric, stable = false, pickFirst = null,
}: {
  /** The Fit panel — FitChecker, rendered by the server page. */
  children: React.ReactNode;
  colours: { hex: string; name: string }[];
  trueColourPhotoUrl: string | null;
  fabric: GarmentFabric | null;
  /**
   * Product pages: always render the tabbed structure, so FitChecker keeps its
   * place in the tree (and the shopper's typed numbers) when switching to a
   * version that has, or lacks, colour or fabric data.
   */
  stable?: boolean;
  /** Set while no version is picked yet: every tab says this instead of its content. */
  pickFirst?: string | null;
}) {
  const [lang] = useLanguage();
  const [tab, setTab] = useState<Tab>('fit');

  const waiting = pickFirst !== null;
  const hasColour = waiting || showColourTab(colours, trueColourPhotoUrl);
  const hasFabric = waiting || showFabricTab(fabric);

  // Nothing extra to show: no tab bar at all, page identical to before this
  // feature existed.
  if (!stable && !hasColour && !hasFabric) return <>{children}</>;

  const activeTab: Tab = (tab === 'colour' && !hasColour) || (tab === 'fabric' && !hasFabric) ? 'fit' : tab;

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
            aria-selected={activeTab === x.key}
            onClick={() => setTab(x.key)}
            className={`px-4 py-2 text-sm ${
              activeTab === x.key
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
      <div hidden={activeTab !== 'fit'}>
        {waiting && <p className="mt-3 text-sm text-gray-600">{pickFirst}</p>}
        {children}
      </div>
      {hasColour && (
        <div hidden={activeTab !== 'colour'}>
          {waiting
            ? <p className="mt-3 text-sm text-gray-600">{pickFirst}</p>
            : <ColourPanel colours={colours} trueColourPhotoUrl={trueColourPhotoUrl} />}
        </div>
      )}
      {hasFabric && (waiting || fabric) && (
        <div hidden={activeTab !== 'fabric'}>
          {waiting
            ? <p className="mt-3 text-sm text-gray-600">{pickFirst}</p>
            : fabric && <FabricPanel fabric={fabric} />}
        </div>
      )}
    </div>
  );
}
