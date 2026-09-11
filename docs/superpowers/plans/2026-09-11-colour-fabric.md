# Colour & Fabric Reference — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** A shopper opening a garment can see the garment's actual colours as on-screen swatches
and its fabric character as icon chips, without reading anything technical; a retailer who knows
textile jargon can add a technical tier behind a collapsed `<details>`.

**Architecture:** Two new tables (`garment_colours` many-per-garment, `garment_fabric`
zero-or-one-per-garment) plus one new column on `garments`. All validation lives in one pure
module, `lib/garment/colour-fabric.ts`, shared by the form and both API routes — the same
single-definition pattern `lib/garment/parse-form.ts` already uses so POST and PATCH cannot
drift. Every shopper-side *decision* (which tab shows, which chips render, which technical rows
have values, how dots overflow) is a pure function in `lib/garment/colour-fabric-view.ts`, so the
React components are thin and the logic is unit-testable in node.

**Tech Stack:** Next.js 14.2.35 App Router, TypeScript strict, Tailwind 3, Supabase
(Postgres + Storage), zod 4, vitest 4 (+ jsdom / @testing-library/react, added in this branch).

**Spec:** `docs/superpowers/specs/2026-09-10-colour-fabric-design.md`
**Branch:** `feature/colour-fabric` (already created; harness commit `f674375` is already on it)

---

## Before you touch anything

Read `/CLAUDE.md` and `docs/superpowers/resume.md` first. The three landmines in CLAUDE.md are
real and two of them apply directly to this work:

- **Zod schemas here need `.strict()`.** Without it zod *strips* unknown keys instead of
  rejecting them, so a malformed payload parses "successfully" as an empty object and produces a
  silent wrong answer rather than an error. Every new object schema in this plan calls
  `.strict()`. Do not remove it.
- **Supabase clients are untyped.** `.from('garment_colours')` returns `any`. A wrong column name
  compiles clean and fails at runtime. `tsc` proves nothing here; the pure tests and the founder's
  manual check are the only real gates.

### Traps specific to this branch — all four cost real time to rediscover

1. **`useLanguage()` returns a TUPLE, not an object.** It is
   `const [lang, setLang] = useLanguage();`. Writing `const { lang } = useLanguage()` compiles to
   `undefined` and every label silently renders blank. Check `GarmentForm.tsx` for the idiom.
2. **Component tests need a `// @vitest-environment jsdom` docblock as the FIRST line** of the
   file. Global `environment` stays `'node'` so the 89 pure tests are unaffected. Without the
   docblock you get "document is not defined".
3. **JSX in tests works only because of `oxc: { jsx: { runtime: 'automatic' } }`** in
   `vitest.config.ts`. `tsconfig.json` sets `"jsx": "preserve"` for Next, and vite 8 transforms
   with oxc, not esbuild — an `esbuild: {}` block is silently ignored. Do not "tidy" that config
   key.
4. **Tailwind preflight styles `[hidden] { display: none }`.** The tab panels rely on the `hidden`
   attribute to stay mounted while invisible (see Task 8). Do not put `flex` or `grid` classes on
   a panel wrapper that carries `hidden` — the display class wins and the panel shows through.

### Verification gates — both, every task

```bash
npm test && npm run build
```

`tsc` clean does **not** mean the build passes: `next lint` rejects unused imports the
typechecker ignores, and an unused type import in a test file has blocked a build on this project
before.

---

## File structure

**Create:**

| File | Responsibility |
|---|---|
| `supabase/migrations/0003_colour_fabric.sql` | Tables, indexes, RLS, the one new `garments` column. Applied by hand in the Supabase SQL editor — see Task 1. |
| `lib/garment/colour-fabric.ts` | Zod schemas, enum constants, `isFabricEmpty`, `FABRIC_CHIPS`, `chipStringKey`, and the two `FormData` parsers. Pure, no I/O. The single definition of "a valid colour / fabric". |
| `lib/garment/colour-fabric.test.ts` | Unit tests for the above. |
| `lib/garment/colour-fabric-view.ts` | Pure shopper-side decisions: `showColourTab`, `showFabricTab`, `visibleChips`, `technicalRows`, `dotsWithOverflow`. No React. |
| `lib/garment/colour-fabric-view.test.ts` | Unit tests for the above. |
| `lib/garment/photo-upload.ts` | `storageKeyFor()`, `pathFromPublicUrl()`, `uploadPhotoField()`. Takes the Supabase client as a parameter, so no `server-only` import and it stays testable. Kills the duplication `resume.md` flagged between the two garment routes. |
| `lib/garment/photo-upload.test.ts` | Unit tests for the two pure helpers. |
| `app/dashboard/garment/ColoursSection.tsx` | Retailer colour row list (client). |
| `app/dashboard/garment/FabricSection.tsx` | Retailer fabric chips + technical `<details>` (client). |
| `app/shop/[shop_slug]/[garment_id]/GarmentTabs.tsx` | Fit / Colour / Fabric tab bar (client). Keeps the Fit panel mounted. |
| `app/shop/[shop_slug]/[garment_id]/GarmentTabs.test.tsx` | jsdom render tests for tab visibility. |
| `app/shop/[shop_slug]/[garment_id]/ColourPanel.tsx` | Swatches, true-colour photo, screen disclaimer (client). |
| `app/shop/[shop_slug]/[garment_id]/FabricPanel.tsx` | Chips, fabric photo, technical `<details>` (client). |
| `app/shop/[shop_slug]/[garment_id]/FabricPanel.test.tsx` | jsdom render tests for chips / technical rows. |
| `app/shop/[shop_slug]/ColourDots.tsx` | Grid card colour dots with `+n` overflow (client). |
| `app/shop/[shop_slug]/ColourDots.test.tsx` | jsdom render tests for the 6-dot cap. |

**Modify:**

| File | Change |
|---|---|
| `lib/supabase/types.ts` | Add `GarmentColour`, `GarmentFabric`; add `true_colour_photo_url` to `Garment`. |
| `lib/i18n/strings.ts` | ~40 new keys, TH + EN (Task 3). |
| `app/api/garments/route.ts` | POST: parse colours + fabric, upload two optional photos, insert child rows. |
| `app/api/garments/[id]/route.ts` | PATCH: same, plus replace-all colours and fabric upsert/delete. |
| `app/dashboard/garment/GarmentForm.tsx` | Mount the two new sections; extend state, snapshot and submit. |
| `app/shop/[shop_slug]/[garment_id]/page.tsx` | Fetch colours + fabric; wrap `FitChecker` in `GarmentTabs`. |
| `app/shop/[shop_slug]/page.tsx` | One extra grouped query for colours; render `ColourDots`. |
| `docs/superpowers/resume.md` | Status update at the end (Task 13). |

---

## The one invariant that matters most

**Colours use replace-all semantics, so "field absent" and "field present but empty" MUST mean
different things.**

- `colours` field **absent** from the FormData → do not touch `garment_colours` at all.
- `colours` field **present** and `[]` → delete every row for that garment.

Collapsing these is the same class of bug as the `photo_url` concurrency defect the spec cites in
§5: a caller that does not know about colours (a stale browser tab, a future script, a partial
retry) would silently wipe the retailer's colour list. `parseColoursField()` returns a
`present: boolean` precisely so the routes can honour this. The same rule applies to `fabric`.

This is tested in Task 2, Step 1. Do not "simplify" it away.

---

## Task 0: Harness — ALREADY DONE

Commit `f674375` on this branch added `jsdom`, `@testing-library/react`, `@testing-library/dom`
and the `vitest.config.ts` changes. Nothing to do. Confirm with `npm test` — expected
`Test Files 7 passed (7)`, `Tests 89 passed (89)`.

---

## Task 1: Migration and row types

**Files:**
- Create: `supabase/migrations/0003_colour_fabric.sql`
- Modify: `lib/supabase/types.ts`

The migration is **not applied by code**. Migrations on this project are run by hand in the
Supabase SQL editor (`CLAUDE.md` → Environment notes). Write the file; Task 12 has the founder
run it. Nothing before Task 12 touches the live database.

- [ ] **Step 1: Write the migration**

```sql
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
-- garment_id IS the primary key, which is what makes the API upsert safe:
-- on conflict (garment_id) can only ever hit this garment's single row.
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
```

- [ ] **Step 2: Add the row types**

In `lib/supabase/types.ts`, add one line to the existing `Garment` interface right after
`photo_url: string;`:

```ts
  /** Garment laid flat under daylight. Nullable: a colour reference, not a hero shot. */
  true_colour_photo_url: string | null;
```

Then append at the end of the file:

```ts
export type Finish = 'matte' | 'slight_sheen' | 'glossy';
export type Thickness = 'thin' | 'medium' | 'thick';
export type Stretch = 'none' | 'some' | 'high';
export type Feel = 'soft' | 'crisp' | 'rough';

export interface GarmentColour {
  id: string;
  garment_id: string;
  /** Always '#rrggbb'. Enforced by a CHECK constraint and by zod. */
  hex: string;
  name: string;
  created_at: string;
}

/**
 * Zero or one per garment. Every content field is nullable, and null means
 * "the retailer did not say" — never "no". isFabricEmpty() in
 * lib/garment/colour-fabric.ts is the only correct way to ask whether this row
 * carries any information, because it ignores garment_id/updated_at.
 */
export interface GarmentFabric {
  garment_id: string;
  finish: Finish | null;
  thickness: Thickness | null;
  stretch: Stretch | null;
  feel: Feel | null;
  composition: string | null;
  weight_gsm: number | null;
  construction: string | null;
  thread_count: number | null;
  pore_size_mm: number | null;
  notes: string | null;
  fabric_photo_url: string | null;
  updated_at: string;
}
```

- [ ] **Step 3: Verify nothing broke**

Run: `npm test && npm run build`
Expected: 89 tests pass, build succeeds. Adding a non-optional field to `Garment` can break an
object literal that constructs one — if the build complains, fix the complaining file.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_colour_fabric.sql lib/supabase/types.ts && git commit -m "feat(db): colour and fabric tables, not yet applied"
```

---

## Task 2: Validation module — `lib/garment/colour-fabric.ts`

**Files:**
- Create: `lib/garment/colour-fabric.ts`
- Test: `lib/garment/colour-fabric.test.ts`

The single definition of "a valid colour / fabric", shared by the form and both API routes,
exactly as `parse-form.ts` is shared by POST and PATCH. TDD: test first.

**Do Task 3 (i18n) before this, or add just `colourInvalid` and `fabricInvalid` now** — this
module imports both.

- [ ] **Step 1: Write the failing tests**

Create `lib/garment/colour-fabric.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  ColourSchema, ColoursSchema, FabricSchema,
  isFabricEmpty, chipStringKey, FABRIC_CHIPS,
  parseColoursField, parseFabricField,
} from './colour-fabric';

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe('ColourSchema', () => {
  it('accepts a six-digit hex with a name', () => {
    expect(ColourSchema.safeParse({ hex: '#A1b2C3', name: 'กรมท่า' }).success).toBe(true);
  });

  it('rejects shorthand, missing hash, bad characters and wrong length', () => {
    for (const hex of ['#abc', 'abcdef', '#abcdeg', '#abcdef0', '']) {
      expect(ColourSchema.safeParse({ hex, name: 'x' }).success).toBe(false);
    }
  });

  it('trims the name and enforces 1..40', () => {
    const ok = ColourSchema.safeParse({ hex: '#000000', name: '  navy  ' });
    expect(ok.success && ok.data.name).toBe('navy');
    expect(ColourSchema.safeParse({ hex: '#000000', name: '   ' }).success).toBe(false);
    expect(ColourSchema.safeParse({ hex: '#000000', name: 'x'.repeat(40) }).success).toBe(true);
    expect(ColourSchema.safeParse({ hex: '#000000', name: 'x'.repeat(41) }).success).toBe(false);
  });

  it('REJECTS unknown keys rather than stripping them', () => {
    // CLAUDE.md landmine: without .strict() zod strips, so a misspelled key
    // parses "successfully" with that value silently gone.
    expect(ColourSchema.safeParse({ hex: '#000000', name: 'x', position: 2 }).success).toBe(false);
  });
});

describe('ColoursSchema', () => {
  it('accepts an empty list — empty is a meaningful value, not an error', () => {
    expect(ColoursSchema.safeParse([]).success).toBe(true);
  });

  it('accepts duplicates and imposes no ranking', () => {
    const r = ColoursSchema.safeParse([
      { hex: '#ff0000', name: 'red' },
      { hex: '#ff0000', name: 'red again' },
    ]);
    expect(r.success && r.data).toHaveLength(2);
  });

  it('rejects the whole list if any one entry is bad', () => {
    expect(ColoursSchema.safeParse([
      { hex: '#ff0000', name: 'red' },
      { hex: 'nope', name: 'bad' },
    ]).success).toBe(false);
  });
});

describe('FabricSchema', () => {
  it('parses to all-null when every key is omitted', () => {
    const r = FabricSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.finish).toBeNull();
  });

  it('turns blank strings into null, not empty strings', () => {
    const r = FabricSchema.safeParse({ finish: '', composition: '   ', weight_gsm: '' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.finish).toBeNull();
      expect(r.data.composition).toBeNull();
      expect(r.data.weight_gsm).toBeNull();
    }
  });

  it('accepts every documented enum value', () => {
    for (const [group, values] of Object.entries(FABRIC_CHIPS)) {
      for (const v of values) {
        expect(FabricSchema.safeParse({ [group]: v }).success).toBe(true);
      }
    }
  });

  it('rejects an enum value outside the set', () => {
    expect(FabricSchema.safeParse({ finish: 'shiny' }).success).toBe(false);
    expect(FabricSchema.safeParse({ stretch: 'stretchy' }).success).toBe(false);
  });

  it('coerces numeric strings and enforces the ranges the CHECKs enforce', () => {
    const r = FabricSchema.safeParse({ weight_gsm: '180', thread_count: '400', pore_size_mm: '0.25' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.weight_gsm).toBe(180);
      expect(r.data.pore_size_mm).toBe(0.25);
    }
    expect(FabricSchema.safeParse({ weight_gsm: 0 }).success).toBe(false);
    expect(FabricSchema.safeParse({ weight_gsm: 2001 }).success).toBe(false);
    expect(FabricSchema.safeParse({ weight_gsm: 12.5 }).success).toBe(false); // integer column
    expect(FabricSchema.safeParse({ pore_size_mm: 0 }).success).toBe(false);  // CHECK is > 0
    expect(FabricSchema.safeParse({ weight_gsm: 'heavy' }).success).toBe(false);
  });

  it('REJECTS unknown keys', () => {
    expect(FabricSchema.safeParse({ gsm: 180 }).success).toBe(false);
  });
});

describe('isFabricEmpty', () => {
  it('is true for null, undefined and an all-null row', () => {
    expect(isFabricEmpty(null)).toBe(true);
    expect(isFabricEmpty(undefined)).toBe(true);
    expect(isFabricEmpty({})).toBe(true);
  });

  it('is false as soon as any one content field is set', () => {
    expect(isFabricEmpty({ finish: 'matte' })).toBe(false);
    expect(isFabricEmpty({ notes: 'ผ้าฝ้ายญี่ปุ่น' })).toBe(false);
    expect(isFabricEmpty({ weight_gsm: 180 })).toBe(false);
    expect(isFabricEmpty({ pore_size_mm: 0.25 })).toBe(false);
  });

  it('ignores the columns that are not content', () => {
    // A row read back from the database always carries these three. Counting
    // them would make isFabricEmpty() permanently false and the Fabric tab
    // permanently visible on any garment that ever had a fabric row.
    expect(isFabricEmpty({
      garment_id: 'f0e1d2c3-0000-4000-8000-000000000000',
      updated_at: '2026-09-11T00:00:00Z',
      fabric_photo_url: 'https://example.test/a.jpg',
    })).toBe(true);
  });

  it('treats a blank string as unset', () => {
    expect(isFabricEmpty({ composition: '   ' })).toBe(true);
  });
});

describe('chipStringKey', () => {
  it('derives the i18n key from the group and value', () => {
    expect(chipStringKey('finish', 'matte')).toBe('finishMatte');
    expect(chipStringKey('finish', 'slight_sheen')).toBe('finishSlightSheen');
    expect(chipStringKey('thickness', 'thin')).toBe('thicknessThin');
    expect(chipStringKey('stretch', 'none')).toBe('stretchNone');
    expect(chipStringKey('feel', 'crisp')).toBe('feelCrisp');
  });
});

describe('parseColoursField', () => {
  it('reports present:false when the field is ABSENT', () => {
    // The invariant: absent must NOT be read as "delete them all".
    expect(parseColoursField(fd({}))).toEqual({ ok: true, present: false });
  });

  it('reports present:true with [] when the field is "[]"', () => {
    const r = parseColoursField(fd({ colours: '[]' }));
    expect(r.ok && r.present).toBe(true);
    expect(r.ok && r.present && r.colours).toEqual([]);
  });

  it('parses a list', () => {
    const r = parseColoursField(fd({ colours: '[{"hex":"#112233","name":"navy"}]' }));
    expect(r.ok && r.present && r.colours).toEqual([{ hex: '#112233', name: 'navy' }]);
  });

  it('fails on malformed JSON, a bad entry, and a non-array', () => {
    expect(parseColoursField(fd({ colours: '{' })).ok).toBe(false);
    expect(parseColoursField(fd({ colours: '[{"hex":"x","name":"y"}]' })).ok).toBe(false);
    expect(parseColoursField(fd({ colours: '{"hex":"#112233","name":"navy"}' })).ok).toBe(false);
  });
});

describe('parseFabricField', () => {
  it('reports present:false when the field is ABSENT', () => {
    expect(parseFabricField(fd({}))).toEqual({ ok: true, present: false });
  });

  it('reports present:true for "{}" so an all-null save can clear the row', () => {
    const r = parseFabricField(fd({ fabric: '{}' }));
    expect(r.ok && r.present).toBe(true);
    expect(r.ok && r.present && isFabricEmpty(r.fabric)).toBe(true);
  });

  it('parses a populated fabric', () => {
    const r = parseFabricField(fd({ fabric: '{"finish":"matte","weight_gsm":"180"}' }));
    expect(r.ok && r.present && r.fabric.finish).toBe('matte');
    expect(r.ok && r.present && r.fabric.weight_gsm).toBe(180);
  });

  it('fails on malformed JSON and on a bad enum', () => {
    expect(parseFabricField(fd({ fabric: 'nope' })).ok).toBe(false);
    expect(parseFabricField(fd({ fabric: '{"feel":"silky"}' })).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/garment/colour-fabric.test.ts`
Expected: FAIL — `Failed to load url ./colour-fabric`.

- [ ] **Step 3: Write the implementation**

Create `lib/garment/colour-fabric.ts`:

```ts
import { z } from 'zod';
import { t } from '@/lib/i18n/strings';

export const HEX = /^#[0-9a-fA-F]{6}$/;

export const FINISH    = ['matte', 'slight_sheen', 'glossy'] as const;
export const THICKNESS = ['thin', 'medium', 'thick'] as const;
export const STRETCH   = ['none', 'some', 'high'] as const;
export const FEEL      = ['soft', 'crisp', 'rough'] as const;

export type FabricChipKey = 'finish' | 'thickness' | 'stretch' | 'feel';

/** One source of chip options for the retailer form AND the shopper page. */
export const FABRIC_CHIPS = {
  finish: FINISH,
  thickness: THICKNESS,
  stretch: STRETCH,
  feel: FEEL,
} as const satisfies Record<FabricChipKey, readonly string[]>;

/**
 * Chip value to i18n key: ('finish','slight_sheen') -> 'finishSlightSheen'.
 * Derived rather than hand-written at each call site, so adding an enum value
 * cannot silently render a blank label.
 */
export function chipStringKey(group: FabricChipKey, value: string): string {
  const suffix = value
    .split('_')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  return `${group}${suffix}`;
}

// .strict() everywhere: see CLAUDE.md. Without it zod STRIPS unknown keys, so a
// misspelled field parses "successfully" with that value silently gone.
export const ColourSchema = z.object({
  hex: z.string().regex(HEX),
  name: z.string().trim().min(1).max(40),
}).strict();

/** Any length, including 0. No cap and no ordering: spec Q3. */
export const ColoursSchema = z.array(ColourSchema);

export type Colour = z.infer<typeof ColourSchema>;

/** '' and undefined both collapse to null — an empty input means "not said". */
const blank = (v: unknown): unknown => {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  return v;
};

const optEnum = <T extends readonly [string, ...string[]]>(vals: T) =>
  z.preprocess(blank, z.enum(vals).nullable());

const optText = (max: number) =>
  z.preprocess(
    v => { const b = blank(v); return b === null ? null : String(b).trim(); },
    z.string().max(max).nullable(),
  );

const optInt = (min: number, max: number) =>
  z.preprocess(
    v => { const b = blank(v); return b === null ? null : Number(b); },
    z.number().int().min(min).max(max).nullable(),
  );

const optNum = (max: number) =>
  z.preprocess(
    v => { const b = blank(v); return b === null ? null : Number(b); },
    z.number().positive().max(max).nullable(),
  );

/**
 * Mirrors the garment_fabric CHECK constraints exactly. Where the two disagree
 * the database wins and the retailer gets a 500 instead of a readable message,
 * so keep them in step: weight_gsm and thread_count integer 1..2000,
 * pore_size_mm > 0 and numeric(6,3) so strictly under 1000.
 */
export const FabricSchema = z.object({
  finish:       optEnum(FINISH),
  thickness:    optEnum(THICKNESS),
  stretch:      optEnum(STRETCH),
  feel:         optEnum(FEEL),
  composition:  optText(200),
  weight_gsm:   optInt(1, 2000),
  construction: optText(200),
  thread_count: optInt(1, 2000),
  pore_size_mm: optNum(999.999),
  notes:        optText(2000),
}).strict();

export type Fabric = z.infer<typeof FabricSchema>;

/** The content fields, in form and display order. NOT garment_id/updated_at/photo. */
export const FABRIC_FIELDS = [
  'finish', 'thickness', 'stretch', 'feel',
  'composition', 'weight_gsm', 'construction', 'thread_count', 'pore_size_mm', 'notes',
] as const;

/**
 * True when the retailer said nothing about the fabric. Drives both hiding the
 * shopper's Fabric tab and deleting the row instead of storing an empty one.
 *
 * Deliberately iterates FABRIC_FIELDS rather than Object.values(): a row read
 * back from the database also carries garment_id, updated_at and
 * fabric_photo_url, which are always set and would make this permanently false.
 */
export function isFabricEmpty(f: Record<string, unknown> | null | undefined): boolean {
  if (!f) return true;
  return FABRIC_FIELDS.every(k => {
    const v = f[k];
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
  });
}

/**
 * Absent field and empty value mean different things, so the result says which.
 * Colours are replace-all; reading an absent field as [] would let any caller
 * that does not know about colours wipe the retailer's list. Same class as the
 * photo_url concurrency bug recorded in spec section 5.
 */
export type ColoursParse =
  | { ok: true; present: false }
  | { ok: true; present: true; colours: Colour[] }
  | { ok: false; error: string };

export function parseColoursField(form: FormData): ColoursParse {
  const raw = form.get('colours');
  if (raw === null) return { ok: true, present: false };
  let json: unknown;
  try { json = JSON.parse(String(raw)); }
  catch { return { ok: false, error: t.colourInvalid.th }; }
  const parsed = ColoursSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: t.colourInvalid.th };
  return { ok: true, present: true, colours: parsed.data };
}

export type FabricParse =
  | { ok: true; present: false }
  | { ok: true; present: true; fabric: Fabric }
  | { ok: false; error: string };

export function parseFabricField(form: FormData): FabricParse {
  const raw = form.get('fabric');
  if (raw === null) return { ok: true, present: false };
  let json: unknown;
  try { json = JSON.parse(String(raw)); }
  catch { return { ok: false, error: t.fabricInvalid.th }; }
  const parsed = FabricSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: t.fabricInvalid.th };
  return { ok: true, present: true, fabric: parsed.data };
}
```

**If `FabricSchema.safeParse({})` fails** — zod 4 may treat an absent key as a missing required
field rather than feeding `undefined` through `preprocess` — change each `.nullable()` in the four
`opt*` helpers to `.nullish()` and append `.transform(v => v ?? null)` to each, so omitted keys
still come out as `null`. Run the test to find out; do not guess.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/garment/colour-fabric.test.ts`
Expected: PASS, ~24 tests.

- [ ] **Step 5: Full gates, then commit**

```bash
npm test && npm run build
git add lib/garment/colour-fabric.ts lib/garment/colour-fabric.test.ts && git commit -m "feat(garment): colour and fabric validation, one shared definition"
```

---

## Task 3: i18n strings

**Files:**
- Modify: `lib/i18n/strings.ts`

Mechanical. Append these keys inside the `t` object, before the closing `} as const;`. Keep the
existing style: one key per line where it fits, TH first.

**Thai copy below is a first draft and the founder must proofread it** before Task 12. Flag it in
the handoff. `feelCrisp` in particular — "crisp" has no single clean Thai word for fabric;
`แข็งอยู่ทรง` (stiff, holds its shape) is the reading intended here.

- [ ] **Step 1: Add the keys**

```ts
  // --- Colour & fabric: shopper tabs ---
  tabFit:    { th: 'ความพอดี', en: 'Fit' },
  tabColour: { th: 'สี', en: 'Colour' },
  tabFabric: { th: 'เนื้อผ้า', en: 'Fabric' },

  // --- Colour & fabric: retailer form ---
  coloursSection:         { th: 'สีของสินค้า', en: 'Colours' },
  addColour:              { th: 'เพิ่มสี', en: 'Add colour' },
  colourName:             { th: 'ชื่อสี', en: 'Colour name' },
  removeColour:           { th: 'ลบสี', en: 'Remove colour' },
  trueColourPhoto:        { th: 'รูปสีจริง (วางราบ แสงธรรมชาติ)', en: 'True colour photo (laid flat, daylight)' },
  fabricSection:          { th: 'เนื้อผ้า', en: 'Fabric' },
  fabricTechnicalDetails: { th: 'รายละเอียดทางเทคนิค', en: 'Technical details' },
  fabricPhoto:            { th: 'รูปใกล้เนื้อผ้า', en: 'Fabric close-up photo' },
  notSet:                 { th: 'ไม่ระบุ', en: 'Not set' },

  // --- Fabric chips: group labels and values ---
  // Value keys are DERIVED by chipStringKey() in lib/garment/colour-fabric.ts.
  // Renaming one here without renaming the enum value there renders a blank label.
  finish:            { th: 'ความเงา', en: 'Finish' },
  finishMatte:       { th: 'ด้าน', en: 'Matte' },
  finishSlightSheen: { th: 'เงาเล็กน้อย', en: 'Slight sheen' },
  finishGlossy:      { th: 'เงา', en: 'Glossy' },
  thickness:         { th: 'ความหนา', en: 'Thickness' },
  thicknessThin:     { th: 'บาง', en: 'Thin' },
  thicknessMedium:   { th: 'ปานกลาง', en: 'Medium' },
  thicknessThick:    { th: 'หนา', en: 'Thick' },
  stretch:           { th: 'ความยืด', en: 'Stretch' },
  stretchNone:       { th: 'ไม่ยืด', en: 'None' },
  stretchSome:       { th: 'ยืดเล็กน้อย', en: 'Some' },
  stretchHigh:       { th: 'ยืดมาก', en: 'High' },
  feel:              { th: 'สัมผัส', en: 'Feel' },
  feelSoft:          { th: 'นุ่ม', en: 'Soft' },
  feelCrisp:         { th: 'แข็งอยู่ทรง', en: 'Crisp' },
  feelRough:         { th: 'หยาบ', en: 'Rough' },

  // --- Fabric technical labels ---
  composition: { th: 'ส่วนประกอบ', en: 'Composition' },
  weightGsm:   { th: 'น้ำหนัก (g/m²)', en: 'Weight (g/m²)' },
  construction:{ th: 'โครงสร้างผ้า', en: 'Construction' },
  threadCount: { th: 'จำนวนเส้นด้าย', en: 'Thread count' },
  poreSizeMm:  { th: 'ขนาดรูผ้า (มม.)', en: 'Pore size (mm)' },
  notes:       { th: 'หมายเหตุ', en: 'Notes' },

  // --- Colour & fabric: shopper copy ---
  trueColourCaption:       { th: 'ถ่ายวางราบใต้แสงธรรมชาติ', en: 'Photographed flat under daylight' },
  screenColourDisclaimer:  { th: 'สีจริงอาจต่างจากหน้าจอเล็กน้อย', en: 'Real colour may differ slightly from your screen' },
  moreColours:             { th: '+{n}', en: '+{n}' },

  // --- Colour & fabric: errors ---
  colourInvalid: { th: 'ข้อมูลสีไม่ถูกต้อง', en: 'Invalid colour data' },
  fabricInvalid: { th: 'ข้อมูลเนื้อผ้าไม่ถูกต้อง', en: 'Invalid fabric data' },
```

- [ ] **Step 2: Check for a key collision**

The technical labels use short generic names. Confirm none already exist:

```bash
grep -nE "^  (notes|composition|construction|finish|feel|stretch|thickness):" lib/i18n/strings.ts
```

Expected: exactly one hit per key (the ones you just added). **Two hits means a duplicate key** —
a later duplicate silently wins in an object literal and would change existing copy. Rename yours
with a `fabric` prefix if so.

- [ ] **Step 3: Gates and commit**

```bash
npm test && npm run build
git add lib/i18n/strings.ts && git commit -m "feat(i18n): colour and fabric strings, TH and EN"
```

---

## Task 4: Extract the photo-upload helper

**Files:**
- Create: `lib/garment/photo-upload.ts`
- Test: `lib/garment/photo-upload.test.ts`
- Modify: `app/api/garments/route.ts`, `app/api/garments/[id]/route.ts`

**Why this task exists.** `resume.md` already flags the extension-sanitisation logic as duplicated
verbatim between the two garment routes, with the note "extract if either is touched again". Task 5
touches both, and adds two more photo fields each. Without extraction that is six near-identical
upload blocks that must agree on the Storage key shape. Extract first, as a pure refactor with the
suite green on both sides of it.

Note there is no `import 'server-only'` in this module, deliberately: it takes the Supabase client
as a parameter, so it holds no credentials and stays unit-testable.

- [ ] **Step 1: Write the failing tests**

Create `lib/garment/photo-upload.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { storageKeyFor, pathFromPublicUrl, STORAGE_PREFIX } from './photo-upload';

const USER = '11111111-2222-4333-8444-555555555555';

describe('storageKeyFor', () => {
  it('keeps the extension and prefixes with the owner id', () => {
    const key = storageKeyFor(USER, 'sweater.JPG');
    expect(key.startsWith(`${USER}/`)).toBe(true);
    expect(key.endsWith('.jpg')).toBe(true);
  });

  it('strips anything that could alter the object key', () => {
    // A hand-crafted filename must not introduce slashes or query strings.
    for (const name of ['a.jp/g', 'a.jpg?x=1', 'a.jp g', 'a.../..']) {
      const key = storageKeyFor(USER, name);
      expect(key.slice(USER.length + 1)).not.toMatch(/[/?\s]/);
    }
  });

  it('falls back to jpg when there is no usable extension', () => {
    expect(storageKeyFor(USER, 'noextension').endsWith('.jpg')).toBe(true);
    expect(storageKeyFor(USER, 'weird.!!!').endsWith('.jpg')).toBe(true);
  });

  it('truncates a long extension to 10 characters', () => {
    const ext = storageKeyFor(USER, `a.${'x'.repeat(40)}`).split('.').pop()!;
    expect(ext).toHaveLength(10);
  });

  it('never collides for the same filename', () => {
    expect(storageKeyFor(USER, 'a.jpg')).not.toBe(storageKeyFor(USER, 'a.jpg'));
  });
});

describe('pathFromPublicUrl', () => {
  it('recovers the object path from a stored public URL', () => {
    const url = `https://x.supabase.co/storage/v1${STORAGE_PREFIX}${USER}/abc.jpg`;
    expect(pathFromPublicUrl(url)).toBe(`${USER}/abc.jpg`);
  });

  it('decodes percent-escapes', () => {
    const url = `https://x.supabase.co/storage/v1${STORAGE_PREFIX}${USER}/a%20b.jpg`;
    expect(pathFromPublicUrl(url)).toBe(`${USER}/a b.jpg`);
  });

  it('returns null for null, a foreign URL, and a malformed escape', () => {
    expect(pathFromPublicUrl(null)).toBeNull();
    expect(pathFromPublicUrl('https://example.test/other/a.jpg')).toBeNull();
    expect(pathFromPublicUrl(`https://x/storage/v1${STORAGE_PREFIX}%E0%A4%A`)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/garment/photo-upload.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `lib/garment/photo-upload.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export const PHOTO_BUCKET = 'garment-photos';
export const STORAGE_PREFIX = `/object/public/${PHOTO_BUCKET}/`;

/**
 * The Storage object key for a new upload. The extension is sanitised to a
 * short alphanumeric token so a hand-crafted filename cannot introduce slashes
 * or query strings into the key. The uuid makes it collision-free, and the
 * owner-id prefix is what removeStoredObject()'s ownership check relies on.
 */
export function storageKeyFor(userId: string, filename: string): string {
  const rawExt = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
  const ext = rawExt.replace(/[^a-z0-9]/g, '').slice(0, 10) || 'jpg';
  return `${userId}/${crypto.randomUUID()}.${ext}`;
}

/** The object path inside the bucket, from a stored public URL. Null if unreadable. */
export function pathFromPublicUrl(photoUrl: string | null): string | null {
  if (!photoUrl) return null;
  const idx = photoUrl.indexOf(STORAGE_PREFIX);
  if (idx === -1) return null;
  try {
    // A malformed %-escape must not throw out of here.
    return decodeURIComponent(photoUrl.slice(idx + STORAGE_PREFIX.length));
  } catch {
    console.error('unreadable photo_url; skipping cleanup');
    return null;
  }
}

export type PhotoUpload = { url: string; path: string };

/**
 * Upload one optional file field. Returns null when the field is absent or
 * empty — which the caller MUST treat as "leave the column alone", never as
 * "set it to null". Writing back a URL read earlier in the request is exactly
 * the concurrency bug fixed on the edit page (see resume.md).
 *
 * Throws nothing: a failed upload returns 'failed' so the caller can map it to
 * its own error response.
 */
export async function uploadPhotoField(
  supabase: SupabaseClient,
  userId: string,
  form: FormData,
  field: string,
): Promise<PhotoUpload | null | 'failed'> {
  const file = form.get(field);
  if (!(file instanceof File) || file.size === 0) return null;

  const path = storageKeyFor(userId, file.name);
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type || 'image/jpeg',
  });
  if (error) {
    console.error(`${field} upload failed:`, error);
    return 'failed';
  }
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/garment/photo-upload.test.ts`
Expected: PASS, ~9 tests.

- [ ] **Step 5: Rewire both routes to use it — behaviour must not change**

In `app/api/garments/[id]/route.ts`: delete the local `STORAGE_PREFIX` const and the URL-parsing
body of `removeStoredPhoto`, and import instead. `removeStoredPhoto` becomes:

```ts
import { PHOTO_BUCKET, pathFromPublicUrl, storageKeyFor, uploadPhotoField } from '@/lib/garment/photo-upload';

/** As removeStoredObject, but locating the object from a stored public URL. */
async function removeStoredPhoto(photoUrl: string | null, userId: string): Promise<void> {
  const path = pathFromPublicUrl(photoUrl);
  if (path) await removeStoredObject(path, userId);
}
```

and `removeStoredObject` keeps its owner-prefix guard but uses the shared bucket constant:

```ts
const { error } = await admin.storage.from(PHOTO_BUCKET).remove([path]);
```

Replace the inline `rawExt`/`ext`/`uploadedPath` block in PATCH with `uploadPhotoField`, and the
same in POST. Leave every status code, every `t.*` error and the upload-then-point-then-delete
ordering exactly as they are. This task changes no behaviour.

- [ ] **Step 6: Gates and commit**

```bash
npm test && npm run build
git add lib/garment/photo-upload.ts lib/garment/photo-upload.test.ts app/api/garments/route.ts "app/api/garments/[id]/route.ts" && git commit -m "refactor(garment): one photo-upload helper for both routes"
```

---

## Task 5: API routes — accept colours and fabric

**Files:**
- Modify: `app/api/garments/route.ts` (POST), `app/api/garments/[id]/route.ts` (PATCH)

No automated coverage reaches these routes — the suite is pure unit tests, and there is no staging
database (one Supabase project serves dev and prod). The pure parsers from Task 2 carry the
validation; correctness here is established by reading carefully and by the founder's manual check
in Task 12. Be slow.

**Three rules that must hold in both routes:**

1. **A photo column is written only when a new file actually arrived.** `uploadPhotoField()`
   returns `null` for an absent field, and `null` means *leave the column alone*. Never write back
   a URL read earlier in the request — that is the edit-page concurrency bug.
2. **`present: false` means do not touch that data.** Absent `colours` must not delete rows.
3. **An existing garment saved with no colour/fabric fields must behave exactly as it does today** —
   same columns written, same response body `{ ok: true }`. Pinned in Task 12.

- [ ] **Step 1: POST — parse before uploading anything**

In `app/api/garments/route.ts`, add after the existing `parseGarmentFields` check:

```ts
import { parseColoursField, parseFabricField, isFabricEmpty } from '@/lib/garment/colour-fabric';
import { uploadPhotoField } from '@/lib/garment/photo-upload';

  const coloursParse = parseColoursField(form);
  if (!coloursParse.ok) return NextResponse.json({ error: coloursParse.error }, { status: 400 });

  const fabricParse = parseFabricField(form);
  if (!fabricParse.ok) return NextResponse.json({ error: fabricParse.error }, { status: 400 });
```

Validate everything before the first upload so a rejected request leaves no orphaned Storage file.

- [ ] **Step 2: POST — upload the two new optional photos**

After the existing required-hero-photo upload, replacing the inline block with the helper from
Task 4:

```ts
  // Every path uploaded so far, so a later failure can clean all of them up.
  const uploaded: string[] = [heroPath];

  const trueColour = await uploadPhotoField(supabase, user.id, form, 'true_colour_photo');
  if (trueColour === 'failed') {
    await supabase.storage.from(PHOTO_BUCKET).remove(uploaded).catch(() => {});
    return NextResponse.json({ error: t.photoUploadFailed.th }, { status: 500 });
  }
  if (trueColour) uploaded.push(trueColour.path);

  const fabricPhoto = await uploadPhotoField(supabase, user.id, form, 'fabric_photo');
  if (fabricPhoto === 'failed') {
    await supabase.storage.from(PHOTO_BUCKET).remove(uploaded).catch(() => {});
    return NextResponse.json({ error: t.photoUploadFailed.th }, { status: 500 });
  }
  if (fabricPhoto) uploaded.push(fabricPhoto.path);
```

- [ ] **Step 3: POST — insert the garment, then the child rows**

```ts
  const { data: row, error: insErr } = await supabase
    .from('garments')
    .insert({
      retailer_id: user.id,
      photo_url: heroUrl,
      // Omit the key entirely when there is no photo, rather than writing null:
      // the column default is null anyway, and this keeps the insert payload
      // byte-identical to today's for a garment with no true-colour photo.
      ...(trueColour ? { true_colour_photo_url: trueColour.url } : {}),
      ...parsed.data,
    })
    .select('id')
    .single();
  if (insErr) {
    console.error('garment insert failed:', insErr);
    await supabase.storage.from(PHOTO_BUCKET).remove(uploaded).catch(() => {});
    return NextResponse.json({ error: t.saveFailed.th }, { status: 500 });
  }

  // Child rows. A failure here leaves a saved garment with incomplete colour
  // or fabric data rather than losing the garment: the retailer can re-save.
  // Deleting the garment to "roll back" would be the worse trade — they just
  // uploaded a photo and filled a form.
  if (coloursParse.present && coloursParse.colours.length > 0) {
    const { error } = await supabase.from('garment_colours').insert(
      coloursParse.colours.map(c => ({ garment_id: row.id, hex: c.hex, name: c.name })),
    );
    if (error) console.error('garment_colours insert failed (non-fatal):', error);
  }

  const fabric = fabricParse.present ? fabricParse.fabric : null;
  if (fabric && (!isFabricEmpty(fabric) || fabricPhoto)) {
    const { error } = await supabase.from('garment_fabric').insert({
      garment_id: row.id,
      ...fabric,
      ...(fabricPhoto ? { fabric_photo_url: fabricPhoto.url } : {}),
    });
    if (error) console.error('garment_fabric insert failed (non-fatal):', error);
  }

  return NextResponse.json({ ok: true, id: row.id });
```

`colours.length > 0` guards the insert because Supabase rejects an empty array insert. An empty
list on create simply means no rows — there is nothing to replace yet.

- [ ] **Step 4: PATCH — read the existing fabric row alongside the ownership check**

In `app/api/garments/[id]/route.ts`, extend the existing ownership read and add a second:

```ts
  const { data: existing } = await supabase
    .from('garments')
    .select('photo_url, true_colour_photo_url')
    .eq('id', params.id)
    .eq('retailer_id', user.id)
    .single();
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Needed to decide delete-vs-update below, and to know whether a fabric photo
  // already exists when every text field has been cleared. Safe to read after
  // the ownership check above has passed.
  const { data: existingFabric } = await supabase
    .from('garment_fabric')
    .select('garment_id, fabric_photo_url')
    .eq('garment_id', params.id)
    .maybeSingle();
```

`maybeSingle()`, not `single()` — no fabric row is the normal case and `single()` logs an error for it.

- [ ] **Step 5: PATCH — uploads, then the garment update**

```ts
  const coloursParse = parseColoursField(form);
  if (!coloursParse.ok) return NextResponse.json({ error: coloursParse.error }, { status: 400 });
  const fabricParse = parseFabricField(form);
  if (!fabricParse.ok) return NextResponse.json({ error: fabricParse.error }, { status: 400 });

  const hero       = await uploadPhotoField(supabase, user.id, form, 'photo');
  const trueColour = await uploadPhotoField(supabase, user.id, form, 'true_colour_photo');
  const fabricPic  = await uploadPhotoField(supabase, user.id, form, 'fabric_photo');

  const uploadedPaths = [hero, trueColour, fabricPic]
    .filter((u): u is PhotoUpload => u !== null && u !== 'failed')
    .map(u => u.path);

  if (hero === 'failed' || trueColour === 'failed' || fabricPic === 'failed') {
    if (uploadedPaths.length) {
      await supabase.storage.from(PHOTO_BUCKET).remove(uploadedPaths).catch(() => {});
    }
    return NextResponse.json({ error: t.photoUploadFailed.th }, { status: 500 });
  }

  const { error: updErr } = await supabase
    .from('garments')
    .update({
      ...parsed.data,
      // Spread only when a new file arrived. An absent field means KEEP, and
      // writing back a value read earlier in this request would clobber a newer
      // URL from a concurrent save — the bug fixed on the edit page.
      ...(hero ? { photo_url: hero.url } : {}),
      ...(trueColour ? { true_colour_photo_url: trueColour.url } : {}),
    })
    .eq('id', params.id)
    .eq('retailer_id', user.id);

  if (updErr) {
    console.error('garment update failed:', updErr);
    if (uploadedPaths.length) {
      await supabase.storage.from(PHOTO_BUCKET).remove(uploadedPaths).catch(() => {});
    }
    return NextResponse.json({ error: t.saveFailed.th }, { status: 500 });
  }
```

- [ ] **Step 6: PATCH — replace-all colours, explicit fabric insert-or-update**

```ts
  // Replace-all: the submitted list IS the truth. Only when the field was
  // actually present — see parseColoursField's present flag.
  if (coloursParse.present) {
    const { error: delErr } = await supabase
      .from('garment_colours').delete().eq('garment_id', params.id);
    if (delErr) console.error('garment_colours delete failed (non-fatal):', delErr);
    else if (coloursParse.colours.length > 0) {
      const { error } = await supabase.from('garment_colours').insert(
        coloursParse.colours.map(c => ({ garment_id: params.id, hex: c.hex, name: c.name })),
      );
      if (error) console.error('garment_colours insert failed (non-fatal):', error);
    }
  }

  if (fabricParse.present) {
    const fabric = fabricParse.fabric;
    // A cleared-out fabric still has a reason to exist if it holds a photo.
    const photoUrl = fabricPic ? fabricPic.url : existingFabric?.fabric_photo_url ?? null;

    if (isFabricEmpty(fabric) && !photoUrl) {
      const { error } = await supabase
        .from('garment_fabric').delete().eq('garment_id', params.id);
      if (error) console.error('garment_fabric delete failed (non-fatal):', error);
    } else if (existingFabric) {
      // Deliberately an explicit update, not .upsert(). PostgREST's ON CONFLICT
      // column set is not obvious, and guessing it wrong would silently drop the
      // existing fabric_photo_url when no new file was uploaded. Spreading the
      // photo key only when a file arrived keeps the KEEP semantics exact.
      const { error } = await supabase
        .from('garment_fabric')
        .update({
          ...fabric,
          ...(fabricPic ? { fabric_photo_url: fabricPic.url } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('garment_id', params.id);
      if (error) console.error('garment_fabric update failed (non-fatal):', error);
    } else {
      const { error } = await supabase.from('garment_fabric').insert({
        garment_id: params.id,
        ...fabric,
        ...(fabricPic ? { fabric_photo_url: fabricPic.url } : {}),
      });
      if (error) console.error('garment_fabric insert failed (non-fatal):', error);
    }
  }

  // Only now are the replaced objects unreferenced.
  if (hero) await removeStoredPhoto(existing.photo_url, user.id);
  if (trueColour) await removeStoredPhoto(existing.true_colour_photo_url, user.id);
  if (fabricPic && existingFabric?.fabric_photo_url) {
    await removeStoredPhoto(existingFabric.fabric_photo_url, user.id);
  }

  return NextResponse.json({ ok: true });
```

Note the old-object cleanup is now per-field and each is guarded by *its own* upload having
happened. Deleting the old true-colour photo because a new hero photo arrived would destroy a file
the row still points at.

- [ ] **Step 7: DELETE — clean up the new photos too**

`DELETE` currently removes only `photo_url`. `on delete cascade` removes the child rows, but
Storage objects are not in the database and would be orphaned. Widen the select and the cleanup:

```ts
  const { data: garment } = await supabase
    .from('garments')
    .select('photo_url, true_colour_photo_url')
    .eq('id', params.id)
    .eq('retailer_id', user.id)
    .single();
  if (!garment) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Read the fabric photo before the cascade removes the row that names it.
  const { data: fabricRow } = await supabase
    .from('garment_fabric')
    .select('fabric_photo_url')
    .eq('garment_id', params.id)
    .maybeSingle();
```

…then after the garment delete succeeds:

```ts
  await removeStoredPhoto(garment.photo_url, user.id);
  await removeStoredPhoto(garment.true_colour_photo_url, user.id);
  await removeStoredPhoto(fabricRow?.fabric_photo_url ?? null, user.id);
```

The fabric read must happen **before** the delete. After the cascade there is nothing left to tell
you that object existed.

- [ ] **Step 8: Gates and commit**

```bash
npm test && npm run build
git add app/api/garments && git commit -m "feat(api): colours and fabric on POST, PATCH and DELETE"
```

---

## Task 6: Shopper view logic — `lib/garment/colour-fabric-view.ts`

**Files:**
- Create: `lib/garment/colour-fabric-view.ts`
- Test: `lib/garment/colour-fabric-view.test.ts`

Every shopper-side decision lives here as a pure function so the components stay thin and the
rules are testable in node. The jsdom tests in Tasks 9–10 then only have to prove the components
wire these up, not re-derive them.

- [ ] **Step 1: Write the failing tests**

Create `lib/garment/colour-fabric-view.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  showColourTab, showFabricTab, visibleChips, technicalRows, dotsWithOverflow,
} from './colour-fabric-view';
import type { GarmentFabric } from '@/lib/supabase/types';

const C = (hex: string, name: string) => ({ hex, name });

function fabric(over: Partial<GarmentFabric> = {}): GarmentFabric {
  return {
    garment_id: 'g', finish: null, thickness: null, stretch: null, feel: null,
    composition: null, weight_gsm: null, construction: null, thread_count: null,
    pore_size_mm: null, notes: null, fabric_photo_url: null,
    updated_at: '2026-09-11T00:00:00Z', ...over,
  };
}

describe('showColourTab', () => {
  it('is false with no colours and no photo', () => {
    expect(showColourTab([], null)).toBe(false);
  });
  it('is true with colours, or with only a true-colour photo', () => {
    expect(showColourTab([C('#000000', 'black')], null)).toBe(true);
    expect(showColourTab([], 'https://example.test/a.jpg')).toBe(true);
  });
});

describe('showFabricTab', () => {
  it('is false with no row at all', () => {
    expect(showFabricTab(null)).toBe(false);
  });
  it('is false for a row that exists but says nothing', () => {
    // The row can survive as all-null if a photo was removed. It must not
    // produce an empty tab.
    expect(showFabricTab(fabric())).toBe(false);
  });
  it('is true for one chip, one technical field, or only a photo', () => {
    expect(showFabricTab(fabric({ finish: 'matte' }))).toBe(true);
    expect(showFabricTab(fabric({ composition: 'cotton 100%' }))).toBe(true);
    expect(showFabricTab(fabric({ fabric_photo_url: 'https://example.test/f.jpg' }))).toBe(true);
  });
});

describe('visibleChips', () => {
  it('returns nothing for null or an all-null row', () => {
    expect(visibleChips(null)).toEqual([]);
    expect(visibleChips(fabric())).toEqual([]);
  });

  it('returns only the groups that are set', () => {
    expect(visibleChips(fabric({ finish: 'matte', feel: 'soft' })))
      .toEqual([{ group: 'finish', value: 'matte' }, { group: 'feel', value: 'soft' }]);
  });

  it('always orders finish, thickness, stretch, feel', () => {
    const chips = visibleChips(fabric({
      feel: 'soft', stretch: 'high', thickness: 'thin', finish: 'glossy',
    }));
    expect(chips.map(c => c.group)).toEqual(['finish', 'thickness', 'stretch', 'feel']);
  });

  it('does not treat a technical field as a chip', () => {
    expect(visibleChips(fabric({ composition: 'cotton 100%' }))).toEqual([]);
  });
});

describe('technicalRows', () => {
  it('returns nothing when every technical field is null', () => {
    expect(technicalRows(null)).toEqual([]);
    expect(technicalRows(fabric({ finish: 'matte' }))).toEqual([]);
  });

  it('stringifies numbers and keeps declaration order', () => {
    expect(technicalRows(fabric({
      notes: 'ซักมือ', weight_gsm: 180, composition: 'cotton 100%', pore_size_mm: 0.25,
    }))).toEqual([
      { key: 'composition', value: 'cotton 100%' },
      { key: 'weight_gsm', value: '180' },
      { key: 'pore_size_mm', value: '0.25' },
      { key: 'notes', value: 'ซักมือ' },
    ]);
  });

  it('drops a blank string but keeps a zero-like value that is really set', () => {
    expect(technicalRows(fabric({ composition: '   ' }))).toEqual([]);
    expect(technicalRows(fabric({ thread_count: 400 })))
      .toEqual([{ key: 'thread_count', value: '400' }]);
  });
});

describe('dotsWithOverflow', () => {
  it('shows everything and no overflow at or under the cap', () => {
    const six = [1, 2, 3, 4, 5, 6];
    expect(dotsWithOverflow(six)).toEqual({ shown: six, extra: 0 });
    expect(dotsWithOverflow([1, 2])).toEqual({ shown: [1, 2], extra: 0 });
    expect(dotsWithOverflow([])).toEqual({ shown: [], extra: 0 });
  });

  it('caps at six and reports the remainder', () => {
    expect(dotsWithOverflow([1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual({ shown: [1, 2, 3, 4, 5, 6], extra: 3 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/garment/colour-fabric-view.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `lib/garment/colour-fabric-view.ts`:

```ts
import { FABRIC_CHIPS, isFabricEmpty, type FabricChipKey } from './colour-fabric';
import type { GarmentFabric } from '@/lib/supabase/types';

/** Spec 6.1: the Colour tab exists only if there is something to show in it. */
export function showColourTab(colours: unknown[], trueColourPhotoUrl: string | null): boolean {
  return colours.length > 0 || !!trueColourPhotoUrl;
}

/**
 * Spec 6.1. Note a fabric row can legitimately exist while saying nothing —
 * it survives if text fields are cleared while a photo remains, and a later
 * photo removal can leave it all-null. An empty tab would be worse than none.
 */
export function showFabricTab(fabric: GarmentFabric | null): boolean {
  if (!fabric) return false;
  return !isFabricEmpty(fabric) || !!fabric.fabric_photo_url;
}

export interface Chip { group: FabricChipKey; value: string }

/** The simple tier, in a fixed order, with only the groups the retailer set. */
export function visibleChips(fabric: GarmentFabric | null): Chip[] {
  if (!fabric) return [];
  return (Object.keys(FABRIC_CHIPS) as FabricChipKey[])
    .map(group => ({ group, value: fabric[group] }))
    .filter((c): c is Chip => typeof c.value === 'string' && c.value.trim() !== '');
}

/** Technical-tier fields, in display order. Not chips, not the photo. */
export const TECHNICAL_FIELDS = [
  'composition', 'weight_gsm', 'construction', 'thread_count', 'pore_size_mm', 'notes',
] as const;

export type TechnicalField = (typeof TECHNICAL_FIELDS)[number];
export interface TechnicalRow { key: TechnicalField; value: string }

/** Only rows with a value. Values are the retailer's own text, shown as-is. */
export function technicalRows(fabric: GarmentFabric | null): TechnicalRow[] {
  if (!fabric) return [];
  return TECHNICAL_FIELDS
    .map(key => {
      const raw = fabric[key];
      return { key, value: raw === null || raw === undefined ? '' : String(raw).trim() };
    })
    .filter(r => r.value !== '');
}

/** Spec 6.2: up to `cap` dots on a grid card, then "+n". */
export function dotsWithOverflow<T>(colours: T[], cap = 6): { shown: T[]; extra: number } {
  return { shown: colours.slice(0, cap), extra: Math.max(0, colours.length - cap) };
}
```

- [ ] **Step 4: Run to verify it passes, then gates and commit**

```bash
npx vitest run lib/garment/colour-fabric-view.test.ts
npm test && npm run build
git add lib/garment/colour-fabric-view.ts lib/garment/colour-fabric-view.test.ts && git commit -m "feat(garment): pure shopper-side colour and fabric view logic"
```

---

## Task 7: Retailer form — Colours section

**Files:**
- Create: `app/dashboard/garment/ColoursSection.tsx`
- Modify: `app/dashboard/garment/GarmentForm.tsx`, `lib/i18n/strings.ts`

Read `GarmentForm.tsx` fully before editing. Note: **`const [lang] = useLanguage();`** — a tuple.

- [ ] **Step 1: Add the one missing i18n key**

```ts
  colourNameRequired: { th: 'กรุณาใส่ชื่อสีทุกสี', en: 'Every colour needs a name' },
```

- [ ] **Step 2: Create the section component**

```tsx
'use client';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import type { Colour } from '@/lib/garment/colour-fabric';

export default function ColoursSection({
  colours, onChange, currentPhotoUrl,
}: {
  colours: Colour[];
  onChange: (next: Colour[]) => void;
  /** Edit mode: the true-colour photo already stored, if any. */
  currentPhotoUrl?: string | null;
}) {
  const [lang] = useLanguage();

  function update(i: number, patch: Partial<Colour>) {
    onChange(colours.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  return (
    <details open className="rounded border p-4">
      <summary className="cursor-pointer font-medium">{t.coloursSection[lang]}</summary>

      <ul className="mt-3 space-y-2">
        {colours.map((c, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              type="color"
              value={c.hex}
              onChange={e => update(i, { hex: e.target.value })}
              className="h-9 w-12 rounded border"
              aria-label={`${t.coloursSection[lang]} ${i + 1}`}
            />
            <input
              type="text"
              value={c.name}
              maxLength={40}
              placeholder={t.colourName[lang]}
              onChange={e => update(i, { name: e.target.value })}
              className="flex-1 rounded border px-2 py-1.5"
            />
            <button
              type="button"
              onClick={() => onChange(colours.filter((_, j) => j !== i))}
              className="px-2 py-1 text-sm text-red-600"
            >
              {t.removeColour[lang]}
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onChange([...colours, { hex: '#000000', name: '' }])}
        className="mt-3 rounded border px-3 py-1.5 text-sm"
      >
        {t.addColour[lang]}
      </button>

      <label className="mt-4 block text-sm">
        {t.trueColourPhoto[lang]}
        {currentPhotoUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={currentPhotoUrl} alt="" className="mt-1 h-20 w-20 rounded object-cover" />
        )}
        <input type="file" name="true_colour_photo" accept="image/*" className="mt-1 block" />
      </label>
    </details>
  );
}
```

The file input is **uncontrolled and read by name at submit** — same pattern as the existing hero
`photoRef`. Add a `trueColourRef` in `GarmentForm` and read `.files?.[0]`.

`key={i}` is correct here despite the usual rule against index keys: rows have no stable id, and
both inputs are fully controlled, so an index key cannot strand state on the wrong row.

- [ ] **Step 3: Wire it into GarmentForm**

1. Extend `GarmentFormInitial` with `colours: Colour[]` and `true_colour_photo_url: string | null`.
2. `const [colours, setColours] = useState<Colour[]>(initial?.colours ?? []);`
3. Add `colours` to the `initialSnapshot` object **and** to the `current` object in the dirty
   check. Miss this and the unsaved-changes guard ignores colour edits silently.
4. Add two refs: `trueColourRef`, and (Task 8) `fabricPhotoRef`. Add them to the dirty check the
   same way `photoRef` already is.
5. In `onSubmit`, before `fetch`:

```ts
    const cleanColours = colours.filter(c => c.name.trim() !== '' || c.hex !== '#000000');
    if (cleanColours.some(c => c.name.trim() === '')) {
      setError(t.colourNameRequired[lang]);
      return;
    }
    form.set('colours', JSON.stringify(cleanColours.map(c => ({ hex: c.hex, name: c.name.trim() }))));
    const trueColour = trueColourRef.current?.files?.[0];
    if (trueColour) form.set('true_colour_photo', trueColour);
```

`colours` is **always** set, including as `'[]'`. That is what tells the API "this list is the
truth, replace it" — and it is why `parseColoursField` distinguishes absent from empty. Dropping a
row that was added and never filled in is a kindness, not validation; a row with a chosen colour
but no name is an error the retailer must resolve.

6. Render `<ColoursSection …/>` under the measurements block, above the fit rule, per spec §5.

- [ ] **Step 4: Pre-fill in edit mode**

In `app/dashboard/garment/[id]/edit/page.tsx`, fetch the colours alongside the garment and pass
them through. Add `true_colour_photo_url` to the garment select:

```ts
  const { data: colourRows } = await supabase
    .from('garment_colours')
    .select('hex, name')
    .eq('garment_id', params.id)
    .order('created_at', { ascending: true });
```

- [ ] **Step 5: Gates and commit**

```bash
npm test && npm run build
git add app/dashboard/garment lib/i18n/strings.ts && git commit -m "feat(garment-form): colour swatch list"
```

---

## Task 8: Retailer form — Fabric section

**Files:**
- Create: `app/dashboard/garment/FabricSection.tsx`
- Modify: `app/dashboard/garment/GarmentForm.tsx`

- [ ] **Step 1: Define the form state shape**

Fabric form state is **all strings**, including the numbers — that is what an `<input>` holds, and
`FabricSchema` already coerces and range-checks them. Do not parse in the component.

```ts
/** Every fabric field as the form holds it: strings, '' meaning "not set". */
export type FabricFormState = Record<string, string>;

export function emptyFabricForm(): FabricFormState {
  return Object.fromEntries(FABRIC_FIELDS.map(k => [k, '']));
}
```

Put both in `FabricSection.tsx` and export them; `GarmentForm` imports them.

- [ ] **Step 2: Create the section component**

```tsx
'use client';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { t, type StringKey } from '@/lib/i18n/strings';
import {
  FABRIC_CHIPS, FABRIC_FIELDS, chipStringKey, type FabricChipKey,
} from '@/lib/garment/colour-fabric';
import { TECHNICAL_FIELDS } from '@/lib/garment/colour-fabric-view';

export type FabricFormState = Record<string, string>;
export function emptyFabricForm(): FabricFormState {
  return Object.fromEntries(FABRIC_FIELDS.map(k => [k, '']));
}

/** 'weight_gsm' -> 'weightGsm', matching the i18n key names. */
function labelKey(field: string): StringKey {
  return field.split('_')
    .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join('') as StringKey;
}

const NUMERIC: Record<string, { step: string; max: number }> = {
  weight_gsm:   { step: '1', max: 2000 },
  thread_count: { step: '1', max: 2000 },
  pore_size_mm: { step: '0.001', max: 999.999 },
};

export default function FabricSection({
  fabric, onChange, currentPhotoUrl,
}: {
  fabric: FabricFormState;
  onChange: (next: FabricFormState) => void;
  currentPhotoUrl?: string | null;
}) {
  const [lang] = useLanguage();
  const set = (k: string, v: string) => onChange({ ...fabric, [k]: v });

  return (
    <details open className="rounded border p-4">
      <summary className="cursor-pointer font-medium">{t.fabricSection[lang]}</summary>

      {(Object.keys(FABRIC_CHIPS) as FabricChipKey[]).map(group => (
        <fieldset key={group} className="mt-3">
          <legend className="text-sm font-medium">{t[group][lang]}</legend>
          <div className="mt-1 flex flex-wrap gap-3 text-sm">
            {/* "Not set" is a real option, not the absence of one: the retailer
                must be able to take a claim back off the garment. */}
            <label className="flex items-center gap-1">
              <input
                type="radio" name={group} value=""
                checked={(fabric[group] ?? '') === ''}
                onChange={() => set(group, '')}
              />
              {t.notSet[lang]}
            </label>
            {FABRIC_CHIPS[group].map(v => (
              <label key={v} className="flex items-center gap-1">
                <input
                  type="radio" name={group} value={v}
                  checked={fabric[group] === v}
                  onChange={() => set(group, v)}
                />
                {t[chipStringKey(group, v) as StringKey][lang]}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <details className="mt-4">
        <summary className="cursor-pointer text-sm">{t.fabricTechnicalDetails[lang]}</summary>
        <div className="mt-2 space-y-2">
          {TECHNICAL_FIELDS.map(field => {
            const num = NUMERIC[field];
            return (
              <label key={field} className="block text-sm">
                {t[labelKey(field)][lang]}
                {field === 'notes' ? (
                  <textarea
                    value={fabric[field] ?? ''} rows={3} maxLength={2000}
                    onChange={e => set(field, e.target.value)}
                    className="mt-1 w-full rounded border px-2 py-1.5"
                  />
                ) : (
                  <input
                    type={num ? 'number' : 'text'}
                    step={num?.step} min={num ? 0 : undefined} max={num?.max}
                    maxLength={num ? undefined : 200}
                    value={fabric[field] ?? ''}
                    onChange={e => set(field, e.target.value)}
                    className="mt-1 w-full rounded border px-2 py-1.5"
                  />
                )}
              </label>
            );
          })}
        </div>
      </details>

      <label className="mt-4 block text-sm">
        {t.fabricPhoto[lang]}
        {currentPhotoUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={currentPhotoUrl} alt="" className="mt-1 h-20 w-20 rounded object-cover" />
        )}
        <input type="file" name="fabric_photo" accept="image/*" className="mt-1 block" />
      </label>
    </details>
  );
}
```

The `name={group}` radios are inside the same `<form>` as the rest of the garment fields, so their
values would also land in the FormData under those names. Harmless — the API reads fabric only
from the single `fabric` JSON field — but **do not** start reading `form.get('finish')` in the
route, or the two sources will drift.

- [ ] **Step 3: Wire into GarmentForm**

1. `const [fabric, setFabric] = useState<FabricFormState>(initial?.fabric ?? emptyFabricForm());`
2. Add `fabric` to `initialSnapshot` and to the dirty-check `current` object.
3. In `onSubmit`: `form.set('fabric', JSON.stringify(fabric));` plus the file, as in Task 7.
   Always set it, even when empty — `'{}'`-equivalent is how a retailer clears the fabric row.
4. Extend `GarmentFormInitial` with `fabric: FabricFormState` and `fabric_photo_url: string | null`.
5. In the edit page, fetch the fabric row and map it to strings:

```ts
  const { data: fabricRow } = await supabase
    .from('garment_fabric').select('*').eq('garment_id', params.id).maybeSingle();

  const fabricForm = emptyFabricForm();
  if (fabricRow) {
    for (const k of FABRIC_FIELDS) {
      const v = (fabricRow as Record<string, unknown>)[k];
      fabricForm[k] = v === null || v === undefined ? '' : String(v);
    }
  }
```

- [ ] **Step 4: Gates and commit**

```bash
npm test && npm run build
git add app/dashboard/garment && git commit -m "feat(garment-form): fabric chips and technical tier"
```

---

## Task 9: Shopper garment page — tabs and the Colour panel

**Files:**
- Create: `app/shop/[shop_slug]/[garment_id]/GarmentTabs.tsx`, `ColourPanel.tsx`,
  `GarmentTabs.test.tsx`
- Modify: `app/shop/[shop_slug]/[garment_id]/page.tsx`

**The rule that protects the existing page:** when a garment has neither colour nor fabric data
there must be **no tab bar at all** and the page must render exactly as it does today. Task 12 pins
this.

**The trap:** the Fit panel must stay **mounted** when another tab is active. `FitChecker` holds the
shopper's typed measurements in local state; unmounting it throws them away, so tapping Colour and
coming back would clear a form they had half filled. Hide it with the `hidden` attribute, which
Tailwind's preflight styles as `display: none`. Do not put a `flex` or `grid` class on a wrapper
that carries `hidden` — the display class wins and the panel shows through.

- [ ] **Step 1: Write the failing render tests**

Create `app/shop/[shop_slug]/[garment_id]/GarmentTabs.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import GarmentTabs from './GarmentTabs';
import type { GarmentFabric } from '@/lib/supabase/types';

function fabric(over: Partial<GarmentFabric> = {}): GarmentFabric {
  return {
    garment_id: 'g', finish: null, thickness: null, stretch: null, feel: null,
    composition: null, weight_gsm: null, construction: null, thread_count: null,
    pore_size_mm: null, notes: null, fabric_photo_url: null,
    updated_at: '2026-09-11T00:00:00Z', ...over,
  };
}

function mount(props: Partial<React.ComponentProps<typeof GarmentTabs>> = {}) {
  return render(
    <LanguageProvider>
      <GarmentTabs colours={[]} trueColourPhotoUrl={null} fabric={null} {...props}>
        <p>FIT PANEL</p>
      </GarmentTabs>
    </LanguageProvider>,
  );
}

describe('GarmentTabs', () => {
  it('renders NO tab bar and just the children when there is no extra data', () => {
    mount();
    expect(screen.getByText('FIT PANEL')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByText(t.tabColour.th)).toBeNull();
  });

  it('shows a Colour tab but no Fabric tab when only colours exist', () => {
    mount({ colours: [{ hex: '#112233', name: 'navy' }] });
    expect(screen.getByRole('tablist')).toBeTruthy();
    expect(screen.getByText(t.tabColour.th)).toBeTruthy();
    expect(screen.queryByText(t.tabFabric.th)).toBeNull();
  });

  it('shows a Fabric tab but no Colour tab when only fabric exists', () => {
    mount({ fabric: fabric({ finish: 'matte' }) });
    expect(screen.getByText(t.tabFabric.th)).toBeTruthy();
    expect(screen.queryByText(t.tabColour.th)).toBeNull();
  });

  it('shows no Fabric tab for a fabric row that says nothing', () => {
    mount({ colours: [{ hex: '#112233', name: 'navy' }], fabric: fabric() });
    expect(screen.queryByText(t.tabFabric.th)).toBeNull();
  });

  it('defaults to the Fit tab', () => {
    mount({ colours: [{ hex: '#112233', name: 'navy' }] });
    expect(screen.getByText('FIT PANEL').closest('[hidden]')).toBeNull();
  });

  it('keeps the Fit panel MOUNTED but hidden when another tab is active', () => {
    // FitChecker holds the shopper's typed measurements. Unmounting it would
    // silently clear a half-filled form when they tap Colour and come back.
    const { getByText } = mount({ colours: [{ hex: '#112233', name: 'navy' }] });
    getByText(t.tabColour.th).click();
    const fit = getByText('FIT PANEL');
    expect(fit).toBeTruthy();
    expect(fit.closest('[hidden]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run "app/shop/[shop_slug]/[garment_id]/GarmentTabs.test.tsx"`
Expected: FAIL — cannot resolve `./GarmentTabs`.

- [ ] **Step 3: Write GarmentTabs**

```tsx
'use client';
import { useState } from 'react';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import { showColourTab, showFabricTab } from '@/lib/garment/colour-fabric-view';
import ColourPanel from './ColourPanel';
import FabricPanel from './FabricPanel';
import type { GarmentFabric } from '@/lib/supabase/types';

type Tab = 'fit' | 'colour' | 'fabric';

export default function GarmentTabs({
  children, colours, trueColourPhotoUrl, fabric,
}: {
  /** The Fit panel — FitChecker, rendered by the server page. */
  children: React.ReactNode;
  colours: { hex: string; name: string }[];
  trueColourPhotoUrl: string | null;
  fabric: GarmentFabric | null;
}) {
  const [lang] = useLanguage();
  const [tab, setTab] = useState<Tab>('fit');

  const hasColour = showColourTab(colours, trueColourPhotoUrl);
  const hasFabric = showFabricTab(fabric);

  // Nothing extra to show: no tab bar, page identical to before this feature.
  if (!hasColour && !hasFabric) return <>{children}</>;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'fit', label: t.tabFit[lang] },
    ...(hasColour ? [{ key: 'colour' as Tab, label: t.tabColour[lang] }] : []),
    ...(hasFabric ? [{ key: 'fabric' as Tab, label: t.tabFabric[lang] }] : []),
  ];

  return (
    <div className="mt-4">
      <div role="tablist" className="flex gap-1 border-b">
        {tabs.map(x => (
          <button
            key={x.key}
            role="tab"
            type="button"
            aria-selected={tab === x.key}
            onClick={() => setTab(x.key)}
            className={`px-4 py-2 text-sm ${
              tab === x.key
                ? 'border-b-2 border-gray-900 font-medium text-gray-900'
                : 'text-gray-500'
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {/*
        Always mounted, hidden when inactive. FitChecker keeps the shopper's
        typed measurements in local state, so unmounting would clear a
        half-filled form. Tailwind preflight gives [hidden] display:none — do
        not add a flex/grid class to these wrappers or it will override that.
      */}
      <div hidden={tab !== 'fit'}>{children}</div>
      {hasColour && (
        <div hidden={tab !== 'colour'}>
          <ColourPanel colours={colours} trueColourPhotoUrl={trueColourPhotoUrl} />
        </div>
      )}
      {hasFabric && fabric && (
        <div hidden={tab !== 'fabric'}>
          <FabricPanel fabric={fabric} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write ColourPanel**

```tsx
'use client';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';

export default function ColourPanel({
  colours, trueColourPhotoUrl,
}: {
  colours: { hex: string; name: string }[];
  trueColourPhotoUrl: string | null;
}) {
  const [lang] = useLanguage();

  return (
    <div className="py-4">
      {colours.length > 0 && (
        <ul className="flex flex-wrap gap-4">
          {colours.map((c, i) => (
            <li key={i} className="w-16 text-center">
              {/* A thin border so white and near-white swatches still read as
                  a swatch rather than as a gap in the row. */}
              <span
                className="block h-12 w-12 rounded border border-gray-300"
                style={{ backgroundColor: c.hex }}
                aria-hidden="true"
              />
              <span className="mt-1 block break-words text-xs text-gray-700">{c.name}</span>
            </li>
          ))}
        </ul>
      )}

      {trueColourPhotoUrl && (
        <figure className="mt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={trueColourPhotoUrl} alt="" className="w-full rounded" />
          <figcaption className="mt-1 text-xs text-gray-500">
            {t.trueColourCaption[lang]}
          </figcaption>
        </figure>
      )}

      {/* Honest, one line, not a banner. Spec 6.1. */}
      <p className="mt-3 text-xs text-gray-400">{t.screenColourDisclaimer[lang]}</p>
    </div>
  );
}
```

Swatches are 48×48 px (`h-12 w-12`), the spec's stated minimum.

- [ ] **Step 5: Fetch the data in the server page**

In `app/shop/[shop_slug]/[garment_id]/page.tsx`, add `true_colour_photo_url` to the garment select
and two queries to the existing `Promise.all`:

```ts
    supabase
      .from('garment_colours')
      .select('hex, name')
      .eq('garment_id', params.garment_id)
      .order('created_at', { ascending: true }),
    supabase
      .from('garment_fabric')
      .select('*')
      .eq('garment_id', params.garment_id)
      .maybeSingle(),
```

Then wrap `FitChecker` — note `FitChecker` itself is unchanged:

```tsx
        <GarmentTabs
          colours={colourRows ?? []}
          trueColourPhotoUrl={garment.true_colour_photo_url ?? null}
          fabric={fabricRow ?? null}
        >
          <FitChecker
            garmentId={garment.id}
            dimensions={dims.map(d => ({
              key: d.key, labelTh: d.labelTh, hintTh: d.measureHintTh,
              labelEn: d.labelEn, hintEn: d.measureHintEn,
            }))}
          />
        </GarmentTabs>
```

These two queries join the existing `Promise.all`, so the page still makes one round of parallel
reads — no extra serial latency.

- [ ] **Step 6: Run the tests, gates, commit**

`FabricPanel` does not exist yet, so write a one-line placeholder that returns `null` to get Task 9
green, then replace it in Task 10. Do not leave the placeholder uncommitted across tasks.

```bash
npx vitest run "app/shop/[shop_slug]/[garment_id]/GarmentTabs.test.tsx"
npm test && npm run build
git add "app/shop/[shop_slug]/[garment_id]" && git commit -m "feat(shop): Fit/Colour/Fabric tabs and colour swatches"
```

---

## Task 10: Shopper — Fabric panel

**Files:**
- Create: `app/shop/[shop_slug]/[garment_id]/FabricPanel.tsx` (replacing the placeholder),
  `FabricPanel.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import FabricPanel from './FabricPanel';
import type { GarmentFabric } from '@/lib/supabase/types';

function fabric(over: Partial<GarmentFabric> = {}): GarmentFabric {
  return {
    garment_id: 'g', finish: null, thickness: null, stretch: null, feel: null,
    composition: null, weight_gsm: null, construction: null, thread_count: null,
    pore_size_mm: null, notes: null, fabric_photo_url: null,
    updated_at: '2026-09-11T00:00:00Z', ...over,
  };
}

const mount = (f: GarmentFabric) =>
  render(<LanguageProvider><FabricPanel fabric={f} /></LanguageProvider>);

describe('FabricPanel', () => {
  it('renders only the chips that are set', () => {
    mount(fabric({ finish: 'matte', feel: 'soft' }));
    expect(screen.getByText(t.finishMatte.th)).toBeTruthy();
    expect(screen.getByText(t.feelSoft.th)).toBeTruthy();
    expect(screen.queryByText(t.thicknessThin.th)).toBeNull();
    expect(screen.queryByText(t.stretchHigh.th)).toBeNull();
  });

  it('hides the technical details entirely when every technical field is null', () => {
    mount(fabric({ finish: 'matte' }));
    expect(screen.queryByText(t.fabricTechnicalDetails.th)).toBeNull();
  });

  it('shows only technical rows that have a value, collapsed by default', () => {
    mount(fabric({ composition: 'cotton 100%', weight_gsm: 180 }));
    const details = screen.getByText(t.fabricTechnicalDetails.th).closest('details');
    expect(details?.hasAttribute('open')).toBe(false);
    expect(screen.getByText('cotton 100%')).toBeTruthy();
    expect(screen.getByText('180')).toBeTruthy();
    expect(screen.queryByText(t.threadCount.th)).toBeNull();
  });

  it('renders the close-up photo when present', () => {
    mount(fabric({ fabric_photo_url: 'https://example.test/f.jpg' }));
    expect(screen.getByRole('presentation')).toBeTruthy();
  });
});
```

An `<img alt="">` has role `presentation`. If that assertion is awkward, query by `img` tag via
`container.querySelector('img')` instead — do not add an alt text that describes nothing.

- [ ] **Step 2: Run to verify it fails, then implement**

```tsx
'use client';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { t, type StringKey } from '@/lib/i18n/strings';
import { chipStringKey } from '@/lib/garment/colour-fabric';
import { visibleChips, technicalRows } from '@/lib/garment/colour-fabric-view';
import type { GarmentFabric } from '@/lib/supabase/types';

/** Monochrome, simple, one per chip group. Spec 6.1: icon + word. */
const ICONS: Record<string, React.ReactNode> = {
  finish:    <circle cx="8" cy="8" r="6" />,
  thickness: <><rect x="2" y="5" width="12" height="2" /><rect x="2" y="9" width="12" height="3" /></>,
  stretch:   <><path d="M2 8h12" /><path d="M2 5v6" /><path d="M14 5v6" /></>,
  feel:      <path d="M2 10c2-4 4 4 6 0s4-4 6 0" />,
};

/** 'weight_gsm' -> 'weightGsm', matching the i18n key names. */
function labelKey(field: string): StringKey {
  return field.split('_')
    .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join('') as StringKey;
}

export default function FabricPanel({ fabric }: { fabric: GarmentFabric }) {
  const [lang] = useLanguage();
  const chips = visibleChips(fabric);
  const rows = technicalRows(fabric);

  return (
    <div className="py-4">
      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {chips.map(c => (
            <li
              key={c.group}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm"
            >
              <svg
                viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"
                fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500"
              >
                {ICONS[c.group]}
              </svg>
              {t[chipStringKey(c.group, c.value) as StringKey][lang]}
            </li>
          ))}
        </ul>
      )}

      {fabric.fabric_photo_url && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={fabric.fabric_photo_url} alt="" className="mt-4 w-full rounded" />
      )}

      {rows.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-gray-600">
            {t.fabricTechnicalDetails[lang]}
          </summary>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {rows.map(r => (
              <div key={r.key} className="col-span-2 grid grid-cols-subgrid">
                <dt className="text-gray-500">{t[labelKey(r.key)][lang]}</dt>
                {/* Retailer's own words, shown as-is. React escapes it. */}
                <dd className="break-words">{r.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </div>
  );
}
```

`grid-cols-subgrid` needs Tailwind 3.4+. The project is on 3.4.1, so it is available — but if the
build complains, replace the wrapper `<div>` with a plain two-column `<dl>` and drop the subgrid.

The `finish` chip's `<circle>` needs `fill` to read as a filled dot; it inherits `fill="none"` from
the `<svg>`. Either give it `fill="currentColor"` or accept it as an outline. Pick one and look at
it — this is the kind of detail the founder's manual check will notice.

- [ ] **Step 3: Gates and commit**

```bash
npx vitest run "app/shop/[shop_slug]/[garment_id]/FabricPanel.test.tsx"
npm test && npm run build
git add "app/shop/[shop_slug]/[garment_id]" && git commit -m "feat(shop): fabric chips and technical tier"
```

---

## Task 11: Shop grid — colour dots

**Files:**
- Create: `app/shop/[shop_slug]/ColourDots.tsx`, `ColourDots.test.tsx`
- Modify: `app/shop/[shop_slug]/page.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/lib/hooks/useLanguage';
import ColourDots from './ColourDots';

const many = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ hex: '#112233', name: `c${i}` }));

const mount = (n: number) =>
  render(<LanguageProvider><ColourDots colours={many(n)} /></LanguageProvider>);

describe('ColourDots', () => {
  it('renders nothing at all when there are no colours', () => {
    const { container } = mount(0);
    expect(container.firstChild).toBeNull();
  });

  it('renders one dot per colour up to six, with no overflow label', () => {
    const { container } = mount(6);
    expect(container.querySelectorAll('li')).toHaveLength(6);
    expect(screen.queryByText(/^\+/)).toBeNull();
  });

  it('caps at six dots and shows +n for the rest', () => {
    const { container } = mount(9);
    expect(container.querySelectorAll('li')).toHaveLength(6);
    expect(screen.getByText('+3')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement**

```tsx
'use client';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import { dotsWithOverflow } from '@/lib/garment/colour-fabric-view';

export default function ColourDots({
  colours,
}: { colours: { hex: string; name: string }[] }) {
  const [lang] = useLanguage();
  if (colours.length === 0) return null;

  const { shown, extra } = dotsWithOverflow(colours);

  return (
    <ul className="flex items-center gap-1">
      {shown.map((c, i) => (
        <li
          key={i}
          // A thin border so a white or near-white colour still reads as a dot.
          className="h-3 w-3 rounded-full border border-gray-300"
          style={{ backgroundColor: c.hex }}
          title={c.name}
        />
      ))}
      {extra > 0 && (
        <li className="ml-0.5 text-xs text-gray-500">
          {t.moreColours[lang].replace('{n}', String(extra))}
        </li>
      )}
    </ul>
  );
}
```

This is a client component because it reads `useLanguage()`. It sits inside the shop route, which
`app/shop/[shop_slug]/layout.tsx` already wraps in `LanguageProvider`, so no new provider is needed.

- [ ] **Step 3: One grouped query in the server page — do NOT N+1**

In `app/shop/[shop_slug]/page.tsx`, after the garments query:

```ts
  // One query for the whole grid, grouped in code. A per-card query would be
  // an N+1 on a page that is meant to list a shop's entire catalogue.
  const ids = (garments ?? []).map(g => g.id);
  const { data: colourRows } = ids.length
    ? await supabase
        .from('garment_colours')
        .select('garment_id, hex, name')
        .in('garment_id', ids)
        .order('created_at', { ascending: true })
    : { data: [] };

  const coloursByGarment = new Map<string, { hex: string; name: string }[]>();
  for (const r of colourRows ?? []) {
    const list = coloursByGarment.get(r.garment_id) ?? [];
    list.push({ hex: r.hex, name: r.name });
    coloursByGarment.set(r.garment_id, list);
  }
```

Then under the garment name in the card:

```tsx
                <div className="p-3 text-sm">
                  {g.name}
                  <div className="mt-1.5">
                    <ColourDots colours={coloursByGarment.get(g.id) ?? []} />
                  </div>
                </div>
```

`.in()` on an empty array is a malformed filter, which is why the ternary guards it. An empty shop
already returns early through `NoGarments`, but the guard keeps that independent of render order.

- [ ] **Step 4: Gates and commit**

```bash
npx vitest run "app/shop/[shop_slug]/ColourDots.test.tsx"
npm test && npm run build
git add "app/shop/[shop_slug]" && git commit -m "feat(shop): colour dots on grid cards"
```

---

## Task 12: The regression pin, then the founder's manual check

**Files:**
- Create: `lib/garment/colour-fabric-regression.test.ts`

Spec §8 asks that an existing garment with no colour/fabric data behave exactly as before. The
garment-edit work pinned its equivalent claim at the **pure-function layer**, because there is no
route or DB harness — `lib/garment/round-trip.test.ts` is the precedent. Do the same.

- [ ] **Step 1: Write the regression test**

```ts
import { describe, it, expect } from 'vitest';
import { parseColoursField, parseFabricField, isFabricEmpty } from './colour-fabric';
import { showColourTab, showFabricTab } from './colour-fabric-view';

/**
 * A garment saved by a client that knows nothing about colour or fabric — a
 * stale browser tab, a retry, a future script — must come out of the parsers
 * saying "do not touch", so its existing data cannot be wiped and its API
 * behaviour cannot change.
 */
describe('a request with no colour or fabric fields', () => {
  function legacyForm(): FormData {
    const f = new FormData();
    f.set('name', 'เสื้อยืดคอกลม');
    f.set('category', 'top');
    f.set('fit_profile', 'regular');
    f.set('chest', '100');
    return f;
  }

  it('reports both as ABSENT, never as empty', () => {
    expect(parseColoursField(legacyForm())).toEqual({ ok: true, present: false });
    expect(parseFabricField(legacyForm())).toEqual({ ok: true, present: false });
  });

  it('means the route writes no colour or fabric statement at all', () => {
    // present:false is the only signal the routes branch on. If this ever
    // returns present:true the replace-all delete would run on a request that
    // never mentioned colours.
    const c = parseColoursField(legacyForm());
    expect(c.ok && c.present).toBe(false);
  });
});

describe('a garment with no colour or fabric data', () => {
  it('shows no tabs, so the shopper page renders as it did before', () => {
    expect(showColourTab([], null)).toBe(false);
    expect(showFabricTab(null)).toBe(false);
  });

  it('shows no fabric tab even if an all-null row somehow exists', () => {
    expect(isFabricEmpty({ garment_id: 'g', updated_at: 'now', fabric_photo_url: null })).toBe(true);
  });
});
```

- [ ] **Step 2: Full gates**

```bash
npm test && npm run build
```

Expected: every test passes. Record the final count — it should be roughly 89 + 24 + 9 + 17 + 6 + 4
+ 3 + 5.

- [ ] **Step 3: Commit**

```bash
git add lib/garment/colour-fabric-regression.test.ts && git commit -m "test: pin that a colour-unaware request changes nothing"
```

- [ ] **Step 4: STOP. Hand back to the director.**

Do not merge, do not push to `main`. The remaining steps need the founder:

1. **Check Supabase is not auto-paused** before anything else (`resume.md` → Environment).
2. **Apply the migration by hand** in the Supabase SQL editor — paste
   `supabase/migrations/0003_colour_fabric.sql`. It has not run yet. Nothing in the feature works
   until it has, and the retailer form will return 500s.
3. **Proofread the Thai copy** added in Task 3, especially `feelCrisp` (`แข็งอยู่ทรง`).
4. **Manual check, ~10 min, spec §8:** on a phone, add a garment with 3 colours and fabric set;
   open the shop link; confirm the swatches look like the real garment under daylight. Then edit:
   remove one colour, save, confirm it is gone and the other two survived. Then edit again changing
   only the name, and confirm the colours and both photos are still there — that is the
   "absent means keep" invariant seen from the outside.

---

## Task 13: Ship

Only after Task 12's manual check passes.

- [ ] **Step 1: Merge and push**

```bash
git checkout main && git merge --ff-only feature/colour-fabric && git push origin main
```

**Pushing the feature branch does not update the live site.** Vercel builds `main` only. This cost
a full session on 2026-08-11.

- [ ] **Step 2: Verify the deploy landed — probe, do not assume**

A blanket 401 would look like success, so check a control as well:

```bash
curl -o /dev/null -s -w "%{http_code}\n" https://fit-mvp-eight.vercel.app/shop/<slug>
```

Better, confirm the new behaviour is really live by loading a garment page that has colours and
seeing the tab bar. A 404 on a route that should exist means the deploy has not landed — check
`git log --oneline origin/main -1` before debugging anything else.

- [ ] **Step 3: Update `resume.md`**

Replace the "NEXT — Colour & fabric reference" section with a shipped record: date, commit range,
test count, what the manual check covered. Add to "Open follow-ups" anything deliberately left:

- AI colour extraction, catalogue organisation, colour search/filter — all deferred by spec §9.
- The child-row inserts in POST/PATCH log and continue rather than failing the request. A retailer
  whose colours silently failed to save sees a successful save. Acceptable for a prototype with one
  retailer; revisit if it ever happens.
- No route or DB test coverage still. Tasks 9–11 added the first component tests this project has
  ever had, which narrows the gap but does not close it.

**Do not add a fourth handoff doc.** Update `resume.md`.

---

## Self-review against the spec

| Spec section | Covered by |
|---|---|
| §3.1 `true_colour_photo_url` | Task 1 |
| §3.2 `garment_colours` | Task 1 |
| §3.3 `garment_fabric` | Task 1 |
| §3.4 RLS mirroring `garments` | Task 1 |
| §4 `lib/garment/colour-fabric.ts`, `isFabricEmpty`, `FABRIC_CHIPS` | Task 2 |
| §5 Colours UI, replace-all, photo-keep semantics | Tasks 5, 7 |
| §5 Fabric UI, chips, technical `<details>`, upsert/delete | Tasks 5, 8 |
| §5 byte-identical response for a no-new-data garment | Task 12 |
| §6.1 Fit/Colour/Fabric tabs, conditional visibility | Task 9 |
| §6.1 swatches, true-colour photo, disclaimer | Task 9 |
| §6.1 chips, fabric photo, technical tier | Task 10 |
| §6.2 grid dots, cap 6, `+n`, no N+1 | Task 11 |
| §7 i18n keys | Task 3 |
| §8 `colour-fabric.test.ts` | Task 2 |
| §8 shopper render tests | Tasks 9, 10, 11 |
| §8 regression pin | Task 12 |
| §8 founder manual check | Task 12 Step 4 |
| §9 deferred items | Task 13 Step 3 — recorded, not built |
| §10 branch, merge, probe, resume.md | Task 13 |

**Where this plan deliberately departs from the spec, and why:**

1. **§8's API round-trip and PATCH tests are not written as described.** They need a database
   harness this project does not have, and there is no staging Supabase — tests would write to
   production. The claims are pinned at the pure-parser layer instead (Task 12), which is the
   precedent `lib/garment/round-trip.test.ts` already set for the edit page. The route behaviour
   itself is covered by the founder's manual check. **This is a real reduction in coverage and
   should be stated plainly, not glossed.**
2. **§5 says "upsert on `garment_id`"; Task 5 uses an explicit insert-or-update.** PostgREST's
   `ON CONFLICT` column set is not obvious, and guessing it wrong would silently drop an existing
   `fabric_photo_url` whenever the retailer saved without choosing a new file. Same outcome,
   no guessing.
3. **Task 4 (photo-upload extraction) is not in the spec.** It is in `resume.md` as a standing
   follow-up — "extract if either is touched again" — and this work touches both routes and adds
   two photo fields to each. Doing it first turns six near-identical upload blocks into one.
4. **`DELETE` cleanup of the two new photos is not in the spec.** The cascade removes the rows;
   Storage objects are not in the database and would be orphaned forever.
5. **Absent-vs-empty for `colours`/`fabric` is not specified.** Chosen: absent = keep, present-empty
   = replace. The alternative silently deletes a retailer's colour list on any save from a client
   that does not know about colours.

---

## Post-review amendments — recorded during execution

This section supersedes the task text above where they disagree. Same convention as
`plans/2026-08-13-garment-edit.md`.

**Task 4 — `storageKeyFor` fell back to `jpg` only for a filename with a dot.**
The plan's test asserted `storageKeyFor(user, 'noextension')` ends in `.jpg`, describing the
*documented* intent. The original route code did not do that: `'noextension'.split('.').pop()`
returns the whole filename, so it produced `…/uuid.noextensio` — a ten-character pseudo-extension.
The test encoded intent, not behaviour, and the implementer surfaced the conflict instead of
quietly editing the test.

Accepted the fix: `storageKeyFor` now uses `lastIndexOf('.')`, so a name with no dot at all gets
`jpg`. Every filename containing a dot is byte-identical to before, and the security property that
actually matters is untouched — `a.jp/g` still sanitises to `jpg`, so no slash or query string can
reach the Storage key. The delta affects only dotless filenames, which a browser file input does
not produce.

**Task 4 — test count is 8, not the 9 the plan estimated**, so the suite total after Task 4 is 123,
not 124. The plan's per-task estimates are approximate; the literal test code is authoritative.

**Task 2 — no zod fallback was needed.** zod 4.4.3 does feed `undefined` through `z.preprocess`
for an absent object key, so `FabricSchema.safeParse({})` yields all-null with the original
`.nullable()` helpers. The `.nullish()` contingency in Task 2 Step 4 is unused; leave it documented
in case a zod upgrade changes this.

**Verification note.** Task 2's three load-bearing invariants were mutation-tested by the
controller, not just run: removing `.strict()` fails 2 tests, making `isFabricEmpty` count
non-content columns fails 1, and treating an absent `colours` field as an empty list fails 1. The
tests are not vacuous.

---

## ORDERING IS NOT OPTIONAL: migration BEFORE merge

Verified against the live database on 2026-09-11, not reasoned about:

```
garments?select=id,true_colour_photo_url  -> 400 {"code":"42703",
                                              "message":"column garments.true_colour_photo_url does not exist"}
garment_colours?select=hex                -> 404 {"code":"PGRST205"}
```

`app/shop/[shop_slug]/[garment_id]/page.tsx` now selects `true_colour_photo_url`, and its existing
guard is:

```ts
if (garmentError && garmentError.code !== 'PGRST116') {
  throw new Error('shop data unavailable: ' + garmentError.message);
}
```

`42703` is not `PGRST116`, so **merging this branch before the migration is applied throws on every
shopper garment page** — a 500 on the one page customers actually use. The colour and fabric queries
themselves degrade silently (their errors are destructured without `error` and `?? []` covers the
null), so they are not the hazard. The single added column is.

**The migration is purely additive** — one nullable column, two new tables, their policies. Nothing
in the currently-deployed code references any of it. So it is safe to apply to production *first*,
while `main` is still the old code, and that is the correct order:

1. Confirm the Supabase project is not auto-paused.
2. Apply `supabase/migrations/0003_colour_fabric.sql` in the SQL editor. Live site unaffected.
3. Re-run the probe above and confirm the column and tables now answer 200.
4. Only then merge to `main` and push.

Doing it the other way round gives a broken live site for however long the migration takes.
