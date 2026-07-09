'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { t } from '@/lib/i18n/strings';
import type { Category } from '@/lib/supabase/types';

type Garment = { id: string; name: string; category: Category; photo_url: string };

const CATEGORY_LABEL: Record<Category, string> = {
  top: t.catTop.th,
  bottom: t.catBottom.th,
  dress: t.catDress.th,
};

export default function GarmentCard({
  garment, shopSlug,
}: { garment: Garment; shopSlug: string | null }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function onDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(t.confirmDelete.th)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/garments/${garment.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh();
      } else {
        alert(t.fitError.th);
      }
    } catch {
      alert(t.fitError.th);
    } finally {
      setDeleting(false);
    }
  }

  const preview = shopSlug ? `/shop/${shopSlug}/${garment.id}` : null;

  return (
    <div className="overflow-hidden rounded border bg-white">
      {preview ? (
        <Link
          href={preview}
          target="_blank"
          rel="noopener"
          title={t.previewShop.th}
          aria-label={t.previewShop.th}
          className="block"
        >
          <div className="relative aspect-square bg-gray-100">
            {garment.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={garment.photo_url} alt={garment.name} className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="p-3">
            <div className="text-sm font-medium">{garment.name}</div>
            <div className="text-xs text-gray-500">{CATEGORY_LABEL[garment.category]}</div>
          </div>
        </Link>
      ) : (
        <>
          <div className="relative aspect-square bg-gray-100">
            {garment.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={garment.photo_url} alt={garment.name} className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="p-3">
            <div className="text-sm font-medium">{garment.name}</div>
            <div className="text-xs text-gray-500">{CATEGORY_LABEL[garment.category]}</div>
          </div>
        </>
      )}
      <div className="border-t px-3 py-2">
        <button
          type="button"
          disabled={deleting}
          onClick={onDelete}
          className="text-xs text-red-600 disabled:opacity-60"
        >
          {t.deleteGarment.th}
        </button>
      </div>
    </div>
  );
}
