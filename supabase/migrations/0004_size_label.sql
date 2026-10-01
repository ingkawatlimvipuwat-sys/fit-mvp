-- =============================================================
-- Optional size label on garments (S / M / L ...)
-- Founder decision 2026-09-28; see decisions-and-lessons.md section 2.
-- =============================================================

-- Purely additive: one nullable column, no default, no backfill. Code that
-- predates this migration never names the column, so it keeps working.
-- Existing rows stay null, which the app shows as nothing.
-- FREE is the stored code for "Free size"; the UI words live in strings.ts.
alter table public.garments
  add column size_label text
  check (size_label in ('XS','S','M','L','XL','XXL','FREE'));
