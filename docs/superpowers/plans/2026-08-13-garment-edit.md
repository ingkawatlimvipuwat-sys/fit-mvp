# Garment Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a retailer edit an existing garment — name, category, measurements, fit rule and photo — at `/dashboard/garment/[id]/edit`, closing the gap where a fit rule could only ever be attached at creation time.

**Architecture:** The add-garment form is extracted into one `GarmentForm` client component used in `create` and `edit` modes, so the two screens cannot drift. Two new pure modules carry the only genuinely new logic and are unit-tested: `ruleSelectionForGarment()` inverts a garment's three stored rule columns back into form state using the same precedence the fit engine uses, and `parseGarmentFields()` becomes the single shared validator for both `POST` and the new `PATCH /api/garments/[id]`.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind 3, Supabase (Postgres + Storage), zod 4, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-08-13-garment-edit-design.md`

---

## Before you start

Read `/CLAUDE.md`. Three landmines in this codebase will cost you a session each if you rediscover them:

1. **`tsc` clean ≠ build passes.** `next lint` rejects unused imports the typechecker ignores. Run `npm test && npm run build`, both, every time.
2. **`tsc` proves nothing about Supabase results.** The clients are untyped — `.from('garments')` returns `any`. A wrong field shape compiles clean and crashes at runtime for a real customer.
3. **`lib/fit/rules.ts` must import from `lib/config/dimensions.ts` with `import type` only.** A value import the other way creates a runtime cycle that makes `DEFAULT_RULE` undefined at module-init. Do not "tidy" it.

Vitest only discovers `lib/**/*.test.ts` (see `vitest.config.ts`). Tests placed anywhere else will silently not run.

Work on branch `feature/garment-edit`, which already exists and holds the spec commit.

## File structure

| File | Responsibility |
|---|---|
| `lib/fit/rule-selection.ts` | **New, pure.** Stored rule columns → form control state. Mirrors `resolveRuleset()` precedence. |
| `lib/fit/rule-selection.test.ts` | **New.** Precedence, unknown profile key, malformed override, deleted preset. |
| `lib/garment/parse-form.ts` | **New, pure.** The shared definition of "a valid garment", used by `POST` and `PATCH`. No photo, no I/O. |
| `lib/garment/parse-form.test.ts` | **New.** Validation coverage that no route test exists to provide. |
| `lib/i18n/strings.ts` | Modify. New labels, `th` **and** `en` both populated. |
| `app/dashboard/garment/GarmentForm.tsx` | **New.** The form, both modes. The only place form fields are defined. |
| `app/dashboard/garment/new/page.tsx` | Modify. Shrinks to a wrapper. |
| `app/dashboard/garment/[id]/edit/page.tsx` | **New.** Server component: owner-scoped fetch, `notFound()`, render the form. |
| `app/api/garments/route.ts` | Modify. `POST` delegates validation to `parseGarmentFields()`. |
| `app/api/garments/[id]/route.ts` | Modify. New `PATCH`; photo cleanup extracted to a shared helper `DELETE` also uses. |
| `app/dashboard/GarmentCard.tsx` | Modify. `แก้ไข` link beside `ลบ`. |

**Task order matters.** Pure modules first (Tasks 2–3) so the routes and form can import them. `POST` is refactored (Task 4) before the form moves (Task 5) so that if the create path breaks, you know which change did it.

---

### Task 1: UI strings

**Files:**
- Modify: `lib/i18n/strings.ts:58` (after `save`)

Every key gets both `th` and `en`. The dashboard renders `.th` only today — the `en` values exist so that wiring a dashboard language toggle later needs no rework. `edit` (`แก้ไข`) already exists at line 90; reuse it, do not add a duplicate.

- [ ] **Step 1: Add the new keys**

Insert after the `save:` line in the "Garment form" block:

```ts
  editGarment: { th: 'แก้ไขเสื้อผ้า', en: 'Edit garment' },
  garmentMeasurements: { th: 'ขนาดเสื้อผ้า', en: 'Garment measurements' },
  replacePhoto: { th: 'เปลี่ยนรูป', en: 'Replace photo' },
  currentPhoto: { th: 'รูปปัจจุบัน', en: 'Current photo' },
  photoKeepCurrent: { th: 'ไม่เลือกไฟล์ = ใช้รูปเดิม', en: 'Leave empty to keep the current photo' },
  saving: { th: 'กำลังบันทึก…', en: 'Saving…' },
  confirmDropMeasurements: {
    th: 'เปลี่ยนประเภทแล้ว ขนาดต่อไปนี้จะถูกลบ: {dims} — บันทึกต่อไหม?',
    en: 'Changing category will discard these measurements: {dims} — save anyway?',
  },
```

`{dims}` is substituted at call time with a comma-joined list of Thai dimension labels.

> **Note on `garmentMeasurements`:** the current add-garment form labels the garment's own measurements with `t.yourMeasurements` — "ขนาดของคุณ", *your* measurements. That is customer-facing copy on a retailer form, and it is wrong. The shared form uses the new key instead. `yourMeasurements` stays untouched because `FitChecker.tsx` uses it correctly.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`t` is `as const`, so a malformed entry fails here.)

- [ ] **Step 3: Commit**

```bash
git add lib/i18n/strings.ts
git commit -m "feat(i18n): strings for the garment edit form"
```

---

### Task 2: `ruleSelectionForGarment()` — stored columns back to form state

A garment carries three columns: `fit_profile` (always set), `fit_ruleset_id` (nullable), `fit_rule_override` (nullable). The form has one grouped `<select>` and one override checkbox. Edit mode has to invert one into the other.

Precedence must be **identical** to `resolveRuleset()` in `lib/fit/resolve.ts` — override, then preset, then built-in profile. If they diverge, the form shows a retailer one rule while customers are scored under another, with nothing failing loudly.

**Files:**
- Create: `lib/fit/rule-selection.ts`
- Test: `lib/fit/rule-selection.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/fit/rule-selection.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { ruleSelectionForGarment } from './rule-selection';
import { DEFAULT_RULE } from './rules';

const STRETCHY = { tightBelow: -6, goodFrom: -4, goodTo: 3 };
const UUID = '11111111-2222-3333-4444-555555555555';

describe('ruleSelectionForGarment', () => {
  it('shows the built-in profile when there is no preset and no override', () => {
    const sel = ruleSelectionForGarment({
      fit_profile: 'slim', fit_ruleset_id: null, fit_rule_override: null,
    });
    expect(sel).toEqual({
      useOverride: false,
      override: { base: DEFAULT_RULE, perDimension: {} },
      select: 'profile:slim',
    });
  });

  it('shows the preset when one is attached', () => {
    const sel = ruleSelectionForGarment({
      fit_profile: 'regular', fit_ruleset_id: UUID, fit_rule_override: null,
    });
    expect(sel.useOverride).toBe(false);
    expect(sel.select).toBe(`preset:${UUID}`);
  });

  it('an override wins over a preset, matching resolveRuleset precedence', () => {
    const sel = ruleSelectionForGarment({
      fit_profile: 'regular',
      fit_ruleset_id: UUID,
      fit_rule_override: { base: STRETCHY, perDimension: {} },
    });
    expect(sel.useOverride).toBe(true);
    expect(sel.override.base).toEqual(STRETCHY);
  });

  it('leaves the select on the profile while an override is active, so unticking falls back sanely', () => {
    const sel = ruleSelectionForGarment({
      fit_profile: 'relaxed',
      fit_ruleset_id: null,
      fit_rule_override: { base: STRETCHY, perDimension: {} },
    });
    expect(sel.select).toBe('profile:relaxed');
  });

  it('falls back to regular for an unrecognised profile key', () => {
    const sel = ruleSelectionForGarment({
      fit_profile: 'nonsense', fit_ruleset_id: null, fit_rule_override: null,
    });
    expect(sel.select).toBe('profile:regular');
  });

  it('ignores a malformed override and falls through to the preset', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sel = ruleSelectionForGarment({
      fit_profile: 'regular',
      fit_ruleset_id: UUID,
      fit_rule_override: { nonsense: true },
    });
    expect(sel.useOverride).toBe(false);
    expect(sel.select).toBe(`preset:${UUID}`);
    spy.mockRestore();
  });

  it('ignores a malformed override and falls through to the profile when there is no preset', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sel = ruleSelectionForGarment({
      fit_profile: 'slim', fit_ruleset_id: null, fit_rule_override: { goodFrom: 'x' },
    });
    expect(sel.useOverride).toBe(false);
    expect(sel.select).toBe('profile:slim');
    spy.mockRestore();
  });

  it('treats a deleted preset (null id) as no preset', () => {
    // fit_ruleset_id is `on delete set null`, so a deleted preset is already
    // null in the row and customers are already scored under the profile.
    const sel = ruleSelectionForGarment({
      fit_profile: 'regular', fit_ruleset_id: null, fit_rule_override: null,
    });
    expect(sel.select).toBe('profile:regular');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/fit/rule-selection.test.ts`
Expected: FAIL — `Failed to resolve import "./rule-selection"`.

- [ ] **Step 3: Write the implementation**

Create `lib/fit/rule-selection.ts`:

```ts
import { fitProfileByKey } from '@/lib/config/fit-profiles';
import { FitRulesetSchema } from './rule-schema';
import { DEFAULT_RULE } from './rules';
import type { FitRuleset } from './rules';
import type { GarmentRuleFields } from './resolve';

/**
 * What the garment form's rule controls should show for an existing garment.
 * `select` is the grouped <select> value; `override` seeds FitRuleEditor.
 */
export interface RuleSelection {
  useOverride: boolean;
  override: FitRuleset;
  select: string;
}

/** Seed for the editor when the garment has no override of its own. */
const blankOverride = (): FitRuleset => ({ base: DEFAULT_RULE, perDimension: {} });

/**
 * Invert the stored rule columns back into form state.
 *
 * Precedence mirrors resolveRuleset() exactly — override, then preset, then
 * built-in profile — so the form always displays the rule the engine is
 * actually applying. If these two ever disagree, a retailer edits one rule
 * while customers are scored under another and nothing fails loudly.
 *
 * A malformed stored override is ignored here for the same reason
 * resolveRuleset ignores it: the form must not offer to "keep" a rule that is
 * not in force. Pure — no I/O, so the caller does not need the preset's rule,
 * only its id.
 */
export function ruleSelectionForGarment(g: GarmentRuleFields): RuleSelection {
  const selectProfile = `profile:${fitProfileByKey(g.fit_profile).key}`;

  if (g.fit_rule_override != null) {
    const parsed = FitRulesetSchema.safeParse(g.fit_rule_override);
    if (parsed.success) {
      return { useOverride: true, override: parsed.data, select: selectProfile };
    }
    console.error('malformed fit_rule_override; showing fit_profile instead');
  }

  if (g.fit_ruleset_id) {
    return { useOverride: false, override: blankOverride(), select: `preset:${g.fit_ruleset_id}` };
  }

  return { useOverride: false, override: blankOverride(), select: selectProfile };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/fit/rule-selection.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: 55 passing (47 existing + 8 new).

- [ ] **Step 6: Commit**

```bash
git add lib/fit/rule-selection.ts lib/fit/rule-selection.test.ts
git commit -m "feat(fit): invert stored rule columns back into form state"
```

---

### Task 3: `parseGarmentFields()` — one validator for create and edit

`POST` currently validates inline. `PATCH` needs the same rules. Duplicating them is how the two screens would drift — the exact failure this whole feature exists to correct. Extracting also makes the validation testable, which matters because this project has no route tests at all.

**Files:**
- Create: `lib/garment/parse-form.ts`
- Test: `lib/garment/parse-form.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/garment/parse-form.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseGarmentFields } from './parse-form';

// zod 4's z.uuid() enforces the RFC 4122 version and variant nibbles, so a
// made-up 8-4-4-4-12 string is NOT necessarily accepted. This is the canonical
// v4 shape: `4` opening the third group, `8` opening the fourth. A fixture with
// `4` in the variant position fails z.uuid() and makes the preset-id tests look
// like implementation bugs.
const UUID = '11111111-2222-4333-8444-555555555555';
const STRETCHY = { tightBelow: -6, goodFrom: -4, goodTo: 3 };

/** Minimal valid top, with any field overridden or removed (value `null`). */
function form(over: Record<string, string | null> = {}): FormData {
  const base: Record<string, string> = {
    name: 'เสื้อเชิ้ตลินิน', category: 'top', fit_profile: 'regular', chest_cm: '97',
  };
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...base, ...over })) {
    if (v !== null) fd.set(k, v);
  }
  return fd;
}

describe('parseGarmentFields', () => {
  it('accepts a minimal valid garment', () => {
    const r = parseGarmentFields(form());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.name).toBe('เสื้อเชิ้ตลินิน');
    expect(r.data.category).toBe('top');
    expect(r.data.measurements).toEqual({ chest_cm: 97 });
    expect(r.data.fit_ruleset_id).toBeNull();
    expect(r.data.fit_rule_override).toBeNull();
  });

  it('trims the name and rejects a blank one', () => {
    expect(parseGarmentFields(form({ name: '  padded  ' })).ok).toBe(true);
    const r = parseGarmentFields(form({ name: '   ' }));
    expect(r).toEqual({ ok: false, error: 'name required' });
  });

  it('rejects an unknown category', () => {
    expect(parseGarmentFields(form({ category: 'hat' })).ok).toBe(false);
  });

  it('rejects an unknown fit profile', () => {
    expect(parseGarmentFields(form({ fit_profile: 'nonsense' })).ok).toBe(false);
  });

  it('keeps only measurements belonging to the category', () => {
    // hip_cm is a bottom/dress dimension; a top must not carry it.
    const r = parseGarmentFields(form({ hip_cm: '95' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.measurements).toEqual({ chest_cm: 97 });
  });

  it('requires at least one measurement', () => {
    expect(parseGarmentFields(form({ chest_cm: null })).ok).toBe(false);
  });

  it.each(['0', '-5', '301', 'abc'])('rejects the out-of-range measurement %s', v => {
    expect(parseGarmentFields(form({ chest_cm: v })).ok).toBe(false);
  });

  it('accepts a valid preset id', () => {
    const r = parseGarmentFields(form({ fit_ruleset_id: UUID }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.fit_ruleset_id).toBe(UUID);
  });

  it('rejects a preset id that is not a uuid', () => {
    expect(parseGarmentFields(form({ fit_ruleset_id: 'not-a-uuid' })).ok).toBe(false);
  });

  it('lets an override clear the preset — the two are mutually exclusive', () => {
    const r = parseGarmentFields(form({
      fit_ruleset_id: UUID,
      fit_rule_override: JSON.stringify({ base: STRETCHY, perDimension: {} }),
    }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.fit_rule_override?.base).toEqual(STRETCHY);
    expect(r.data.fit_ruleset_id).toBeNull();
  });

  it('treats an absent override as "no override", so editing can turn one off', () => {
    const r = parseGarmentFields(form({ fit_ruleset_id: UUID, fit_rule_override: '' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.fit_rule_override).toBeNull();
    expect(r.data.fit_ruleset_id).toBe(UUID);
  });

  it('rejects an override that is not JSON', () => {
    expect(parseGarmentFields(form({ fit_rule_override: '{oops' })).ok).toBe(false);
  });

  it('REJECTS an override with unknown keys rather than stripping them', () => {
    // Without .strict() zod strips unknown keys, so this would parse
    // "successfully" as an empty ruleset and silently drop every dimension to
    // its default — a wrong verdict, not an error. See /CLAUDE.md.
    expect(parseGarmentFields(form({ fit_rule_override: '{"nonsense":true}' })).ok).toBe(false);
  });

  it('rejects an override whose bounds are inverted', () => {
    const bad = JSON.stringify({ base: { tightBelow: 5, goodFrom: 1, goodTo: 3 }, perDimension: {} });
    expect(parseGarmentFields(form({ fit_rule_override: bad })).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/garment/parse-form.test.ts`
Expected: FAIL — `Failed to resolve import "./parse-form"`.

- [ ] **Step 3: Write the implementation**

Create `lib/garment/parse-form.ts`. This is lifted from `app/api/garments/route.ts:20-72` with no behaviour change — keep the comments, they explain non-obvious choices.

```ts
import { z } from 'zod';
import { dimensionsForCategory } from '@/lib/config/dimensions';
import { FIT_PROFILES } from '@/lib/config/fit-profiles';
import { FitRulesetSchema, firstIssueMessage } from '@/lib/fit/rule-schema';
import { t } from '@/lib/i18n/strings';
import type { FitRuleset } from '@/lib/fit/rules';
import type { Category, MeasurementBag } from '@/lib/supabase/types';

const CATEGORY = z.enum(['top', 'bottom', 'dress']);
const PROFILE_KEYS = FIT_PROFILES.map(p => p.key) as [string, ...string[]];

/** Exactly the columns a retailer may write. Never id/retailer_id/created_at. */
export interface GarmentFields {
  name: string;
  category: Category;
  fit_profile: string;
  fit_ruleset_id: string | null;
  fit_rule_override: FitRuleset | null;
  measurements: MeasurementBag;
}

export type ParseResult =
  | { ok: true; data: GarmentFields }
  | { ok: false; error: string };

/**
 * The single definition of "a valid garment", shared by POST (create) and
 * PATCH (edit) so the two cannot drift apart.
 *
 * Photo handling is deliberately NOT here: it is required on create, optional
 * on edit, and needs Storage I/O. Keeping it out leaves this function pure and
 * unit-testable, which is the only automated coverage the routes get.
 */
export function parseGarmentFields(form: FormData): ParseResult {
  const name = String(form.get('name') ?? '').trim();
  if (!name) return { ok: false, error: 'name required' };

  const catParse = CATEGORY.safeParse(String(form.get('category') ?? ''));
  if (!catParse.success) return { ok: false, error: 'invalid category' };
  const category: Category = catParse.data;

  const fit_profile = String(form.get('fit_profile') ?? 'regular');
  if (!z.enum(PROFILE_KEYS).safeParse(fit_profile).success) {
    return { ok: false, error: 'invalid fit_profile' };
  }

  // These two are mutually exclusive by construction, not just by convention:
  // an inline override always clears any preset reference. On edit, an absent
  // override is also how an override gets turned OFF.
  let fit_rule_override: FitRuleset | null = null;
  let fit_ruleset_id: string | null = null;

  const overrideRaw = String(form.get('fit_rule_override') ?? '').trim();
  const rulesetIdRaw = String(form.get('fit_ruleset_id') ?? '').trim();

  if (overrideRaw) {
    let overrideJson: unknown;
    try { overrideJson = JSON.parse(overrideRaw); }
    catch { return { ok: false, error: 'ข้อมูลกฎไม่ถูกต้อง' }; }
    const parsed = FitRulesetSchema.safeParse(overrideJson);
    if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };
    fit_rule_override = parsed.data;
  } else if (rulesetIdRaw) {
    if (!z.uuid().safeParse(rulesetIdRaw).success) {
      return { ok: false, error: 'invalid fit_ruleset_id' };
    }
    fit_ruleset_id = rulesetIdRaw;
  }

  // Collect measurements only for dimensions this category uses.
  const measurements: MeasurementBag = {};
  for (const d of dimensionsForCategory(category)) {
    const raw = form.get(d.key);
    if (raw === null || raw === '') continue;
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0 || num > 300) {
      return { ok: false, error: `ค่าไม่ถูกต้อง: ${d.labelTh}` };
    }
    measurements[d.key] = num;
  }
  if (Object.keys(measurements).length === 0) {
    return { ok: false, error: t.garmentNeedsMeasurement.th };
  }

  return {
    ok: true,
    data: { name, category, fit_profile, fit_ruleset_id, fit_rule_override, measurements },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/garment/parse-form.test.ts`
Expected: PASS, 17 tests (the `it.each` counts as 4).

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: 72 passing.

- [ ] **Step 6: Commit**

```bash
git add lib/garment/parse-form.ts lib/garment/parse-form.test.ts
git commit -m "feat(garment): shared field validator for create and edit"
```

---

### Task 4: `POST` delegates to the shared validator

Pure refactor of a **live** route. No behaviour change is intended; the tests from Task 3 plus a manual create are the evidence.

**Files:**
- Modify: `app/api/garments/route.ts`

- [ ] **Step 1: Replace the inline validation**

Replace the entire contents of `app/api/garments/route.ts` with:

```ts
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { parseGarmentFields } from '@/lib/garment/parse-form';

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();

  const parsed = parseGarmentFields(form);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // Photo is required on create, so it is checked here rather than in the
  // shared validator, which edit also uses and where it is optional.
  const photo = form.get('photo');
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: 'photo required' }, { status: 400 });
  }

  // Upload photo to Storage. Sanitize ext to a short alphanumeric token so
  // a hand-crafted filename can't introduce slashes or query strings into
  // the Storage object key.
  const rawExt = photo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const ext = rawExt.replace(/[^a-z0-9]/g, '').slice(0, 10) || 'jpg';
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from('garment-photos').upload(path, photo, {
    cacheControl: '3600', upsert: false, contentType: photo.type || 'image/jpeg',
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  const { data: { publicUrl } } = supabase.storage.from('garment-photos').getPublicUrl(path);

  const { data: row, error: insErr } = await supabase
    .from('garments')
    .insert({ retailer_id: user.id, photo_url: publicUrl, ...parsed.data })
    .select('id')
    .single();
  if (insErr) {
    // Best-effort cleanup: remove the orphaned Storage file so the bucket
    // doesn't accumulate dead photos. Mirrors the signup route's orphan
    // cleanup at commit 13230c7. Failure of this cleanup is swallowed —
    // the user-facing error is what we return regardless.
    await supabase.storage.from('garment-photos').remove([path]).catch(() => {});
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: row.id });
}
```

> **Ordering changed deliberately.** Validation now runs *before* the photo check, where it used to interleave. A request missing both a name and a photo now reports the name first. No caller depends on which error comes back.

- [ ] **Step 2: Verify both gates**

Run: `npm test && npm run build`
Expected: 72 tests passing, build succeeds. If the build fails on an unused import, that is landmine #1 — remove it.

- [ ] **Step 3: Manually verify creating a garment still works**

Run `npm run dev`, sign in, go to `/dashboard/garment/new`, add a garment with a photo and one measurement.
Expected: redirect to `/dashboard`, new card visible with its photo.

**This is the regression gate for the whole plan.** Do not continue if it fails.

- [ ] **Step 4: Commit**

```bash
git add app/api/garments/route.ts
git commit -m "refactor(api): POST /garments uses the shared field validator"
```

---

### Task 5: `GarmentForm` — one form, two modes

**Files:**
- Create: `app/dashboard/garment/GarmentForm.tsx`
- Modify: `app/dashboard/garment/new/page.tsx`

Two behaviours are new relative to today's add form, and both are intended:

- **Measurement inputs become controlled**, held in one map keyed by dimension. Switching category hides inputs but keeps their values, so switching back restores them. Today those values are lost.
- **A confirmation before discarding.** If saving would drop values typed for dimensions the current category does not use, the retailer is asked first.

Create mode gains both. That is an improvement, not a regression — but it means "add a garment" is not byte-identical to before, so Task 4's manual check stays the reference for *saving* behaviour.

- [ ] **Step 1: Create the component**

Create `app/dashboard/garment/GarmentForm.tsx`:

```tsx
'use client';
import { useMemo, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { dimensionsForCategory, dimensionByKey } from '@/lib/config/dimensions';
import { FIT_PROFILES } from '@/lib/config/fit-profiles';
import { t } from '@/lib/i18n/strings';
import type { Category, MeasurementBag } from '@/lib/supabase/types';
import FitRuleEditor, { isRulesetValid } from '@/app/dashboard/fit-rules/FitRuleEditor';
import { DEFAULT_RULE } from '@/lib/fit/rules';
import type { FitRuleset } from '@/lib/fit/rules';

/** Everything edit mode needs to reproduce a garment's current state. */
export interface GarmentFormInitial {
  id: string;
  name: string;
  category: Category;
  photo_url: string;
  measurements: MeasurementBag;
  /** From ruleSelectionForGarment() — see lib/fit/rule-selection.ts. */
  useOverride: boolean;
  override: FitRuleset;
  select: string;
}

export default function GarmentForm({ mode, initial }: {
  mode: 'create' | 'edit';
  initial?: GarmentFormInitial;
}) {
  const router = useRouter();
  const isEdit = mode === 'edit';
  const photoRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState<Category>(initial?.category ?? 'top');
  const [select, setSelect] = useState(initial?.select ?? 'profile:regular');
  const [useOverride, setUseOverride] = useState(initial?.useOverride ?? false);
  const [override, setOverride] = useState<FitRuleset>(
    initial?.override ?? { base: DEFAULT_RULE, perDimension: {} }
  );

  // Keyed by dimension across ALL categories, not just the current one.
  // Switching category hides inputs; holding their values here means switching
  // back restores what was typed instead of silently discarding it.
  const [measurements, setMeasurements] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const [k, v] of Object.entries(initial?.measurements ?? {})) {
      if (typeof v === 'number') seed[k] = String(v);
    }
    return seed;
  });

  const [presets, setPresets] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const dims = useMemo(() => dimensionsForCategory(category), [category]);

  useEffect(() => {
    fetch('/api/fit-rulesets')
      .then(r => r.ok ? r.json() : { rulesets: [] })
      .then(d => setPresets(d.rulesets ?? []))
      .catch(() => setPresets([]));  // a failed load just means no presets offered
  }, []);

  // Presets load after first paint. Without a stand-in option, a garment whose
  // rule IS a preset would render with the select showing something else until
  // the fetch lands — and saving in that window would silently change its rule.
  const presetOptions = useMemo(() => {
    const list = [...presets];
    const initialId = initial?.select.startsWith('preset:')
      ? initial.select.slice('preset:'.length)
      : null;
    if (initialId && !list.some(p => p.id === initialId)) {
      list.unshift({ id: initialId, name: '…' });
    }
    return list;
  }, [presets, initial]);

  /** Dimensions holding a value that the current category has no input for. */
  function strandedKeys(): string[] {
    const active = new Set<string>(dims.map(d => d.key));
    return Object.keys(measurements)
      .filter(k => !active.has(k) && (measurements[k] ?? '').trim() !== '');
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (useOverride && !isRulesetValid(override)) {
      setError(t.authError.th);
      return;
    }

    const entries = dims
      .map(d => [d.key, (measurements[d.key] ?? '').trim()] as const)
      .filter(([, v]) => v !== '');
    if (entries.length === 0) {
      setError(t.garmentNeedsMeasurement.th);
      return;
    }

    const photo = photoRef.current?.files?.[0] ?? null;
    if (!photo && !isEdit) {
      setError(t.photoRequired.th);
      return;
    }

    // Saving writes only the current category's dimensions, so warn before
    // a category change quietly discards numbers already entered.
    const stranded = strandedKeys();
    if (stranded.length > 0) {
      const labels = stranded.map(k => dimensionByKey(k)?.labelTh ?? k).join(', ');
      if (!window.confirm(t.confirmDropMeasurements.th.replace('{dims}', labels))) return;
    }

    const form = new FormData();
    form.set('name', name.trim());
    form.set('category', category);
    for (const [k, v] of entries) form.set(k, v);
    if (photo) form.set('photo', photo);

    // The grouped select carries one value; split it back into the two
    // mutually exclusive columns the API expects.
    if (useOverride) {
      form.set('fit_profile', 'regular');       // required column; the override wins at resolve time
      form.set('fit_rule_override', JSON.stringify(override));
    } else if (select.startsWith('preset:')) {
      form.set('fit_profile', 'regular');       // fallback if the preset is later deleted
      form.set('fit_ruleset_id', select.slice('preset:'.length));
    } else {
      form.set('fit_profile', select.slice('profile:'.length));
    }

    setLoading(true);
    try {
      const res = await fetch(
        isEdit ? `/api/garments/${initial!.id}` : '/api/garments',
        { method: isEdit ? 'PATCH' : 'POST', body: form },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === 'string' ? data.error : t.authError.th);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      // Network failure (offline, timeout, DNS). Surface the generic error
      // so the user knows the form is recoverable.
      setError(t.networkError.th);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold">{isEdit ? t.editGarment.th : t.addGarment.th}</h1>

      <label className="block">
        <span className="text-sm text-gray-700">{t.garmentName.th}</span>
        <input
          required value={name} onChange={e => setName(e.target.value)}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        />
      </label>

      <label className="block">
        <span className="text-sm text-gray-700">{t.category.th}</span>
        <select
          required value={category}
          onChange={e => setCategory(e.target.value as Category)}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        >
          <option value="top">{t.catTop.th}</option>
          <option value="bottom">{t.catBottom.th}</option>
          <option value="dress">{t.catDress.th}</option>
        </select>
      </label>

      <label className="block">
        <span className="text-sm text-gray-700">{t.fitProfile.th}</span>
        <select
          value={select} onChange={e => setSelect(e.target.value)}
          disabled={useOverride}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 disabled:opacity-60"
        >
          <optgroup label={t.fitRuleBuiltIn.th}>
            {FIT_PROFILES.map(p => (
              <option key={p.key} value={`profile:${p.key}`}>{p.labelTh}</option>
            ))}
          </optgroup>
          {presetOptions.length > 0 && (
            <optgroup label={t.fitRuleShopRules.th}>
              {presetOptions.map(p => <option key={p.id} value={`preset:${p.id}`}>{p.name}</option>)}
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

      <label className="block">
        <span className="text-sm text-gray-700">{isEdit ? t.replacePhoto.th : t.photo.th}</span>
        {isEdit && initial?.photo_url && (
          <span className="mt-2 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={initial.photo_url} alt={t.currentPhoto.th}
              className="h-16 w-16 rounded object-cover"
            />
            <span className="text-xs text-gray-500">{t.photoKeepCurrent.th}</span>
          </span>
        )}
        <input
          ref={photoRef} required={!isEdit} type="file" accept="image/*"
          className="mt-1 block w-full text-sm"
        />
      </label>

      <fieldset className="space-y-3 rounded border p-4">
        <legend className="px-2 text-sm font-medium">{t.garmentMeasurements.th}</legend>
        {dims.map(d => (
          <label key={d.key} className="block">
            <span className="text-sm text-gray-700">{d.labelTh} (cm)</span>
            <input
              type="number" step="0.1" min="1" max="300" inputMode="decimal"
              value={measurements[d.key] ?? ''}
              onChange={e => setMeasurements(m => ({ ...m, [d.key]: e.target.value }))}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
        ))}
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-4">
        <button
          type="submit" disabled={loading}
          className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? t.saving.th : t.save.th}
        </button>
        <Link href="/dashboard" className="text-sm text-gray-600 underline">{t.cancel.th}</Link>
      </div>
    </form>
  );
}
```

> **`name` attributes are gone from the inputs on purpose.** The submit handler builds `FormData` by hand from controlled state rather than from the form element, because measurements for hidden categories must not be submitted and hidden inputs would not be in the element anyway. Leaving stale `name` attributes would invite someone to "simplify" back to `new FormData(e.currentTarget)` and silently reintroduce the bug.

- [ ] **Step 2: Reduce the new-garment page to a wrapper**

Replace the entire contents of `app/dashboard/garment/new/page.tsx` with:

```tsx
import GarmentForm from '@/app/dashboard/garment/GarmentForm';

export default function NewGarmentPage() {
  return <GarmentForm mode="create" />;
}
```

- [ ] **Step 3: Verify both gates**

Run: `npm test && npm run build`
Expected: 72 passing, build succeeds.

- [ ] **Step 4: Manually verify create still works, plus the new retention behaviour**

With `npm run dev`, at `/dashboard/garment/new`:
1. Add a garment with a photo and one measurement → lands on `/dashboard`, card appears.
2. Start a new one, type a chest measurement, switch category to กางเกง, switch back to เสื้อ → **the chest value is still there.**
3. Type a chest measurement, switch to กางเกง, enter a hip measurement, save → confirmation names รอบอก; accepting saves only the bottom dimensions.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/garment/GarmentForm.tsx app/dashboard/garment/new/page.tsx
git commit -m "refactor(dashboard): extract GarmentForm with create and edit modes"
```

---

### Task 6: `PATCH /api/garments/[id]`

**Files:**
- Modify: `app/api/garments/[id]/route.ts`

Photo cleanup is extracted into a helper because `PATCH` and `DELETE` need identical behaviour, including the owner-prefix guard.

- [ ] **Step 1: Extract the photo-cleanup helper and rewire `DELETE`**

Replace the entire contents of `app/api/garments/[id]/route.ts` with:

```ts
import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { parseGarmentFields } from '@/lib/garment/parse-form';

const STORAGE_PREFIX = '/object/public/garment-photos/';

/**
 * Best-effort removal of a garment photo from Storage.
 *
 * Never throws. By the time this runs the database is already correct, so an
 * orphaned file is a far smaller problem than a failed request. The
 * owner-prefix check stops a doctored photo_url from aiming the delete at
 * another retailer's object.
 */
async function removeStoredPhoto(photoUrl: string | null, userId: string): Promise<void> {
  if (!photoUrl) return;
  const idx = photoUrl.indexOf(STORAGE_PREFIX);
  if (idx === -1) return;
  const path = decodeURIComponent(photoUrl.slice(idx + STORAGE_PREFIX.length));
  if (!path.startsWith(`${userId}/`)) return;

  const admin = createSupabaseAdminClient();
  try {
    const { error } = await admin.storage.from('garment-photos').remove([path]);
    if (error) console.error('storage cleanup failed (non-fatal):', error);
  } catch (e) {
    console.error('storage cleanup failed (non-fatal):', e);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Ownership check and the current photo in one read. Scoping by retailer_id
  // means another shop's id is indistinguishable from a nonexistent one.
  const { data: existing } = await supabase
    .from('garments')
    .select('photo_url')
    .eq('id', params.id)
    .eq('retailer_id', user.id)
    .single();
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const form = await req.formData();

  const parsed = parseGarmentFields(form);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // Photo is the one field where absent means "keep what's there". Everything
  // in parsed.data is written unconditionally — this is a full replacement of
  // the editable columns, not a merge of whichever keys arrived.
  let photo_url: string = existing.photo_url;
  let uploadedPath: string | null = null;

  const photo = form.get('photo');
  if (photo instanceof File && photo.size > 0) {
    // Same ext sanitisation as POST: a hand-crafted filename must not be able
    // to introduce slashes or query strings into the Storage object key.
    const rawExt = photo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const ext = rawExt.replace(/[^a-z0-9]/g, '').slice(0, 10) || 'jpg';
    uploadedPath = `${user.id}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('garment-photos')
      .upload(uploadedPath, photo, {
        cacheControl: '3600', upsert: false, contentType: photo.type || 'image/jpeg',
      });
    // Upload first, point the row at it second, delete the old one last. If
    // this fails nothing has changed and the original photo is intact.
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    photo_url = supabase.storage.from('garment-photos').getPublicUrl(uploadedPath).data.publicUrl;
  }

  const { error: updErr } = await supabase
    .from('garments')
    .update({ ...parsed.data, photo_url })
    .eq('id', params.id)
    .eq('retailer_id', user.id);

  if (updErr) {
    // Roll the upload back so a failed save leaves no stray file. The garment
    // still points at its original photo.
    if (uploadedPath) {
      await supabase.storage.from('garment-photos').remove([uploadedPath]).catch(() => {});
    }
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // Only now is the old object unreferenced.
  if (uploadedPath) await removeStoredPhoto(existing.photo_url, user.id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: garment } = await supabase
    .from('garments')
    .select('photo_url')
    .eq('id', params.id)
    .eq('retailer_id', user.id)
    .single();
  if (!garment) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { error: delErr } = await supabase
    .from('garments')
    .delete()
    .eq('id', params.id)
    .eq('retailer_id', user.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  await removeStoredPhoto(garment.photo_url, user.id);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify both gates**

Run: `npm test && npm run build`
Expected: 72 passing, build succeeds.

- [ ] **Step 3: Verify deleting a garment still works**

`DELETE` was rewritten around the extracted helper. In the running dev app, delete a throwaway garment.
Expected: card disappears; the Storage object is gone from the `garment-photos` bucket in Supabase Studio.

- [ ] **Step 4: Commit**

```bash
git add app/api/garments/[id]/route.ts
git commit -m "feat(api): PATCH /garments/[id] with photo replacement"
```

---

### Task 7: The edit page

**Files:**
- Create: `app/dashboard/garment/[id]/edit/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/dashboard/garment/[id]/edit/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ruleSelectionForGarment } from '@/lib/fit/rule-selection';
import GarmentForm from '@/app/dashboard/garment/GarmentForm';
import type { Category, MeasurementBag } from '@/lib/supabase/types';

export default async function EditGarmentPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // layout already redirects

  // Scoped by retailer_id: another shop's garment reads as nonexistent, and a
  // malformed id fails the query the same way. Both land on notFound().
  const { data: g } = await supabase
    .from('garments')
    .select('id, name, category, photo_url, measurements, fit_profile, fit_ruleset_id, fit_rule_override')
    .eq('id', params.id)
    .eq('retailer_id', user.id)
    .single();
  if (!g) notFound();

  const selection = ruleSelectionForGarment({
    fit_profile: g.fit_profile,
    fit_ruleset_id: g.fit_ruleset_id,
    fit_rule_override: g.fit_rule_override,
  });

  return (
    <GarmentForm
      mode="edit"
      initial={{
        id: g.id,
        name: g.name,
        category: g.category as Category,
        photo_url: g.photo_url,
        measurements: (g.measurements ?? {}) as MeasurementBag,
        ...selection,
      }}
    />
  );
}
```

- [ ] **Step 2: Verify both gates**

Run: `npm test && npm run build`
Expected: 72 passing, build succeeds.

- [ ] **Step 3: Load the page by hand**

Copy a garment id from the dashboard (the preview link contains it) and open `/dashboard/garment/<id>/edit`.
Expected: the form is populated with the garment's real name, category, measurements, rule and photo thumbnail.

Then open `/dashboard/garment/11111111-2222-3333-4444-555555555555/edit`.
Expected: the Next.js 404 page.

- [ ] **Step 4: Commit**

```bash
git add "app/dashboard/garment/[id]/edit/page.tsx"
git commit -m "feat(dashboard): garment edit page"
```

---

### Task 8: The `แก้ไข` link on the card

**Files:**
- Modify: `app/dashboard/GarmentCard.tsx:79-88`

- [ ] **Step 1: Add the link to the card footer**

Replace the footer block (the `<div className="border-t px-3 py-2">` and its contents) with:

```tsx
      <div className="flex items-center gap-4 border-t px-3 py-2">
        <Link
          href={`/dashboard/garment/${garment.id}/edit`}
          className="text-xs text-blue-700 underline"
        >
          {t.edit.th}
        </Link>
        <button
          type="button"
          disabled={deleting}
          onClick={onDelete}
          className="text-xs text-red-600 disabled:opacity-60"
        >
          {t.deleteGarment.th}
        </button>
      </div>
```

`Link` and `t` are already imported in this file. No import changes.

- [ ] **Step 2: Verify both gates**

Run: `npm test && npm run build`
Expected: 72 passing, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/GarmentCard.tsx
git commit -m "feat(dashboard): edit link on garment cards"
```

---

### Task 9: End-to-end verification

Nothing here is optional. The Supabase clients are untyped, so nothing above proves the queries have the right shape — a wrong field name compiles clean and fails only when a real person uses it. There is one Supabase project and no staging: **these run against live data.** Use a throwaway garment where a step is destructive.

**Files:** none — this is verification.

- [ ] **Step 1: Both automated gates, from a clean tree**

```bash
git status --short && npm test && npm run build
```

Expected: no uncommitted changes, 72 tests passing, build succeeds. A dirty tree here means a previous task committed less than it verified — a mistake made before on this project.

- [ ] **Step 2: Work the manual checklist**

From the spec §8. Tick each:

1. **Add a garment** — still works end to end.
2. **Edit only the name** — photo, measurements and rule all survive.
3. **Attach a shop preset to a pre-existing garment** — the reason this work exists. Pick a garment created before the fit-rules feature.
4. **Custom rule on** — tick the override, set `-6 / -4 / 3`, save, reopen. The numbers come back and the select is disabled.
5. **Custom rule off** — untick, choose a shop preset, save, reopen. The override is gone and the preset is selected. Confirm in Supabase Studio that `fit_rule_override` is `null` and `fit_ruleset_id` is set.
6. **Category change** — `เสื้อ` → `กางเกง` on a garment with a chest measurement. The confirmation names รอบอก; after saving, `measurements` holds only bottom dimensions.
7. **Replace the photo** — new image on the dashboard card and on the public shop page. The old Storage object is gone; the new one is present.
8. **Another account's garment** — open `/dashboard/garment/<other-id>/edit` → 404.
9. **Customer fit check on an edited garment** — the verdict reflects the new rule. Use garment 97cm against body 100cm: `good_fit` under `-6/-4/3`, `too_tight` under the default. **Do not use 96cm** — ease of exactly −4 sits on the boundary and returns `snug`. That mistake has been made twice on this project.

- [ ] **Step 3: Update the docs of record**

In `docs/superpowers/resume.md`:
- Move the garment-edit entry from "Decided 2026-08-13 … not yet built" into **Done**, noting the shared `GarmentForm`, `parseGarmentFields()` and `ruleSelectionForGarment()`.
- Add the new files to the file map.
- Update the test count from 47 to 72.
- Remove the stale follow-up "`lib/i18n/strings.ts`: apply `as const`" — line 91 already has it.

Do **not** write a fourth handoff document.

```bash
git add docs/superpowers/resume.md
git commit -m "docs: record the garment edit page as shipped"
```

- [ ] **Step 4: Ship**

```bash
git checkout main && git merge --ff-only feature/garment-edit && git push origin main
```

- [ ] **Step 5: Confirm the deploy actually landed**

`PATCH` is a new *method* on a path that already exists, so probing the path proves nothing — it answers either way. Probe the method:

```bash
curl -o /dev/null -s -w "%{http_code}\n" -X PATCH https://fit-mvp-eight.vercel.app/api/garments/11111111-2222-3333-4444-555555555555
```

Expected: **401** — the handler is live and rejected an unauthenticated caller.
**405** means Vercel is still serving the old code, where only `DELETE` exists. Wait for the build and probe again. Do not report this as shipped on a 405.

---

## Out of scope — do not drift into these

Both are recorded in `resume.md` as follow-ups. Raised during design on 2026-08-13 and deliberately excluded:

- **Dashboard EN/TH toggle.** The dashboard is Thai-only — every component hardcodes `t.x.th`, and `LanguageProvider` wraps the shop route only. This plan writes correct `en` values for every new string so none of it needs redoing, but wires no toggle.
- **Dashboard visual design.** A look-and-feel pass is wanted and is separate work. Do not restyle anything beyond the markup shown here.
