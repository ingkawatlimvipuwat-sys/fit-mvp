-- 0008: the owner's order of each picker's values (Catalogue Stage 3, 2026-10-27).
-- Spec: docs/superpowers/specs/2026-10-01-catalogue-organisation-design.md section 4.5
-- Plan: docs/superpowers/plans/2026-10-27-catalogue-stage-3.md
--
-- ADDITIVE ONLY: one new column with a default. The code live before Stage 3
-- never names it (it selects id, name, position and inserts without it), so it
-- keeps working after this runs. Run this BEFORE merging the Stage 3 pull
-- request: the Stage 3 code reads the column, and every product page would
-- error until it exists.
--
-- value_order lists a picker's values ("S", "M", "L") in the order shoppers
-- see them. Empty (the default) means "the order the owner first used them",
-- which is exactly what shoppers see today. Values not in the list follow the
-- listed ones; entries matching no version are ignored by the app.
--
-- Safe to run twice: "if not exists" makes the second run do nothing.
-- RLS: the existing product_pickers_owner_all policy already covers the new
-- column. No new policy, no anon access.
begin;

alter table public.product_pickers
  add column if not exists value_order text[] not null default '{}';

commit;
