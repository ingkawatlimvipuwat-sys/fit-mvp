-- =============================================================
-- Fit Recommendation MVP — initial schema
-- =============================================================

-- ---------- retailers ----------
create table public.retailers (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  shop_name   text not null,
  shop_slug   text not null unique,
  created_at  timestamptz not null default now()
);

alter table public.retailers enable row level security;

-- Retailers can read their own row
create policy "retailers_self_read"
  on public.retailers for select
  using (auth.uid() = id);

-- Retailers can insert their own row (during signup)
create policy "retailers_self_insert"
  on public.retailers for insert
  with check (auth.uid() = id);

-- Retailers can update their own row
create policy "retailers_self_update"
  on public.retailers for update
  using (auth.uid() = id);

-- Public shop directory: the `shops` view is the anon-facing surface over
-- `retailers`. It exposes ONLY (id, shop_name, shop_slug) — column projection is
-- the security boundary, not row-level. By default Postgres views run with the
-- owner's privileges (security_definer-like), so they bypass `retailers` RLS.
-- This is INTENTIONAL: every registered shop is enumerable to anon, like a
-- public directory. CRITICAL: do not add columns to `retailers` that should be
-- private without also updating this view's SELECT list or switching the view
-- to `security_invoker = true` with a complementary anon policy.
create view public.shops as
  select id, shop_name, shop_slug from public.retailers;
grant select on public.shops to anon;

-- ---------- garments ----------
create table public.garments (
  id            uuid primary key default gen_random_uuid(),
  retailer_id   uuid not null references public.retailers(id) on delete cascade,
  name          text not null,
  category      text not null check (category in ('top','bottom','dress')),
  photo_url     text not null,
  fit_profile   text not null default 'regular' check (fit_profile in ('regular','slim','relaxed')),
  measurements  jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index garments_retailer_id_idx on public.garments(retailer_id);

alter table public.garments enable row level security;

-- Retailers can CRUD their own garments
create policy "garments_owner_all"
  on public.garments for all
  using (auth.uid() = retailer_id)
  with check (auth.uid() = retailer_id);

-- Public can read any garment (needed for /shop pages). Display columns only —
-- but there are no secret columns on garments, so a blanket public select is OK.
create policy "garments_public_read"
  on public.garments for select
  to anon
  using (true);

-- ---------- fit_sessions ----------
create table public.fit_sessions (
  id                     uuid primary key default gen_random_uuid(),
  garment_id             uuid not null references public.garments(id) on delete cascade,
  customer_token         text,
  customer_measurements  jsonb not null,
  result                 jsonb not null,
  tryon_image_url        text,                       -- reserved for Phase 2; null in Phase 1
  created_at             timestamptz not null default now()
);

create index fit_sessions_garment_id_idx on public.fit_sessions(garment_id);
create index fit_sessions_customer_token_idx on public.fit_sessions(customer_token);

alter table public.fit_sessions enable row level security;

-- Public can insert their own fit sessions (anonymous customers)
create policy "fit_sessions_public_insert"
  on public.fit_sessions for insert
  to anon
  with check (true);

-- Note: there is NO public SELECT policy on fit_sessions. Pre-fill of a returning
-- customer's measurements is implemented server-side via /api/fit/last using the
-- service-role client (bypasses RLS). This keeps customer biometric data out of
-- direct anon read range.

-- Retailers can read fit_sessions for their own garments (basic analytics later)
create policy "fit_sessions_retailer_read"
  on public.fit_sessions for select
  using (
    exists (
      select 1 from public.garments g
      where g.id = fit_sessions.garment_id and g.retailer_id = auth.uid()
    )
  );
