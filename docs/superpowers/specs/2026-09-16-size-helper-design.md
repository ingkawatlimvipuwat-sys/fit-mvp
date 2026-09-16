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
| Gender | **Women's + Men's**, customer picks | A Thai women's M ≠ men's M. Customer taps gender first. |
| Interaction | **One helper panel, both jobs** | Avoids mode-toggle screen states; partial-estimate stays natural. |
| Which dims the chart carries | **shoulder, chest, waist, hip only** | These scale with body size. `length_cm` and `sleeve_cm` are garment-cut / length-preference numbers, not fixed body attributes — we do not invent them. |
| Garment applicability | Helper only fills dims **this garment actually has** | Sleeveless garment → sleeve never touched. Falls out of the existing per-garment dimension list. |
| Transparency | Every filled/estimated value lands in the **normal, editable inputs** | No hidden guessing; customer can correct any value before checking fit. |

**Out of scope for this build:** the dashboard editor for per-shop overrides
(phase 2), and additional sizes beyond S/M/L/XL (the data shape allows them, we
just don't ship them yet).

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
export type Gender = 'women' | 'men';
export type SizeCode = 'S' | 'M' | 'L' | 'XL';

// Only body dimensions that scale with size. Never length_cm / sleeve_cm.
export type SizeChartDim = 'shoulder_cm' | 'chest_cm' | 'waist_cm' | 'hip_cm';

export type SizeRow = Record<SizeChartDim, number>;
export type SizeChart = Record<Gender, Record<SizeCode, SizeRow>>;
```

### Default numbers (cm) — starting values, editable in one place

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
  gender: Gender,
  size: SizeCode,
  garmentDims: DimensionKey[],
): Partial<Record<DimensionKey, number>>
```
Returns the chosen row's values, **intersected** with `garmentDims`. A garment
without `chest_cm` won't receive a chest value; `length_cm` / `sleeve_cm` are
never present in the chart so are never returned.

```ts
estimateFromPartial(
  gender: Gender,
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

1. Panel shows **Women's / Men's** toggle, **S M L XL** buttons, and an
   **"Estimate the rest"** button.
2. Tap a size → all applicable body fields fill (editable), marked subtly as
   auto-filled.
3. Or type what you know → tap "Estimate the rest" → blank body fields fill; a
   note reads "Estimated as size M — adjust anything that's off."
4. `length_cm` / `sleeve_cm` stay blank for the customer to measure or skip.
5. All values remain editable; **Check fit** proceeds exactly as today.

Gender is used only to select the chart on the client. It is **not** sent to the
API and **not** stored — `/api/fit/evaluate` still receives plain cm numbers.

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

FitChecker gets a manual browser check (both genders, a size fill, a partial
estimate, a sleeveless garment, editing an auto-filled value).

## 9. Phase 2 seam (not built now)

`getSizeChart(shop?)` is the single read point and today returns the default.
Later, a per-shop override stored as JSON on the shop row merges over the default
— no customer-side rework. This honors the "default + override" choice without
building the dashboard editor yet.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
