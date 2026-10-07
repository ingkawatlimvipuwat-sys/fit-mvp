-- =============================================================
-- Catalogue: products, versions, pickers (Stage 1) + folders, tags (Stage 2 tables)
-- Spec: docs/superpowers/specs/2026-10-01-catalogue-organisation-design.md section 4
-- ADDITIVE ONLY. Old code never names the new columns, so it keeps working
-- between running this and merging Stage 1.
--
-- RUN ONCE. All-or-nothing: it is one transaction, so if any statement fails
-- it rolls back and nothing is changed. Running it a second time will fail on
-- the first create table (the tables already exist).
-- =============================================================

begin;

create table public.folders (
  id          uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  -- null = top level. No cascade: the API moves children up before deleting.
  parent_id   uuid references public.folders(id),
  name        text not null check (char_length(name) between 1 and 60),
  created_at  timestamptz not null default now()
);

create table public.products (
  id          uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  folder_id   uuid references public.folders(id) on delete set null,
  name        text not null check (char_length(name) between 1 and 120),
  created_at  timestamptz not null default now()
);
create index products_retailer_id_idx on public.products(retailer_id);

create table public.product_pickers (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 30),
  position   int  not null,
  unique (product_id, position)
);

create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 30),
  created_at  timestamptz not null default now()
);
create unique index tags_retailer_lower_name_idx on public.tags(retailer_id, lower(name));

create table public.product_tags (
  product_id uuid not null references public.products(id) on delete cascade,
  tag_id     uuid not null references public.tags(id) on delete cascade,
  primary key (product_id, tag_id)
);

-- A version is a garments row. product_id stays NULLABLE: old code inserts
-- garments without it. A later migration makes it NOT NULL.
alter table public.garments
  add column product_id uuid references public.products(id) on delete cascade,
  add column picks jsonb not null default '{}';
create index garments_product_id_idx on public.garments(product_id);

-- ---------- RLS: owner only, no anon policies ----------
-- The shopper page reads through the server-side admin client.
alter table public.folders enable row level security;
create policy "folders_owner_all" on public.folders for all
  using (retailer_id = auth.uid()) with check (retailer_id = auth.uid());

alter table public.products enable row level security;
create policy "products_owner_all" on public.products for all
  using (retailer_id = auth.uid()) with check (retailer_id = auth.uid());

alter table public.tags enable row level security;
create policy "tags_owner_all" on public.tags for all
  using (retailer_id = auth.uid()) with check (retailer_id = auth.uid());

alter table public.product_pickers enable row level security;
create policy "product_pickers_owner_all" on public.product_pickers for all
  using      (exists (select 1 from public.products p where p.id = product_id and p.retailer_id = auth.uid()))
  with check (exists (select 1 from public.products p where p.id = product_id and p.retailer_id = auth.uid()));

alter table public.product_tags enable row level security;
create policy "product_tags_owner_all" on public.product_tags for all
  using      (exists (select 1 from public.products p where p.id = product_id and p.retailer_id = auth.uid()))
  with check (exists (select 1 from public.products p where p.id = product_id and p.retailer_id = auth.uid()));

-- ---------- Backfill ----------
-- Every garment without a product gets its own, with the SAME id as the
-- garment, so an old shopper link /shop/<slug>/<garment_id> is also a valid
-- product id. No pickers: a one-version, no-picker product renders exactly
-- like today's page.
insert into public.products (id, retailer_id, name, created_at)
-- garments.name has no length check but products.name needs 1-120 characters,
-- so a blank or very long name must not abort the whole migration.
select g.id, g.retailer_id, coalesce(nullif(left(btrim(g.name), 120), ''), 'Untitled'), g.created_at
from public.garments g
where g.product_id is null
on conflict (id) do nothing;

update public.garments set product_id = id where product_id is null;

commit;
