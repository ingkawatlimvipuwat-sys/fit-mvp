import { t } from '@/lib/i18n/strings';

/** Stored codes, in display order. Must match the check in migration 0004. */
export const SIZE_LABELS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'FREE'] as const;
export type SizeLabel = (typeof SIZE_LABELS)[number];

export function isSizeLabel(v: unknown): v is SizeLabel {
  return typeof v === 'string' && (SIZE_LABELS as readonly string[]).includes(v);
}

/** What a shopper or retailer reads. Letter sizes are the same in both languages. */
export function sizeLabelText(code: SizeLabel, lang: 'th' | 'en'): string {
  return code === 'FREE' ? t.sizeFree[lang] : code;
}

/**
 * A stored column value to display text, or null for "show nothing". An
 * unknown value (a hand-edited row) is treated as empty rather than echoed.
 */
export function displaySizeLabel(stored: unknown, lang: 'th' | 'en'): string | null {
  return isSizeLabel(stored) ? sizeLabelText(stored, lang) : null;
}
