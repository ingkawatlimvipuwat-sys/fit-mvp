# Catalogue Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Products with versions and shopper pickers: owners group garments into products (one Shopee listing = one link), each version is a full garment, and the shopper picks size/colour before the fit check.

**Architecture:** One additive migration (five new tables, two new `garments` columns, backfill: every existing garment becomes a one-version product with the *same id*, so old links keep resolving). All new rules live in pure functions in `lib/catalogue/` (unit-tested). API routes stay thin: load, call the pure rules, write. Shopper page is a new route `/shop/[slug]/p/[product_id]` holding a client `ProductView`; the old garment URL redirects to it.

**Tech Stack:** Next.js 15 App Router, Supabase (untyped client, RLS), zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-01-catalogue-organisation-design.md` (§3 rules, §4 data, §5 owner, §6 shopper, §7 errors, §8 Stage 1, §9 tests).

**Out of scope (Stage 2/3):** folders UI, tags UI, search, sort, filters, Move to…, drag-and-drop, reordering values, migration "0005 NOT NULL" step. The folders/tags *tables* ARE created now (spec §4.1) so Stage 2 needs no migration.

**Standing rules:** database is live, so no SQL anywhere except writing the file. Never rebase; `git merge origin/main`. Never `npm run build` while a dev server runs. Never use the words "mother/parent/base/main version". Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

**Renumbering (confirmed by `god` 2026-10-05):** the spec says 0004 (catalogue) and 0005 (NOT NULL). `0004_size_label.sql` is taken and the founder chose to run it on live, so the catalogue migration is **`0005_catalogue.sql`** and the later NOT NULL step is **`0006`**. `size_label` stays and must keep working (form select, dashboard card, shopper page).

**Open items (asked of `god` 2026-10-05; item 1 now answered, see above):**
1. Migration file number. `0004_size_label.sql` already exists on `main`, so this plan names the file `0005_catalogue.sql` (recommended; the later NOT NULL step becomes `0006`). If `god` says otherwise, rename the file and the references in Task 1 and Task 12 only.
2. No local database is available (`scripts/local-db.mjs` and `supabase/config.toml` are missing, no Docker). The migration is therefore **not executed anywhere**; Task 1 adds a static check of its text instead, and the report must say so.

---

## File map

| File | Responsibility |
|---|---|
| `supabase/migrations/0005_catalogue.sql` (new) | Tables, columns, RLS, backfill |
| `lib/catalogue/picks.ts` (new) | Pick normalising, completeness, duplicate detection, version resolution, grey-out, value order, clash-on-removal |
| `lib/catalogue/needs-attention.ts` (new) | §5.5 rules |
| `lib/catalogue/keep-shared.ts` (new) | Measurement carry-over between garment types |
| `lib/catalogue/parse.ts` (new) | Validate picker names and a picks field from a form |
| `lib/catalogue/ownership.ts` (new) | `loadProductContext`, `checkGarmentOwnership` — shop-scoped reads |
| `lib/garment/storage-cleanup.ts` (new, moved from `app/api/garments/[id]/route.ts`) | `removeStoredObject`, `removeStoredPhoto`, plus `copyStoredObject` |
| `app/api/products/route.ts`, `app/api/products/[id]/route.ts` (new) | Create (with default pickers), rename, delete (with photo cleanup) |
| `app/api/products/[id]/pickers/route.ts`, `.../pickers/[pickerId]/route.ts` (new) | Add / rename / remove picker |
| `app/api/garments/route.ts`, `app/api/garments/[id]/route.ts` (modify) | Accept `product_id`, `picks`, `copy_from`; enforce rule 4 |
| `app/dashboard/page.tsx`, `ProductGrid.tsx`, `ProductCard.tsx` (new/replace of GarmentGrid use) | Product cards, newest first |
| `app/dashboard/product/new/page.tsx`, `app/dashboard/product/[id]/page.tsx` + client parts (new) | Create product; product page (list layout) |
| `app/dashboard/garment/GarmentForm.tsx`, `new/page.tsx`, `[id]/edit/page.tsx` (modify) | Pick fields; product context; duplicate |
| `app/shop/[shop_slug]/p/[product_id]/page.tsx`, `ProductView.tsx` (new) | Shopper product page |
| `app/shop/[shop_slug]/[garment_id]/page.tsx` (modify) | Redirect to product page when the garment has one |
| `app/shop/[shop_slug]/[garment_id]/FitChecker.tsx` (modify) | Reset result and keep shared values when the garment changes |
| `app/shop/[shop_slug]/page.tsx`, `OtherGarments.tsx` (modify) | One card per product |
| `lib/i18n/strings.ts`, `lib/supabase/types.ts` (modify) | Copy and types |
| `docs/superpowers/resume.md`, `decisions-and-lessons.md` (modify) | Status of record; founder SQL steps live in the PR body and `docs/superpowers/plans/…-founder-steps` section below |

---

### Task 1: Migration file and static check

**Files:** Create `supabase/migrations/0005_catalogue.sql`; Test `lib/catalogue/migration.test.ts`.

- [ ] **Step 1: Write the failing test** — `lib/catalogue/migration.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sql = readFileSync(join(process.cwd(), 'supabase/migrations/0005_catalogue.sql'), 'utf8')
  .replace(/--.*$/gm, '').toLowerCase();

describe('0005_catalogue.sql stays additive (spec §4)', () => {
  it('creates the five tables', () => {
    for (const t of ['folders', 'products', 'product_pickers', 'tags', 'product_tags']) {
      expect(sql).toContain(`create table public.${t} `);
      expect(sql).toContain(`alter table public.${t} enable row level security`);
    }
  });
  it('never drops, renames or tightens existing columns', () => {
    expect(sql).not.toMatch(/\bdrop\b/);
    expect(sql).not.toMatch(/rename/);
    expect(sql).not.toMatch(/set not null/);
  });
  it('adds product_id nullable and picks with a default', () => {
    expect(sql).toMatch(/add column product_id uuid references public\.products\(id\) on delete cascade[,;]/);
    expect(sql).toMatch(/add column picks jsonb not null default '\{\}'/);
  });
  it('gives anon no read policy', () => {
    expect(sql).not.toMatch(/to anon/);
  });
  it('backfills one product per unlinked garment, reusing the garment id', () => {
    expect(sql).toMatch(/insert into public\.products[\s\S]*from public\.garments[\s\S]*where product_id is null/);
    expect(sql).toMatch(/update public\.garments set product_id = id where product_id is null/);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** — `npx vitest run lib/catalogue/migration.test.ts` → ENOENT on the sql file.

- [ ] **Step 3: Write the migration** — `supabase/migrations/0005_catalogue.sql`

```sql
-- =============================================================
-- Catalogue: products, versions, pickers (Stage 1) + folders, tags (Stage 2 tables)
-- Spec: docs/superpowers/specs/2026-10-01-catalogue-organisation-design.md section 4
-- ADDITIVE ONLY. Old code never names the new columns, so it keeps working
-- between running this and merging Stage 1.
-- =============================================================

create table public.folders (
  id          uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  parent_id   uuid references public.folders(id),            -- null = top level; no cascade (API moves children up)
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

-- A version is a garments row. product_id stays NULLABLE: old code inserts garments without it.
alter table public.garments
  add column product_id uuid references public.products(id) on delete cascade,
  add column picks jsonb not null default '{}';
create index garments_product_id_idx on public.garments(product_id);

-- ---------- RLS: owner only, no anon policies (the shopper page uses the admin client) ----------
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

-- ---------- Backfill (idempotent) ----------
-- Every garment without a product gets its own, with the SAME id as the garment,
-- so an old shopper link /shop/<slug>/<garment_id> is also a valid product id.
-- No pickers: a one-version, no-picker product renders exactly like today's page.
insert into public.products (id, retailer_id, name, created_at)
select g.id, g.retailer_id, g.name, g.created_at
from public.garments g
where product_id is null
on conflict (id) do nothing;

update public.garments set product_id = id where product_id is null;
```

- [ ] **Step 4: Run test, expect PASS.** `npx vitest run lib/catalogue/migration.test.ts`
- [ ] **Step 5: Commit** — `git add supabase/migrations/0005_catalogue.sql lib/catalogue/migration.test.ts && git commit -m "feat: catalogue migration (products, versions, pickers) — not run anywhere"`

---

### Task 2: Pick rules (`lib/catalogue/picks.ts`)

**Files:** Create `lib/catalogue/picks.ts`; Test `lib/catalogue/picks.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import {
  normPick, isComplete, findDuplicate, versionLabel, resolveVersion,
  availableValues, valueOrder, clashesAfterRemoval,
} from './picks';

const IDS = ['size', 'colour'];
const PICKERS = [{ id: 'size', name: 'Size', position: 0 }, { id: 'colour', name: 'Colour', position: 1 }];
const v = (id: string, picks: Record<string, string>, created_at = '2026-01-01T00:00:0' + id.length + 'Z') =>
  ({ id, picks, created_at });
const VERSIONS = [
  v('a', { size: 'L', colour: 'Black' }, '2026-01-01T00:00:01Z'),
  v('b', { size: 'L', colour: 'Green' }, '2026-01-01T00:00:02Z'),
  v('c', { size: 'M', colour: 'black ' }, '2026-01-01T00:00:03Z'),
];

describe('normPick', () => {
  it('trims and lowercases', () => expect(normPick(' Black ')).toBe('black'));
});

describe('isComplete', () => {
  it('needs a non-blank value for every picker', () => {
    expect(isComplete({ size: 'L', colour: 'Black' }, IDS)).toBe(true);
    expect(isComplete({ size: 'L' }, IDS)).toBe(false);
    expect(isComplete({ size: 'L', colour: '  ' }, IDS)).toBe(false);
  });
  it('a product with no pickers is always complete', () => expect(isComplete({}, [])).toBe(true));
});

describe('findDuplicate (rule 4)', () => {
  it('matches trimmed and case-insensitively', () => {
    expect(findDuplicate(VERSIONS, { size: 'm', colour: 'BLACK' }, IDS)?.id).toBe('c');
  });
  it('is null when something differs', () => {
    expect(findDuplicate(VERSIONS, { size: 'M', colour: 'Green' }, IDS)).toBe(null);
  });
  it('ignores the version being edited', () => {
    expect(findDuplicate(VERSIONS, { size: 'L', colour: 'Black' }, IDS, 'a')).toBe(null);
  });
  it('with no pickers, a second version always clashes', () => {
    expect(findDuplicate([v('a', {})], {}, [])?.id).toBe('a');
  });
});

describe('versionLabel', () => {
  it('joins picks in picker order', () => expect(versionLabel({ colour: 'Black', size: 'L' }, PICKERS)).toBe('L / Black'));
  it('skips blanks', () => expect(versionLabel({ size: 'L' }, PICKERS)).toBe('L'));
});

describe('resolveVersion', () => {
  it('finds the exact version once every picker is chosen', () => {
    expect(resolveVersion(VERSIONS, { size: 'L', colour: 'green' }, IDS)?.id).toBe('b');
  });
  it('is null for a partial selection', () => {
    expect(resolveVersion(VERSIONS, { size: 'L' }, IDS)).toBe(null);
  });
  it('is null when no such combination exists', () => {
    expect(resolveVersion(VERSIONS, { size: 'M', colour: 'Green' }, IDS)).toBe(null);
  });
  it('a single version with no pickers resolves with an empty selection', () => {
    expect(resolveVersion([v('a', {})], {}, [])?.id).toBe('a');
  });
});

describe('availableValues (grey-out)', () => {
  it('with nothing chosen, every used value is available', () => {
    expect([...availableValues(VERSIONS, IDS, {}, 'size')].sort()).toEqual(['l', 'm']);
  });
  it('colour options narrow to what exists for the chosen size', () => {
    expect([...availableValues(VERSIONS, IDS, { size: 'M' }, 'colour')]).toEqual(['black']);
    expect([...availableValues(VERSIONS, IDS, { size: 'L' }, 'colour')].sort()).toEqual(['black', 'green']);
  });
  it("a picker's own current choice does not narrow itself", () => {
    expect([...availableValues(VERSIONS, IDS, { size: 'M', colour: 'Black' }, 'size')].sort()).toEqual(['l', 'm']);
  });
  it('ignores incomplete versions', () => {
    const withPartial = [...VERSIONS, v('d', { size: 'XL' })];
    expect(availableValues(withPartial, IDS, {}, 'size').has('xl')).toBe(false);
  });
});

describe('valueOrder (first-used order, §4.5)', () => {
  it('orders by created_at and de-duplicates case-insensitively keeping the first spelling', () => {
    expect(valueOrder(VERSIONS, 'colour')).toEqual(['Black', 'Green']);
    expect(valueOrder([...VERSIONS].reverse(), 'size')).toEqual(['L', 'M']);
  });
});

describe('clashesAfterRemoval', () => {
  it('reports versions that would become identical', () => {
    const vs = [v('a', { size: 'L', colour: 'Black' }), v('b', { size: 'L', colour: 'Green' })];
    const clashes = clashesAfterRemoval(vs, IDS, 'colour');
    expect(clashes.map(([x, y]) => [x.id, y.id])).toEqual([['a', 'b']]);
  });
  it('reports nothing when versions stay distinct', () => {
    expect(clashesAfterRemoval(VERSIONS, IDS, 'colour')).toEqual([['a', 'b']].length ? clashesAfterRemoval(VERSIONS, IDS, 'colour') : []);
    const distinct = [v('a', { size: 'L', colour: 'x' }), v('b', { size: 'M', colour: 'x' })];
    expect(clashesAfterRemoval(distinct, IDS, 'colour')).toEqual([]);
  });
});
```

(In the last test replace the tautological first line with a plain `expect(clashesAfterRemoval(VERSIONS, IDS, 'colour').length).toBe(1)` — VERSIONS a/b both become `size=L`. Write it that way.)

- [ ] **Step 2: Run, expect FAIL** (module not found).
- [ ] **Step 3: Implement** — `lib/catalogue/picks.ts`

```ts
/** A version's picks, keyed by product_pickers.id. */
export type Picks = Record<string, string>;
export interface PickerDef { id: string; name: string; position: number }
export interface VersionPicks { id: string; picks: Picks; created_at: string }

export const normPick = (v: string | undefined | null): string => (v ?? '').trim().toLowerCase();

export function isComplete(picks: Picks, pickerIds: string[]): boolean {
  return pickerIds.every(id => normPick(picks[id]) !== '');
}

function keyOf(picks: Picks, pickerIds: string[]): string {
  return pickerIds.map(id => normPick(picks[id])).join('\u0000');
}

/** Rule 4: another version of the same product with the same picks, or null. */
export function findDuplicate<T extends VersionPicks>(
  versions: T[], candidate: Picks, pickerIds: string[], ignoreId?: string,
): T | null {
  const k = keyOf(candidate, pickerIds);
  return versions.find(x => x.id !== ignoreId && keyOf(x.picks, pickerIds) === k) ?? null;
}

/** "L / Black": display spellings, picker order, blanks skipped. */
export function versionLabel(picks: Picks, pickers: PickerDef[]): string {
  return [...pickers]
    .sort((a, b) => a.position - b.position)
    .map(p => (picks[p.id] ?? '').trim())
    .filter(Boolean)
    .join(' / ');
}

/** The one version a full selection names. Null for partial or non-existent selections. */
export function resolveVersion<T extends VersionPicks>(
  versions: T[], selection: Picks, pickerIds: string[],
): T | null {
  if (!isComplete(selection, pickerIds)) return null;
  return findDuplicate(versions, selection, pickerIds) ;
}

/**
 * Normalised values of `pickerId` that exist among COMPLETE versions consistent
 * with every OTHER picker the shopper has already chosen. Others are greyed out.
 */
export function availableValues(
  versions: VersionPicks[], pickerIds: string[], selection: Picks, pickerId: string,
): Set<string> {
  const out = new Set<string>();
  for (const x of versions) {
    if (!isComplete(x.picks, pickerIds)) continue;
    const ok = pickerIds.every(id =>
      id === pickerId || normPick(selection[id]) === '' || normPick(selection[id]) === normPick(x.picks[id]));
    if (ok) out.add(normPick(x.picks[pickerId]));
  }
  return out;
}

/** Display values for one picker in the order the owner first used them (by created_at). */
export function valueOrder(versions: VersionPicks[], pickerId: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of [...versions].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const raw = (x.picks[pickerId] ?? '').trim();
    if (!raw || seen.has(normPick(raw))) continue;
    seen.add(normPick(raw));
    out.push(raw);
  }
  return out;
}

/** Pairs of versions that would become identical if `removeId` picker were deleted. */
export function clashesAfterRemoval<T extends VersionPicks>(
  versions: T[], pickerIds: string[], removeId: string,
): [T, T][] {
  const rest = pickerIds.filter(id => id !== removeId);
  const pairs: [T, T][] = [];
  for (let i = 0; i < versions.length; i++) {
    for (let j = i + 1; j < versions.length; j++) {
      if (keyOf(versions[i].picks, rest) === keyOf(versions[j].picks, rest)) pairs.push([versions[i], versions[j]]);
    }
  }
  return pairs;
}
```

- [ ] **Step 4: Run, expect PASS.** `npx vitest run lib/catalogue/picks.test.ts`
- [ ] **Step 5: Commit** — `git add lib/catalogue && git commit -m "feat: pick rules (duplicates, resolution, grey-out, order)"`

---

### Task 3: Needs-attention and measurement carry-over

**Files:** Create `lib/catalogue/needs-attention.ts`, `lib/catalogue/keep-shared.ts`; Tests alongside.

- [ ] **Step 1: Failing tests**

`lib/catalogue/needs-attention.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { attentionReasons } from './needs-attention';
import { dimensionsForCategory } from '@/lib/config/dimensions';

const full = Object.fromEntries(dimensionsForCategory('top').map(d => [d.key, 50]));
const ver = (over: Record<string, unknown> = {}) =>
  ({ category: 'top' as const, measurements: full, picks: { size: 'L' }, ...over });

describe('attentionReasons (§5.5)', () => {
  it('flags a product with no versions', () => {
    expect(attentionReasons([], ['size'])).toEqual(['no_versions']);
  });
  it('is clean for a complete version', () => {
    expect(attentionReasons([ver()], ['size'])).toEqual([]);
  });
  it('flags a missing measurement for the garment type', () => {
    const { [Object.keys(full)[0]]: _drop, ...rest } = full;
    expect(attentionReasons([ver({ measurements: rest })], ['size'])).toEqual(['missing_measurement']);
  });
  it('flags a missing pick', () => {
    expect(attentionReasons([ver({ picks: {} })], ['size'])).toEqual(['missing_pick']);
  });
  it('reports each reason once', () => {
    const r = attentionReasons([ver({ picks: {}, measurements: {} }), ver({ picks: {} })], ['size']);
    expect(r.sort()).toEqual(['missing_measurement', 'missing_pick']);
  });
});
```
(`_drop` must not trip `next lint`: use `const rest = { ...full }; delete rest[Object.keys(full)[0]];` instead.)

`lib/catalogue/keep-shared.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { keepSharedValues } from './keep-shared';

describe('keepSharedValues', () => {
  it('keeps values for dimensions the new garment also asks for', () => {
    expect(keepSharedValues({ chest_cm: '100', waist_cm: '80' }, ['chest_cm', 'length_cm']))
      .toEqual({ chest_cm: '100' });
  });
  it('returns an empty object when nothing is shared', () => {
    expect(keepSharedValues({ chest_cm: '100' }, ['hip_cm'])).toEqual({});
  });
});
```
Before writing, run `grep -n "key:" lib/config/dimensions.ts` and use real dimension keys in these fixtures (the clothing keys are `chest_cm` etc.; confirm).

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**

`lib/catalogue/needs-attention.ts`:
```ts
import { dimensionsForCategory } from '@/lib/config/dimensions';
import { isComplete, type Picks } from './picks';
import type { Category, MeasurementBag } from '@/lib/supabase/types';

export type AttentionReason = 'no_versions' | 'missing_measurement' | 'missing_pick';

export function attentionReasons(
  versions: { category: Category; measurements: MeasurementBag; picks: Picks }[],
  pickerIds: string[],
): AttentionReason[] {
  if (versions.length === 0) return ['no_versions'];
  const out = new Set<AttentionReason>();
  for (const v of versions) {
    const bag = (v.measurements ?? {}) as Record<string, number | undefined>;
    if (dimensionsForCategory(v.category).some(d => typeof bag[d.key] !== 'number')) out.add('missing_measurement');
    if (!isComplete(v.picks ?? {}, pickerIds)) out.add('missing_pick');
  }
  return [...out];
}
```
`lib/catalogue/keep-shared.ts`:
```ts
export function keepSharedValues(values: Record<string, string>, newKeys: string[]): Record<string, string> {
  const keep = new Set(newKeys);
  return Object.fromEntries(Object.entries(values).filter(([k]) => keep.has(k)));
}
```
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `feat: needs-attention rules and measurement carry-over`.

---

### Task 4: Parsing and ownership (`parse.ts`, `ownership.ts`)

**Files:** Create `lib/catalogue/parse.ts`, `lib/catalogue/ownership.ts`; Tests `parse.test.ts`, `ownership.test.ts`. Pattern copied from `lib/garment/ruleset-ownership.ts`: every read is scoped by `retailer_id`, so another shop's id looks nonexistent (404); a failed lookup is 500 and never a pass.

- [ ] **Step 1: Failing tests**

`parse.test.ts` — cases: `parseProductName` trims, rejects empty and >120 chars; `parsePickerName` trims, 1–30 chars; `parsePicksField(raw, pickerIds)` accepts a JSON object whose keys are all in `pickerIds` and whose values are strings ≤60 chars (trimmed), rejects: non-JSON, arrays, unknown picker key, non-string value, over-long value; absent/empty field returns `{}`.
```ts
import { describe, it, expect } from 'vitest';
import { parseProductName, parsePickerName, parsePicksField } from './parse';

describe('names', () => {
  it('trims', () => { expect(parseProductName('  Tee ')).toEqual({ ok: true, value: 'Tee' }); });
  it('rejects blank and too long', () => {
    expect(parseProductName('  ').ok).toBe(false);
    expect(parseProductName('x'.repeat(121)).ok).toBe(false);
    expect(parsePickerName('x'.repeat(31)).ok).toBe(false);
    expect(parsePickerName('Size')).toEqual({ ok: true, value: 'Size' });
  });
});

describe('parsePicksField', () => {
  const ids = ['p1', 'p2'];
  it('empty is {}', () => { expect(parsePicksField('', ids)).toEqual({ ok: true, picks: {} }); });
  it('accepts known keys and trims values', () => {
    expect(parsePicksField('{"p1":" L ","p2":"Black"}', ids)).toEqual({ ok: true, picks: { p1: 'L', p2: 'Black' } });
  });
  it('rejects an unknown picker id (another shop\'s picker looks like this)', () => {
    expect(parsePicksField('{"zzz":"L"}', ids).ok).toBe(false);
  });
  it('rejects bad shapes', () => {
    for (const bad of ['not json', '[]', '{"p1":5}', JSON.stringify({ p1: 'x'.repeat(61) })]) {
      expect(parsePicksField(bad, ids).ok).toBe(false);
    }
  });
});
```
`ownership.test.ts` uses a tiny fake client — rows in memory, `.from(t).select().eq(c,v)...` filters, `.maybeSingle()` / awaiting the builder returns `{data, error}`:
```ts
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadProductContext, checkGarmentOwnership } from './ownership';

type Row = Record<string, unknown>;
function fake(tables: Record<string, Row[]>, failTable?: string): SupabaseClient {
  return {
    from(table: string) {
      const filters: [string, unknown][] = [];
      const b: Record<string, unknown> = {
        select: () => b,
        eq: (c: string, v: unknown) => { filters.push([c, v]); return b; },
        order: () => b,
        maybeSingle: async () => run(true),
        then: (res: (v: unknown) => unknown) => Promise.resolve(run(false)).then(res),
      };
      function run(single: boolean) {
        if (table === failTable) return { data: null, error: { message: 'boom' } };
        const rows = (tables[table] ?? []).filter(r => filters.every(([c, v]) => r[c] === v));
        return { data: single ? rows[0] ?? null : rows, error: null };
      }
      return b;
    },
  } as unknown as SupabaseClient;
}

const DB = {
  products: [{ id: 'P1', retailer_id: 'A', name: 'Tee' }, { id: 'P2', retailer_id: 'B', name: 'Other' }],
  product_pickers: [{ id: 'k1', product_id: 'P1', name: 'Size', position: 0 }],
  garments: [
    { id: 'G1', retailer_id: 'A', product_id: 'P1', picks: { k1: 'L' }, category: 'top', measurements: {}, created_at: '2026-01-01T00:00:00Z' },
    { id: 'G2', retailer_id: 'B', product_id: 'P2', picks: {}, category: 'top', measurements: {}, created_at: '2026-01-01T00:00:00Z' },
  ],
};

describe('loadProductContext', () => {
  it('loads own product with pickers and versions', async () => {
    const r = await loadProductContext(fake(DB), 'A', 'P1');
    expect(r.ok && r.ctx.pickers.map(p => p.id)).toEqual(['k1']);
    expect(r.ok && r.ctx.versions.map(v => v.id)).toEqual(['G1']);
  });
  it("another shop's product is a 404, same as nonexistent", async () => {
    expect(await loadProductContext(fake(DB), 'A', 'P2')).toMatchObject({ ok: false, status: 404 });
    expect(await loadProductContext(fake(DB), 'A', 'nope')).toMatchObject({ ok: false, status: 404 });
  });
  it('fails closed with 500 when the lookup errors', async () => {
    expect(await loadProductContext(fake(DB, 'products'), 'A', 'P1')).toMatchObject({ ok: false, status: 500 });
  });
});

describe('checkGarmentOwnership', () => {
  it('accepts own garment', async () => {
    expect(await checkGarmentOwnership(fake(DB), 'A', 'G1')).toMatchObject({ ok: true });
  });
  it("rejects another shop's garment as 404", async () => {
    expect(await checkGarmentOwnership(fake(DB), 'A', 'G2')).toMatchObject({ ok: false, status: 404 });
  });
});
```
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**

`lib/catalogue/parse.ts`:
```ts
import type { Picks } from './picks';

type Named = { ok: true; value: string } | { ok: false; error: string };

function named(raw: unknown, max: number, error: string): Named {
  const value = String(raw ?? '').trim();
  return value.length >= 1 && value.length <= max ? { ok: true, value } : { ok: false, error };
}
export const parseProductName = (raw: unknown) => named(raw, 120, 'invalid product name');
export const parsePickerName = (raw: unknown) => named(raw, 30, 'invalid picker name');

export function parsePicksField(raw: unknown, pickerIds: string[]):
  { ok: true; picks: Picks } | { ok: false; error: string } {
  const text = String(raw ?? '').trim();
  if (!text) return { ok: true, picks: {} };
  let json: unknown;
  try { json = JSON.parse(text); } catch { return { ok: false, error: 'invalid picks' }; }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return { ok: false, error: 'invalid picks' };
  const allowed = new Set(pickerIds);
  const picks: Picks = {};
  for (const [k, v] of Object.entries(json)) {
    if (!allowed.has(k)) return { ok: false, error: 'invalid picks' };
    if (typeof v !== 'string' || v.trim().length > 60) return { ok: false, error: 'invalid picks' };
    picks[k] = v.trim();
  }
  return { ok: true, picks };
}
```
`lib/catalogue/ownership.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { t } from '@/lib/i18n/strings';
import type { PickerDef, Picks } from './picks';
import type { Category, MeasurementBag } from '@/lib/supabase/types';

export interface ProductContext {
  id: string;
  name: string;
  pickers: PickerDef[];
  versions: { id: string; picks: Picks; created_at: string; category: Category; measurements: MeasurementBag }[];
}
export type Failure = { ok: false; status: 404 | 500; error: string };

const fail500: Failure = { ok: false, status: 500, error: t.saveFailed.th };
const fail404: Failure = { ok: false, status: 404, error: 'not found' };

/**
 * One product, its pickers and its versions, for a caller. The product read is
 * scoped by retailer_id so another shop's id looks nonexistent; pickers and
 * versions are then read by that verified product id. A failed read is a 500,
 * never a pass.
 */
export async function loadProductContext(
  supabase: SupabaseClient, userId: string, productId: string,
): Promise<{ ok: true; ctx: ProductContext } | Failure> {
  const { data: product, error } = await supabase
    .from('products').select('id, name').eq('id', productId).eq('retailer_id', userId).maybeSingle();
  if (error) { console.error('product lookup failed:', error); return fail500; }
  if (!product) return fail404;

  const [{ data: pickers, error: pErr }, { data: versions, error: vErr }] = await Promise.all([
    supabase.from('product_pickers').select('id, name, position').eq('product_id', productId).order('position', { ascending: true }),
    supabase.from('garments').select('id, picks, created_at, category, measurements')
      .eq('product_id', productId).eq('retailer_id', userId).order('created_at', { ascending: true }),
  ]);
  if (pErr || vErr) { console.error('product detail lookup failed:', pErr ?? vErr); return fail500; }
  return {
    ok: true,
    ctx: {
      id: product.id, name: product.name,
      pickers: (pickers ?? []) as PickerDef[],
      versions: (versions ?? []) as ProductContext['versions'],
    },
  };
}

/** Is this garment the caller's? Used for `copy_from`. */
export async function checkGarmentOwnership(
  supabase: SupabaseClient, userId: string, garmentId: string,
): Promise<{ ok: true } | Failure> {
  const { data, error } = await supabase
    .from('garments').select('id').eq('id', garmentId).eq('retailer_id', userId).maybeSingle();
  if (error) { console.error('garment ownership lookup failed:', error); return fail500; }
  return data ? { ok: true } : fail404;
}
```
Note `order(...)` in the fake returns the builder, and `await builder` uses its `then`; the real client does the same, so the code path matches.
- [ ] **Step 4: Run, expect PASS.** `npx vitest run lib/catalogue`
- [ ] **Step 5: Commit** — `feat: catalogue parsing and shop-scoped ownership reads`.

---

### Task 5: Strings and types

**Files:** Modify `lib/i18n/strings.ts`, `lib/supabase/types.ts`.

- [ ] **Step 1:** Add to `Garment`: `product_id: string | null; picks: Record<string, string>;`. Add interfaces `Product { id; retailer_id; folder_id: string | null; name; created_at }` and `ProductPicker { id; product_id; name; position }`.
- [ ] **Step 2:** Add keys to `strings.ts` (Thai first; follow the file's `{ th, en }` shape). Required keys, with text:

| key | th | en |
|---|---|---|
| `productSingular` | สินค้า | Product |
| `newProduct` | เพิ่มสินค้า | New product |
| `productName` | ชื่อสินค้า | Product name |
| `versionsCount` | {n} แบบ | {n} versions |
| `addVersion` | + เพิ่มแบบ | + Add version |
| `duplicateVersion` | ทำซ้ำ | Duplicate |
| `copyShopperLink` | คัดลอกลิงก์ลูกค้า | Copy shopper link |
| `pickerSize` / `pickerColour` | ไซส์ / สี | Size / Colour |
| `addPicker` | + เพิ่มตัวเลือก | + Add picker |
| `pickerValuesPrompt` | กรอกค่าของแบบที่มีอยู่ (เว้นว่างได้) | Fill in the existing versions' values (can be left blank) |
| `removePicker` | ลบตัวเลือก | Remove picker |
| `needsAttention` | ต้องแก้ไข | Needs attention |
| `attentionNoVersions` / `attentionMissingMeasurement` / `attentionMissingPick` | ยังไม่มีแบบ / ขาดขนาดตัวเลข / ขาดตัวเลือก | No versions yet / Missing a measurement / Missing a pick |
| `duplicatePicks` | {label} มีอยู่แล้ว | {label} already exists |
| `removePickerClash` | ลบไม่ได้: {a} กับ {b} จะซ้ำกัน | Can't remove: {a} and {b} would become identical |
| `confirmDeleteProduct` | ลบสินค้านี้และทุกแบบ? ลบแล้วกู้คืนไม่ได้ | Delete this product and all its versions? This cannot be undone. |
| `pickFirst` | เลือก {names} ก่อน | Pick {names} first |
| `noVersions` | ยังไม่มีแบบ เพิ่มแบบแรกได้เลย | No versions yet. Add the first one. |
| `addPickersFirst` | เพิ่มตัวเลือก (ไซส์ สี ฯลฯ) ก่อนเพิ่มแบบที่สอง | Add pickers (size, colour…) before a second version |

- [ ] **Step 3:** `npx tsc --noEmit` clean. Commit `feat: catalogue strings and types`.

---

### Task 6: Storage helpers and product API

**Files:** Create `lib/garment/storage-cleanup.ts`, `app/api/products/route.ts`, `app/api/products/[id]/route.ts`; Modify `app/api/garments/[id]/route.ts` (import the moved helpers); Test `lib/garment/storage-cleanup.test.ts`.

- [ ] **Step 1:** Move `removeStoredObject` and `removeStoredPhoto` unchanged from `app/api/garments/[id]/route.ts` to `lib/garment/storage-cleanup.ts` (export both); import them back in the route. Add:
```ts
/**
 * Copy one stored object to a new path under the same owner, returning the new
 * public URL and path. Returns null for a null/unreadable url, 'failed' on error.
 * Duplicate never shares a URL between versions (spec 5.4).
 */
export async function copyStoredObject(
  supabase: SupabaseClient, userId: string, photoUrl: string | null,
): Promise<PhotoUpload | null | 'failed'> {
  const from = pathFromPublicUrl(photoUrl);
  if (!from) return null;
  if (!from.startsWith(`${userId}/`)) return 'failed';   // never copy another shop's file
  const to = storageKeyFor(userId, from);
  const { error } = await supabase.storage.from(PHOTO_BUCKET).copy(from, to);
  if (error) { console.error('storage copy failed:', error); return 'failed'; }
  return { url: supabase.storage.from(PHOTO_BUCKET).getPublicUrl(to).data.publicUrl, path: to };
}
```
- [ ] **Step 2: Failing test** `storage-cleanup.test.ts` with a stub client whose `storage.from().copy/getPublicUrl` record calls: copy of own path calls `copy(from, to)` with `to` under the same `${userId}/` prefix and different from `from`; foreign prefix returns `'failed'` without calling copy; null url returns null.
- [ ] **Step 3:** Run (FAIL), implement, run (PASS).
- [ ] **Step 4: `POST /api/products`** — body JSON `{ name }`. Auth 401; `parseProductName`; insert product `{retailer_id: user.id, name}`; insert two pickers `Size` position 0 and `Colour` position 1 (names from `t.pickerSize.th` / `t.pickerColour.th`); if the picker insert fails, delete the product and return 500 `t.saveFailed.th`; return `{ ok: true, id }`.
- [ ] **Step 5: `PATCH /api/products/[id]`** — body `{ name }`; `loadProductContext` first (404/500 via `status`), then update `.eq('id').eq('retailer_id')`. Versions' stored `garments.name` is deliberately not synced (spec 4.2).
- [ ] **Step 6: `DELETE /api/products/[id]`** — `loadProductContext` → 404/500; read `photo_url, true_colour_photo_url` of its versions and `garment_fabric.fabric_photo_url` (`in('garment_id', ids)`) BEFORE deleting (cascade destroys the rows that name them); delete product `.eq('retailer_id')`; then `removeStoredPhoto` for every URL. Return `{ ok: true }`.
- [ ] **Step 7:** `npm test && npx tsc --noEmit`. Commit `feat: product API and storage helpers`.

---

### Task 7: Garment API accepts product, picks, copy_from

**Files:** Modify `app/api/garments/route.ts`, `app/api/garments/[id]/route.ts`; add a small pure helper + test in `lib/catalogue/version-write.ts`.

Rules enforced here: shop isolation (product from `loadProductContext`; `copy_from` from `checkGarmentOwnership`; picks keys must be that product's pickers), rule 4 (Thai error naming the clash), name copied from the product.

- [ ] **Step 1: Failing test** `lib/catalogue/version-write.test.ts` for
```ts
export function checkPicksForWrite(
  ctx: { pickers: PickerDef[]; versions: VersionPicks[] }, picks: Picks, ignoreId?: string,
): { ok: true } | { ok: false; error: string }
```
Cases: complete + unique → ok; missing a pick when pickers exist → error `t.pickRequired.th` (add key `pickRequired`: th "เลือกให้ครบทุกตัวเลือก", en "Fill in every picker"); duplicate (trim/case) → error `t.duplicatePicks.th.replace('{label}', versionLabel(existing.picks, pickers))`; editing a version ignores itself; product with no pickers and an existing version → error `t.addPickersFirst.th`; product with no pickers and no other version → ok.
- [ ] **Step 2:** Run (FAIL); implement using `isComplete`, `findDuplicate`, `versionLabel`; run (PASS).
- [ ] **Step 3: `POST /api/garments`** — after `req.formData()` and before `parseGarmentFields`: read optional `product_id`. If present: `z.uuid()` check → 400; `loadProductContext(supabase, user.id, productId)` → on failure return `{error}` with its status; `form.set('name', ctx.name)`; `parsePicksField(form.get('picks'), ctx.pickers.map(p=>p.id))` → 400; `checkPicksForWrite(ctx, picks)` → 400. Optional `copy_from`: `z.uuid()`; `checkGarmentOwnership` → status. In the insert add `product_id`, `picks` only when product given (so a product-less create is byte-identical to today). When `copy_from` is set and no new `photo` file arrived: read the source's `photo_url, true_colour_photo_url`, `garment_fabric.fabric_photo_url` (scoped `.eq('retailer_id', user.id)` via the ownership read), and `copyStoredObject` each; `photo` is then not "required" (`photoRequired` only when there is no upload and no copy); a `'failed'` copy cleans up uploaded/copied paths and returns 500 `t.photoUploadFailed.th`. Fabric photo copy applies only if the submitted fabric is present (same rule as a new upload) and no new `fabric_photo` file came.
- [ ] **Step 4: `PATCH /api/garments/[id]`** — select `photo_url, true_colour_photo_url, product_id` in the existing read. If `product_id` is non-null: `loadProductContext(…, existing.product_id)`; `form.set('name', ctx.name)` before parse; `parsePicksField`; `checkPicksForWrite(ctx, picks, params.id)`; add `picks` to the update payload. If `product_id` is null (a garment created in the gap), behave exactly as today and ignore any `picks` field. The client never sends `product_id` on PATCH; moving a version between products is not allowed in Stage 1.
- [ ] **Step 5:** `npm test && npx tsc --noEmit`. Commit `feat: garment routes enforce product ownership, picks and duplicate rule`.

---

### Task 8: Picker API

**Files:** Create `app/api/products/[id]/pickers/route.ts`, `app/api/products/[id]/pickers/[pickerId]/route.ts`; add pure helper `lib/catalogue/picker-ops.ts` + test.

Pure helpers (test first, in `picker-ops.test.ts`):
- `nextPosition(pickers)` → `max(position)+1`, `0` when empty.
- `parseBackfill(raw, versionIds)` → validates `{ [versionId]: string }` (known version ids only, values trimmed ≤60, blank allowed = skip).
- `planAddPicker(ctx, name, values)` → `{ newVersionPicks: {id, picks}[] }`: for each version with a non-blank value, picks gets `{...picks, [newPickerId]: value}`; result must keep rule 4 for the *fully complete* set — if two versions end up identical, return `{ ok:false, error: duplicatePicks… }`.

- [ ] **Step 1: `POST …/pickers`** body JSON `{ name, values?: Record<versionId,string> }`: `loadProductContext`; `parsePickerName`; `parseBackfill`; generate the picker with `position = nextPosition`; insert it; then for each version needing a pick write `update garments set picks = … where id and retailer_id` (a failed write returns 500; the new picker row stays and the response tells the page to refresh, which shows ⚠ missing pick — acceptable and honest).
- [ ] **Step 2: `PATCH …/pickers/[pickerId]`** `{ name }` rename: `loadProductContext`, confirm `pickerId` is in `ctx.pickers` (else 404), update by `id` and `product_id`.
- [ ] **Step 3: `DELETE …/pickers/[pickerId]`**: `loadProductContext`; confirm picker belongs to product (else 404); `clashesAfterRemoval(ctx.versions, ids, pickerId)` — if any, 409 with `t.removePickerClash.th` filled with the two `versionLabel`s (computed WITH the picker, so the owner recognises them); otherwise delete the picker and strip that key from every version's picks (update each version whose picks contain it).
- [ ] **Step 4:** tests for the three helpers PASS; `npx tsc --noEmit`. Commit `feat: picker API (add with backfill, rename, remove with clash guard)`.

---

### Task 9: Owner UI — dashboard cards, product page, version form

**Files:** Modify `app/dashboard/page.tsx`; Create `ProductGrid.tsx`, `ProductCard.tsx`, `app/dashboard/product/new/page.tsx` + `NewProductForm.tsx`, `app/dashboard/product/[id]/page.tsx` + `ProductEditor.tsx` (client: name, pickers, version rows, copy link, delete product); Modify `AddGarmentLink.tsx` (→ "New product"), `GarmentForm.tsx`, `garment/new/page.tsx`, `garment/[id]/edit/page.tsx`. Keep `GarmentCard/GarmentGrid` files for garments with no product (gap period); the dashboard renders `ProductGrid` plus a "no product yet" section only when such garments exist.

- [ ] **Step 1: Dashboard query** (server, user-scoped): `products` (id, name, created_at) for `retailer_id`, newest first; `product_pickers` for those ids; `garments` (id, product_id, category, measurements, picks, photo_url, created_at) with `product_id` in ids, ordered `created_at asc`. Group in code (one query each — no N+1). Per product: `versionCount`, `photo_url` of the first-created version, `needsAttention = attentionReasons(...).length > 0`. Also select garments `where product_id is null` → legacy list rendered by the old `GarmentGrid`.
- [ ] **Step 2: `ProductCard`** — photo (or grey box), name, `t.versionsCount`, ⚠ `t.needsAttention` badge; links to `/dashboard/product/[id]`; also a preview link to `/shop/<slug>/p/<id>` opening in a new tab.
- [ ] **Step 3: New product page** — one name field, POST `/api/products`, on `ok` `router.push('/dashboard/product/' + id)`. Unsaved-work guard like `GarmentForm` is NOT needed (single field).
- [ ] **Step 4: Product page (server)** — `loadProductContext` (scoped; `notFound()` on 404, throw on 500), plus versions' `photo_url`, first colour hex (`garment_colours`, one `in()` query), measurements. Render `ProductEditor` with plain props.
- [ ] **Step 5: `ProductEditor` (client)** — header: editable name (PATCH on blur), **Copy shopper link** (`${location.origin}/shop/${slug}/p/${id}`, reuse `CopyPublicLink`'s clipboard approach), delete product (confirm with `t.confirmDeleteProduct`, DELETE, then `router.push('/dashboard')`). Pickers: list with rename-on-blur and remove (409 message shown inline); **Add picker** opens an inline panel: name field + one input per existing version (label = `versionLabel`) with datalist-free plain inputs, prompt `t.pickerValuesPrompt`, POST then `router.refresh()`. Version rows: `versionLabel` (or "—"), colour dot, key measurements (first three present), ⚠ text from `attentionReasons` per version, **Edit** → `/dashboard/garment/[versionId]/edit`, **Duplicate** → `/dashboard/garment/new?product=<id>&copy=<versionId>`. **+ Add version** → `/dashboard/garment/new?product=<id>`; when the product has versions but no pickers show `t.addPickersFirst` instead of the link.
- [ ] **Step 6: `garment/new/page.tsx`** — now async: read `searchParams` (`product`, `copy`). With `product`: `loadProductContext`; build `productCtx = { id, pickers, usedValues: Record<pickerId, string[]> (valueOrder), }`. With `copy` (must belong to this product — query `.eq('product_id').eq('retailer_id')`; otherwise `notFound()`): load that version exactly as `edit/page.tsx` does and pass as `initial` plus `copyFrom: id`, with `picks` pre-filled. Without `product`, render as today (legacy create). Remember `name`-hiding below.
- [ ] **Step 7: `edit/page.tsx`** — when `g.product_id` is set, also `select('… product_id, picks')`, `loadProductContext`, pass `productCtx` and `picks`.
- [ ] **Step 8: `GarmentForm`** — new optional props `productCtx?: { id; pickers: PickerDef[]; usedValues: Record<string,string[]> }`, `initial.picks?: Record<string,string>`, `copyFrom?: string`. With `productCtx`: hide the Name field; render, above the category select, one text input per picker (label = picker name, `list` datalist from `usedValues[picker.id]` so "Black"/"black" don't both appear); add `picks` (JSON) and `product_id` to the submitted form data (`product_id` only in create; in edit the server uses the stored one); add `copy_from` when `copyFrom`; include `picks` in `isDirty` snapshot. In duplicate mode the dirty check treats the pre-filled state as dirty so leaving warns. Photo input: `required` only when no `copyFrom` and no existing photo. After a successful save with `productCtx` go to `/dashboard/product/<id>`; otherwise as today. Server `400` text (e.g. duplicate) is shown by the existing error slot.
- [ ] **Step 9:** `npx tsc --noEmit && npm run lint`. Commit `feat: owner product pages, version form picks, duplicate`.

(There is no component test harness for these screens beyond the existing jsdom setup; behaviour is covered by the lib tests plus the manual checklist in Task 12.)

---

### Task 10: Shopper product page

**Files:** Create `app/shop/[shop_slug]/p/[product_id]/page.tsx`, `ProductView.tsx`; Modify `app/shop/[shop_slug]/[garment_id]/page.tsx`, `FitChecker.tsx`, `app/shop/[shop_slug]/page.tsx`, `OtherGarments.tsx`.

- [ ] **Step 1: Product page (server, admin client, `force-dynamic`)** — resolve shop by slug (same error handling as the garment page); product `.eq('id').eq('retailer_id', shop.id)` (`notFound()` if absent); pickers ordered by position; versions `.eq('product_id').eq('retailer_id', shop.id)` ordered `created_at asc` selecting `id, category, size_label?` — **do NOT select `size_label`**, the column is not used by the catalogue; select `id, category, photo_url, true_colour_photo_url, measurements, picks, created_at`; colours (`in('garment_id', ids)`) and fabric (`in('garment_id', ids)`) in one query each. Keep only **complete** versions (`isComplete`); if none → `notFound()` (§7). Metadata: `${product.name} — ${shop.shop_name}`. Other products strip: other products of the shop (limit 8, newest first) with the first version's photo.
- [ ] **Step 2: `ProductView` (client)** — props: product name, pickers, versions (with their colours/fabric/dims for `dimensionsForCategory(category)` mapped like the garment page does), shop slug. State: `selection: Record<pickerId,string>`. Computes `selected = resolveVersion(versions, selection, pickerIds)`. Renders: hero photo (selected version's `photo_url`, else the first version's), `<h1>` name, `<TryOn />` as on the garment page, picker rows in position order, each value (from `valueOrder`) a button — greyed (`disabled`, `aria-disabled`) when `!availableValues(...).has(normPick(value))`, toggling a chosen value off when tapped again — then `<GarmentTabs>` with the selected version's colours / true-colour photo / fabric (`null`/empty when nothing selected) wrapping `<FitChecker garmentId={selected?.id ?? null} dimensions={…} disabled={!selected} />`, and when `!selected` the three tabs' content shows `t.pickFirst` (names of the not-yet-chosen pickers, comma-joined). With zero pickers and one version, `selected` is that version immediately and the page is indistinguishable from today's. `GarmentTabs` panels stay hidden, never unmounted (decisions §3); `FitChecker` is rendered once and never `key`ed by version id.
- [ ] **Step 3: `FitChecker`** — accept `garmentId: string | null` and optional `disabled`. Add an effect on `garmentId`: `setResult(null)` and `setValues(v => keepSharedValues(v, dimensions.map(d => d.key)))`; disable the check button and block submit when `garmentId === null || disabled`. Existing behaviour otherwise unchanged. Read the whole file first; the size-helper block uses `values` too, so keep its state handling intact.
- [ ] **Step 4: Old link** — in `[garment_id]/page.tsx`, after the shop lookup and garment select (add `product_id`), `if (garment.product_id) redirect(\`/shop/${slug}/p/${garment.product_id}\`)` (`next/navigation`). Garments with no product (created between running the migration and merging) still render the old page. Remove nothing else.
- [ ] **Step 5: Shop list** — `app/shop/[shop_slug]/page.tsx`: list products (newest first) with the first version's photo and colour dots; link to `/shop/${slug}/p/${p.id}`. Products with no complete versions are skipped. Legacy garments with `product_id` null are still listed with the old link. `OtherGarments` keeps its props shape (`id, name, photo_url`) but its links change to `/p/` — add a `href` prop per item instead of building it inside, and have the garment page build `/shop/${slug}/${g.id}` for legacy items.
- [ ] **Step 6:** `npx tsc --noEmit && npm run lint && npm test`. Commit `feat: shopper product page with pickers, old-link redirect, product lists`.

---

### Task 11: Docs

**Files:** Modify `docs/superpowers/resume.md`, `docs/superpowers/decisions-and-lessons.md`.

- [ ] **Step 1: `resume.md`** — fix the snapshot heading (remove the pending `feature/tryon-test-fix` mention) and the Tests row (current count; TryOn tests pass on main since PR #10); add Stage 1 under "What's live" as *built, not shipped* until merged; list `0005_catalogue.sql` as written, NOT applied; delete the catalogue to-do item, replacing it with "Stages 2 and 3" pointing at spec §8; add the migration `0006` NOT NULL step as a post-merge to-do.
- [ ] **Step 2: `decisions-and-lessons.md`** — record: product id equals the garment id for backfilled rows (and why: old links keep working); `size_label` column stays unused; migration numbering; picks keyed by picker id; Duplicate copies Storage objects via the `copy_from` field; name copied from the product; the shopper page never selects `size_label`.
- [ ] **Step 3:** Commit `docs: record catalogue stage 1`.

---

### Task 12: Gates, push, PR, report

- [ ] **Step 1:** `git fetch origin && git merge origin/main` (never rebase). Resolve conflicts, keeping both sides' intent.
- [ ] **Step 2:** `npm install` if `package-lock.json` changed upstream, then `git checkout -- package-lock.json` if only dirtied. Copy `.env.local` from the main checkout into the worktree (never print or commit it). Stop any dev server. Run `npm test && npm run build`; both must be green.
- [ ] **Step 3:** `git push -u origin feature/catalogue-stage-1`.
- [ ] **Step 4:** Open the PR with `gh pr create --base main` (merging is forbidden). Body: what changed, gates, **founder SQL steps (below)**, preview checklist, "preview uses the LIVE database" warning, and the line "the migration was not executed anywhere before this PR (no local database exists)".
- [ ] **Step 5:** Poll the head commit's Vercel status until `success`; then report to `god`: PR URL, head sha, test count, build result, Vercel status, checklist.

#### Founder steps (put verbatim in the PR body)

Do these in order, and **before** pressing Merge:
1. Open https://supabase.com/dashboard → your project → **Database** → **Backups**. Press **Create backup** (or confirm today's scheduled backup exists). Wait until it says complete.
2. Left menu **SQL Editor** → **New query**.
3. Open `supabase/migrations/0005_catalogue.sql` on GitHub (branch `feature/catalogue-stage-1`), press **Copy raw file**, paste into the editor, press **Run**. Expect "Success. No rows returned".
4. Check the live site still works: open https://fit-mvp-eight.vercel.app, then your shop page, then one garment link. Everything should look exactly as before (old code does not use the new columns).
5. In **Table Editor** open `products`: you should see one row per garment you already had.
6. Only now go to the pull request and press **Merge pull request**.

#### Preview checklist (phone AND computer)

The preview uses the **live database**. Create only a product named **TEST ลบได้ / delete me** and delete it at the end.
1. Dashboard shows product cards, newest first; every existing garment appears as a one-version product.
2. New product → "TEST ลบได้ / delete me": it starts with Size and Colour pickers.
3. Add version L / Black, then Duplicate it → try saving unchanged (must be refused, Thai message) → change colour to Green → saves.
4. Add a picker "Sleeve", fill the existing versions' values in the same step.
5. Remove the Sleeve picker (must work when versions stay distinct).
6. Copy shopper link; open it in a private tab: pick L then see Green/Black; greyed values; tabs say "pick … first" until all chosen; photo and fit check switch to the picked version; type measurements, switch version, they stay; press Check.
7. Open an OLD garment link (`/shop/<slug>/<garment id>`): it redirects to a product page that looks like before.
8. Shop list page shows one card per product.
9. Delete the TEST product (confirm) → it and its photos disappear.

---

## Self-review

- **Spec coverage:** §3 rules 1 (versions own measurements, untouched), 2 (Task 4/7/8 scoped reads), 3 (no folder link), 4 (Task 2/7), 7 (Task 6 DELETE), 8 (Task 6/7 copy), 9 (Task 10 complete-only); §4 (Task 1); §5.1 cards (Task 9), §5.2 pickers/rows/copy link/add-picker backfill (Task 8/9), §5.3 form + Duplicate (Task 9), §5.4 (Task 6/7), §5.5 (Task 3/9 ⚠); §6 all bullets (Task 10); §7 errors (Tasks 4/7/8, 404s); §9 Stage 1 tests (Tasks 2–4, 7, 8). Rules 5, 6 and folder/tag tests are Stage 2.
- **Placeholders:** none intended; Task 9/10 steps describe components by exact props, queries and behaviour rather than full JSX, because they are wiring over the tested `lib/` functions.
- **Names used across tasks:** `Picks`, `PickerDef`, `VersionPicks`, `normPick`, `isComplete`, `findDuplicate`, `versionLabel`, `resolveVersion`, `availableValues`, `valueOrder`, `clashesAfterRemoval`, `attentionReasons`, `keepSharedValues`, `parsePicksField`, `loadProductContext`, `checkGarmentOwnership`, `checkPicksForWrite`, `copyStoredObject`.
