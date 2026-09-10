# Colour & Fabric Reference — Design

**Date:** 2026-09-10
**Status:** Approved by founder in brainstorm. Not yet planned, not yet built.
**Origin:** Early Phase 1 user feedback. Buyers receive garments whose colour or fabric
finish does not match the photo (lighting, angle, gloss, wool texture). This spec gives the
shopper a plain, honest reference for both.

**Sibling feedback deferred to its own spec:** catalogue organisation (categories, nesting,
variants, sorting for shops with hundreds of items). Not in scope here. See §9.

## 1. Goal

Shopper opens a garment and can see, without reading anything technical:
- the **actual colours present** in the garment, as real swatches on screen;
- the **fabric character** as a few icon chips (finish / thickness / stretch / feel).

Retailer who knows textile jargon can add a technical tier (composition, GSM, weave, thread
count, pore size, notes). Shopper only sees it if they tap "details".

**Principle from founder:** "people dumb, people want ease of use." Simple tier is always the
first thing seen. Technical tier never gets in the way.

## 2. Decisions locked in brainstorm

| # | Decision | Chosen |
|---|----------|--------|
| Q1 | Colour source | Retailer picks with colour picker (hex) + name. Optional "true colour" photo (garment flat, daylight). AI extraction from photo = future, not now. |
| Q2 | Fabric | Fixed chips (simple tier) + optional technical fields (technical tier) + optional close-up photo. |
| Q3 | Colours per garment | Unlimited list, no primary/secondary ranking. Shopper judges dominance from photo; list only says what is present. |
| Q4 | Shopper placement | Tabs on garment page: **Fit / Colour / Fabric**. Shop grid cards show small colour dots under name. |
| Q5 | Data model | **Separate tables** `garment_colours` and `garment_fabric` (founder chose relational over jsonb). |

## 3. Data model

New migration `supabase/migrations/0003_colour_fabric.sql`.

### 3.1 `garments` — one new column

```sql
alter table public.garments
  add column true_colour_photo_url text;   -- nullable; flat garment under daylight
```

### 3.2 `garment_colours` — many per garment

```sql
create table public.garment_colours (
  id          uuid primary key default gen_random_uuid(),
  garment_id  uuid not null references public.garments(id) on delete cascade,
  hex         text not null check (hex ~ '^#[0-9a-fA-F]{6}$'),
  name        text not null check (char_length(name) between 1 and 40),
  created_at  timestamptz not null default now()
);
create index garment_colours_garment_id_idx on public.garment_colours(garment_id);
```

Display order = `created_at` ascending. No `position` column (founder: no ranking).

### 3.3 `garment_fabric` — zero or one per garment

```sql
create table public.garment_fabric (
  garment_id       uuid primary key references public.garments(id) on delete cascade,
  -- simple tier (chips). null = retailer did not say.
  finish           text check (finish in ('matte','slight_sheen','glossy')),
  thickness        text check (thickness in ('thin','medium','thick')),
  stretch          text check (stretch in ('none','some','high')),
  feel             text check (feel in ('soft','crisp','rough')),
  -- technical tier. all optional.
  composition      text,        -- free text, e.g. "cotton 100%", "polyester 65 / cotton 35"
  weight_gsm       integer check (weight_gsm between 1 and 2000),
  construction     text,        -- weave/knit type, e.g. "plain weave", "single jersey", "twill"
  thread_count     integer check (thread_count between 1 and 2000),
  pore_size_mm     numeric(6,3) check (pore_size_mm > 0),
  notes            text,        -- any jargon retailer wants
  fabric_photo_url text,        -- close-up of fabric
  updated_at       timestamptz not null default now()
);
```

### 3.4 RLS — mirror `garments`

Both tables: RLS on. Owner CRUD via garment ownership; anon read (shop pages are public).

```sql
create policy "garment_colours_owner_all" on public.garment_colours for all
  using  (exists (select 1 from public.garments g where g.id = garment_id and g.retailer_id = auth.uid()))
  with check (exists (select 1 from public.garments g where g.id = garment_id and g.retailer_id = auth.uid()));
create policy "garment_colours_public_read" on public.garment_colours for select to anon using (true);
-- same two policies for garment_fabric
```

Both photo URLs go in the existing public-read `garment-photos` bucket.

## 4. Validation — `lib/garment/colour-fabric.ts`

Zod schemas shared by form parsing and API. Follow the pattern of `lib/garment/parse-form.ts`.

```ts
export const HEX = /^#[0-9a-fA-F]{6}$/;
export const FINISH    = ['matte','slight_sheen','glossy'] as const;
export const THICKNESS = ['thin','medium','thick'] as const;
export const STRETCH   = ['none','some','high'] as const;
export const FEEL      = ['soft','crisp','rough'] as const;

ColourSchema  = { hex: string matching HEX, name: string 1..40 trimmed }
ColoursSchema = ColourSchema[]            // any length incl. 0
FabricSchema  = { finish?, thickness?, stretch?, feel?,      // enums above, nullable
                  composition?, weight_gsm?, construction?,
                  thread_count?, pore_size_mm?, notes? }     // all nullable
isFabricEmpty(f) = every field null/blank   // used to hide tab + skip upsert
```

Export `FabricChipKey = 'finish'|'thickness'|'stretch'|'feel'` and a `FABRIC_CHIPS` map so
form and shopper page share one source of options.

## 5. Retailer side — `GarmentForm` (add + edit share it)

Two new sections under existing measurements, above fit rule. Both collapsible, default open.

**Colours**
- Row list: `<input type="color">` + name text input + remove button. "Add colour" button.
- Start empty. No minimum.
- Edit mode pre-fills from `garment_colours`.
- "True colour photo" file input, optional. Edit mode shows current with replace.

**Fabric**
- Four radio groups (finish / thickness / stretch / feel), each with a "not set" state.
  Labels from `t.*` (TH/EN) — see §7.
- "Technical details" `<details>` element, collapsed by default: composition, weight (g/m²),
  construction, thread count, pore size (mm), notes. Plain inputs.
- "Fabric close-up photo" file input, optional.

**Submission**
- `POST /api/garments` and `PATCH /api/garments/[id]` accept `colours: Colour[]`,
  `fabric: Fabric`, and the two optional photo files.
- Colours: **replace-all** inside the handler (delete existing rows for garment, insert new).
  Simple, matches "list is the truth" semantics.
- Fabric: upsert on `garment_id`. If `isFabricEmpty(fabric)` and no `fabric_photo_url`,
  delete the row instead.
- Photos: upload to `garment-photos`, then write URL. **Only write a photo URL column when a
  new file was uploaded.** Never rewrite it from a value read earlier in the request — the
  garment-edit page had exactly this concurrency bug (see `resume.md`, edit page section).
- Existing garments with no new data: **byte-for-byte identical API response** to today.
  Pin with a regression test like the edit page did.

## 6. Shopper side

### 6.1 Garment page `/shop/[shop_slug]/[garment_id]`

Tab bar under the photo: **Fit | Colour | Fabric**. Client-side state, no URL change.
Default tab = Fit. `FitChecker` unchanged inside Fit tab.

- **Colour tab shown only if** `colours.length > 0 || true_colour_photo_url`.
- **Fabric tab shown only if** fabric row exists and `!isFabricEmpty || fabric_photo_url`.
- If neither has data: no tab bar at all, page identical to today.

**Colour tab**
- Row of swatches, wrap. Each: square filled with hex (min 48×48 px), name under it.
- True colour photo below, full width, caption `t.trueColourCaption`.
- Small grey line `t.screenColourDisclaimer` ("สีจริงอาจต่างจากหน้าจอเล็กน้อย" / "Real colour
  may differ slightly from your screen"). Honest, one line, not a banner.

**Fabric tab**
- Simple tier first: up to four chips, each = icon + word. Only chips that are set.
  Icons: inline SVG, monochrome, simple. Words from `t.*`.
- Fabric close-up photo below, if any.
- Technical tier: `<details>` collapsed, summary `t.fabricTechnicalDetails`. Inside: two-column
  label/value list. Only rows with a value. Values are retailer text, shown as-is.

### 6.2 Shop grid `/shop/[shop_slug]`

Under garment name on each card: row of colour dots (12 px circles, hex fill, thin border so
white shows). Show up to 6; if more, 6 dots + `+n`. No dots if no colours.
Query: one extra select on `garment_colours` for all garments of the shop, group in code.
Do not N+1.

## 7. i18n — `lib/i18n/strings.ts`

Add keys (TH first, EN second):
- Tabs: `tabFit`, `tabColour`, `tabFabric`
- Form: `coloursSection`, `addColour`, `colourName`, `removeColour`, `trueColourPhoto`,
  `fabricSection`, `fabricTechnicalDetails`, `fabricPhoto`, `notSet`
- Chip groups + values: `finish`, `finishMatte`, `finishSlightSheen`, `finishGlossy`,
  `thickness`, `thicknessThin/Medium/Thick`, `stretch`, `stretchNone/Some/High`,
  `feel`, `feelSoft/Crisp/Rough`
- Technical labels: `composition`, `weightGsm`, `construction`, `threadCount`, `poreSizeMm`, `notes`
- Shopper: `trueColourCaption`, `screenColourDisclaimer`, `moreColours` ("+{n}")

Colour names, composition, construction, notes = retailer text. Not translated, same rule as
garment names.

## 8. Tests (vitest, extend the 89)

- `colour-fabric.test.ts`: hex accept/reject, name length, enum reject, `isFabricEmpty`.
- API: POST with colours+fabric round-trips; PATCH replace-all colours (add one, remove one,
  reorder ignored); PATCH empty fabric deletes row; PATCH without photo file does **not**
  touch photo URL columns.
- Regression: PATCH/GET on garment with no colour/fabric data → response byte-identical to
  pre-change snapshot.
- Shopper page render: no data → no tab bar; colours only → Colour tab, no Fabric tab; chips
  render only set values; technical details hidden when all null.
- Shop grid: dots capped at 6 with `+n`.

Manual check before merge (founder, ~10 min): add garment with 3 colours + fabric on phone,
open shop link, confirm swatches look like real garment under daylight. Then edit: remove one
colour, save, confirm.

## 9. Deferred / future

- **AI colour extraction** from photo — founder wants later. Same lighting problem makes it
  wrong today; revisit when a "true colour" reference photo exists to calibrate against.
- **Catalogue organisation** (categories, nesting, variants, sort) — separate spec. When
  variants arrive, colour stays per-garment, so a colour-variant is just a child garment with
  its own `garment_colours` rows. Nothing here blocks that.
- Colour search/filter on shop grid — only after catalogue spec.

## 10. How to execute this spec (for the next session)

Founder intends **Opus as director, Sonnet as implementer**, in a later session.

1. Read `/CLAUDE.md`, then `docs/superpowers/resume.md`, then this spec.
2. Invoke `superpowers:writing-plans` on this spec → `docs/superpowers/plans/2026-MM-DD-colour-fabric.md`.
3. Execute with `superpowers:subagent-driven-development`, pragmatic mode (see feedback memory):
   Sonnet subagents for tasks, Opus reviews, 1–3 line fixes inline.
4. Branch `feature/colour-fabric`. Vercel builds `main` only — merge + push + probe a new route
   before saying "live". Check Supabase is not auto-paused first (see `resume.md`).
5. Update `resume.md` when shipped. Do not add a fourth handoff doc.
