# Catalogue organisation and versions — design

**Status:** approved by the founder in a brainstorm on 2026-09-30 / 2026-10-01. Not built.
**Settles:** to-do "Decide on size labels" (decisions-and-lessons §2) and the "Catalogue
organisation" idea in `resume.md`.
**Mockups the founder picked:** `2026-10-01-catalogue-mockups/` next to this file (open the
`.html` files in a browser; the chosen option is named in each section below).

---

## 0. In plain words

A shop owner with hundreds of garments needs to find, group and tidy them. A Shopee listing has
one link but many sizes and colours. So:

- The owner groups garments into **products** (one product = one Shopee listing = one shopper
  link) and files products into **folders**, nested as deep as they like, plus **tags**.
- Each size/colour combination is a **version**, and every version is a full garment with its own
  measurements, exactly like a garment today. A **Duplicate** button makes entering 12 versions
  quick.
- The shopper opens the product's link, **picks their size and colour themselves** (the same way
  they just did on Shopee), and the fit checker compares them against that version's numbers.

Shoppers never see folders or tags. This is an owner's stock-management tool, not a catalogue
platform.

---

## 1. Goals and non-goals

**Goals**
- Quick and easy for the common case, open-ended for every shop's own habits ("let them walk
  the desire paths"). Each shop's folders, tags and pickers are its own.
- One shopper link per Shopee listing, covering all its sizes and colours.
- The fit checker stays exactly as trustworthy as today, whatever the owner does with grouping.

**Non-goals (founder decisions, do not add)**
- **No shopper-facing browsing.** Shoppers arrive at one product page from a Shopee link. No
  shopper search, filter, folders or tags.
- **No size recommendation.** The app never picks a size for the shopper ("don't decide for the
  customer and irritate them"). The shopper picks; we check.
- **No Shopee integration of any kind**: no reading the shopper's Shopee selection, no size or
  colour in the link, no "Back to Shopee" button. See §11, open for the founder's partners.

---

## 2. Vocabulary — use these words exactly

| Word | Meaning |
|---|---|
| **Folder** | An owner-only container for folders and products. No link. Shoppers never see it. |
| **Product** | A named container that matches **one Shopee listing** and has **one shopper link**. **A product is not a garment**: it has no measurements, photo, fit rule, colour or fabric of its own. It holds a name, tags, picker names and versions. |
| **Version** | One real garment, e.g. "L / Black". It is today's `garments` row: measurements, garment type (top/bottom/dress), fit rule, photos, colours, fabric. Plus one pick per picker. |
| **Picker** | A named choice on a product, e.g. "Size", "Colour", "Sleeve length". New products start with Size and Colour; owners rename, add or remove freely. No upper limit. |
| **Pick** | A version's value for one picker, e.g. Size = "L". |
| **Tag** | An owner-created label ("Sale", "Summer") on products only. |
| **Garment type** | The existing `garments.category` (`top` / `bottom` / `dress`). It decides which measurements the fit checker asks for. It is **not** a shop category and folders/tags never touch it. |

**Never use "mother garment"**, "parent garment", "base version" or "main version" — in code,
UI, docs or commit messages. No version is special and no version inherits from the product.
The founder corrected this explicitly: the garment the shopper ends up checking is whichever
version they pick.

---

## 3. Rules that never bend

1. **Every version keeps its own measurements.** Moving, tagging, regrouping or renaming can
   never change what the fit checker compares against.
2. **Shop isolation.** Every link between rows — version → product, product → folder,
   folder → parent folder, product → tag, pick → picker — must belong to the same shop as the
   caller. Checked on every write. (Same class of hole as to-do "Check preset ownership"; follow
   that fix's pattern.)
3. **Only a product has a shopper link.** A folder never does.
4. **No two versions of one product have the same picks.** Compared trimmed and
   case-insensitively ("Black" = "black ").
5. **A folder cannot be moved into itself or into one of its own subfolders** (it would vanish
   from the tree).
6. **Deleting a folder never deletes its contents.** Its folders and products move up one level
   (to its parent, or the top level).
7. **Deleting a product deletes its versions**, only after the owner confirms, and removes their
   stored photos too (see §5.4).
8. **Each version owns its own photo files.** Duplicate copies the files in Storage; it never
   shares a URL between versions (see §5.4 for why).
9. **The shopper only ever sees complete versions.** A version missing a pick is hidden from the
   shopper page.

---

## 4. Data model

Migration `0004_catalogue.sql`. **Additive only**: no renames, no drops, nothing made NOT NULL
that old code writes without. The hosted database is production and is updated by hand; the old
code must keep working between the founder running 0004 and merging Stage 1.

### 4.1 New tables

```
folders
  id          uuid pk default gen_random_uuid()
  retailer_id uuid not null → retailers(id) on delete cascade
  parent_id   uuid null → folders(id)        -- null = top level
  name        text not null (1–60 chars)
  created_at  timestamptz not null default now()

products
  id          uuid pk
  retailer_id uuid not null → retailers(id) on delete cascade
  folder_id   uuid null → folders(id) on delete set null   -- null = top level
  name        text not null (1–120 chars)
  created_at  timestamptz not null default now()

product_pickers
  id          uuid pk
  product_id  uuid not null → products(id) on delete cascade
  name        text not null (1–30 chars)
  position    int  not null                 -- order of picker rows on the shopper page
  unique (product_id, position)

tags
  id          uuid pk
  retailer_id uuid not null → retailers(id) on delete cascade
  name        text not null (1–30 chars)
  created_at  timestamptz not null default now()
  unique index on (retailer_id, lower(name))

product_tags
  product_id  uuid not null → products(id) on delete cascade
  tag_id      uuid not null → tags(id) on delete cascade
  primary key (product_id, tag_id)
```

`folders.parent_id` deliberately has **no** `on delete cascade`: rule 6 is done by the API
moving children up before deleting the folder.

### 4.2 New columns on `garments` (= versions)

```
product_id  uuid null → products(id) on delete cascade
picks       jsonb not null default '{}'   -- { "<product_pickers.id>": "L", ... }
```

- Picks are keyed by **picker id**, not name, so renaming a picker touches one row and removing
  one is a key delete.
- `product_id` stays **nullable** in 0004 because old code inserts garments without it. A later
  migration `0005` (run by the founder only after Stage 1 is live) re-runs the backfill for any
  garment created in the gap and then sets `NOT NULL`.
- `garments.name` stays (NOT NULL today). After Stage 1 nothing reads it. New versions copy the
  product's name into it purely to satisfy the constraint; it is not kept in sync.

### 4.3 Backfill in 0004

Every existing garment gets its own product: `name` = the garment's name, top level, no tags,
**no pickers**, and the garment's `product_id` set to it. A product with one version and no
pickers renders exactly like today's page. When the owner adds a second version they add
pickers (the product page prompts for it, starting from Size and Colour).

### 4.4 Row-level security

Owner-only on all five tables (`retailer_id = auth.uid()`; for `product_pickers` and
`product_tags` via `exists` on the parent, as `0003` does for `garment_colours`). **No anon
read policies**: the shopper page already reads through the server-side admin client
(`createSupabaseAdminClient`), and folders/tags are private by product decision.

### 4.5 Sorting data

Picker values on the shopper page appear in **the order the owner first used them**: the
order of the versions' `created_at`. (Stage 3 adds explicit reordering; it will need its own
small column then, not now.)

---

## 5. Owner side

Mockups: `dashboard-layout.html` (**option A** chosen), `product-versions.html` (**option B**
chosen — the founder's reason: a list lets owners add XXL, "Free size" or anything else, where
a grid constrains them).

### 5.1 Dashboard (layout A: folder list on the side, product picture cards)

- **Folder list on the left**, "All items" at the top. **Product cards on the right**: photo
  (borrowed from the product's first-added version), name, version count, tags, ⚠ if it needs
  attention. On a phone the folder list becomes a "‹ back" header.
- **"+ New ▾"** → New folder / New product, created in the current folder.
- **Toolbar:** search by product name · tag filter (several tags = products having **all** of
  them) · sort: newest, oldest, name A–Z, name Z–A · **⚠ Needs attention** filter.
- Search and filters cover **the current folder and everything below it**; from "All items",
  the whole shop.
- **Moving:** computer — drag a card onto a folder in the left list (Stage 3). Everywhere —
  **⋯ → Move to…** opens a folder chooser (Stage 2). Folders move the same way.

### 5.2 Product page (list layout B)

- Header: product name (editable), tags (typing suggests the shop's existing tags; Enter on a
  new word creates it), **Copy shopper link**.
- **Pickers:** shown as editable names; add, rename, remove. Removing a picker deletes that key
  from every version's picks; if that would make two versions identical (rule 4), block it and
  say which versions clash.
- **Adding a picker asks for the existing versions' values in the same step** (pre-filled
  blank, can be skipped). Otherwise a live version would lose a pick and drop off the shopper
  page under rule 9. The common case — a migrated one-version product getting its first
  pickers so a second version can be added — is exactly this step.
- **One row per version:** picks ("L / Black"), its first colour swatch dot, key measurements,
  ⚠ text if incomplete, **Edit**, **Duplicate**. **+ Add version** starts a blank one.
- Deleting a version: the existing garment delete. Deleting the last version leaves an empty
  product (flagged in Needs attention), it does not delete the product.

### 5.3 Version form

**Today's garment form (`GarmentForm`), unchanged**, with one field per picker added at the top.
Each pick field suggests the values this product already uses for that picker, so "Black" and
"black" don't both appear. Saving checks rule 4 and returns a Thai-first error naming the clash.

**Duplicate** opens the version form pre-filled from the source version: measurements, garment
type, fit rule (preset or override), colours, fabric and photos. Picks are pre-filled too; the
form refuses to save until at least one pick differs (rule 4).

### 5.4 Photos and Duplicate — why files are copied

`app/api/garments/[id]/route.ts` deletes the stored file when a photo is replaced, and garment
delete removes photos. If Duplicate shared one URL between versions, replacing L/Black's photo
would delete L/Green's. So **Duplicate copies each Storage object** (hero, true-colour, fabric
photo) to a new path under the owner's folder, and the existing delete logic stays correct
untouched. Product delete must remove every version's stored photos (reuse the existing
removal helper); a database cascade alone would orphan the files.

### 5.5 Needs attention

A product is flagged when:
- it has **no versions**, or
- any version is **missing a measurement** for a dimension of its garment type, or
- any version is **missing a pick** (e.g. after a new picker was added).

---

## 6. Shopper side

Mockup: `shopper-pickers.html`, **option A** chosen (pick first, like Shopee).

- **One link per product:** `/shop/[shop_slug]/p/[product_id]`.
- **Old links keep working:** `/shop/[shop_slug]/[garment_id]` redirects to that version's
  product page. Nothing is pre-selected (non-goal: no picks in the link). Every existing garment
  is a one-version product, so these look identical to today.
- **Picker rows** under the product name, one per picker in `position` order, values as tappable
  buttons in first-used order (§4.5). Combinations that don't exist among complete versions are
  greyed out given the other picks made.
- **Until every picker is chosen:** the Fit / Colour / Fabric tabs show "Pick a <picker names>
  first" (Thai first), and the check button is disabled.
- **Once a version is picked:** photo, colour swatches, fabric and fit check all switch to that
  version. Everything below the pickers is today's page.
- **Switching versions keeps the shopper's typed measurements.** Keep `FitChecker` mounted (do
  not `key` it by version id). If the new version's garment type asks for different
  dimensions, keep the values for dimensions both share. The shopper presses Check again.
- **One version, no pickers:** the page looks exactly like today.
- **Shop list page and "Other garments" strip:** one card per product, not per version.
- **Fit sessions** keep recording the exact version checked (`garment_id` is the version).
- Respect the existing landmine in decisions-and-lessons §3: `GarmentTabs` panels are hidden,
  never unmounted.
- **Try-on** (`TryOn`, added on `main` 2026-09-29 by a partner) sits under the product name;
  when it becomes real it should use the **picked version's** photo.

---

## 7. Errors

All new messages Thai-first in `lib/i18n/strings.ts`, English second.
- Duplicate picks: name the clashing version ("L / Black มีอยู่แล้ว").
- Ownership failures: 404, the same as today's "not your garment" handling — never reveal that
  another shop's id exists.
- Folder cycle: refuse with a plain message; nothing moves.
- Product page with no complete versions, for shoppers: the existing not-found page.

---

## 8. Build in three stages

Each stage is one branch, one pull request, checked by the founder on the preview (phone **and**
computer), then merged. Each stage is usable on its own.

**Stage 1 — products, versions, shopper pickers.** Migration 0004 (+ backfill). Product page,
version form with picks, Duplicate (with Storage copy), Add version, picker management, Copy
shopper link. Shopper product page with pickers, old-link redirect, shop list + Other garments
by product. Dashboard shows **product cards**, newest first, no folders yet. Then migration 0005
after it is live.

**Stage 2 — organising.** Folders (side list, nesting, create/rename/delete-moves-up),
**Move to…**, tags (create, attach, filter), search, sort, Needs attention.

**Stage 3 — finishing.** Drag-and-drop on computer, reorder picker values, rough edges found in
Stages 1–2.

---

## 9. Testing

Unit tests in `lib/` (the existing pattern; there is no route or DB test harness):
- picks → version resolution; which buttons grey out for a partial selection
- duplicate-pick detection (trim, case-insensitive), including after a picker is removed
- Needs-attention rules (§5.5)
- folder delete moves children up; folder cycle rejection, including deep descendants
- every ownership check rejects another shop's folder / product / tag / picker id
- measurement carry-over when switching between versions of different garment types

Manual, per stage, on the preview: the walkthrough the agent lists in its report. **The preview
uses the production database**, so all testing uses a product named **"TEST ลบได้ / delete me"**,
deleted afterwards.

---

## 10. How to build this — handoff for the next session

The founder will run this through **Munder Difflin** (Michael hands work to temps, each in its
own worktree). Read `/CLAUDE.md` first; its team rules apply. The founder wants design and
verification on Opus and mechanical edits on Sonnet.

**Before Stage 1 starts**
1. **`main` does not build as of 2026-10-01.** `app/shop/[shop_slug]/[garment_id]/page.tsx`
   imports `./TryOn` (commit `f071316`, PR #4) but `TryOn.tsx` was never committed. Vercel will
   reject every deploy until it is added (most likely it is uncommitted on the partner's
   machine) or the import is removed. Fix this first, as its own small PR.
2. **Jim's `feature/preset-ownership` must be merged first.** Stage 1 touches the same garment
   parsing (`lib/garment/parse-form.ts`) and its ownership checks should copy Jim's pattern.
3. The Next.js 15 upgrade is already merged (2026-09-29), so it no longer competes with this.

**For each stage**
1. Write the plan with `superpowers:writing-plans` from this spec, saved to
   `docs/superpowers/plans/`. One plan per stage.
2. Branch `feature/catalogue-stage-N` from `origin/main`; `npm install`; local stack via
   `npm run setup:local` (applies migrations to the **local** database only).
3. Build test-first for the §9 logic. Gates: `npm test && npm run build`.
4. **Schema changes:** write the migration file; give the founder click-by-click Supabase SQL
   editor steps. The founder takes a backup, runs it, checks the live site still works, and only
   **then** merges the code. Agents never run SQL against production.
5. Push, give the founder the compare link (CLAUDE.md "Shipping"), with the preview checklist
   for phone and computer and the "TEST ลบได้" warning.
6. After merge: confirm the deploy landed; update `resume.md`.

---

## 11. Open — for the founder's partners, do not build

- **Shopee's rule against outside links.** Third-party seller guides (2025) say Shopee removes
  product and shop descriptions that link to outside websites. The app is not yet linked from
  Shopee. How the link reaches shoppers needs checking against Shopee Thailand's own rules
  before launch.
- **A Shopee partnership**, e.g. Shopee passing the shopper's picks to us, or showing the fit
  check inside Shopee. Not possible with Shopee's public seller tools today.
- **A "Back to Shopee to order" button** and **picks carried in the link.** Both were offered
  and deliberately parked.
