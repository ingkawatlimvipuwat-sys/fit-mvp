-- 0007: index for the fit-session write cap (reliability fixes, 2026-10-26).
--
-- OPTIONAL BUT RECOMMENDED. Index only: no table, column or policy change.
-- /api/fit/evaluate counts fit_sessions rows from the last 10 minutes before
-- saving a new one. Without this index that count scans the whole table —
-- fine while it is small, slow if it ever grows large. Safe for the live code
-- before or after the merge: it changes no behaviour, only speed.
begin;
create index if not exists fit_sessions_created_at_idx
  on public.fit_sessions (created_at);
commit;
