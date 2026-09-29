# Size-based Measurement Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a shopper fill or estimate their missing body measurements on the fit form by picking an adult S/M/L/XL size (Women's or Men's), backed by a built-in Thai size chart.

**Architecture:** A plain-data body size chart (`lib/config/sizeChart.ts`) keyed by body profile, two pure lookup functions (`lib/fit/sizeEstimate.ts`) covered by the existing Vitest suite, and a helper panel in the existing client component `FitChecker.tsx` that only ever writes into the normal, editable measurement inputs. No API or database change.

**Tech Stack:** Next.js 14 App Router, TypeScript, Vitest (`vitest run`), Tailwind. Tests co-located as `*.test.ts(x)`, `@` path alias → repo root.

**Spec:** `docs/superpowers/specs/2026-09-16-size-helper-design.md`

**Landmines (from CLAUDE.md — read before starting):**
- `lib/config/dimensions.ts` and `lib/fit/rules.ts` have a deliberate circular import resolved with `import type`. This plan does **not** touch that pair; keep new imports of `DimensionKey` as `import type`.
- Ease boundaries are inclusive-edge; use 97/100 not 96/100 in any fixture meant to read as `good_fit`. (No fit-verdict fixtures are needed in this plan, but keep it in mind if you add one.)
- `next lint` fails the build on unused imports even when `tsc` is clean. Don't leave an unused import in any file, including tests.
- Shipping requires merging to `main` (Vercel only builds `main`). Merge/deploy is handled after the plan, not inside it.

---

## File Structure

- **Create `lib/config/sizeChart.ts`** — types (`BodyProfile`, `SizeCode`, `SizeChartDim`, `SizeRow`, `SizeChart`), the built-in Thai default data (adult women's + men's), and `getSizeChart()` as the single read point (phase-2 override seam). Provenance comment block.
- **Create `lib/config/sizeChart.test.ts`** — sanity tests over the default data.
- **Create `lib/fit/sizeEstimate.ts`** — `fillFromSize()` and `estimateFromPartial()`, pure, no React/DB/network.
- **Create `lib/fit/sizeEstimate.test.ts`** — behaviour tests for both functions.
- **Modify `lib/i18n/strings.ts`** — new th/en keys for the helper panel (insert before `} as const;`).
- **Modify `app/shop/[shop_slug]/[garment_id]/FitChecker.tsx`** — add the helper panel; wire it to the existing `values` state.

---

## Task 1: Size chart data + `getSizeChart()`

**Files:**
- Create: `lib/config/sizeChart.ts`
- Test: `lib/config/sizeChart.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/config/sizeChart.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getSizeChart, CHART_DIMS, type BodyProfile, type SizeCode } from './sizeChart';

const PROFILES: BodyProfile[] = ['women', 'men'];
const SIZES: SizeCode[] = ['S', 'M', 'L', 'XL'];

describe('getSizeChart default data', () => {
  it('has every chart dimension for every profile and size', () => {
    const chart = getSizeChart();
    for (const p of PROFILES) {
      for (const s of SIZES) {
        const row = chart[p][s];
        for (const d of CHART_DIMS) {
          expect(typeof row[d]).toBe('number');
          expect(row[d]).toBeGreaterThan(0);
        }
      }
    }
  });

  it('increases monotonically S < M < L < XL on every dimension', () => {
    const chart = getSizeChart();
    for (const p of PROFILES) {
      for (const d of CHART_DIMS) {
        const seq = SIZES.map(s => chart[p][s][d]);
        for (let i = 1; i < seq.length; i++) {
          expect(seq[i]).toBeGreaterThan(seq[i - 1]);
        }
      }
    }
  });

  it('does not carry length or sleeve columns', () => {
    const row = getSizeChart().women.M as Record<string, unknown>;
    expect(row.length_cm).toBeUndefined();
    expect(row.sleeve_cm).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/config/sizeChart.test.ts`
Expected: FAIL — cannot resolve `./sizeChart`.

- [ ] **Step 3: Write the implementation**

Create `lib/config/sizeChart.ts`:

```ts
/**
 * Built-in body size chart used by the fit form's "not sure of your
 * measurements?" helper.
 *
 * PROVENANCE: best-estimate Thai adult body averages, captured 2026-09.
 * These numbers are PROVISIONAL — refine them here (single source) when real
 * fit data lands. This is the only place the default numbers live.
 *
 * Only carries body dimensions that scale with size (shoulder/chest/waist/hip).
 * length_cm and sleeve_cm are garment-cut / length-preference numbers, not body
 * attributes, so the chart deliberately omits them.
 *
 * Keyed by BodyProfile (not raw gender) so non-adult profiles (teen/kids) are
 * additive later without restructuring — see spec §10.
 */

export type BodyProfile = 'women' | 'men'; // future: 'teen_women' | 'teen_men' | 'kids' | ...
export type SizeCode = 'S' | 'M' | 'L' | 'XL'; // adult codes; a future kids profile may use age bands
export type SizeChartDim = 'shoulder_cm' | 'chest_cm' | 'waist_cm' | 'hip_cm';

export type SizeRow = Record<SizeChartDim, number>;
export type SizeChart = Record<BodyProfile, Record<SizeCode, SizeRow>>;

/** The body dimensions the chart can fill. Never length_cm / sleeve_cm. */
export const CHART_DIMS: SizeChartDim[] = ['shoulder_cm', 'chest_cm', 'waist_cm', 'hip_cm'];

const DEFAULT_CHART: SizeChart = {
  women: {
    S:  { shoulder_cm: 36,   chest_cm: 82, waist_cm: 64, hip_cm: 88 },
    M:  { shoulder_cm: 37,   chest_cm: 87, waist_cm: 69, hip_cm: 93 },
    L:  { shoulder_cm: 38,   chest_cm: 92, waist_cm: 74, hip_cm: 98 },
    XL: { shoulder_cm: 39.5, chest_cm: 98, waist_cm: 80, hip_cm: 104 },
  },
  men: {
    S:  { shoulder_cm: 42, chest_cm: 90,  waist_cm: 76, hip_cm: 90 },
    M:  { shoulder_cm: 44, chest_cm: 96,  waist_cm: 82, hip_cm: 95 },
    L:  { shoulder_cm: 46, chest_cm: 102, waist_cm: 88, hip_cm: 100 },
    XL: { shoulder_cm: 47, chest_cm: 108, waist_cm: 94, hip_cm: 105 },
  },
};

/**
 * Single read point for the size chart. Today it returns the built-in default.
 * Phase-2 seam: a per-shop override (JSON on the shop row) will merge over the
 * default here, without any customer-side rework.
 */
export function getSizeChart(): SizeChart {
  return DEFAULT_CHART;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/config/sizeChart.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/config/sizeChart.ts lib/config/sizeChart.test.ts
git commit -m "feat(size-chart): built-in Thai adult body size chart"
```

---

## Task 2: `fillFromSize` and `estimateFromPartial`

**Files:**
- Create: `lib/fit/sizeEstimate.ts`
- Test: `lib/fit/sizeEstimate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/fit/sizeEstimate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fillFromSize, estimateFromPartial } from './sizeEstimate';
import type { DimensionKey } from '@/lib/config/dimensions';

const TOP: DimensionKey[] = ['shoulder_cm', 'chest_cm', 'waist_cm', 'sleeve_cm', 'length_cm'];
const SLEEVELESS: DimensionKey[] = ['shoulder_cm', 'chest_cm', 'waist_cm', 'length_cm'];

describe('fillFromSize', () => {
  it('returns the chosen row, intersected with the garment dimensions', () => {
    expect(fillFromSize('women', 'M', TOP)).toEqual({
      shoulder_cm: 37, chest_cm: 87, waist_cm: 69,
    });
  });

  it('never returns length or sleeve even when the garment has them', () => {
    const out = fillFromSize('men', 'L', TOP);
    expect(out.length_cm).toBeUndefined();
    expect(out.sleeve_cm).toBeUndefined();
  });

  it('omits body dims the garment does not have', () => {
    const out = fillFromSize('women', 'S', SLEEVELESS);
    expect(out.hip_cm).toBeUndefined(); // SLEEVELESS has no hip
    expect(out.shoulder_cm).toBe(36);
  });
});

describe('estimateFromPartial', () => {
  it('infers the nearest size from a known body dim and fills the blanks', () => {
    // women waist 70 is closest to M (69); fills chest+shoulder, leaves waist as given
    const res = estimateFromPartial('women', { waist_cm: 70 }, TOP);
    expect(res).not.toBeNull();
    expect(res!.inferredSize).toBe('M');
    expect(res!.values).toEqual({ shoulder_cm: 37, chest_cm: 87 });
  });

  it('never overwrites a value the customer already entered', () => {
    const res = estimateFromPartial('women', { chest_cm: 999, waist_cm: 74 }, TOP);
    expect(res!.values.chest_cm).toBeUndefined(); // chest was provided, so not filled
  });

  it('only fills body dims present on the garment', () => {
    const res = estimateFromPartial('women', { waist_cm: 70 }, SLEEVELESS);
    expect(res!.values.hip_cm).toBeUndefined(); // SLEEVELESS has no hip
  });

  it('returns null when nothing usable was entered', () => {
    // length/sleeve are not chart dims, so there is nothing to match on
    expect(estimateFromPartial('women', { length_cm: 60, sleeve_cm: 55 }, TOP)).toBeNull();
    expect(estimateFromPartial('women', {}, TOP)).toBeNull();
  });

  it('breaks an exact tie toward the smaller size', () => {
    // women waist midway between S(64) and M(69) is 66.5; equal distance → S wins
    const res = estimateFromPartial('women', { waist_cm: 66.5 }, TOP);
    expect(res!.inferredSize).toBe('S');
  });

  it('ignores non-positive or non-finite known values when scoring', () => {
    const res = estimateFromPartial('women', { waist_cm: 0, chest_cm: 92 }, TOP);
    expect(res!.inferredSize).toBe('L'); // chest 92 == L; waist 0 ignored
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/fit/sizeEstimate.test.ts`
Expected: FAIL — cannot resolve `./sizeEstimate`.

- [ ] **Step 3: Write the implementation**

Create `lib/fit/sizeEstimate.ts`:

```ts
import type { DimensionKey } from '@/lib/config/dimensions';
import {
  getSizeChart, CHART_DIMS,
  type BodyProfile, type SizeCode, type SizeChartDim,
} from '@/lib/config/sizeChart';

const SIZES: SizeCode[] = ['S', 'M', 'L', 'XL']; // ascending; tie-break prefers earlier (smaller)

function isChartDim(key: DimensionKey): key is SizeChartDim {
  return (CHART_DIMS as string[]).includes(key);
}

function isUsable(v: number | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/**
 * Returns the given size's row, restricted to the dimensions this garment
 * actually has. length_cm / sleeve_cm are never in the chart, so never returned.
 */
export function fillFromSize(
  profile: BodyProfile,
  size: SizeCode,
  garmentDims: DimensionKey[],
): Partial<Record<DimensionKey, number>> {
  const row = getSizeChart()[profile][size];
  const out: Partial<Record<DimensionKey, number>> = {};
  for (const dim of garmentDims) {
    if (isChartDim(dim)) out[dim] = row[dim];
  }
  return out;
}

/**
 * Infers the nearest size from whatever body dimensions the customer already
 * entered, then returns chart values for the garment's chart dims that are
 * still blank. Never overwrites a value the customer provided.
 *
 * Scoring: sum of absolute differences across the usable known chart dims.
 * Tie-break: SIZES is ascending and we keep the first strict minimum, so an
 * exact tie resolves to the smaller size (avoids over-sizing).
 *
 * Returns null when there is no usable chart dim to match on.
 */
export function estimateFromPartial(
  profile: BodyProfile,
  known: Partial<Record<DimensionKey, number>>,
  garmentDims: DimensionKey[],
): { values: Partial<Record<DimensionKey, number>>; inferredSize: SizeCode } | null {
  const chart = getSizeChart()[profile];

  const scoreDims = CHART_DIMS.filter(d => isUsable(known[d]));
  if (scoreDims.length === 0) return null;

  let best: SizeCode = SIZES[0];
  let bestScore = Infinity;
  for (const size of SIZES) {
    const row = chart[size];
    let score = 0;
    for (const d of scoreDims) score += Math.abs((known[d] as number) - row[d]);
    if (score < bestScore) { bestScore = score; best = size; }
  }

  const row = chart[best];
  const values: Partial<Record<DimensionKey, number>> = {};
  for (const dim of garmentDims) {
    if (isChartDim(dim) && !isUsable(known[dim])) {
      values[dim] = row[dim];
    }
  }
  return { values, inferredSize: best };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/fit/sizeEstimate.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Run the whole suite to confirm nothing regressed**

Run: `npm test`
Expected: PASS — the previous 47 tests plus the 13 new ones (3 chart + 10 estimate).

- [ ] **Step 6: Commit**

```bash
git add lib/fit/sizeEstimate.ts lib/fit/sizeEstimate.test.ts
git commit -m "feat(size-estimate): fill and estimate body measurements from a size"
```

---

## Task 3: i18n strings for the helper panel

**Files:**
- Modify: `lib/i18n/strings.ts` (insert a block immediately before the closing `} as const;`)

- [ ] **Step 1: Add the strings**

In `lib/i18n/strings.ts`, find the final block (it ends with `fabricInvalid: { ... },`) and insert this block directly before the `} as const;` line:

```ts
  // --- Size helper (fit form) ---
  sizeHelperTitle:   { th: 'ไม่แน่ใจขนาดตัวเอง?', en: 'Not sure of your measurements?' },
  sizeHelperIntro:   {
    th: 'เลือกไซซ์เพื่อกรอกให้อัตโนมัติ หรือกรอกที่รู้แล้วให้เราประมาณส่วนที่เหลือ (สำหรับผู้ใหญ่)',
    en: 'Pick a size to fill the fields, or enter what you know and we\'ll estimate the rest (adult sizing).',
  },
  profileWomen:      { th: 'ผู้หญิง', en: "Women's" },
  profileMen:        { th: 'ผู้ชาย', en: "Men's" },
  estimateRest:      { th: 'ประมาณส่วนที่เหลือ', en: 'Estimate the rest' },
  estimatedAs:       {
    th: 'ประมาณว่าเป็นไซซ์ {size} — ปรับค่าที่ไม่ตรงได้',
    en: 'Estimated as size {size} — adjust anything that\'s off.',
  },
  filledFromSize:    {
    th: 'กรอกจากไซซ์ {size} แล้ว — ปรับค่าที่ไม่ตรงได้',
    en: 'Filled from size {size} — adjust anything that\'s off.',
  },
  needMeasurementToEstimate: {
    th: 'กรอกขนาดที่รู้อย่างน้อย 1 รายการก่อน',
    en: 'Enter at least one measurement first.',
  },
```

- [ ] **Step 2: Typecheck the strings file compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/i18n/strings.ts
git commit -m "feat(i18n): strings for the size helper panel"
```

---

## Task 4: Helper panel in `FitChecker.tsx`

**Files:**
- Modify: `app/shop/[shop_slug]/[garment_id]/FitChecker.tsx`

Context: `FitChecker` already holds `values: Record<string, string>` (the inputs, as strings), a `prefilled` flag, and a `dimensions: DimInfo[]` prop whose `.key`s are the garment's applicable dimensions. The helper writes into `values` exactly like a manual edit.

- [ ] **Step 1: Add imports and the profile state**

At the top of the file, add to the existing import block:

```ts
import { fillFromSize, estimateFromPartial } from '@/lib/fit/sizeEstimate';
import type { BodyProfile } from '@/lib/config/sizeChart';
import type { DimensionKey } from '@/lib/config/dimensions';
```

Inside the component, next to the other `useState` hooks, add:

```ts
  const [profile, setProfile] = useState<BodyProfile>('women');
  const [sizeNote, setSizeNote] = useState<string | null>(null);

  const garmentDims = dimensions.map(d => d.key) as DimensionKey[];
```

- [ ] **Step 2: Add the fill and estimate handlers**

Inside the component, above `onSubmit`, add:

```ts
  function applySize(size: 'S' | 'M' | 'L' | 'XL') {
    const filled = fillFromSize(profile, size, garmentDims);
    setValues(v => {
      const next = { ...v };
      for (const [k, num] of Object.entries(filled)) next[k] = String(num);
      return next;
    });
    setPrefilled(false);
    setError(null);
    setSizeNote(t.filledFromSize[lang].replace('{size}', size));
  }

  function estimateRest() {
    const known: Partial<Record<DimensionKey, number>> = {};
    for (const d of garmentDims) {
      const n = Number(values[d]);
      if (values[d] && Number.isFinite(n) && n > 0) known[d] = n;
    }
    const res = estimateFromPartial(profile, known, garmentDims);
    if (!res) {
      setSizeNote(t.needMeasurementToEstimate[lang]);
      return;
    }
    setValues(v => {
      const next = { ...v };
      for (const [k, num] of Object.entries(res.values)) next[k] = String(num);
      return next;
    });
    setPrefilled(false);
    setError(null);
    setSizeNote(t.estimatedAs[lang].replace('{size}', res.inferredSize));
  }
```

- [ ] **Step 3: Render the panel**

Immediately after the `<h2>{t.yourMeasurements[lang]}</h2>` line inside the `<form>`, insert:

```tsx
        <div className="space-y-2 rounded bg-gray-50 p-3">
          <p className="text-sm font-medium text-gray-700">{t.sizeHelperTitle[lang]}</p>
          <p className="text-xs text-gray-500">{t.sizeHelperIntro[lang]}</p>
          <div className="flex gap-2">
            {(['women', 'men'] as const).map(p => (
              <button
                key={p} type="button" onClick={() => setProfile(p)}
                className={`rounded border px-3 py-1 text-sm ${
                  profile === p ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700'
                }`}
              >
                {p === 'women' ? t.profileWomen[lang] : t.profileMen[lang]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(['S', 'M', 'L', 'XL'] as const).map(s => (
              <button
                key={s} type="button" onClick={() => applySize(s)}
                className="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700"
              >
                {s}
              </button>
            ))}
            <button
              type="button" onClick={estimateRest}
              className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700"
            >
              {t.estimateRest[lang]}
            </button>
          </div>
          {sizeNote && <p className="text-xs text-gray-600">{sizeNote}</p>}
        </div>
```

- [ ] **Step 4: Clear the size note when the customer edits a field by hand**

In the existing per-dimension `<input>`'s `onChange`, add `setSizeNote(null);` alongside the existing `setPrefilled(false);`:

```ts
              onChange={e => {
                const val = e.target.value;
                setValues(v => ({ ...v, [d.key]: val }));
                setPrefilled(false);
                setSizeNote(null);
              }}
```

- [ ] **Step 5: Typecheck and lint (the build gate)**

Run: `npm run build`
Expected: build succeeds. Watch specifically for `next lint` errors about unused imports — if `DimensionKey` or `BodyProfile` shows as unused, you missed a usage above.

- [ ] **Step 6: Manual browser verification**

Start the dev server (preview_start `{name: "dev"}`, or `npm run dev`) and open a garment fit page. Verify:
1. Women's + a size (e.g. M) fills shoulder/chest/waist with the chart numbers; length/sleeve stay blank; note reads "Filled from size M".
2. Switch to Men's, pick L → fields update to men's numbers.
3. Clear fields, type only a waist value, tap "Estimate the rest" → blanks fill, note reads "Estimated as size …".
4. Clear everything, tap "Estimate the rest" with nothing entered → note reads "Enter at least one measurement first", no fields change.
5. Open a sleeveless garment (no sleeve dimension) → no sleeve field appears and none is filled.
6. Edit an auto-filled value by hand → the note disappears.
7. Toggle language (TH/EN) → panel copy switches.
8. Check `read_console_messages` for errors after the interactions.

Capture a screenshot of the filled form to share as proof.

- [ ] **Step 7: Commit**

```bash
git add "app/shop/[shop_slug]/[garment_id]/FitChecker.tsx"
git commit -m "feat(fit-form): size helper to fill or estimate body measurements"
```

---

## Task 5: Update the state-of-record doc

**Files:**
- Modify: `docs/superpowers/resume.md`

- [ ] **Step 1: Record the feature**

Add a short entry to `docs/superpowers/resume.md` noting: the size helper shipped (built-in Thai adult chart, women's/men's, S/M/L/XL, fill + estimate); the chart lives in `lib/config/sizeChart.ts` and its numbers are provisional/editable in one place; the pure logic is in `lib/fit/sizeEstimate.ts`; and the two tagged follow-ups from the spec (teen/kids profiles, age-data collection module — spec §10) remain open. Keep it to the doc's existing style; do not create a new handoff doc.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/resume.md
git commit -m "docs(resume): record the size helper feature and open follow-ups"
```

---

## Final verification (before merge to `main`)

- [ ] Run `npm test` — all tests green (47 existing + 13 new = 60).
- [ ] Run `npm run build` — succeeds, no lint errors.
- [ ] Manual checks from Task 4 Step 6 all pass.
- [ ] Ship per CLAUDE.md: `git checkout main && git merge --ff-only feature/<branch> && git push origin main`, then confirm the live deploy landed. (Merge is a human-authorized step, not part of automated execution.)
