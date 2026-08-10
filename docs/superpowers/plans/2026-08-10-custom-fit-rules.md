# Custom Fit Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a retailer define what "good fit" means for their own garments — reusable presets plus per-garment overrides — replacing the three hardcoded profiles, and unblocking stretchy fabrics.

**Architecture:** Every retailer-facing surface speaks **ease** (`garment − customer`, "how many cm roomier than the body"), never the engine's internal `diff` (`customer − garment`). A pure compiler `easeRuleToBands()` bridges the two, so the engine's band-matching loop is untouched. Rules resolve all-or-nothing at the ruleset level (override → preset → built-in profile), then fall through per dimension (`perDimension` → `base` → dimension default). The resolved ruleset is snapshotted into every `fit_session` so history stays interpretable after a preset is edited.

**Tech Stack:** Next.js 14.2 App Router, TypeScript strict, Tailwind 3, Supabase (Postgres + RLS), zod 4, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-08-06-custom-fit-rules-design.md` (committed `05ac058`)

---

## Baseline before starting

Verified 2026-08-10 in `C:\Users\Copter\Documents\Claude\Projects\Startup poor fools\fit-mvp` — **this is the canonical checkout**, not `C:\Users\Copter\Desktop\Claude code`, which is a stale clone one commit behind. Confirm with `git log --oneline -1` → should show `05ac058` or later.

- `npm test` → **12 passed (12)**. Not 26; the spec's original figure was a miscount.
- `npm run build` → must be green before and after.

---

## File structure

**Create**

| File | Responsibility |
|---|---|
| `lib/fit/rules.ts` | `EaseRule`, `FitRuleset`, `DEFAULT_RULE`, `easeRuleToBands()`. Pure. No I/O. |
| `lib/fit/rules.test.ts` | Compiler + regression guard |
| `lib/fit/rule-schema.ts` | zod schemas shared by API routes and the client editor |
| `lib/fit/resolve.ts` | `resolveRuleset()`, `builtinRuleset()`. Pure — caller supplies the fetched preset. |
| `lib/fit/resolve.test.ts` | Resolution precedence + malformed-rule fallback |
| `supabase/migrations/0002_fit_rulesets.sql` | Table, policy, index, 3 nullable columns |
| `app/api/fit-rulesets/route.ts` | `GET` list, `POST` create |
| `app/api/fit-rulesets/[id]/route.ts` | `PATCH`, `DELETE` |
| `app/dashboard/fit-rules/page.tsx` | Server component: fetch + render list |
| `app/dashboard/fit-rules/FitRulesManager.tsx` | Client: list, create/edit/delete flow |
| `app/dashboard/fit-rules/FitRuleEditor.tsx` | Client: 3 inputs + live preview. Reused by the garment form. |

**Modify**

| File | Change |
|---|---|
| `lib/config/dimensions.ts` | `defaultBands: ThresholdBand[]` → `defaultRule: EaseRule` |
| `lib/config/fit-profiles.ts` | `overrides` → `ruleset: FitRuleset` |
| `lib/fit/engine.ts` | Third arg becomes `FitRuleset` |
| `lib/fit/engine.test.ts` | 12 call sites pass a ruleset |
| `lib/supabase/types.ts` | New columns + `FitRulesetRow` |
| `app/api/fit/evaluate/route.ts` | Resolve ruleset, write `applied_rule` |
| `app/api/garments/route.ts` | Accept `fit_ruleset_id` / `fit_rule_override` |
| `app/dashboard/garment/new/page.tsx` | Grouped select + override checkbox |
| `lib/i18n/strings.ts` | New keys |

### The one import trap

`lib/fit/rules.ts` must import from `lib/config/dimensions.ts` using **`import type` only**. `dimensions.ts` imports `DEFAULT_RULE` as a *value* from `rules.ts`. If `rules.ts` ever takes a value import back from `dimensions.ts`, that becomes a real runtime cycle and `DEFAULT_RULE` will be `undefined` at module-init time — a failure that surfaces as every dimension silently getting `undefined` bands. Type imports are erased at compile time, so the one-way runtime edge `dimensions → rules` is safe. Do not "tidy" these into plain imports.

---

## Task 1: Rule primitives and the compiler

**Files:**
- Create: `lib/fit/rules.ts`
- Test: `lib/fit/rules.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/fit/rules.test.ts`. The regression guard holds a **frozen literal** of today's `DEFAULT_BANDS` rather than importing it. That is deliberate: importing the constant would make the test tautological once Task 2 rewrites `dimensions.ts`. This literal is the golden value — if it ever needs changing, existing garments changed behaviour.

```ts
import { describe, it, expect } from 'vitest';
import { easeRuleToBands, DEFAULT_RULE, type EaseRule } from './rules';

const INF = Number.POSITIVE_INFINITY;

/** Frozen copy of DEFAULT_BANDS as it stood at commit e3cd406. Golden value. */
const LEGACY_DEFAULT_BANDS = [
  { min: 1,    max: INF,  verdict: 'too_tight' },
  { min: -1,   max: 1,    verdict: 'snug' },
  { min: -5,   max: -1,   verdict: 'good_fit' },
  { min: -INF, max: -5,   verdict: 'loose' },
];

/** Frozen copies of SLIM_DEFAULT / RELAXED_DEFAULT at the same commit. */
const LEGACY_SLIM_BANDS = [
  { min: 1,    max: INF, verdict: 'too_tight' },
  { min: -1,   max: 1,   verdict: 'snug' },
  { min: -3,   max: -1,  verdict: 'good_fit' },
  { min: -INF, max: -3,  verdict: 'loose' },
];
const LEGACY_RELAXED_BANDS = [
  { min: 1,    max: INF, verdict: 'too_tight' },
  { min: -1,   max: 1,   verdict: 'snug' },
  { min: -8,   max: -1,  verdict: 'good_fit' },
  { min: -INF, max: -8,  verdict: 'loose' },
];

describe('easeRuleToBands — regression guard', () => {
  it('DEFAULT_RULE compiles to the legacy default bands exactly', () => {
    expect(easeRuleToBands(DEFAULT_RULE)).toEqual(LEGACY_DEFAULT_BANDS);
  });
  it('slim rule compiles to the legacy slim bands exactly', () => {
    expect(easeRuleToBands({ tightBelow: -1, goodFrom: 1, goodTo: 3 })).toEqual(LEGACY_SLIM_BANDS);
  });
  it('relaxed rule compiles to the legacy relaxed bands exactly', () => {
    expect(easeRuleToBands({ tightBelow: -1, goodFrom: 1, goodTo: 8 })).toEqual(LEGACY_RELAXED_BANDS);
  });
});

describe('easeRuleToBands — structure', () => {
  it('covers the whole number line with no gaps', () => {
    const bands = easeRuleToBands({ tightBelow: -6, goodFrom: -4, goodTo: 3 });
    expect(bands[0].max).toBe(INF);
    expect(bands[bands.length - 1].min).toBe(-INF);
    // each band's min meets the previous band's max
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i].max).toBe(bands[i - 1].min);
    }
  });

  it('produces an empty snug band when tightBelow === goodFrom', () => {
    const bands = easeRuleToBands({ tightBelow: 1, goodFrom: 1, goodTo: 5 });
    const snug = bands.find(b => b.verdict === 'snug')!;
    expect(snug.min).toBe(snug.max); // min === max never matches [min, max)
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run lib/fit/rules.test.ts
```

Expected: FAIL — `Failed to resolve import "./rules"`.

- [ ] **Step 3: Write the implementation**

Create `lib/fit/rules.ts`:

```ts
import type { DimensionKey, ThresholdBand } from '@/lib/config/dimensions';

/**
 * A fit rule expressed in EASE — how many cm roomier the garment is than the
 * body (`garment - customer`). This is the retailer-facing orientation; the
 * engine works on the negation (`diff = customer - garment`).
 *
 * Negative ease means the garment measures SMALLER than the body, which is how
 * a stretchy fabric is expressed. That is why there is no separate stretch flag.
 */
export interface EaseRule {
  tightBelow: number;  // ease <= this            -> too_tight
  goodFrom: number;    // tightBelow < ease <= me -> snug
  goodTo: number;      // goodFrom  < ease <= me  -> good_fit;  above -> loose
}

/**
 * A base rule plus per-dimension exceptions. `base` is optional so the built-in
 * `regular` profile can be `{ perDimension: {} }` and fall through to each
 * dimension's own default — which keeps a future dimension with a different
 * default from being silently overridden.
 */
export interface FitRuleset {
  base?: EaseRule;
  perDimension: Partial<Record<DimensionKey, EaseRule>>;
}

/** Today's behaviour, unchanged: good fit is 1-5cm of room. */
export const DEFAULT_RULE: EaseRule = { tightBelow: -1, goodFrom: 1, goodTo: 5 };

const INF = Number.POSITIVE_INFINITY;

/**
 * Compile an ease rule to the engine's diff-oriented bands.
 *
 * Note the inclusivity flip: ease bounds are inclusive-UPPER, engine bands are
 * `[min, max)`. Negating swaps the open end so the two agree. If
 * `tightBelow === goodFrom` the snug band is empty (min === max never matches)
 * — harmless and intentional.
 */
export function easeRuleToBands(r: EaseRule): ThresholdBand[] {
  return [
    { min: -r.tightBelow, max: INF,           verdict: 'too_tight' },
    { min: -r.goodFrom,   max: -r.tightBelow, verdict: 'snug' },
    { min: -r.goodTo,     max: -r.goodFrom,   verdict: 'good_fit' },
    { min: -INF,          max: -r.goodTo,     verdict: 'loose' },
  ];
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run lib/fit/rules.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/fit/rules.ts lib/fit/rules.test.ts && git commit -m "feat(fit): ease rule model and band compiler"
```

---

## Task 2: Dimensions carry a default rule, not default bands

**Files:**
- Modify: `lib/config/dimensions.ts`

- [ ] **Step 1: Replace the bands constant with the rule import**

In `lib/config/dimensions.ts`, delete the `const INF` and the whole `DEFAULT_BANDS` block (lines 26–34), and add at the top of the file, after the existing `Category` import:

```ts
import { DEFAULT_RULE } from '@/lib/fit/rules';
import type { EaseRule } from '@/lib/fit/rules';
```

`ThresholdBand` stays exported from this file — the engine still consumes it.

- [ ] **Step 2: Change the Dimension interface**

Replace the `defaultBands` field:

```ts
export interface Dimension {
  key: DimensionKey;
  labelTh: string;
  labelEn: string;
  measureHintTh: string;
  measureHintEn: string;
  categories: Category[];
  defaultRule: EaseRule;   // was: defaultBands: readonly ThresholdBand[]
}
```

- [ ] **Step 3: Update all six dimension entries**

In each of the six entries in `DIMENSIONS`, replace `defaultBands: DEFAULT_BANDS,` with `defaultRule: DEFAULT_RULE,`. All six take the same value. Do not change any other field.

- [ ] **Step 4: Verify it compiles as far as expected**

```bash
npx tsc --noEmit
```

Expected: FAIL, but **only** with errors in `lib/fit/engine.ts` (`Property 'defaultBands' does not exist`). Task 4 fixes those. If you see errors in any other file, stop and re-read the step.

- [ ] **Step 5: Commit**

```bash
git add lib/config/dimensions.ts && git commit -m "refactor(config): dimensions carry defaultRule instead of defaultBands"
```

---

## Task 3: Built-in profiles become rulesets

**Files:**
- Modify: `lib/config/fit-profiles.ts`

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `lib/config/fit-profiles.ts`:

```ts
import type { EaseRule, FitRuleset } from '@/lib/fit/rules';

/**
 * A built-in profile is now just a named FitRuleset. `regular` carries an empty
 * ruleset so every dimension falls through to its own default — see the comment
 * on FitRuleset.base for why that matters.
 */
export interface FitProfile {
  key: string;
  labelTh: string;
  labelEn: string;
  ruleset: FitRuleset;
}

/** Slim: acceptable ease shrinks to 1-3cm. */
const SLIM: EaseRule = { tightBelow: -1, goodFrom: 1, goodTo: 3 };
/** Relaxed: acceptable ease extends to 1-8cm. */
const RELAXED: EaseRule = { tightBelow: -1, goodFrom: 1, goodTo: 8 };

export const FIT_PROFILES: FitProfile[] = [
  {
    key: 'regular', labelTh: 'ทรงปกติ', labelEn: 'Regular',
    ruleset: { perDimension: {} },
  },
  {
    key: 'slim', labelTh: 'ทรงเข้ารูป', labelEn: 'Slim',
    ruleset: {
      perDimension: {
        shoulder_cm: SLIM, chest_cm: SLIM, waist_cm: SLIM, hip_cm: SLIM,
      },
    },
  },
  {
    key: 'relaxed', labelTh: 'ทรงหลวม', labelEn: 'Relaxed',
    ruleset: {
      perDimension: {
        shoulder_cm: RELAXED, chest_cm: RELAXED, waist_cm: RELAXED, hip_cm: RELAXED,
      },
    },
  },
];

/**
 * Label/metadata lookup for the dashboard. Falls back to `regular` for an
 * unrecognised key, preserving pre-change behaviour. The ruleset-resolution
 * path uses `builtinRuleset()` in lib/fit/resolve.ts, which wraps this.
 */
export function fitProfileByKey(key: string): FitProfile {
  return FIT_PROFILES.find(p => p.key === key) ?? FIT_PROFILES[0]!;
}
```

> **Deviation from spec §5, deliberate.** The spec says the unrecognised-key fallback *moves* out of `fitProfileByKey`. It stays here instead, and `builtinRuleset()` wraps it. Reason: `fitProfileByKey` and `FIT_PROFILES` are still needed by the garment form and `app/api/garments/route.ts` for **labels**, so deleting the function would break two call sites for no gain. The behaviour the spec asks for — "an unrecognised `fit_profile` resolves to regular, and that is tested in the resolve layer" — is preserved exactly; only the location of the one-line `??` differs.

- [ ] **Step 2: Commit**

```bash
git add lib/config/fit-profiles.ts && git commit -m "refactor(config): built-in profiles expressed as FitRulesets"
```

---

## Task 4: Engine takes a ruleset

**Files:**
- Modify: `lib/fit/engine.ts`
- Modify: `lib/fit/engine.test.ts`

- [ ] **Step 1: Change the engine**

In `lib/fit/engine.ts`, replace the imports on lines 1–3:

```ts
import { DIMENSIONS, type DimensionKey } from '@/lib/config/dimensions';
import { easeRuleToBands, type FitRuleset } from '@/lib/fit/rules';
import type { MeasurementBag } from '@/lib/supabase/types';
```

(`fitProfileByKey` is no longer imported here; `ThresholdBand` is still needed by `matchBand`, so keep `type ThresholdBand` in the first import if `tsc` asks for it.)

Change the signature and the two lines that used the profile:

```ts
export function evaluateFit(
  garment: MeasurementBag,
  customer: MeasurementBag,
  ruleset: FitRuleset
): FitResult {
  const result: FitResult = { dimensions: {}, overall: 'unknown' };
  let worstScored: Verdict | null = null;

  for (const dim of DIMENSIONS) {
    const g = garment[dim.key];
    const c = customer[dim.key];
    if (g === undefined || c === undefined) {
      result.dimensions[dim.key] = { verdict: 'unknown', customer: c ?? null, garment: g ?? null, diff: null };
      continue;
    }
    // perDimension beats base beats the dimension's own default (spec §4.4)
    const rule = ruleset.perDimension[dim.key] ?? ruleset.base ?? dim.defaultRule;
    const bands = easeRuleToBands(rule);
    const diff = c - g;
    const verdict = matchBand(diff, bands);
    result.dimensions[dim.key] = { verdict, customer: c, garment: g, diff };
    if (worstScored === null || SEVERITY[verdict] > SEVERITY[worstScored]) {
      worstScored = verdict;
    }
  }

  result.overall = worstScored ?? 'unknown';
  return result;
}
```

Everything else in the file — `SEVERITY`, `matchBand`, the types — is unchanged.

- [ ] **Step 2: Update the 12 test call sites**

This is mechanical and a good candidate to delegate. Every `evaluateFit(a, b, 'someKey')` becomes `evaluateFit(a, b, rulesetFor('someKey'))`. Add this helper at the top of `lib/fit/engine.test.ts`, after the existing imports:

```ts
import { fitProfileByKey } from '@/lib/config/fit-profiles';

/** Test helper: look up a built-in profile's ruleset by key. */
const rulesetFor = (key: string) => fitProfileByKey(key).ruleset;
```

Then rewrite the calls:

| Line | Was | Becomes |
|---|---|---|
| 11, 15, 19, 23 | `'regular'` | `rulesetFor('regular')` |
| 33 | `'slim'` | `rulesetFor('slim')` |
| 40 | `'relaxed'` | `rulesetFor('relaxed')` |
| 32, 39, 48, 52, 75 | `'regular'` | `rulesetFor('regular')` |
| 59, 67 | (multi-line calls) `'regular'` | `rulesetFor('regular')` |

**Line 82 is different.** The `'banana'` test covers the unrecognised-key fallback, which is no longer the engine's job — it belongs to the resolve layer. **Delete that test from this file**; Task 6 re-adds it as a `resolveRuleset` test. Deleting it here takes the file from 12 tests to 11.

- [ ] **Step 3: Run the full suite**

```bash
npm test
```

Expected: PASS, **16 tests** (11 in `engine.test.ts` + 5 in `rules.test.ts`). If any engine test fails on a *verdict value*, the compiler is wrong — stop and revisit Task 1, do not adjust the assertion.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: PASS with no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/fit/engine.ts lib/fit/engine.test.ts && git commit -m "refactor(fit): evaluateFit takes a FitRuleset instead of a profile key"
```

---

## Task 5: Validation schema

**Files:**
- Create: `lib/fit/rule-schema.ts`
- Test: `lib/fit/resolve.test.ts` (created here, extended in Task 6)

- [ ] **Step 1: Write the failing test**

Create `lib/fit/resolve.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EaseRuleSchema, FitRulesetSchema, RulesetNameSchema } from './rule-schema';

describe('EaseRuleSchema', () => {
  it('accepts the default rule', () => {
    expect(EaseRuleSchema.safeParse({ tightBelow: -1, goodFrom: 1, goodTo: 5 }).success).toBe(true);
  });
  it('accepts a stretchy rule with negative ease', () => {
    expect(EaseRuleSchema.safeParse({ tightBelow: -6, goodFrom: -4, goodTo: 3 }).success).toBe(true);
  });
  it('accepts tightBelow === goodFrom (no snug zone)', () => {
    expect(EaseRuleSchema.safeParse({ tightBelow: 1, goodFrom: 1, goodTo: 5 }).success).toBe(true);
  });
  it('rejects goodFrom === goodTo — good_fit would be unreachable', () => {
    expect(EaseRuleSchema.safeParse({ tightBelow: -1, goodFrom: 3, goodTo: 3 }).success).toBe(false);
  });
  it('rejects tightBelow > goodFrom', () => {
    expect(EaseRuleSchema.safeParse({ tightBelow: 2, goodFrom: 1, goodTo: 5 }).success).toBe(false);
  });
  it('rejects a unit slip (500 for 50)', () => {
    expect(EaseRuleSchema.safeParse({ tightBelow: -1, goodFrom: 1, goodTo: 500 }).success).toBe(false);
  });
  it('rejects a missing field', () => {
    expect(EaseRuleSchema.safeParse({ tightBelow: -1, goodFrom: 1 }).success).toBe(false);
  });
  it('rejects a non-numeric field', () => {
    expect(EaseRuleSchema.safeParse({ tightBelow: -1, goodFrom: 1, goodTo: '5' }).success).toBe(false);
  });
});

describe('FitRulesetSchema', () => {
  it('accepts an empty ruleset and defaults perDimension', () => {
    const r = FitRulesetSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.perDimension).toEqual({});
  });
  it('accepts base plus a per-dimension exception', () => {
    const r = FitRulesetSchema.safeParse({
      base: { tightBelow: -1, goodFrom: 1, goodTo: 5 },
      perDimension: { waist_cm: { tightBelow: -6, goodFrom: -4, goodTo: 3 } },
    });
    expect(r.success).toBe(true);
  });
  it('rejects an unknown dimension key', () => {
    const r = FitRulesetSchema.safeParse({
      perDimension: { elbow_cm: { tightBelow: -1, goodFrom: 1, goodTo: 5 } },
    });
    expect(r.success).toBe(false);
  });
  it('rejects a ruleset whose nested rule is invalid', () => {
    const r = FitRulesetSchema.safeParse({
      perDimension: { chest_cm: { tightBelow: -1, goodFrom: 5, goodTo: 5 } },
    });
    expect(r.success).toBe(false);
  });
});

describe('RulesetNameSchema', () => {
  it('trims and accepts a normal name', () => {
    const r = RulesetNameSchema.safeParse('  ผ้ายืด  ');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe('ผ้ายืด');
  });
  it('rejects an empty name', () => {
    expect(RulesetNameSchema.safeParse('   ').success).toBe(false);
  });
  it('rejects a name over 60 chars', () => {
    expect(RulesetNameSchema.safeParse('x'.repeat(61)).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run lib/fit/resolve.test.ts
```

Expected: FAIL — `Failed to resolve import "./rule-schema"`.

- [ ] **Step 3: Write the implementation**

Create `lib/fit/rule-schema.ts`:

```ts
import { z } from 'zod';
import { DIMENSIONS, type DimensionKey } from '@/lib/config/dimensions';

const DIMENSION_KEYS = DIMENSIONS.map(d => d.key) as [DimensionKey, ...DimensionKey[]];

/**
 * Shared by the API routes and the client editor so the two cannot drift.
 *
 * The +/-30..50cm envelope is a typo net, not a physical limit — it catches a
 * `500` typed for `50`, which would otherwise silently make every garment fit.
 */
export const EaseRuleSchema = z
  .object({
    tightBelow: z.number().min(-30).max(50),
    goodFrom: z.number().min(-30).max(50),
    goodTo: z.number().min(-30).max(50),
  })
  // Equality allowed: it simply means "no snug zone".
  .refine(r => r.tightBelow <= r.goodFrom, {
    message: 'ค่า "พอดีตั้งแต่" ต้องไม่น้อยกว่าค่า "แน่นเกินไป"',
    path: ['goodFrom'],
  })
  // Strict: equality would make good_fit unreachable.
  .refine(r => r.goodFrom < r.goodTo, {
    message: 'ค่า "ถึง" ต้องมากกว่าค่า "พอดีตั้งแต่"',
    path: ['goodTo'],
  });

export const FitRulesetSchema = z.object({
  base: EaseRuleSchema.optional(),
  perDimension: z.record(z.enum(DIMENSION_KEYS), EaseRuleSchema).default({}),
});

export const RulesetNameSchema = z.string().trim().min(1).max(60);

/** First human-readable message from a failed parse, for a 400 body. */
export function firstIssueMessage(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง';
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run lib/fit/resolve.test.ts
```

Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/fit/rule-schema.ts lib/fit/resolve.test.ts && git commit -m "feat(fit): shared zod schema for ease rules and rulesets"
```

---

## Task 6: Resolution

**Files:**
- Create: `lib/fit/resolve.ts`
- Modify: `lib/fit/resolve.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/fit/resolve.test.ts`:

```ts
import { resolveRuleset, builtinRuleset, type GarmentRuleFields } from './resolve';
import { evaluateFit } from './engine';

const STRETCHY = { tightBelow: -6, goodFrom: -4, goodTo: 3 };
const TAILORED = { tightBelow: 0, goodFrom: 1, goodTo: 3 };

const garment = (over: Partial<GarmentRuleFields> = {}): GarmentRuleFields => ({
  fit_profile: 'regular', fit_ruleset_id: null, fit_rule_override: null, ...over,
});

describe('builtinRuleset', () => {
  it('returns regular for an unrecognised profile key', () => {
    // moved here from engine.test.ts — the fallback is the resolver's job now
    expect(builtinRuleset('banana')).toEqual(builtinRuleset('regular'));
  });
  it('returns the slim ruleset for slim', () => {
    expect(builtinRuleset('slim').perDimension.chest_cm).toEqual({ tightBelow: -1, goodFrom: 1, goodTo: 3 });
  });
});

describe('resolveRuleset — precedence', () => {
  it('override beats preset', () => {
    const r = resolveRuleset(
      garment({ fit_rule_override: { perDimension: { chest_cm: STRETCHY } } }),
      { perDimension: { chest_cm: TAILORED } }
    );
    expect(r.perDimension.chest_cm).toEqual(STRETCHY);
  });
  it('preset beats built-in', () => {
    const r = resolveRuleset(garment({ fit_profile: 'slim' }), { perDimension: { chest_cm: STRETCHY } });
    expect(r.perDimension.chest_cm).toEqual(STRETCHY);
  });
  it('falls back to built-in when there is no override and no preset', () => {
    expect(resolveRuleset(garment({ fit_profile: 'slim' }), null)).toEqual(builtinRuleset('slim'));
  });
  it('override REPLACES the preset rather than merging with it', () => {
    const r = resolveRuleset(
      garment({ fit_rule_override: { perDimension: { chest_cm: STRETCHY } } }),
      { perDimension: { waist_cm: TAILORED } }
    );
    expect(r.perDimension.waist_cm).toBeUndefined();
  });
});

describe('resolveRuleset — malformed input never throws', () => {
  it('falls back to fit_profile when the override is malformed', () => {
    const r = resolveRuleset(garment({ fit_profile: 'slim', fit_rule_override: { nonsense: true } }), null);
    expect(r).toEqual(builtinRuleset('slim'));
  });
  it('falls back to fit_profile when the stored preset is malformed', () => {
    const r = resolveRuleset(garment({ fit_profile: 'relaxed' }), { perDimension: { chest_cm: { tightBelow: 9 } } });
    expect(r).toEqual(builtinRuleset('relaxed'));
  });
});

describe('the case this feature exists for', () => {
  it('a stretchy rule returns good_fit where the default returns too_tight', () => {
    // garment 97cm, customer 100cm -> ease -3.
    // NOT -4: ease exactly at goodFrom is snug by the §3.2 table, so a garment
    // measuring 96 here would assert the wrong verdict. Pick a point strictly
    // inside the good_fit zone.
    const g = { chest_cm: 97 }, c = { chest_cm: 100 };
    expect(evaluateFit(g, c, builtinRuleset('regular')).dimensions.chest_cm?.verdict).toBe('too_tight');
    const stretchy = resolveRuleset(garment(), { base: STRETCHY, perDimension: {} });
    expect(evaluateFit(g, c, stretchy).dimensions.chest_cm?.verdict).toBe('good_fit');
  });
});

describe('boundaries land on the documented side', () => {
  const rule = { tightBelow: -1, goodFrom: 1, goodTo: 5 };
  const rs = { base: rule, perDimension: {} };
  const verdictAtEase = (ease: number) =>
    evaluateFit({ chest_cm: 100 }, { chest_cm: 100 - ease }, rs).dimensions.chest_cm?.verdict;

  it('ease exactly at tightBelow is too_tight', () => expect(verdictAtEase(-1)).toBe('too_tight'));
  it('ease just above tightBelow is snug',   () => expect(verdictAtEase(-0.5)).toBe('snug'));
  it('ease exactly at goodFrom is snug',     () => expect(verdictAtEase(1)).toBe('snug'));
  it('ease just above goodFrom is good_fit', () => expect(verdictAtEase(1.5)).toBe('good_fit'));
  it('ease exactly at goodTo is good_fit',   () => expect(verdictAtEase(5)).toBe('good_fit'));
  it('ease just above goodTo is loose',      () => expect(verdictAtEase(5.5)).toBe('loose'));
});

describe('empty snug zone', () => {
  it('never returns unknown when tightBelow === goodFrom', () => {
    const rs = { base: { tightBelow: 1, goodFrom: 1, goodTo: 5 }, perDimension: {} };
    for (const ease of [-5, -1, 0, 1, 2, 5, 9]) {
      const v = evaluateFit({ chest_cm: 100 }, { chest_cm: 100 - ease }, rs).dimensions.chest_cm?.verdict;
      expect(v).not.toBe('unknown');
      expect(v).not.toBe('snug');
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run lib/fit/resolve.test.ts
```

Expected: FAIL — `Failed to resolve import "./resolve"`.

- [ ] **Step 3: Write the implementation**

Create `lib/fit/resolve.ts`:

```ts
import { fitProfileByKey } from '@/lib/config/fit-profiles';
import { FitRulesetSchema } from './rule-schema';
import type { FitRuleset } from './rules';

/** The subset of a garment row that rule resolution needs. */
export interface GarmentRuleFields {
  fit_profile: string;
  fit_ruleset_id?: string | null;
  fit_rule_override?: unknown;
}

/** Built-in profile as a ruleset. Unrecognised keys resolve to `regular`. */
export function builtinRuleset(fitProfileKey: string): FitRuleset {
  return fitProfileByKey(fitProfileKey).ruleset;
}

/**
 * Resolve the ruleset actually in force for a garment (spec §4.4).
 *
 *     override ?? preset ?? builtinProfile(fit_profile)
 *
 * All-or-nothing at the ruleset level: an override REPLACES the preset, it does
 * not merge with it. Merging would make "which number is in force" unanswerable
 * from any one place.
 *
 * Pure — the caller fetches `presetRule` and passes it in, so this does no I/O.
 *
 * A malformed stored rule must never break the customer-facing checker, so both
 * inputs are validated and a failure logs and falls through to the built-in.
 */
export function resolveRuleset(garment: GarmentRuleFields, presetRule: unknown): FitRuleset {
  if (garment.fit_rule_override != null) {
    const parsed = FitRulesetSchema.safeParse(garment.fit_rule_override);
    if (parsed.success) return parsed.data;
    console.error('malformed fit_rule_override; falling back to fit_profile');
  }

  if (presetRule != null) {
    const parsed = FitRulesetSchema.safeParse(presetRule);
    if (parsed.success) return parsed.data;
    console.error('malformed fit_ruleset.rule; falling back to fit_profile');
  }

  return builtinRuleset(garment.fit_profile);
}
```

- [ ] **Step 4: Run the full suite**

```bash
npm test
```

Expected: PASS, **47 tests** — 11 `engine.test.ts` + 5 `rules.test.ts` + 31 `resolve.test.ts` (15 from Task 5, 16 added here).

- [ ] **Step 5: Commit**

```bash
git add lib/fit/resolve.ts lib/fit/resolve.test.ts && git commit -m "feat(fit): ruleset resolution with validation fallback"
```

---

## Task 7: Migration and types

**Files:**
- Create: `supabase/migrations/0002_fit_rulesets.sql`
- Modify: `lib/supabase/types.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0002_fit_rulesets.sql`:

```sql
-- =============================================================
-- Retailer-defined fit rules
-- Spec: docs/superpowers/specs/2026-08-06-custom-fit-rules-design.md
-- =============================================================

create table public.fit_rulesets (
  id           uuid primary key default gen_random_uuid(),
  retailer_id  uuid not null references public.retailers(id) on delete cascade,
  name         text not null,
  rule         jsonb not null,
  created_at   timestamptz not null default now()
);

create index fit_rulesets_retailer_id_idx on public.fit_rulesets(retailer_id);

alter table public.fit_rulesets enable row level security;

create policy "fit_rulesets_owner_all"
  on public.fit_rulesets for all
  using (auth.uid() = retailer_id)
  with check (auth.uid() = retailer_id);

-- No anon policy. /api/fit/evaluate uses the service-role client, so ruleset
-- resolution happens server-side and presets stay out of anon read range —
-- consistent with keeping fit_sessions out of anon reach.
--
-- NOTE the asymmetry (spec §4.2): `garments` carries a blanket anon SELECT
-- policy, so `fit_rule_override` below IS anon-readable. Accepted: it is the
-- retailer's own thresholds, not customer data, and no code path reads garments
-- with the anon client. Do not tell retailers their rules are secret.

-- ---------- garment columns ----------
-- Both nullable. `fit_profile` is untouched and remains the fallback for every
-- existing garment. These two are mutually exclusive by construction in the API.
alter table public.garments
  add column fit_ruleset_id    uuid references public.fit_rulesets(id) on delete set null,
  add column fit_rule_override jsonb;

-- ---------- session snapshot ----------
-- Rules are editable, so a session referencing a preset by ID becomes
-- uninterpretable the moment that preset is edited. This column records the
-- ruleset that actually produced the verdict. Written once at evaluation time,
-- never updated. Nullable so pre-existing rows stay valid — those were all
-- evaluated under the built-in defaults, which still live in the code.
alter table public.fit_sessions
  add column applied_rule jsonb;
```

- [ ] **Step 2: Apply it**

Run this in the Supabase dashboard SQL editor for the `fit-mvp` project (Singapore). Paste the file contents and execute.

Expected: `Success. No rows returned.`

- [ ] **Step 3: Verify the schema landed**

Run in the same SQL editor:

```sql
select column_name from information_schema.columns
where table_name = 'garments' and column_name like 'fit_rule%';
```

Expected: two rows — `fit_ruleset_id`, `fit_rule_override`.

- [ ] **Step 4: Update the types**

In `lib/supabase/types.ts`, add the import and the new fields:

```ts
import type { DimensionKey } from '@/lib/config/dimensions';
import type { FitRuleset } from '@/lib/fit/rules';
```

Add to `Garment`, after `fit_profile`:

```ts
  fit_ruleset_id: string | null;
  fit_rule_override: FitRuleset | null;
```

Add to `FitSession`, after `result`:

```ts
  applied_rule: FitRuleset | null;
```

And add the new row type at the end of the file:

```ts
export interface FitRulesetRow {
  id: string;
  retailer_id: string;
  name: string;
  rule: FitRuleset;
  created_at: string;
}
```

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
```

Expected: PASS.

```bash
git add supabase/migrations/0002_fit_rulesets.sql lib/supabase/types.ts && git commit -m "feat(db): fit_rulesets table, garment rule columns, session snapshot"
```

---

## Task 8: Evaluate route resolves and snapshots

**Files:**
- Modify: `app/api/fit/evaluate/route.ts`

- [ ] **Step 1: Add the imports**

Add to the imports at the top of `app/api/fit/evaluate/route.ts`:

```ts
import { resolveRuleset } from '@/lib/fit/resolve';
```

- [ ] **Step 2: Widen the garment select**

Replace the `.select('measurements, fit_profile')` on line 31 with:

```ts
    .select('measurements, fit_profile, fit_ruleset_id, fit_rule_override')
```

- [ ] **Step 3: Fetch the preset and resolve**

Replace line 36 (the single `evaluateFit` call) with:

```ts
  // One extra query at most, skipped entirely when the garment has an inline
  // override or uses a built-in profile.
  let presetRule: unknown = null;
  if (garment.fit_ruleset_id && garment.fit_rule_override == null) {
    const { data: preset, error: pErr } = await supabase
      .from('fit_rulesets')
      .select('rule')
      .eq('id', garment.fit_ruleset_id)
      .single();
    if (pErr || !preset) {
      // A deleted or unreadable preset must not break the customer-facing
      // checker — resolveRuleset falls back to the garment's fit_profile.
      console.error('fit_ruleset fetch failed; falling back to fit_profile:', pErr?.message);
    } else {
      presetRule = preset.rule;
    }
  }

  const ruleset = resolveRuleset(garment, presetRule);
  const result = evaluateFit(garment.measurements as MeasurementBag, cleanCustomer, ruleset);
```

- [ ] **Step 4: Snapshot the applied rule**

In the `fit_sessions.insert({...})` call, add one line after `result,`:

```ts
    applied_rule: ruleset,
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit && npm run build
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/fit/evaluate/route.ts && git commit -m "feat(api): evaluate resolves retailer rulesets and snapshots applied_rule"
```

> **Known coverage gap.** Spec §8.5b asks for an automated test that `applied_rule` holds the ruleset that produced the verdict and does not change when the preset is later edited. This plan verifies that **manually** (Task 14, Step 2, items 5–6) rather than automatically, because the project has no integration-test harness — the whole suite is pure unit tests over `lib/fit`, with no DB or route testing anywhere. Building that harness is a larger piece of work than the feature it would guard here. The pure half of the guarantee *is* automated: `resolveRuleset` returns a plain value that the route writes verbatim. What stays unverified by CI is the route wiring.

---

## Task 9: i18n strings

**Files:**
- Modify: `lib/i18n/strings.ts`

- [ ] **Step 1: Add the keys**

Insert before the closing `} as const;` in `lib/i18n/strings.ts`:

```ts
  // Fit rules
  fitRules: { th: 'กฎความพอดี', en: 'Fit rules' },
  fitRulesNav: { th: 'กฎของร้าน', en: 'Shop rules' },
  fitRuleNew: { th: 'สร้างกฎใหม่', en: 'New rule' },
  fitRuleName: { th: 'ชื่อกฎ', en: 'Rule name' },
  fitRuleNamePlaceholder: { th: 'เช่น ผ้ายืด', en: 'e.g. Stretchy jersey' },
  fitRuleTightBelow: { th: 'แน่นเกินไป เมื่อแคบกว่าตัวมากกว่า…', en: 'Too tight when narrower than the body by more than…' },
  fitRuleGoodFrom: { th: 'พอดี ตั้งแต่…', en: 'Good fit from…' },
  fitRuleGoodTo: { th: '…ถึง…', en: '…to…' },
  fitRulePreview: { th: 'ตัวอย่าง', en: 'Preview' },
  fitRulePerDimension: { th: 'ปรับเฉพาะบางจุด', en: 'Per-measurement exceptions' },
  fitRuleSameAsAbove: { th: 'เหมือนด้านบน', en: 'Same as above' },
  fitRuleOverride: { th: 'ปรับเฉพาะสินค้านี้', en: 'Custom rule for this garment only' },
  fitRuleGarmentCount: { th: 'สินค้าที่ใช้กฎนี้', en: 'Garments using this rule' },
  fitRuleDeleteConfirm: { th: 'ลบกฎนี้? สินค้าที่ใช้อยู่จะกลับไปใช้ทรงมาตรฐาน', en: 'Delete this rule? Garments using it revert to their built-in profile.' },
  fitRuleNone: { th: 'ยังไม่มีกฎของร้าน', en: 'No shop rules yet' },
  fitRuleBuiltIn: { th: 'ทรงมาตรฐาน', en: 'Built-in profiles' },
  fitRuleShopRules: { th: 'กฎของร้าน', en: 'Shop rules' },
  cancel: { th: 'ยกเลิก', en: 'Cancel' },
  delete: { th: 'ลบ', en: 'Delete' },
  edit: { th: 'แก้ไข', en: 'Edit' },
```

> Thai copy here is placeholder wording, shipped as-is per the founder's 2026-08-10 decision (spec §10.1). Replacing it later is a one-file edit — no code change.

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit
```

```bash
git add lib/i18n/strings.ts && git commit -m "feat(i18n): strings for fit rule management"
```

---

## Task 10: Ruleset CRUD API

**Files:**
- Create: `app/api/fit-rulesets/route.ts`
- Create: `app/api/fit-rulesets/[id]/route.ts`

Both mirror the auth-guard and error shape of `app/api/garments/[id]/route.ts`. Ownership is enforced by RLS *and* by an explicit `.eq('retailer_id', user.id)` — belt and braces, matching the existing garment route.

- [ ] **Step 1: Create the collection route**

Create `app/api/fit-rulesets/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { FitRulesetSchema, RulesetNameSchema, firstIssueMessage } from '@/lib/fit/rule-schema';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('fit_rulesets')
    .select('id, name, rule, created_at')
    .eq('retailer_id', user.id)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rulesets: data });
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });

  const name = RulesetNameSchema.safeParse(body.name);
  if (!name.success) return NextResponse.json({ error: 'ชื่อกฎไม่ถูกต้อง' }, { status: 400 });

  const rule = FitRulesetSchema.safeParse(body.rule);
  if (!rule.success) {
    return NextResponse.json({ error: firstIssueMessage(rule.error) }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('fit_rulesets')
    .insert({ retailer_id: user.id, name: name.data, rule: rule.data })
    .select('id, name, rule, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ruleset: data });
}
```

- [ ] **Step 2: Create the item route**

Create `app/api/fit-rulesets/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { FitRulesetSchema, RulesetNameSchema, firstIssueMessage } from '@/lib/fit/rule-schema';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });

  const patch: { name?: string; rule?: unknown } = {};

  if (body.name !== undefined) {
    const name = RulesetNameSchema.safeParse(body.name);
    if (!name.success) return NextResponse.json({ error: 'ชื่อกฎไม่ถูกต้อง' }, { status: 400 });
    patch.name = name.data;
  }
  if (body.rule !== undefined) {
    const rule = FitRulesetSchema.safeParse(body.rule);
    if (!rule.success) {
      return NextResponse.json({ error: firstIssueMessage(rule.error) }, { status: 400 });
    }
    patch.rule = rule.data;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'ไม่มีข้อมูลให้แก้ไข' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('fit_rulesets')
    .update(patch)
    .eq('id', params.id)
    .eq('retailer_id', user.id)
    .select('id, name, rule, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });

  return NextResponse.json({ ok: true, ruleset: data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // `on delete set null` on garments.fit_ruleset_id means affected garments
  // silently revert to their built-in fit_profile. No orphans, no broken evals.
  const { error } = await supabase
    .from('fit_rulesets')
    .delete()
    .eq('id', params.id)
    .eq('retailer_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit && npm run build
```

Expected: both PASS.

```bash
git add app/api/fit-rulesets && git commit -m "feat(api): fit ruleset CRUD routes"
```

---

## Task 11: The rule editor

**Files:**
- Create: `app/dashboard/fit-rules/FitRuleEditor.tsx`

This is the component that catches a bad rule before a customer sees it. It is reused verbatim by the garment form in Task 13, so it takes value/onChange props and owns no persistence.

- [ ] **Step 1: Create the component**

```tsx
'use client';
import { useMemo } from 'react';
import { DIMENSIONS } from '@/lib/config/dimensions';
import { EaseRuleSchema } from '@/lib/fit/rule-schema';
import { DEFAULT_RULE } from '@/lib/fit/rules';
import type { EaseRule, FitRuleset } from '@/lib/fit/rules';
import { t } from '@/lib/i18n/strings';

// Matches VERDICT_COLOR in app/shop/[shop_slug]/[garment_id]/FitChecker.tsx
const ZONE_COLOR = {
  too_tight: 'bg-red-200', snug: 'bg-yellow-200',
  good_fit: 'bg-green-200', loose: 'bg-blue-200',
} as const;

const SCALE_MIN = -10, SCALE_MAX = 15;
const pct = (ease: number) =>
  Math.max(0, Math.min(100, ((ease - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100));

function NumberField({ label, value, onChange }: {
  label: string; value: number; onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm text-gray-700">{label}</span>
      <input
        type="number" step="0.5" inputMode="decimal" value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
      />
    </label>
  );
}

/** Horizontal ease scale, coloured into the four verdict zones. */
function Preview({ rule }: { rule: EaseRule }) {
  const zones = [
    { verdict: 'too_tight' as const, from: SCALE_MIN,        to: rule.tightBelow },
    { verdict: 'snug' as const,      from: rule.tightBelow,  to: rule.goodFrom },
    { verdict: 'good_fit' as const,  from: rule.goodFrom,    to: rule.goodTo },
    { verdict: 'loose' as const,     from: rule.goodTo,      to: SCALE_MAX },
  ];
  // Worked example, recomputed as the numbers change: a 96cm chest.
  const body = 96;
  const garmentAtGoodFit = body + (rule.goodFrom + rule.goodTo) / 2;

  return (
    <div className="space-y-2">
      <div className="flex h-6 w-full overflow-hidden rounded border">
        {zones.map(z => (
          <div
            key={z.verdict}
            className={ZONE_COLOR[z.verdict]}
            style={{ width: `${Math.max(0, pct(z.to) - pct(z.from))}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{SCALE_MIN} ซม.</span><span>0</span><span>+{SCALE_MAX} ซม.</span>
      </div>
      <p className="text-sm text-gray-700">
        ลูกค้ารอบอก {body} ซม. + เสื้อ {garmentAtGoodFit.toFixed(1)} ซม. → {t.verdictGood.th}
      </p>
    </div>
  );
}

export default function FitRuleEditor({ value, onChange }: {
  value: FitRuleset;
  onChange: (next: FitRuleset) => void;
}) {
  const base = value.base ?? DEFAULT_RULE;
  const parsed = useMemo(() => EaseRuleSchema.safeParse(base), [base]);
  const error = parsed.success ? null : parsed.error.issues[0]?.message ?? null;

  const setBase = (patch: Partial<EaseRule>) =>
    onChange({ ...value, base: { ...base, ...patch } });

  const setDim = (key: string, rule: EaseRule | null) => {
    const next = { ...value.perDimension } as Record<string, EaseRule>;
    if (rule === null) delete next[key]; else next[key] = rule;
    onChange({ ...value, perDimension: next });
  };

  return (
    <div className="space-y-4">
      <NumberField label={t.fitRuleTightBelow.th} value={base.tightBelow} onChange={n => setBase({ tightBelow: n })} />
      <NumberField label={t.fitRuleGoodFrom.th}   value={base.goodFrom}   onChange={n => setBase({ goodFrom: n })} />
      <NumberField label={t.fitRuleGoodTo.th}     value={base.goodTo}     onChange={n => setBase({ goodTo: n })} />

      <div>
        <p className="mb-1 text-sm font-medium">{t.fitRulePreview.th}</p>
        {parsed.success ? <Preview rule={base} /> : <p className="text-sm text-red-600">{error}</p>}
      </div>

      <details className="rounded border p-3">
        <summary className="cursor-pointer text-sm font-medium">{t.fitRulePerDimension.th}</summary>
        <div className="mt-3 space-y-4">
          {DIMENSIONS.map(d => {
            const dimRule = value.perDimension[d.key];
            return (
              <div key={d.key} className="rounded border p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox" checked={dimRule === undefined}
                    onChange={e => setDim(d.key, e.target.checked ? null : { ...base })}
                  />
                  <span>{d.labelTh} — {t.fitRuleSameAsAbove.th}</span>
                </label>
                {dimRule && (
                  <div className="mt-3 space-y-3">
                    <NumberField label={t.fitRuleTightBelow.th} value={dimRule.tightBelow} onChange={n => setDim(d.key, { ...dimRule, tightBelow: n })} />
                    <NumberField label={t.fitRuleGoodFrom.th}   value={dimRule.goodFrom}   onChange={n => setDim(d.key, { ...dimRule, goodFrom: n })} />
                    <NumberField label={t.fitRuleGoodTo.th}     value={dimRule.goodTo}     onChange={n => setDim(d.key, { ...dimRule, goodTo: n })} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}

/** Whether a ruleset is safe to save. Exported so parents can disable submit. */
export function isRulesetValid(rs: FitRuleset): boolean {
  if (rs.base && !EaseRuleSchema.safeParse(rs.base).success) return false;
  return Object.values(rs.perDimension).every(r => EaseRuleSchema.safeParse(r).success);
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
```

```bash
git add app/dashboard/fit-rules/FitRuleEditor.tsx && git commit -m "feat(dashboard): fit rule editor with live ease preview"
```

---

## Task 12: Preset management page

**Files:**
- Create: `app/dashboard/fit-rules/page.tsx`
- Create: `app/dashboard/fit-rules/FitRulesManager.tsx`
- Modify: `app/dashboard/layout.tsx` (nav link)

- [ ] **Step 1: Create the server page**

`app/dashboard/fit-rules/page.tsx`:

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { t } from '@/lib/i18n/strings';
import FitRulesManager from './FitRulesManager';
import type { FitRulesetRow } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function FitRulesPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // middleware guards this route

  const { data: rulesets } = await supabase
    .from('fit_rulesets')
    .select('id, name, rule, created_at, retailer_id')
    .eq('retailer_id', user.id)
    .order('created_at', { ascending: true });

  // Garment counts, so delete can state what reverts.
  const { data: garments } = await supabase
    .from('garments')
    .select('fit_ruleset_id')
    .eq('retailer_id', user.id);

  const counts: Record<string, number> = {};
  for (const g of garments ?? []) {
    if (g.fit_ruleset_id) counts[g.fit_ruleset_id] = (counts[g.fit_ruleset_id] ?? 0) + 1;
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">{t.fitRules.th}</h1>
      <FitRulesManager initial={(rulesets ?? []) as FitRulesetRow[]} counts={counts} />
    </div>
  );
}
```

- [ ] **Step 2: Create the client manager**

`app/dashboard/fit-rules/FitRulesManager.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FitRuleEditor, { isRulesetValid } from './FitRuleEditor';
import { DEFAULT_RULE } from '@/lib/fit/rules';
import type { FitRuleset } from '@/lib/fit/rules';
import { t } from '@/lib/i18n/strings';
import type { FitRulesetRow } from '@/lib/supabase/types';

const EMPTY: FitRuleset = { base: DEFAULT_RULE, perDimension: {} };

/** One-line plain-language summary, e.g. "พอดีเมื่อกว้างกว่าตัว 1–5 ซม." */
function summarize(rs: FitRuleset): string {
  const b = rs.base ?? DEFAULT_RULE;
  return `พอดีเมื่อกว้างกว่าตัว ${b.goodFrom}–${b.goodTo} ซม.`;
}

export default function FitRulesManager({ initial, counts }: {
  initial: FitRulesetRow[];
  counts: Record<string, number>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; name: string; rule: FitRuleset } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!editing) return;
    setError(null); setBusy(true);
    try {
      const isNew = editing.id === null;
      const res = await fetch(isNew ? '/api/fit-rulesets' : `/api/fit-rulesets/${editing.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editing.name, rule: editing.rule }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === 'string' ? data.error : t.authError.th);
        return;
      }
      setEditing(null);
      router.refresh();
    } catch {
      setError(t.authError.th);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const n = counts[id] ?? 0;
    if (!confirm(`${t.fitRuleDeleteConfirm.th}\n${t.fitRuleGarmentCount.th}: ${n}`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/fit-rulesets/${id}`, { method: 'DELETE' });
      if (!res.ok) { setError(t.authError.th); return; }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    const valid = editing.name.trim() !== '' && isRulesetValid(editing.rule);
    return (
      <div className="space-y-4 rounded border bg-white p-4">
        <label className="block">
          <span className="text-sm text-gray-700">{t.fitRuleName.th}</span>
          <input
            value={editing.name} placeholder={t.fitRuleNamePlaceholder.th} maxLength={60}
            onChange={e => setEditing({ ...editing, name: e.target.value })}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <FitRuleEditor value={editing.rule} onChange={rule => setEditing({ ...editing, rule })} />

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={save} disabled={!valid || busy}
            className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
          >
            {busy ? '…' : t.save.th}
          </button>
          <button onClick={() => { setEditing(null); setError(null); }} className="rounded border px-4 py-2">
            {t.cancel.th}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setEditing({ id: null, name: '', rule: EMPTY })}
        className="rounded bg-gray-900 px-4 py-2 text-white"
      >
        {t.fitRuleNew.th}
      </button>

      {initial.length === 0 && <p className="text-sm text-gray-600">{t.fitRuleNone.th}</p>}

      <ul className="space-y-2">
        {initial.map(r => (
          <li key={r.id} className="flex items-center justify-between rounded border bg-white p-3">
            <div>
              <p className="font-medium">{r.name}</p>
              <p className="text-sm text-gray-600">{summarize(r.rule)}</p>
              <p className="text-xs text-gray-500">{t.fitRuleGarmentCount.th}: {counts[r.id] ?? 0}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing({ id: r.id, name: r.name, rule: r.rule })}
                className="rounded border px-3 py-1 text-sm"
              >
                {t.edit.th}
              </button>
              <button
                onClick={() => remove(r.id)} disabled={busy}
                className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 disabled:opacity-60"
              >
                {t.delete.th}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Add the nav link**

In `app/dashboard/layout.tsx`, add a link to `/dashboard/fit-rules` labelled `{t.fitRulesNav.th}` alongside the existing dashboard navigation. Match the surrounding markup — read the file and follow whatever pattern is already there rather than inventing a new one.

- [ ] **Step 4: Verify and commit**

```bash
npm run build
```

Expected: PASS.

```bash
git add app/dashboard && git commit -m "feat(dashboard): fit rule preset management page"
```

---

## Task 13: Garment form integration

**Files:**
- Modify: `app/dashboard/garment/new/page.tsx`
- Modify: `app/api/garments/route.ts`

- [ ] **Step 1: Accept the new fields in the API**

In `app/api/garments/route.ts`, add after the `fit_profile` read (line 21):

```ts
  const fitRulesetIdRaw = String(form.get('fit_ruleset_id') ?? '').trim();
  const overrideRaw = String(form.get('fit_rule_override') ?? '').trim();
```

Add the import:

```ts
import { FitRulesetSchema, firstIssueMessage } from '@/lib/fit/rule-schema';
```

Add validation after the existing `fit_profile` check (after line 33):

```ts
  // These two are mutually exclusive by construction, not just by convention:
  // an inline override always clears any preset reference.
  let fit_rule_override: unknown = null;
  let fit_ruleset_id: string | null = null;

  if (overrideRaw) {
    const parsed = FitRulesetSchema.safeParse(JSON.parse(overrideRaw));
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 });
    }
    fit_rule_override = parsed.data;
  } else if (fitRulesetIdRaw) {
    if (!z.string().uuid().safeParse(fitRulesetIdRaw).success) {
      return NextResponse.json({ error: 'invalid fit_ruleset_id' }, { status: 400 });
    }
    fit_ruleset_id = fitRulesetIdRaw;
  }
```

Wrap the `JSON.parse` so a malformed body yields a 400 rather than a 500 — replace that one line with:

```ts
    let overrideJson: unknown;
    try { overrideJson = JSON.parse(overrideRaw); }
    catch { return NextResponse.json({ error: 'ข้อมูลกฎไม่ถูกต้อง' }, { status: 400 }); }
    const parsed = FitRulesetSchema.safeParse(overrideJson);
```

Then extend the insert on line 65:

```ts
    .insert({
      retailer_id: user.id, name, category, fit_profile,
      photo_url: publicUrl, measurements,
      fit_ruleset_id, fit_rule_override,
    })
```

- [ ] **Step 2: Load presets in the form**

`app/dashboard/garment/new/page.tsx` is a client component, so fetch presets on mount. Add to the imports:

```ts
import { useEffect } from 'react';
import FitRuleEditor, { isRulesetValid } from '@/app/dashboard/fit-rules/FitRuleEditor';
import { DEFAULT_RULE } from '@/lib/fit/rules';
import type { FitRuleset } from '@/lib/fit/rules';
```

Add state alongside the existing `useState` calls:

```ts
  const [presets, setPresets] = useState<{ id: string; name: string }[]>([]);
  const [useOverride, setUseOverride] = useState(false);
  const [override, setOverride] = useState<FitRuleset>({ base: DEFAULT_RULE, perDimension: {} });

  useEffect(() => {
    fetch('/api/fit-rulesets')
      .then(r => r.ok ? r.json() : { rulesets: [] })
      .then(d => setPresets(d.rulesets ?? []))
      .catch(() => setPresets([]));  // a failed load just means no presets offered
  }, []);
```

- [ ] **Step 3: Replace the fit_profile select with a grouped select**

Replace the whole `<label>` block containing the `fit_profile` select (lines 68–73) with:

```tsx
      <label className="block">
        <span className="text-sm text-gray-700">{t.fitProfile.th}</span>
        <select
          name="fit_profile_or_ruleset" defaultValue="profile:regular"
          disabled={useOverride}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 disabled:opacity-60"
        >
          <optgroup label={t.fitRuleBuiltIn.th}>
            {FIT_PROFILES.map(p => (
              <option key={p.key} value={`profile:${p.key}`}>{p.labelTh}</option>
            ))}
          </optgroup>
          {presets.length > 0 && (
            <optgroup label={t.fitRuleShopRules.th}>
              {presets.map(p => <option key={p.id} value={`preset:${p.id}`}>{p.name}</option>)}
            </optgroup>
          )}
        </select>
      </label>

      <div className="space-y-3 rounded border p-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useOverride} onChange={e => setUseOverride(e.target.checked)} />
          <span>{t.fitRuleOverride.th}</span>
        </label>
        {useOverride && <FitRuleEditor value={override} onChange={setOverride} />}
      </div>
```

- [ ] **Step 4: Split the select value on submit**

In `onSubmit`, after `const form = new FormData(e.currentTarget);`, add:

```ts
      // The grouped select carries one value; split it back into the two
      // mutually exclusive columns the API expects.
      const choice = String(form.get('fit_profile_or_ruleset') ?? 'profile:regular');
      form.delete('fit_profile_or_ruleset');
      if (useOverride) {
        if (!isRulesetValid(override)) { setError(t.authError.th); return; }
        form.set('fit_profile', 'regular');       // required column; the override wins at resolve time
        form.set('fit_rule_override', JSON.stringify(override));
      } else if (choice.startsWith('preset:')) {
        form.set('fit_profile', 'regular');       // fallback if the preset is later deleted
        form.set('fit_ruleset_id', choice.slice('preset:'.length));
      } else {
        form.set('fit_profile', choice.slice('profile:'.length));
      }
```

- [ ] **Step 5: Verify and commit**

```bash
npm run build
```

Expected: PASS.

```bash
git add app/dashboard/garment/new/page.tsx app/api/garments/route.ts && git commit -m "feat(dashboard): garment form accepts shop rules and per-garment overrides"
```

---

## Task 14: Full verification

- [ ] **Step 1: Run the gate**

```bash
npm test && npm run build && npx tsc --noEmit && npm run lint
```

Expected: tests **47 passed (47)**; build, typecheck and lint all clean. Per the project's standing gate, all must be green before anything reaches `main`.

- [ ] **Step 2: Manual smoke test against the live Supabase project**

```bash
npm run dev
```

Walk this path and confirm each step:

1. `/dashboard/fit-rules` → create a preset named "ผ้ายืด" with base `-6 / -4 / 3`. The preview should show a wide green zone extending left of 0.
2. Try to save `goodFrom: 5, goodTo: 5` → save is disabled and an inline reason appears.
3. `/dashboard/garment/new` → the preset appears under "กฎของร้าน". Create a garment with chest 96 using it.
4. Open that garment's public shop page, enter chest 100 → verdict is **พอดี** (`good_fit`). Under the built-in `regular` profile this same input returns `too_tight` — that difference is the whole feature.
5. In Supabase Studio, check the newest `fit_sessions` row: `applied_rule` holds the stretchy ruleset, not a reference to it.
6. Edit the preset to `-1 / 1 / 5`, then re-check that same historical row — `applied_rule` is unchanged. This is the §4.3 guarantee.
7. Delete the preset → the garment still evaluates (falling back to `regular`), no error.

- [ ] **Step 3: Update the resume doc**

In `docs/superpowers/resume.md`: correct the "12 Vitest tests" line under the file map to the new count, add `lib/fit/rules.ts`, `rule-schema.ts` and `resolve.ts` to the file map, and move "Fit engine boundary tests at diff = ±1 and ±5" out of Open follow-ups — Task 6 covers it.

- [ ] **Step 4: Commit and push**

```bash
git add docs/superpowers/resume.md && git commit -m "docs: update resume for custom fit rules"
```

```bash
git push origin main
```

---

## Deliberately not in this plan

Straight from spec §2 and §10 — do not let these creep in:

- Showing the rule or its rationale to the customer. Customers keep seeing verdicts only.
- Retailer analytics on rule performance.
- Machine-assisted calibration from `fit_sessions` history. §4.3 makes it *possible* later; it is not built now.
- **Size labels / size variants (§10.4).** Deferred by founder decision on 2026-08-10, with the deadline intact: decide before onboarding a second retailer, because after that the migration cost is someone else's re-typing.
- PDPA consent for secondary use of measurement data (§10.5).
- Dropping the vestigial `garments_public_read` anon policy (spec §4.2 follow-up).
