-- =============================================================
-- Colour & fabric reference
-- Spec: docs/superpowers/specs/2026-09-10-colour-fabric-design.md
-- =============================================================

-- ---------- garments: one new column ----------
-- Nullable. The garment laid flat under daylight, as a colour reference the
-- hero photo cannot be: the hero photo is styled, angled and lit for appeal.
alter table public.garments
  add column true_colour_photo_url text;

-- ---------- colours: many per garment ----------
-- No `position` column, deliberately (spec Q3): the founder rejected ranking.
-- The list says only what IS present; the shopper judges dominance from the
-- photo. Display order is created_at ascending.
create table public.garment_colours (
  id          uuid primary key default gen_random_uuid(),
  garment_id  uuid not null references public.garments(id) on delete cascade,
  hex         text not null check (hex ~ '^#[0-9a-fA-F]{6}$'),
  name        text not null check (char_length(name) between 1 and 40),
  created_at  timestamptz not null default now()
);

create index garment_colours_garment_id_idx on public.garment_colours(garment_id);

alter table public.garment_colours enable row level security;

create policy "garment_colours_owner_all"
  on public.garment_colours for all
  using      (exists (select 1 from public.garments g
                      where g.id = garment_id and g.retailer_id = auth.uid()))
  with check (exists (select 1 from public.garments g
                      where g.id = garment_id and g.retailer_id = auth.uid()));

create policy "garment_colours_public_read"
  on public.garment_colours for select to anon using (true);

-- ---------- fabric: zero or one per garment ----------
-- garment_id IS the primary key, which is what makes the API's insert-or-update
-- safe: a conflict on garment_id can only ever be this garment's single row.
create table public.garment_fabric (
  garment_id       uuid primary key references public.garments(id) on delete cascade,

  -- simple tier (chips). null = retailer did not say. Never a default: a
  -- guessed default would be a claim about the garment that nobody made.
  finish           text check (finish in ('matte','slight_sheen','glossy')),
  thickness        text check (thickness in ('thin','medium','thick')),
  stretch          text check (stretch in ('none','some','high')),
  feel             text check (feel in ('soft','crisp','rough')),

  -- technical tier. all optional, all the retailer's own words.
  composition      text,
  weight_gsm       integer check (weight_gsm between 1 and 2000),
  construction     text,
  thread_count     integer check (thread_count between 1 and 2000),
  pore_size_mm     numeric(6,3) check (pore_size_mm > 0),
  notes            text,
  fabric_photo_url text,

  updated_at       timestamptz not null default now()
);

alter table public.garment_fabric enable row level security;

create policy "garment_fabric_owner_all"
  on public.garment_fabric for all
  using      (exists (select 1 from public.garments g
                      where g.id = garment_id and g.retailer_id = auth.uid()))
  with check (exists (select 1 from public.garments g
                      where g.id = garment_id and g.retailer_id = auth.uid()));

create policy "garment_fabric_public_read"
  on public.garment_fabric for select to anon using (true);

-- Both anon-read policies mirror `garments_public_read` from 0001. They are not
-- strictly load-bearing: the shop pages read through the service-role client, so
-- they would work without them. They are here so these tables match the access
-- model of the table they hang off, rather than being quietly stricter than the
-- garment whose colour they describe.
--
-- Both photo URL columns point into the existing public-read `garment-photos`
-- bucket. No new bucket, no new Storage policy.
