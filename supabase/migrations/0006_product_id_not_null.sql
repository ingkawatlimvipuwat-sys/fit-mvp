-- =============================================================
-- Catalogue follow-up: every garment must belong to a product
-- Spec: docs/superpowers/specs/2026-10-01-catalogue-organisation-design.md section 4.2
-- (the spec calls this migration 0005; 0004 was taken by size_label, so it is 0006)
--
-- RUN ONCE, after 0005 and after the Stage 1 code is live. All-or-nothing:
-- it is one transaction, so if any statement fails it rolls back and nothing
-- is changed. It is safe to re-run only in the sense that the backfill finds
-- nothing to do the second time; do not rely on that.
--
-- Step 1 repeats the 0005 backfill for any garment created between running
-- 0005 and merging Stage 1 (old code inserted garments without a product).
-- Step 2 makes garments.product_id NOT NULL. If step 1 missed a row, step 2
-- fails and the whole transaction rolls back.
-- =============================================================

begin;

-- ---------- Backfill (same as 0005, including the name guard) ----------
-- Every garment without a product gets its own, with the SAME id as the
-- garment, so an old shopper link /shop/<slug>/<garment_id> is also a valid
-- product id. No pickers: a one-version, no-picker product renders exactly
-- like a single garment page.
insert into public.products (id, retailer_id, name, created_at)
-- garments.name has no length check but products.name needs 1-120 characters,
-- so a blank or very long name must not abort the whole migration.
select g.id, g.retailer_id, coalesce(nullif(left(btrim(g.name), 120), ''), 'Untitled'), g.created_at
from public.garments g
where g.product_id is null
on conflict (id) do nothing;

update public.garments set product_id = id where product_id is null;

-- ---------- Tighten ----------
alter table public.garments alter column product_id set not null;

commit;
