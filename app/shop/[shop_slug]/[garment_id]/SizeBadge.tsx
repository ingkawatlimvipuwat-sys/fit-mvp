'use client';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { displaySizeLabel } from '@/lib/garment/size-label';

/** Renders nothing when the garment has no (valid) size label. */
export default function SizeBadge({ sizeLabel }: { sizeLabel: string | null }) {
  const [lang] = useLanguage();
  const text = displaySizeLabel(sizeLabel, lang);
  if (!text) return null;
  return <p className="mt-1 text-sm text-gray-600">{text}</p>;
}
