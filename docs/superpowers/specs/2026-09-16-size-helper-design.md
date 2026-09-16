# Size-based measurement helper — design

**Date:** 2026-09-16
**Status:** Approved, ready for implementation plan
**Author:** Founder + Claude (Opus 4.8)

## 1. Problem

Customers open a garment's public shop page and are asked for their **body**
measurements (shoulder, chest, waist, hip, and — where the garment has them —
length and sleeve). The fit engine compares each body number against the
garment's number and returns a per-dimension verdict.

Customer feedback: **most people don't know all their own body numbers.** A
shopper may know their height and waist but not their chest. Today that means
blank fields and a thinner fit result.

We want to let a customer either:
- **pick a general size** (S / M / L / XL) and have the fields filled, or
- **enter what they do know** and have us estimate the rest.

Geography: Thailand. Defaults should reflect Thai adult bodies.

## 2. Core idea — one object, both jobs

Both asks are served by a single **body size chart**: a table mapping
`gender × size → typical body measurements`.

- "Pick a size" = read a row directly.
- "Estimate the rest" = find the row that best matches the numbers the customer
  *did* enter, then borrow the missing numbers from that row.

One mechanism, two features. No machine learning, no regression — just a small
lookup table and a nearest-row match over four sizes.

## 3. Scope decisions (settled during brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| Chart source | Built-in Thai default **now**, per-shop override **later** | Ship customer value first; leave a clean seam for overrides. |
| Body profile | **Adult Women's + Men's** now; axis generalized so Teen/Kids drop in later | A Thai women's M ≠ men's M. The chart is keyed by a `BodyProfile`, not a raw gender, so non-adult profiles are additive — no restructuring. |
| Non-adults (teens, children) | **Not in the helper now.** They use the always-available manual entry. | Children's clothing is sized by age/height, not S/M/L/XL — a genuinely different structure. Deferred to a future profile (see §10), tied to the age-data module. |
| Interaction | **One helper panel, both jobs** | Avoids mode-toggle screen states; partial-estimate stays natural. |
| Which dims the chart carries | **shoulder, chest, waist, hip only** | These scale with body size. `length_cm` and `sleeve_cm` are garment-cut / length-preference numbers, not fixed body attributes — we do not invent them. |
| Garment applicability | Helper only fills dims **this garment actually has** | Sleeveless garment → sleeve never touched. Falls out of the existing per-garment dimension list. |
| Transparency | Every filled/estimated value lands in the **normal, editable inputs** | No hidden guessing; customer can correct any value before checking fit. |

**Out of scope for this build:** the dashboard editor for per-shop overrides
(phase 2); additional sizes beyond S/M/L/XL (the data shape allows them, we just
don't ship them yet); Teen/Kids body profiles (§10); and the age-data collection
module (§10). The helper is an **adult convenience** — everyone, including
non-adults, keeps the manual-entry path that already produces a full fit verdict.

## 4. Architecture

No API or database change in phase 1. The chart is client-side data; the helper
only populates the same inputs that already POST to `/api/fit/evaluate`.

### New files

- **`lib/config/sizeChart.ts`** — the built-in Thai body size chart as plain
  data, plus `getSizeChart()` as the single read point (phase-2 override seam).
  Carries a comment block recording provenance: *best-estimate Thai adult
  averages, 2026-09; provisional, replace when real fit data lands.*
- **`lib/fit/sizeEstimate.ts`** — pure functions (below). Placed in `lib/fit` so
  it is covered by the existing unit-test suite. No DB, no network, no React.

### Changed files

- **`app/shop/[shop_slug]/[garment_id]/FitChecker.tsx`** — new "Not sure of your
  measurements?" panel above the existing fields.
- **`lib/i18n/strings.ts`** — new th/en keys for the panel.

### Data shape

```ts
// Keyed by body profile, NOT raw gender, so non-adult profiles (e.g.
// 'teen_women' / 'kids') are additive later without restructuring. Phase 1
// ships only the two adult profiles.
export type BodyProfile = 'women' | 'men'; // future: 'teen_women' | 'teen_men' | 'kids' | ...
export type SizeCode = 'S' | 'M' | 'L' | 'XL'; // adult codes; a future kids profile may use age bands

// Only body dimensions that scale with size. Never length_cm / sleeve_cm.
export type SizeChartDim = 'shoulder_cm' | 'chest_cm' | 'waist_cm' | 'hip_cm';

export type SizeRow = Record<SizeChartDim, number>;
// Per-profile map is size-code → row. A future kids profile could key by age
// band instead; keep the inner map's key type open enough to allow that.
export type SizeChart = Record<BodyProfile, Record<SizeCode, SizeRow>>;
```

### Default numbers (cm) — adult, starting values, editable in one place

| | Shoulder | Chest/Bust | Waist | Hip |
|---|---|---|---|---|
| **Women S** | 36 | 82 | 64 | 88 |
| **Women M** | 37 | 87 | 69 | 93 |
| **Women L** | 38 | 92 | 74 | 98 |
| **Women XL** | 39.5 | 98 | 80 | 104 |
| **Men S** | 42 | 90 | 76 | 90 |
| **Men M** | 44 | 96 | 82 | 95 |
| **Men L** | 46 | 102 | 88 | 100 |
| **Men XL** | 47 | 108 | 94 | 105 |

These are provisional Thai-adult estimates. Refining them later is a one-file
edit + deploy.

## 5. The two functions

```ts
fillFromSize(
  profile: BodyProfile,
  size: SizeCode,
  garmentDims: DimensionKey[],
): Partial<Record<DimensionKey, number>>
```
Returns the chosen row's values, **intersected** with `garmentDims`. A garment
without `chest_cm` won't receive a chest value; `length_cm` / `sleeve_cm` are
never present in the chart so are never returned.

```ts
estimateFromPartial(
  profile: BodyProfile,
  known: Partial<Record<DimensionKey, number>>,
  garmentDims: DimensionKey[],
): { values: Partial<Record<DimensionKey, number>>; inferredSize: SizeCode } | null
```
1. Restrict `known` to chart dims (ignore length/sleeve and any non-body input).
2. If nothing usable remains → return `null` (caller disables the button /
   shows "enter at least one measurement first").
3. Score each size row = **sum of absolute differences** across the known chart
   dims. Pick the size with the lowest score.
4. **Tie-break:** on an exact score tie, prefer the **smaller** size (documented,
   deterministic — avoids over-sizing a customer).
5. Return chart values for the chart dims that are in `garmentDims` **and still
   blank** in `known` — never overwrite what the customer typed — plus the
   `inferredSize` for the "Estimated as M" note.

*Rejected alternative:* per-dimension interpolation/regression. Overkill for
four sizes and produces off-chart numbers that feel arbitrary. Nearest-row is
honest and explainable.

## 6. Customer flow

1. Panel shows an adult **Women's / Men's** toggle, **S M L XL** buttons, and an
   **"Estimate the rest"** button. Framing makes clear it's an adult shortcut;
   anyone can ignore it and type real numbers (the manual path is unchanged).
2. Tap a size → all applicable body fields fill (editable), marked subtly as
   auto-filled.
3. Or type what you know → tap "Estimate the rest" → blank body fields fill; a
   note reads "Estimated as size M — adjust anything that's off."
4. `length_cm` / `sleeve_cm` stay blank for the customer to measure or skip.
5. All values remain editable; **Check fit** proceeds exactly as today.

Body profile is used only to select the chart on the client. It is **not** sent
to the API and **not** stored — `/api/fit/evaluate` still receives plain cm
numbers.

## 7. Error / edge handling

- Only `length`/`sleeve` entered, nothing to match on → estimate returns `null`;
  the button is disabled with a hint.
- Garment carries none of the chart's body dims (unusual) → size buttons fill
  nothing; panel can hint that this garment can't be estimated by size.
- Customer edits an auto-filled value → the auto-fill marker clears for that
  field (consistent with the existing `prefilled` behavior).
- Values still pass the existing input guard (`> 0`, finite, 1–300 range).

## 8. Testing

Pure functions in `lib/fit/sizeEstimate.ts` get unit tests alongside the current
47:
- `fillFromSize` returns the right row, intersected with garment dims.
- Sleeveless garment → no sleeve/absent dims returned.
- `estimateFromPartial` picks the nearest row for a clear case.
- Only length/sleeve entered → returns `null`.
- Tie between two equidistant sizes → smaller size wins.
- Never overwrites a value the customer already entered.
- **Boundary trap (CLAUDE.md):** verify any fixture that feeds into a fit verdict
  uses 97/100 not 96/100 where `good_fit` is intended.

FitChecker gets a manual browser check (both adult profiles, a size fill, a
partial estimate, a sleeveless garment, editing an auto-filled value).

## 9. Phase 2 seam (not built now)

`getSizeChart(shop?)` is the single read point and today returns the default.
Later, a per-shop override stored as JSON on the shop row merges over the default
— no customer-side rework. This honors the "default + override" choice without
building the dashboard editor yet.

## 10. Tagged future work (NOT implemented — design seams only)

These are recorded so the phase-1 code doesn't need rework to add them. **None
are built in this phase.** No fields, migrations, or UI ship for them now.

### 10a. Teen / Kids body profiles
The chart is keyed by `BodyProfile`, so adding `'teen_women'`, `'teen_men'`, or
`'kids'` is additive — new rows + new toggle options, no restructuring. A kids
profile likely keys rows by **age band or height** rather than S/M/L/XL, which is
why §4 keeps the inner map's key type able to widen. Until then, teens and
children use manual entry.

### 10b. Age-data collection module
**Idea (founder, 2026-09-16):** optionally collect a customer's age when they
choose to enter it, to (a) improve size estimation over time and (b) unlock
age-based kids sizing (10a).

**Not implemented now. Seam left open:**
- The size functions take a `BodyProfile`; an age-derived profile would slot in
  at the same call site with no signature change beyond the profile union.
- The fit-session record already stores per-`customer_token` measurements; an
  optional `age` (or `age_band`) column could be added there when the module
  lands — a purely additive migration, no rework of the phase-1 write path.
- `/api/fit/evaluate` would gain an optional `age` field; today it is neither
  sent nor expected, and adding it later is backward-compatible.

When this module is built it needs its own spec (consent/PDPA considerations for
collecting age in Thailand, especially any data relating to minors).

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
