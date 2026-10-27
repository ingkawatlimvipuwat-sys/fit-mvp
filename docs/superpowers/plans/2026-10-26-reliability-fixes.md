# Reliability fixes — implementation plan (2026-10-26)

> **MIGRATION FLAG — read first.** Task 8 adds `supabase/migrations/0007_fit_sessions_created_at_idx.sql`.
> It is **optional but recommended**, and it contains **one index and nothing else** (no table, column or
> policy change). The code in this plan works the same with or without it — without it, one count
> query does a full scan of `fit_sessions`, which is cheap while the table is small. So it can be
> applied **before or after** the merge, in any order. The founder applies it by hand; no agent runs SQL.

Branch `feature/reliability-fixes`, worktree `C:\Users\Copter\Documents\Munder logs\worktrees\reliability-fixes`,
cut from `main` `d1817f9`. Baseline: `npm test` = **349 passing, 35 files**.

Scope: resume.md To-do items **#5, #6, #7, #8, #9, #11**. Not in scope: #10, #12, Housekeeping, Stage 3.
Task 0 (docs: key rotation, the 2026-10-26 pause and the founder's restore-by-hand decision, status at
`d1817f9`) is **already done** — commit `3312ef7`.

## Rules for the builder (all tasks)

- Read `/CLAUDE.md` first. Landmines that apply here: **zod `.strict()`**; **never change the
  `lib/fit/rules.ts` ↔ `lib/config/dimensions.ts` import relationship** (no new value import from
  `dimensions.ts` into `rules.ts`); ease boundaries are inclusive-edge — any fit fixture meant to be
  `good_fit` uses garment **97** / customer **100**, never 96/100.
- **Live database, no staging.** No SQL, no dev server, no `curl` / API calls, no form submits.
  Everything here is checked by unit tests and the build.
- Fresh-worktree prep (once): `node_modules` is already installed in this worktree. Copy `.env.local`
  from the main checkout (`C:\Users\Copter\Documents\Claude\Projects\Startup poor fools\fit-mvp\.env.local`)
  into the worktree root before the first build. Never print it, never commit it.
- **One commit per task**, with `git commit -m "..." -- <paths>` (never plain `git commit`). End each
  message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Tests first** in every task: write the listed tests, run them and see them fail, then implement.
- **Gate after every task** (no dev server is running, so the build is safe):
  `npm test && npx next lint && npm run build` — all three green before committing. `tsc` clean is
  not enough (`next lint` rejects unused imports, including type imports in test files).
- Never push `main`, never merge into `main`, never rebase or force-push. Pushing this branch is fine.
- Server-side error messages are **Thai only** and come from `lib/i18n/strings.ts` as `t.<key>.th`.
  Client components pick `t.<key>[lang]`. No English literal may reach a user.
- Do not "improve" anything not listed. If something in this plan turns out not to match the code,
  stop and report rather than redesigning.

---

## Task 1 — all new UI strings, in one commit

**File:** `lib/i18n/strings.ts` only. Add these keys inside the `t` object, in a new block at the end,
just before the closing `} as const;`, under a comment `// --- Reliability fixes (2026-10-26) ---`.
Copy exactly:

```ts
  // --- Reliability fixes (2026-10-26) ---
  // Fit check rate limit (#5)
  fitTooManyChecks: {
    th: 'ตรวจบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
    en: 'Too many checks in a short time. Please wait a minute and try again.',
  },
  // Shop-rule loading in the garment form (#6, #7)
  presetLoading: { th: 'กำลังโหลด…', en: 'Loading…' },
  presetUnavailable: { th: 'กฎของร้าน (โหลดไม่สำเร็จ)', en: 'Shop rule (could not load)' },
  presetRuleStillLoading: {
    th: 'กำลังโหลดกฎของร้าน รอสักครู่แล้วติ๊กอีกครั้ง',
    en: 'Your shop rules are still loading. Wait a moment, then tick this again.',
  },
  presetRuleUnavailable: {
    th: 'โหลดกฎของร้านไม่สำเร็จ จึงเริ่มจากกฎนี้ไม่ได้ รีเฟรชหน้านี้ หรือเลือกทรงมาตรฐานก่อนแล้วติ๊กอีกครั้ง',
    en: 'Could not load your shop rules, so this cannot start from them. Refresh the page, or pick a built-in profile first and tick this again.',
  },
  // Garment validation (#9)
  categoryInvalid: { th: 'ประเภทเสื้อผ้าไม่ถูกต้อง', en: 'Invalid category' },
  fitProfileInvalid: { th: 'ทรงการตัดไม่ถูกต้อง', en: 'Invalid fit profile' },
  sizeLabelInvalid: { th: 'ไซส์ไม่ถูกต้อง', en: 'Invalid size' },
  measurementInvalid: { th: 'ค่าไม่ถูกต้อง: {dim}', en: 'Invalid value: {dim}' },
  requestInvalid: { th: 'ข้อมูลไม่ถูกต้อง', en: 'Invalid request' },
  itemNotFound: { th: 'ไม่พบรายการนี้ อาจถูกลบไปแล้ว', en: 'Not found. It may have been deleted.' },
  picksInvalid: { th: 'ตัวเลือกของสินค้าไม่ถูกต้อง', en: 'Invalid version choices' },
  deleteFailed: { th: 'ลบไม่สำเร็จ กรุณาลองใหม่', en: 'Delete failed. Please try again.' },
  fitRuleOrderGoodFrom: {
    th: 'ค่า "พอดีตั้งแต่" ต้องไม่น้อยกว่าค่า "แน่นเกินไป"',
    en: '"Good fit from" must not be lower than "Too tight".',
  },
  fitRuleOrderGoodTo: {
    th: 'ค่า "ถึง" ต้องมากกว่าค่า "พอดีตั้งแต่"',
    en: '"To" must be greater than "Good fit from".',
  },
  // Colour / fabric save failure (#11)
  colourFabricNotSavedCreate: {
    th: 'บันทึกเสื้อผ้าแล้ว แต่บันทึกสีหรือข้อมูลเนื้อผ้าไม่สำเร็จ กรุณาเปิดแก้ไขแล้วใส่สีและเนื้อผ้าอีกครั้ง',
    en: 'The garment was saved, but its colours or fabric details were not. Open it with Edit and add them again.',
  },
  colourFabricNotSavedEdit: {
    th: 'บันทึกเสื้อผ้าแล้ว แต่บันทึกสีหรือข้อมูลเนื้อผ้าไม่สำเร็จ กรุณากดบันทึกอีกครั้ง',
    en: 'The garment was saved, but its colours or fabric details were not. Press Save again.',
  },
```

(The two `fitRuleOrder*` Thai texts are exactly the messages currently hard-coded in
`lib/fit/rule-schema.ts`, so Thai users see no change.)

**Tests:** none new (no behaviour). **Acceptance:** gate green; 349 tests still pass.
Commit: `feat: strings for reliability fixes`.

---

## Task 2 — #9: no English validation messages on the garment path

The to-do says `parseGarmentFields()` returns English for "four rare paths" — there are five today
(`name required`, `invalid category`, `invalid fit_profile`, `invalid fit_ruleset_id`,
`invalid size_label`). The "raw dimension keys" part of the item is already fixed for measurements
(the parser uses `d.labelTh`), but **zod's own English messages** still reach users through
`firstIssueMessage()` (e.g. `Too big: expected number to be <=50`, `Unrecognized key: "foo_cm"`),
both from the API and inside `FitRuleEditor` on the client. Fix all of it.

### 2a. `lib/fit/rule-schema.ts`

1. Add `import { t } from '@/lib/i18n/strings';` and
   `import { dimensionByKey } from '@/lib/config/dimensions';` (merge with the existing
   `DIMENSIONS` import from the same module). `rule-schema.ts` is not `rules.ts`, so this does not
   touch the circular-import landmine.
2. In `EaseRuleSchema`, change the two refine messages to the **string-key names**:
   `message: 'fitRuleOrderGoodFrom'` (the `goodFrom` refine) and `message: 'fitRuleOrderGoodTo'`
   (the `goodTo` refine). Keep `path` and the predicates unchanged.
3. Add, above `firstIssueMessage`:

```ts
const RULE_MESSAGE_KEYS = ['fitRuleOrderGoodFrom', 'fitRuleOrderGoodTo'] as const;
type RuleMessageKey = (typeof RULE_MESSAGE_KEYS)[number];
const isRuleMessageKey = (m: string): m is RuleMessageKey =>
  (RULE_MESSAGE_KEYS as readonly string[]).includes(m);

/**
 * A rule-validation failure as text for the given language. Our own refine
 * messages are string keys mapped through strings.ts; every other zod issue
 * (range, type, unknown key) becomes the generic fitRuleInvalid, so zod's
 * English never reaches a user. A per-dimension issue names the dimension by
 * its label, never by its raw key.
 */
export function ruleIssueMessage(err: z.ZodError, lang: 'th' | 'en'): string {
  const issue = err.issues[0];
  if (!issue) return t.fitRuleInvalid[lang];
  const text = issue.code === 'custom' && isRuleMessageKey(issue.message)
    ? t[issue.message][lang]
    : t.fitRuleInvalid[lang];
  const dimKey = issue.path[0] === 'perDimension' ? issue.path[1] : undefined;
  const dim = typeof dimKey === 'string' ? dimensionByKey(dimKey) : undefined;
  return dim ? `${text} (${lang === 'th' ? dim.labelTh : dim.labelEn})` : text;
}
```

4. Replace the body of `firstIssueMessage` with `return ruleIssueMessage(err, 'th');` (keep its name
   and signature — two fit-rulesets routes and `parse-form.ts` call it).

### 2b. `app/dashboard/fit-rules/FitRuleEditor.tsx`

Line 78: `const error = parsed.success ? null : ruleIssueMessage(parsed.error, lang);` and import
`ruleIssueMessage` alongside `EaseRuleSchema`. Nothing else in that file changes in this task.

### 2c. `lib/garment/parse-form.ts`

Replace each literal:

| Now | Becomes |
|---|---|
| `'name required'` | `t.garmentNameRequired.th` |
| `'invalid category'` | `t.categoryInvalid.th` |
| `'invalid fit_profile'` | `t.fitProfileInvalid.th` |
| `'ข้อมูลกฎไม่ถูกต้อง'` (bad override JSON) | `t.fitRuleInvalid.th` |
| `'invalid fit_ruleset_id'` | `t.rulesetNotOwned.th` |
| `'invalid size_label'` | `t.sizeLabelInvalid.th` |
| `` `ค่าไม่ถูกต้อง: ${d.labelTh}` `` | `t.measurementInvalid.th.replace('{dim}', d.labelTh)` |

### 2d. Garment routes — `app/api/garments/route.ts` and `app/api/garments/[id]/route.ts`

Only these response bodies change (status codes stay the same):

- `'unauthorized'` → `t.loginRequired.th` (both files, all three handlers).
- `'ข้อมูลไม่ถูกต้อง'` literal → `t.requestInvalid.th` (both files).
- POST: `'product_id is required'`, `'invalid product_id'`, `'invalid copy_from'` → `t.requestInvalid.th`.
- POST: `{ error: product.error }` → `{ error: product.status === 404 ? t.itemNotFound.th : product.error }`;
  same pattern for `{ error: own.error }` (`own.status === 404`). PATCH: same for `product.error`.
  (Do **not** change `fail404` in `lib/catalogue/ownership.ts` — `ProductTags.tsx` matches on the
  raw `'not found'` code from other routes.)
- POST and PATCH: `{ error: picksParse.error }` stays, but in `lib/catalogue/parse.ts`
  `parsePicksField` returns `t.picksInvalid.th` instead of `'invalid picks'` (all four places).
- PATCH and DELETE: `'not found'` → `t.itemNotFound.th`.
- DELETE: `{ error: delErr.message }` → log it (`console.error('garment delete failed:', delErr)`)
  and return `{ error: t.deleteFailed.th }` with status 500.

### Tests first

`lib/garment/parse-form.test.ts`:
- Update line 34's expectation to `{ ok: false, error: t.garmentNameRequired.th }` (import `t`).
- New: `category: 'hat'` → error `t.categoryInvalid.th`; `fit_profile: 'nonsense'` →
  `t.fitProfileInvalid.th`; `fit_ruleset_id: 'not-a-uuid'` → `t.rulesetNotOwned.th`;
  `size_label: 'XXXL-weird'` → `t.sizeLabelInvalid.th`; `chest_cm: '0'` → `'ค่าไม่ถูกต้อง: รอบอก'`;
  `fit_rule_override: '{not json'` → `t.fitRuleInvalid.th`.
- New: `fit_rule_override` = `JSON.stringify({ base: { tightBelow: 0, goodFrom: -1, goodTo: 5 }, perDimension: {} })`
  → error `t.fitRuleOrderGoodFrom.th`.
- New, a sweep: for every failing case above, `expect(error).not.toMatch(/[A-Za-z]/)` (Thai text has
  no Latin letters; this is the regression net for the whole item).

New file `lib/fit/rule-schema.test.ts`:
- `ruleIssueMessage(EaseRuleSchema.safeParse({ tightBelow: 0, goodFrom: -1, goodTo: 5 }).error!, 'en')`
  === `t.fitRuleOrderGoodFrom.en`; same input with `'th'` === `t.fitRuleOrderGoodFrom.th`.
- `{ tightBelow: 0, goodFrom: 3, goodTo: 3 }` → `t.fitRuleOrderGoodTo.en`.
- `{ tightBelow: 0, goodFrom: 1, goodTo: 60 }` (range) → exactly `t.fitRuleInvalid.en`.
- `FitRulesetSchema.safeParse({ perDimension: { chest_cm: { tightBelow: 0, goodFrom: 1, goodTo: 60 } } })`
  → `ruleIssueMessage(..., 'en')` === `` `${t.fitRuleInvalid.en} (Chest)` `` and the `'th'` version
  ends with `(รอบอก)`.
- `FitRulesetSchema.safeParse({ perDimension: { foo_cm: {...valid} } })` → `t.fitRuleInvalid.th`,
  and the message does not contain `foo_cm`.
- `firstIssueMessage(err)` equals `ruleIssueMessage(err, 'th')` for one of the above.

**Acceptance:** gate green; `grep -n "error: '[a-z]" app/api/garments lib/garment/parse-form.ts` finds nothing.
Commit: `fix: Thai validation messages on the garment path (no zod English, no raw keys)`.

---

## Task 3 — #8: `strandedDimensions()` compares against the garment's original state

Problem: the form seeds `measurements` from the stored bag. If `dimensions.ts` ever moves a dimension
out of a category, a stored value for it is "stranded" even though the retailer changed nothing, and
the confirm says *"Changing category will discard…"*. Fix: a value the garment's **original** category
already did not hold, and that the retailer has not touched in this session, is not theirs to lose by
this save — do not warn about it.

### `lib/garment/form-fields.ts`

Change the signature (the third parameter is optional so existing callers and tests still compile):

```ts
export interface MeasurementBaseline {
  /** The category the form opened with. */
  category: Category;
  /** The measurements the form opened with (seeded strings). */
  measurements: Record<string, string>;
}

export function strandedDimensions(
  measurements: Record<string, string>,
  category: Category,
  baseline?: MeasurementBaseline,
): string[]
```

Rule: key `k` is stranded when its trimmed value is non-empty, `k` is not a dimension of `category`,
**and not** all of: `baseline` given, `k` is not a dimension of `baseline.category`, and
`(baseline.measurements[k] ?? '').trim() === (measurements[k] ?? '').trim()`.
Update the doc comment to say this.

### `app/dashboard/garment/GarmentForm.tsx`

- Add, next to `initialSnapshot`:
  `const [baseline] = useState<MeasurementBaseline>(() => ({ category: initial?.category ?? 'top', measurements: seedMeasurements(initial?.measurements) }));`
- Line 227: `strandedDimensions(measurements, category, baseline)`. Import the type with `import type`.

### Tests first (`lib/garment/form-fields.test.ts`, in the existing `describe('strandedDimensions')`)

- Unchanged-from-seed value outside the original category (simulates a dimension moved out by
  `dimensions.ts`): `strandedDimensions({ chest_cm: '97' }, 'bottom', { category: 'bottom', measurements: { chest_cm: '97' } })` → `[]`.
- Same, but the retailer edited it: measurements `{ chest_cm: '98' }`, baseline `{ chest_cm: '97' }`, category bottom/bottom → `['chest_cm']`.
- Real category change: `strandedDimensions({ chest_cm: '97' }, 'bottom', { category: 'top', measurements: { chest_cm: '97' } })` → `['chest_cm']`.
- Typed this session in another category, original had nothing: `({ chest_cm: '97', hip_cm: '95' }, 'bottom', { category: 'top', measurements: {} })` → `['chest_cm']`.
- Whitespace-only differences count as unchanged: measurements `{ chest_cm: ' 97 ' }`, baseline `{ chest_cm: '97' }`, bottom/bottom → `[]`.
- The three existing tests (no baseline) still pass unchanged.

**Acceptance:** gate green. Commit: `fix: stranded-measurement warning only blames changes the retailer made`.

---

## Task 4 — #6: a failed preset load shows an error, not `…` forever

### New file `lib/fit/preset-options.ts` (pure, no React)

```ts
import { DEFAULT_RULE } from '@/lib/fit/rules';
import type { FitRuleset } from '@/lib/fit/rules';

export type PresetOption = { id: string; name: string; rule: FitRuleset };
export type PresetsStatus = 'loading' | 'ready' | 'failed';
/** A select option; `placeholder` marks a stand-in for a preset not in the loaded list. */
export type PresetSelectOption = PresetOption & { placeholder?: 'loading' | 'unavailable' };

/**
 * The shop-rule options for the garment form's select. When the garment's own
 * preset is not in the loaded list, a stand-in keeps the select showing the
 * garment's real rule: 'loading' while the fetch is in flight, 'unavailable'
 * once it has failed or finished without it. A stand-in is display-only and
 * must never be used as a seed source (its rule is a dummy).
 */
export function presetOptionsFor(
  presets: PresetOption[],
  initialChoice: string | undefined,
  status: PresetsStatus,
): PresetSelectOption[]
```

Behaviour: start from a copy of `presets`. If `initialChoice` starts with `preset:` and that id is not in
the list, `unshift` `{ id, name: '', rule: { base: DEFAULT_RULE, perDimension: {} }, placeholder: status === 'loading' ? 'loading' : 'unavailable' }`.

### `app/dashboard/garment/GarmentForm.tsx`

- Delete the local `type PresetOption` and import `PresetOption`, `PresetsStatus`, `presetOptionsFor`
  from the new module.
- Add `const [presetsStatus, setPresetsStatus] = useState<PresetsStatus>('loading');`
- Replace the fetch effect with:

```ts
useEffect(() => {
  fetch('/api/fit-rulesets')
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(d => { setPresets(Array.isArray(d?.rulesets) ? d.rulesets : []); setPresetsStatus('ready'); })
    .catch(() => setPresetsStatus('failed'));
}, []);
```

- Replace the `presetOptions` `useMemo` body with
  `presetOptionsFor(presets, initial?.ruleChoice, presetsStatus)` (deps `[presets, initial?.ruleChoice, presetsStatus]`).
- In the `<option>` map: label is `p.placeholder === 'loading' ? t.presetLoading[lang] : p.placeholder === 'unavailable' ? t.presetUnavailable[lang] : p.name`.
- Directly after the fit-profile `<select>` (inside its `<label>`), render
  `{presetsStatus === 'failed' && <span className="mt-1 block text-sm text-red-600">{t.fitRulesLoadFailed[lang]}</span>}`
  (reuses the existing "could not load your shop rules, please refresh" string).
- Saving is unchanged: `ruleChoice` state still holds the real `preset:<id>`, so a save during or after
  a failed load keeps the garment's preset (this is the existing behaviour and must stay).

### Tests first — new file `lib/fit/preset-options.test.ts`

- `presetOptionsFor([], 'preset:A', 'loading')` → one option, id `A`, `placeholder: 'loading'`.
- same with `'failed'` → `placeholder: 'unavailable'`; with `'ready'` → `'unavailable'`.
- loaded list contains `A` → returned list equals the input list, no placeholder.
- `initialChoice` `'profile:slim'` or `undefined` → list unchanged.
- input array is not mutated (compare to a copy).

**Acceptance:** gate green. Commit: `fix: garment form says when shop rules failed to load`.

---

## Task 5 — #7: a new override starts from the rule in force (edit and duplicate too)

Already partly fixed (UX audit D3 added `seedOverrideFrom`), but **still broken in edit mode and on
Duplicate**: the checkbox handler seeds only when `!initial?.override`, and
`ruleSelectionForGarment()` always returns a non-null `override` (`blankOverride()`), so for any
existing garment the seed never runs and the editor opens on `DEFAULT_RULE` — a `slim` garment silently
starts at regular's numbers. Also, a preset-backed garment whose presets have not loaded (or failed)
seeds from `DEFAULT_RULE` silently.

### New file `lib/fit/override-seed.ts` (pure)

Move `seedOverrideFrom` out of `GarmentForm.tsx` into this file, keep its doc comment, and change it
to return `FitRuleset | null`: when `choice` is `preset:<id>` and no preset in the list has that id,
return `null` (never fall back to `DEFAULT_RULE`). Callers must pass only the real loaded `presets`
state, never `presetOptions` (which may contain a placeholder). Also export:

```ts
/**
 * Whether ticking "custom rule" should seed the editor from the rule in force.
 * Not when the garment already had an override in force when the form opened
 * (that stored override is already in state), and not when the retailer has
 * edited the override this session (toggling off and on must keep their edits).
 */
export function shouldSeedOverride(on: boolean, hadOverrideInForce: boolean, editedThisSession: boolean): boolean {
  return on && !hadOverrideInForce && !editedThisSession;
}
```

Imports: `DEFAULT_RULE` (value) and `FitRuleset` (type) from `@/lib/fit/rules`, `fitProfileByKey` from
`@/lib/config/fit-profiles`, `PresetOption` type from `@/lib/fit/preset-options`.

### `app/dashboard/garment/GarmentForm.tsx`

- Remove the local `seedOverrideFrom`; import `seedOverrideFrom`, `shouldSeedOverride`.
- Add `const [overrideNotice, setOverrideNotice] = useState<string | null>(null);`
- Rewrite the checkbox `onChange` to this order:

```ts
onChange={e => {
  const on = e.target.checked;
  const priorChoice = ruleChoice; // before any preset->profile reassignment (keep the existing comment)
  setOverrideNotice(null);
  if (shouldSeedOverride(on, initial?.useOverride ?? false, editedOverrideRef.current)) {
    const seed = seedOverrideFrom(priorChoice, presets);
    if (seed === null) {
      // The preset's numbers are not available: refuse rather than start from the default rule.
      setOverrideNotice(presetsStatus === 'loading' ? t.presetRuleStillLoading[lang] : t.presetRuleUnavailable[lang]);
      return; // checkbox stays unticked (controlled)
    }
    setOverride(seed);
  }
  setUseOverride(on);
  if (on && priorChoice.startsWith('preset:')) {
    setRuleChoice(`profile:${initial?.profileKey ?? 'regular'}`);
  }
}}
```

  Keep the existing explanatory comments (spec §6.1 preset drop, D3) next to the matching lines;
  update the D3 comment to say the condition is "the override in force when the form opened", not
  "a stored override exists".
- Render `{overrideNotice && <p className="text-sm text-red-600">{overrideNotice}</p>}` directly after
  the checkbox `<label>` inside the override box.
- Also clear the notice when the fit-profile select changes: its `onChange` becomes
  `e => { setRuleChoice(e.target.value); setOverrideNotice(null); }`.

### Tests first — new file `lib/fit/override-seed.test.ts`

- `seedOverrideFrom('profile:slim', [])` deep-equals
  `{ base: fitProfileByKey('slim').ruleset.base ?? DEFAULT_RULE, perDimension: fitProfileByKey('slim').ruleset.perDimension }`,
  and differs from `{ base: DEFAULT_RULE, perDimension: {} }` (guards the actual bug: slim ≠ regular).
- `seedOverrideFrom('profile:regular', [])` → `base` deep-equals `DEFAULT_RULE`.
- bare legacy key `seedOverrideFrom('relaxed', [])` → relaxed's ruleset (existing behaviour).
- `seedOverrideFrom('preset:A', [{ id: 'A', name: 'x', rule: STRETCHY_RULESET }])` → that rule's
  base/perDimension (use `{ base: { tightBelow: -6, goodFrom: -4, goodTo: 3 }, perDimension: {} }`).
- preset with no `base` → `base` filled with `DEFAULT_RULE`, source object not mutated.
- `seedOverrideFrom('preset:A', [])` → `null`.
- `shouldSeedOverride`: `(true,false,false)` → true; `(true,true,false)` → false; `(true,false,true)` → false; `(false,false,false)` → false.
- **The bug itself:** build `const sel = ruleSelectionForGarment({ fit_profile: 'slim', fit_ruleset_id: null, fit_rule_override: null })`
  and assert `shouldSeedOverride(true, sel.useOverride, false) === true` (the old condition,
  `!sel.override`, was false here). Check `GarmentRuleFields` in `lib/fit/resolve.ts` for the exact field
  names before writing the object.

**Acceptance:** gate green. Commit: `fix: per-garment override starts from the rule in force on edit and duplicate`.

---

## Task 6 — #11: a colour or fabric save failure reaches the user

Today both garment routes `console.error` a failed `garment_colours` / `garment_fabric` write and still
answer `{ ok: true }`. The garment row itself **is** saved, so this must not become a plain error:
on create, re-pressing Save would make a second garment (and Rule 4 would then block it as duplicate
picks). Design: the route still answers 200, but adds a machine-readable warning; the form tells the
retailer in their language.

### New file `lib/garment/save-outcome.ts` (pure; importable by routes and the client)

```ts
/** Sent as `warning` in a 200 garment-save response when the garment saved but colours/fabric did not. */
export const COLOUR_FABRIC_NOT_SAVED = 'colour_fabric_not_saved';

export type SaveOutcome = 'done' | 'warn_and_leave' | 'warn_and_stay';

/**
 * What the form does after a 2xx save. Create (incl. duplicate) must leave the
 * form even on a warning — a second Save would create a second garment. Edit
 * stays, keeping the typed colours/fabric in the form, so pressing Save again
 * (a full, idempotent PATCH) retries them.
 */
export function saveOutcome(isEdit: boolean, body: unknown): SaveOutcome {
  const warned = typeof body === 'object' && body !== null
    && (body as { warning?: unknown }).warning === COLOUR_FABRIC_NOT_SAVED;
  if (!warned) return 'done';
  return isEdit ? 'warn_and_stay' : 'warn_and_leave';
}
```

### Routes

`app/api/garments/route.ts` (POST): add `let sideWriteFailed = false;` before the colours block; in
each of the two `if (error) console.error(...)` lines, also set `sideWriteFailed = true` (keep the log
lines, change "(non-fatal)" to "(reported to the user)"). Final response:
`NextResponse.json(sideWriteFailed ? { ok: true, id: row.id, warning: COLOUR_FABRIC_NOT_SAVED } : { ok: true, id: row.id })`.

`app/api/garments/[id]/route.ts` (PATCH): same flag, set on **every** failed colour/fabric write: the
colours delete, the colours insert, the fabric delete, the fabric update, the fabric insert. Final:
`NextResponse.json(sideWriteFailed ? { ok: true, warning: COLOUR_FABRIC_NOT_SAVED } : { ok: true })`.
Do **not** touch the photo-cleanup lines after the fabric block, the "explicit insert-or-update, not
upsert" fabric logic, or the `present` checks (decisions-and-lessons §4).

### `app/dashboard/garment/GarmentForm.tsx` (`onSubmit`, after `if (!res.ok) {...}`)

```ts
const body = await res.json().catch(() => ({}));
const outcome = saveOutcome(isEdit, body);
if (outcome === 'warn_and_stay') { setError(t.colourFabricNotSavedEdit[lang]); return; }
if (outcome === 'warn_and_leave') window.alert(t.colourFabricNotSavedCreate[lang]);
router.push(...); router.refresh();   // existing lines
```

(`window.alert` is the accepted MVP style, decisions-and-lessons §2.) `finally { setLoading(false) }`
already covers the early return.

### Tests first — new file `lib/garment/save-outcome.test.ts`

- `saveOutcome(false, { ok: true, id: 'x' })` → `'done'`; `saveOutcome(true, { ok: true })` → `'done'`.
- `saveOutcome(false, { ok: true, warning: COLOUR_FABRIC_NOT_SAVED })` → `'warn_and_leave'`.
- `saveOutcome(true, { ok: true, warning: COLOUR_FABRIC_NOT_SAVED })` → `'warn_and_stay'`.
- `null`, `'text'`, `{}`, `{ warning: 'other' }` → `'done'`.
- `COLOUR_FABRIC_NOT_SAVED === 'colour_fabric_not_saved'` (pins the wire value).

**Acceptance:** gate green; `grep -n "non-fatal" app/api/garments` finds nothing.
Commit: `fix: tell the retailer when colours or fabric did not save`.

---

## Task 7 — #5 part 1: rate-limit and write-gate logic (pure lib, no route change yet)

### Design (why it looks like this)

Vercel functions do not share memory, there is no Redis, and the founder wants no paid service. The
real harm from abuse is **database growth** (each call inserts a `fit_sessions` row; the free plan
caps the database at 500 MB) more than the verdict itself. So:

1. **Per-IP limiter, in memory, per instance** — 30 checks per IP per minute, then HTTP 429. Defence
   in depth only: each instance counts separately and a cold start resets it. Real shoppers make a few
   checks a minute; 30 leaves room for several shoppers behind one mobile-carrier IP.
2. **Duplicate skip** — if the same shopper token's latest session for this garment has the same
   measurements and is under 10 minutes old, return the verdict but do not insert.
3. **Global write cap, enforced by the database** — count `fit_sessions` rows created in the last
   10 minutes (works across all instances). At 120 or more, return the verdict but do not insert. This
   bounds growth to at most ~17,000 rows a day no matter how many machines attack. One shop's real
   traffic is far below it.
4. **Bounded token** — a `customer_token` that is not 1–64 of `[A-Za-z0-9-]` is stored as null (the
   app's own tokens are 36-character UUIDs). Without this one request could store megabytes.

Shoppers always get their verdict except under (1). Every gate **fails open**: if a gate's query
errors, the row is inserted as before, because a broken gate must never break the fit checker.

### New file `lib/rate-limit.ts`

```ts
export interface LimitResult { allowed: boolean; retryAfterSec: number }

/**
 * Fixed-window counter per key, held in this server instance's memory only.
 * Instances do not share it and a cold start empties it, so it is a speed
 * bump, not a guarantee. Memory is bounded: at maxKeys, expired windows are
 * dropped, and if that is not enough the map is cleared (fails open).
 */
export function createFixedWindowLimiter(opts: {
  limit: number; windowMs: number; maxKeys?: number; now?: () => number;
}): { hit(key: string): LimitResult; size(): number }

/** The caller's IP as Vercel reports it: first x-forwarded-for entry, else x-real-ip, else 'unknown'. Never logged or stored. */
export function clientIpFrom(headers: Headers): string
```

Implementation (exact semantics): `maxKeys` default 5000, `now` default `Date.now`. A `Map<string, { count: number; resetAt: number }>`.
On `hit(key)`: `t = now()`; take the entry; if none or `entry.resetAt <= t`, then — only when adding a
*new* key and `size >= maxKeys` — delete every entry with `resetAt <= t`, and if still `>= maxKeys`
`clear()` — then set `{ count: 0, resetAt: t + windowMs }`. Increment `count`. If `count > limit` return
`{ allowed: false, retryAfterSec: Math.max(1, Math.ceil((resetAt - t) / 1000)) }`, else
`{ allowed: true, retryAfterSec: 0 }`.

### New file `lib/fit/session-gate.ts`

```ts
import type { MeasurementBag } from '@/lib/supabase/types';

export const EVALUATE_PER_IP_PER_MINUTE = 30;
export const SESSION_WRITE_WINDOW_MS = 10 * 60_000;
export const SESSION_WRITE_CAP = 120;           // rows across the whole app per window
export const DUPLICATE_WINDOW_MS = 10 * 60_000;

export type WriteDecision = 'insert' | 'skip_duplicate' | 'skip_cap';

/** A token we are willing to store: 1–64 of [A-Za-z0-9-] after trimming, else null. */
export function normaliseCustomerToken(raw: unknown): string | null

/** Same keys and same numbers. `stored` comes from the database, so it is checked, not trusted. */
export function sameMeasurements(a: MeasurementBag, stored: unknown): boolean

/**
 * recentCount: rows in the last SESSION_WRITE_WINDOW_MS, or null if the count failed (fail open).
 * last: this token's latest session for this garment, or null (none, no token, or the read failed).
 */
export function decideSessionWrite(input: {
  recentCount: number | null;
  last: { customer_measurements: unknown; created_at: string } | null;
  measurements: MeasurementBag;
  now: number;
}): WriteDecision
```

`decideSessionWrite` order: (1) if `last` and `sameMeasurements(measurements, last.customer_measurements)`
and `Date.parse(last.created_at)` is finite and `now - that < DUPLICATE_WINDOW_MS` → `'skip_duplicate'`;
(2) if `recentCount !== null && recentCount >= SESSION_WRITE_CAP` → `'skip_cap'`; (3) `'insert'`.
`sameMeasurements`: `stored` must be a non-null, non-array object; key sets equal (same size, every key
of `a` present); every value `=== a[k]`.

### Tests first

`lib/rate-limit.test.ts` (inject a fake clock `let now = 0; const clock = () => now;`):
- limit 3: hits 1–3 allowed, hit 4 refused with `retryAfterSec` 60 (windowMs 60_000 at t=0).
- at `now = 59_000` hit refused with `retryAfterSec` 1; at `now = 60_000` allowed again (new window).
- two keys counted separately.
- `maxKeys: 2`: keys a, b at t=0; at t=60_000 key c → expired a, b are pruned, `size()` = 1.
- `maxKeys: 2`, none expired: a, b at t=0, c at t=1 → map cleared then c added, `size()` = 1, c allowed.
- `clientIpFrom(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))` → `'1.2.3.4'`;
  only `x-real-ip: 5.6.7.8` → `'5.6.7.8'`; none → `'unknown'`; `x-forwarded-for: '  '` with
  `x-real-ip` → the real-ip value.

`lib/fit/session-gate.test.ts`:
- `normaliseCustomerToken`: a `crypto.randomUUID()` → itself; `'  abc  '` → `'abc'`; `''`, `'   '`,
  `undefined`, `42`, `'a'.repeat(65)`, `'has space'`, `'<script>'` → `null`; `'a'.repeat(64)` → itself.
- `sameMeasurements`: equal bags → true; extra key either side → false; one value differs → false;
  `null`, `[]`, `'x'` stored → false; `{}` vs `{}` → true.
- `decideSessionWrite` (use `now = Date.parse('2026-10-26T10:00:00Z')`, measurements `{ chest_cm: 100 }`):
  - no last, count 0 → `insert`; count 119 → `insert`; count 120 → `skip_cap`; count null → `insert`.
  - last same measurements 9 min 59 s ago → `skip_duplicate` (even with count 500);
    exactly 10 min ago → `insert`; different measurements 1 min ago → `insert`;
    last with `created_at: 'garbage'` → `insert`.

**Acceptance:** gate green. Commit: `feat: per-instance rate limiter and fit-session write gate (pure)`.

---

## Task 8 — #5 part 2: wire the gates into `/api/fit/evaluate`; shopper message; optional index

### `app/api/fit/evaluate/route.ts`

- Module level (not exported): `const ipLimiter = createFixedWindowLimiter({ limit: EVALUATE_PER_IP_PER_MINUTE, windowMs: 60_000 });`
- `Body` becomes `.strict()` (the only client, `FitChecker.tsx`, sends exactly these three keys —
  verify before changing). `customer_token` stays `z.string().optional()`; it is normalised, not rejected,
  so an odd old token never breaks a shopper's check.
- First lines of `POST`, before reading the body:

```ts
const limit = ipLimiter.hit(clientIpFrom(req.headers));
if (!limit.allowed) {
  return NextResponse.json(
    { error: t.fitTooManyChecks.th, code: 'rate_limited' },
    { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
  );
}
```

- Replace the insert block (from `const { error: insErr } ...` to its `console.error`) with:

```ts
const token = normaliseCustomerToken(customer_token);
const now = Date.now();
const since = new Date(now - SESSION_WRITE_WINDOW_MS).toISOString();
const [countRes, lastRes] = await Promise.all([
  supabase.from('fit_sessions').select('id', { count: 'exact', head: true }).gte('created_at', since),
  token
    ? supabase.from('fit_sessions')
        .select('customer_measurements, created_at')
        .eq('customer_token', token).eq('garment_id', garment_id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
    : Promise.resolve({ data: null, error: null }),
]);
if (countRes.error) console.error('fit_sessions count failed; not capping:', countRes.error.message);
if (lastRes.error) console.error('fit_sessions last-session read failed; not de-duplicating:', lastRes.error.message);

const decision = decideSessionWrite({
  recentCount: countRes.error ? null : (countRes.count ?? null),
  last: lastRes.error ? null : (lastRes.data ?? null),
  measurements: cleanCustomer,
  now,
});
if (decision === 'insert') {
  const { error: insErr } = await supabase.from('fit_sessions').insert({
    garment_id,
    customer_token: token,
    customer_measurements: cleanCustomer,
    result,
    // (keep the existing applied_rule comment)
    applied_rule: ruleset,
  });
  if (insErr) console.error('fit_sessions insert failed (non-fatal):', insErr.message);
} else if (decision === 'skip_cap') {
  console.warn('fit_sessions write cap reached; verdict returned without saving');
}
```

  Never log the IP or the token. The 400/404 responses stay as they are (the 404's `'garment not found'`
  text is never shown — `FitChecker` shows its own message for any non-OK status).

### `app/shop/[shop_slug]/[garment_id]/FitChecker.tsx`

In `onSubmit`: `if (res.ok) setResult(j.result); else if (res.status === 429) setError(t.fitTooManyChecks[lang]); else setError(t.fitError[lang]);`

### New file `supabase/migrations/0007_fit_sessions_created_at_idx.sql`

```sql
-- 0007: index for the fit-session write cap (reliability fixes, 2026-10-26).
--
-- OPTIONAL BUT RECOMMENDED. Index only: no table, column or policy change.
-- /api/fit/evaluate counts fit_sessions rows from the last 10 minutes before
-- saving a new one. Without this index that count scans the whole table —
-- fine while it is small, slow if it ever grows large. Safe for the live code
-- before or after the merge: it changes no behaviour, only speed.
begin;
create index if not exists fit_sessions_created_at_idx
  on public.fit_sessions (created_at);
commit;
```

### Tests

No route tests exist (no staging DB). The gate logic is covered by Task 7. Write first a new
`lib/fit/migration-0007.test.ts`, copying the `readFileSync(join(process.cwd(), ...))` pattern from
`lib/catalogue/migration.test.ts` (which reads only 0005 and needs no change). Strip `--` comment lines,
lower-case the rest, then assert: it contains `create index if not exists fit_sessions_created_at_idx`;
it contains no `drop `, `alter `, `delete `, `update `, `insert `, `truncate`, `create table` or
`policy`; it starts with `begin;` and ends with `commit;` (after trimming).

**Acceptance:** gate green; `git grep -n "x-forwarded-for\|customer_token" -- app/api/fit/evaluate/route.ts`
shows no `console` line containing either.
Commit: `feat: rate-limit fit checks and cap fit-session writes`.

---

## Task 9 — gates, docs, ship-ready

1. `git fetch origin && git merge origin/main` (merge, never rebase). If it conflicts, stop and report.
2. `npm test && npx next lint && npm run build` — all green. Record the test count.
3. `docs/superpowers/resume.md`:
   - Status snapshot: tests row → new count; note the branch is waiting for the founder's merge.
   - Migrations row: add "0007 (optional index for the fit-session write cap) — **not yet applied**".
   - What's live: add a row "Reliability fixes — **built, not shipped — PR pending** (branch
     `feature/reliability-fixes`; optional migration 0007)" with a one-line summary of the six fixes
     and a link to this plan.
   - To do: delete items 5, 6, 7, 8, 9 and 11; renumber the "Worth doing soon" and "Housekeeping"
     lists continuously. Add under "Worth doing soon": **"English error texts remain in other API
     routes"** — `products`, `folders`, `fit-rulesets` (`'not found'`, `'invalid body'`,
     `'invalid product name'`, `'invalid picker name'`, `error.message` in the fit-rulesets GET); the
     garment path was fixed 2026-10-26. Add under "Before a second shop joins": **"The fit-session write
     cap is app-wide"** — one busy or attacked shop stops session saving (not verdicts) for all shops;
     make it per-shop before a second shop joins.
   - Remove the stale "API | map raw dimension keys" row from "Known deferred-polish items".
4. `docs/superpowers/decisions-and-lessons.md` §4:
   - Replace the bullet "**Colour and fabric writes log and continue on failure** …" with: colour and
     fabric writes still do not fail the garment save (the garment row is already written), but since
     2026-10-26 the route returns `warning: 'colour_fabric_not_saved'`; create alerts and leaves (a
     second Save would make a duplicate garment), edit stays on the form so Save retries.
   - Add: "**`/api/fit/evaluate` is rate-limited in three layers (2026-10-26).**" — per-IP 30/min in
     memory (per instance, a speed bump only), duplicate skip (same token + garment + measurements
     within 10 min), and an app-wide write cap (120 `fit_sessions` rows per 10 min, counted in the
     database). The verdict is always returned except on 429; gates fail open. What it does not stop:
     a many-IP flood still costs function invocations and database reads, and can crowd out real
     shoppers' session saves (not their verdicts) while it lasts. Under a real attack, turn on Vercel's
     Attack Challenge Mode (Vercel dashboard → project → Firewall).
   - In §2 or §4, add: refine messages in `rule-schema.ts` are **string keys**, mapped by
     `ruleIssueMessage()`; never put display text in a zod message again.
5. Commit the docs: `docs: record reliability fixes` with `-- docs/superpowers/resume.md docs/superpowers/decisions-and-lessons.md`.
6. `git push -u origin feature/reliability-fixes` (or plain `git push origin feature/reliability-fixes`).
7. Report: head sha, test count, gate results, the PR link
   `https://github.com/ingkawatlimvipuwat-sys/fit-mvp/compare/main...feature/reliability-fixes?expand=1`,
   and the founder checklist below.

### Founder checklist (for the report)

**Warning: the preview site uses the live database — saving anything there changes the real shop.**
Use Cancel, not Save, unless noted.

1. Optional, any time: Supabase → **SQL Editor** → **New query** → paste the whole of
   `supabase/migrations/0007_fit_sessions_created_at_idx.sql` → **Run** → expect "Success. No rows returned".
2. Preview → open the shop link → a product → enter measurements → **Check fit**: a verdict appears as
   before. (This saves one fit-check row, exactly as a real shopper would.)
3. Preview → dashboard → open a version whose rule is **Slim** (or a shop rule) → **Edit** → tick
   "Custom rule for this garment only": the numbers shown must be Slim's (or that shop rule's), not
   −1 / 1 / 5. Press **Cancel** and confirm leaving.
4. Same form: change Category from Top to Bottom with a chest value filled in → press Save → the
   "Changing category will discard…" question must still appear → press **Cancel** in that question,
   then **Cancel** the form.
5. Not testable by hand (needs a forced failure): the preset-load error, the colour/fabric warning,
   the 429 message and the Thai validation messages. They are covered by unit tests.

---

## Risks for the builder

- **`initial.override` is never null** for an existing garment — that is the #7 bug. Use
  `initial?.useOverride`, not `initial?.override`, in the seeding condition.
- Pass the loaded `presets` state (never `presetOptions`) to `seedOverrideFrom`; a placeholder has a
  dummy rule.
- `ProductTags.tsx` matches raw `'not found'` from other routes — do not change `lib/catalogue/ownership.ts`.
- zod 4: the refine `message` is now a key string; `ruleIssueMessage` only maps it for
  `issue.code === 'custom'`. Do not convert these schemas away from `.strict()`.
- The untyped Supabase client means a wrong query shape compiles. Copy the evaluate-route queries
  exactly; `{ count: 'exact', head: true }` returns `count` with `data: null`.
- Thai strings: copy them byte-for-byte; the regex sweep in Task 2 fails on any Latin letter.
- Only one `next build` at a time in this worktree; never with a dev server running.
