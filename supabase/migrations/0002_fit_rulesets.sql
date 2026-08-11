-- =============================================================
-- Retailer-defined fit rules
-- Spec: docs/superpowers/specs/2026-08-06-custom-fit-rules-design.md
-- =============================================================

create table public.fit_rulesets (
  id           uuid primary key default gen_random_uuid(),
  retailer_id  uuid not null references public.retailers(id) on delete cascade,
  name         text not null,
  rule         jsonb not null,
  created_at   timestamptz not null default now()
);

create index fit_rulesets_retailer_id_idx on public.fit_rulesets(retailer_id);

alter table public.fit_rulesets enable row level security;

create policy "fit_rulesets_owner_all"
  on public.fit_rulesets for all
  using (auth.uid() = retailer_id)
  with check (auth.uid() = retailer_id);

-- No anon policy. /api/fit/evaluate uses the service-role client, so ruleset
-- resolution happens server-side and presets stay out of anon read range —
-- consistent with keeping fit_sessions out of anon reach.
--
-- NOTE the asymmetry (spec §4.2): `garments` carries a blanket anon SELECT
-- policy, so `fit_rule_override` below IS anon-readable. Accepted: it is the
-- retailer's own thresholds, not customer data, and no code path reads garments
-- with the anon client. Do not tell retailers their rules are secret.

-- ---------- garment columns ----------
-- Both nullable. `fit_profile` is untouched and remains the fallback for every
-- existing garment. These two are mutually exclusive by construction in the API.
alter table public.garments
  add column fit_ruleset_id    uuid references public.fit_rulesets(id) on delete set null,
  add column fit_rule_override jsonb;

-- ---------- session snapshot ----------
-- Rules are editable, so a session referencing a preset by ID becomes
-- uninterpretable the moment that preset is edited. This column records the
-- ruleset that actually produced the verdict. Written once at evaluation time,
-- never updated. Nullable so pre-existing rows stay valid — those were all
-- evaluated under the built-in defaults, which still live in the code.
alter table public.fit_sessions
  add column applied_rule jsonb;
