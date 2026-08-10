# Design — Retailer-defined fit rules (2026-08-06)

> Lets a shop owner define what "good fit" means for their own garments, instead of
> being limited to the three hardcoded profiles (`regular` / `slim` / `relaxed`).

---

## 1. Problem

The fit engine ships with fixed threshold bands. A retailer can only choose one of three
built-in profiles. Two real cases break this:

- **Slim-fit garments.** A few cm of extra room is fine on a relaxed tee and wrong on a
  tailored shirt. `slim` is a guess, not the retailer's guess.
- **Stretchy fabrics.** The garment's flat measurement understates how it wears. A jersey
  top measuring 96cm can fit a 100cm chest comfortably. The current model has **no way to
  express this at all** — it hard-codes `too_tight` as soon as the body exceeds the garment
  by 1cm, whatever the fabric.

The retailer knows their stock. They need to encode that knowledge.

---

## 2. Scope

**In scope**

- Retailer-defined, reusable fit rulesets ("presets") managed from the dashboard.
- Per-garment overrides for one-off items.
- A whole-garment rule with optional per-dimension exceptions.
- Live preview in the editor so a rule can be sanity-checked before saving.
- Bilingual (TH/EN) labels for everything new.
- Snapshotting the rule actually applied into each `fit_session`, so history stays
  interpretable once rules become editable (§4.3).

**Out of scope**

- Showing the rule or its rationale to the customer on the shop page. Customers keep
  seeing verdicts only.
- Retailer analytics on how rules perform.
- Machine-assisted calibration from `fit_sessions` history.
- Anything VTO / Phase 2.

---

## 3. The rule model

### 3.1 Ease, not diff

The engine works internally on `diff = customer − garment`, which reads backwards to a
human: "good fit" is a *negative* number. Every retailer-facing surface uses **ease**
instead:

```
ease = garment − customer      // "how many cm roomier than the body"
```

Negative ease means the garment measures smaller than the body — which is exactly how a
stretchy garment gets expressed. This is the whole reason no separate "stretch" flag is
needed.

### 3.2 EaseRule

```ts
export interface EaseRule {
  tightBelow: number;  // ease at or below this → too_tight
  goodFrom: number;    // ease above tightBelow and at or below this → snug
  goodTo: number;      // ease above goodFrom and at or below this → good_fit
                       // ease above goodTo → loose
}
```

Resolving verdicts, in order:

| Ease | Verdict |
|---|---|
| `ease ≤ tightBelow` | `too_tight` |
| `tightBelow < ease ≤ goodFrom` | `snug` |
| `goodFrom < ease ≤ goodTo` | `good_fit` |
| `ease > goodTo` | `loose` |

**Default:** `{ tightBelow: -1, goodFrom: 1, goodTo: 5 }`.

Worked examples the retailer would actually enter:

| Garment | Rule | Reading |
|---|---|---|
| Default / regular | `-1 / 1 / 5` | Today's behaviour, unchanged |
| Tailored slim shirt | `0 / 1 / 3` | Room beyond 3cm already looks wrong |
| Stretchy jersey | `-6 / -4 / 3` | Can measure 4cm *under* the body and still fit well |
| Oversized outerwear | `-1 / 3 / 12` | Needs a lot of room to look right |

### 3.3 Ruleset

A ruleset is a base rule plus optional per-dimension exceptions:

```ts
export interface FitRuleset {
  base?: EaseRule;                                  // omitted → dimension default
  perDimension: Partial<Record<DimensionKey, EaseRule>>;
}
```

`base` is optional so the built-in `regular` profile can be `{ perDimension: {} }` and fall
through to each dimension's own default. That preserves the property that a future
dimension with a different default is not silently overridden by a ruleset's base.

Per-dimension exceptions cover the mixed case: a skirt with a stretchy waistband and a
fixed hip measurement is `base` = fixed, `perDimension.waist_cm` = stretchy.

### 3.4 Compiling to bands

The engine keeps consuming `ThresholdBand[]`. A pure compiler bridges the two:

```ts
export function easeRuleToBands(r: EaseRule): ThresholdBand[] {
  return [
    { min: -r.tightBelow, max: INF,           verdict: 'too_tight' },
    { min: -r.goodFrom,   max: -r.tightBelow, verdict: 'snug' },
    { min: -r.goodTo,     max: -r.goodFrom,   verdict: 'good_fit' },
    { min: -INF,          max: -r.goodTo,     verdict: 'loose' },
  ];
}
```

Applied to the default rule this yields byte-for-byte today's `DEFAULT_BANDS`. That
equality is asserted in a test and is the primary regression guard for this whole change.

Note the inclusivity flip: ease bounds are inclusive-upper, and the engine's bands are
`[min, max)`. Negating swaps the open end correctly. If `tightBelow === goodFrom` the snug
band is empty (`min === max` never matches) — harmless and intentional.

### 3.5 Rewriting the built-ins

`lib/config/fit-profiles.ts` is re-expressed in `FitRuleset` shape. No behaviour change:

| Profile | Ruleset |
|---|---|
| `regular` | `{ perDimension: {} }` |
| `slim` | `{ perDimension: { shoulder_cm, chest_cm, waist_cm, hip_cm → -1 / 1 / 3 } }` |
| `relaxed` | `{ perDimension: { shoulder_cm, chest_cm, waist_cm, hip_cm → -1 / 1 / 8 } }` |

`lib/config/dimensions.ts` swaps `defaultBands: ThresholdBand[]` for
`defaultRule: EaseRule`. Adding a dimension remains a one-file edit.

---

## 4. Data model

### 4.1 New table

```sql
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
```

**No anon policy.** `/api/fit/evaluate` already uses the service-role client, so ruleset
resolution happens server-side. Rulesets are never in anon read range — consistent with
the existing decision to keep `fit_sessions` out of anon reach.

### 4.2 Garment columns

```sql
alter table public.garments
  add column fit_ruleset_id    uuid references public.fit_rulesets(id) on delete set null,
  add column fit_rule_override jsonb;
```

Both nullable. `fit_profile` stays exactly as-is, including its check constraint — it is
the fallback for every existing garment, and nothing about their behaviour changes.

`on delete set null`: deleting a preset silently drops affected garments back to their
built-in `fit_profile`. No orphaned references, no broken evaluations.

**Anon visibility — a deliberate asymmetry with §4.1.** `garments` already carries a
blanket `garments_public_read ... for select to anon using (true)` policy
(`0001_initial.sql`). Adding these two columns therefore puts `fit_rule_override` — the
actual threshold numbers — inside anon read range, even though §4.1 keeps `fit_rulesets`
out of it. A preset is hidden; an inline override on the same garment is not.

This is accepted rather than fixed, for three reasons: the exposed data is the retailer's
own fit thresholds, not customer measurements, so no PII boundary moves; every read path
in the app already goes through `createSupabaseAdminClient()` (both shop pages and
`/api/fit/evaluate`), so nothing in the product depends on the anon policy; and §2's
"customers keep seeing verdicts only" is a statement about the shop UI, which stays true.

What it is *not* is a claim that rules are unreachable by anon. The anon key ships in the
browser bundle, so a determined customer can read any garment's override directly.
Retailers should not be told their rules are secret.

Follow-up, out of scope here: the `garments_public_read` policy appears vestigial given
that no code path uses the anon client for garments. Dropping it would close this gap and
align the two storage paths, but it is a separate change with its own blast radius.

### 4.3 Session snapshot

```sql
alter table public.fit_sessions
  add column applied_rule jsonb;
```

`/api/fit/evaluate` writes the **resolved ruleset** into this column on every insert.

This exists because rules are now editable. `fit_sessions.result` records the verdict, but
the rule that produced it is referenced by ID — so the moment a retailer edits a preset,
every historical session evaluated under the old numbers becomes uninterpretable. Nobody
can reconstruct why a verdict was given, and the session history stops being usable as
evidence about anything.

The column is nullable so pre-existing rows stay valid; those were all evaluated under the
built-in defaults, which are still in the code. It is written at evaluation time and never
updated afterwards — an append-only record of what was actually applied.

Cost now: one jsonb column and one line in the insert. Cost if deferred: the gap is
permanent, because the information is destroyed at the moment of the edit rather than
merely un-recorded.

### 4.4 Resolution

**All-or-nothing at the ruleset level, then per-dimension fallthrough.** This follows the
precedent already in the codebase ("bands are full replacements, not deltas"):

```
effective ruleset =
    garment.fit_rule_override
 ?? ruleset(garment.fit_ruleset_id)
 ?? builtinProfile(garment.fit_profile)

bands for dimension d =
    easeRuleToBands(
        effective.perDimension[d.key]
     ?? effective.base
     ?? d.defaultRule
    )
```

A per-garment override **replaces** the preset entirely; it does not merge with it.
Merging would make it impossible to answer "which number is actually in force" by
looking at one place.

---

## 5. Engine changes

`lib/fit/engine.ts` — `evaluateFit` stops taking a profile key string:

```ts
// before
evaluateFit(garment, customer, fitProfileKey: string): FitResult
// after
evaluateFit(garment, customer, ruleset: FitRuleset): FitResult
```

The band-matching loop is unchanged. The engine stays pure — no DB, no network, no
config lookup by key.

New `lib/fit/resolve.ts` holds `resolveRuleset(garment, presetRule)` implementing §4.4.
It is also pure: the caller supplies the fetched preset, so `resolve.ts` does no I/O.

`/api/fit/evaluate` becomes: fetch garment (now also selecting `fit_ruleset_id` and
`fit_rule_override`) → if `fit_ruleset_id` is set and no override, fetch that ruleset row
→ `resolveRuleset` → `evaluateFit` → insert the session with `applied_rule` set to the
resolved ruleset (§4.3). Worst case one extra query, skipped entirely when the garment has
an override or uses a built-in.

If the ruleset row is missing or its `rule` fails validation, log and fall back to the
garment's `fit_profile`. A malformed rule must never break the customer-facing checker.

`builtinProfile()` keeps today's behaviour of returning `regular` for an unrecognised
`fit_profile` string — that fallback moves from `fitProfileByKey` into `resolveRuleset`,
and the existing test covering it moves with it.

All 12 existing tests in `lib/fit/engine.test.ts` pass a profile-key string as the third
argument (`'regular'`, `'slim'`, `'relaxed'`, and one `'banana'` case covering the
unrecognised-key fallback). Each must be updated to pass a ruleset instead. This is
mechanical, but it is the bulk of the diff in that file and should not be mistaken for a
behaviour change.

> Corrected 2026-08-10: an earlier draft of this section said "26 existing tests". The
> suite has 12. The overcount came from a text search in which `evaluateFit(` matches the
> substring `it(`. Verified against `npm test`: 12 passed (12).

---

## 6. UI

### 6.1 Preset management — `/dashboard/fit-rules`

- Lists the retailer's presets: name, a one-line plain-language summary
  ("พอดีเมื่อกว้างกว่าตัว 1–5 ซม."), garment count, edit / delete.
- Create and edit open `FitRuleEditor`.
- Delete asks for confirmation and states how many garments will revert to their
  built-in profile.
- Linked from the dashboard nav.

### 6.2 `FitRuleEditor.tsx` (client component)

Three number inputs, `inputMode="decimal"`, matching the convention established in
`FitChecker.tsx`. Each labelled in plain language, not in jargon:

- "แน่นเกินไป เมื่อแคบกว่าตัวมากกว่า…" (`tightBelow`)
- "พอดี ตั้งแต่…" (`goodFrom`)
- "…ถึง…" (`goodTo`)

**Live preview** (the reason a bad rule gets caught before a customer sees it):

- A horizontal ease scale from −10 to +15cm, coloured into the four verdict zones using
  the existing badge colours, with the three boundaries marked.
- A worked example underneath, recomputed as the numbers change: "ลูกค้ารอบอก 96 ซม. +
  เสื้อ 100 ซม. → พอดี".
- Invalid input disables save and shows the reason inline.

**Per-dimension exceptions**: a collapsed `<details>` section. Opening it lists the
dimensions and lets each carry its own three numbers, defaulting to "same as above".

### 6.3 Garment form

`/dashboard/garment/new` — the `fit_profile` select becomes a grouped select: built-in
profiles, then "กฎของร้าน" (the retailer's presets). Beneath it, a "ปรับเฉพาะสินค้านี้"
checkbox reveals an inline `FitRuleEditor` writing to `fit_rule_override`.

Submitting with the checkbox on sends `fit_rule_override` and clears `fit_ruleset_id`;
these two are mutually exclusive by construction, not just by convention.

### 6.4 i18n

All new copy goes in `lib/i18n/strings.ts` in the existing `{ th, en }` shape. Preset
*names* are retailer-entered content and are never translated — same boundary as shop and
garment names.

---

## 7. Validation and error handling

Shared zod schema in `lib/fit/rule-schema.ts`, used by both API routes and imported by the
client editor so the two can't drift:

```ts
EaseRuleSchema = z.object({
  tightBelow: z.number().min(-30).max(50),
  goodFrom:   z.number().min(-30).max(50),
  goodTo:     z.number().min(-30).max(50),
}).refine(r => r.tightBelow <= r.goodFrom && r.goodFrom < r.goodTo)
```

- `goodFrom < goodTo` is strict — equality would make `good_fit` unreachable.
- `tightBelow ≤ goodFrom` allows equality, which simply means "no snug zone".
- The ±30/50cm envelope catches unit slips and typos (`500` for `50`).
- Failures return 400 with a friendly Thai message naming the offending field, following
  the pattern already used in `app/api/garments/route.ts`.
- Preset `name`: required, trimmed, 1–60 chars.

New routes: `POST /api/fit-rulesets`, `PATCH /api/fit-rulesets/[id]`,
`DELETE /api/fit-rulesets/[id]` — all auth-guarded, ownership enforced by RLS, mirroring
`app/api/garments/[id]/route.ts`.

---

## 8. Testing

Extending `lib/fit/engine.test.ts` and adding `lib/fit/resolve.test.ts`:

1. **Regression guard** — `easeRuleToBands(DEFAULT_RULE)` deep-equals the current
   `DEFAULT_BANDS` array. If this fails, existing garments changed behaviour.
2. **Built-in equivalence** — `regular` / `slim` / `relaxed` rewritten as rulesets produce
   identical verdicts to the pre-change profiles across a table of sample measurements.
3. **Boundaries** — ease exactly at `tightBelow`, `goodFrom`, `goodTo` lands in the
   documented verdict on each side.
4. **Negative ease** — a stretchy rule returns `good_fit` where the default returns
   `too_tight`. This is the case the feature exists for.
5. **Resolution precedence** — override beats preset beats built-in; `perDimension` beats
   `base` beats dimension default; an absent `base` falls through correctly.
5b. **Session snapshot** — the ruleset written to `fit_sessions.applied_rule` is the one
   that produced the verdict, and editing the preset afterwards does not alter the stored
   row.
6. **Empty snug zone** — `tightBelow === goodFrom` produces no `snug` verdict and never
   returns `unknown`.
7. **Validation** — each invalid shape is rejected; a malformed stored rule falls back to
   `fit_profile` rather than throwing.

Per the project's existing gate, `npm test` and `npm run build` must both be green before
anything reaches `main`.

---

## 9. Migration and compatibility

- One migration, `0002_fit_rulesets.sql`: new table + policy + index + two nullable
  garment columns + `fit_sessions.applied_rule`.
- No backfill. Every existing garment keeps `fit_profile` and both new columns null,
  which resolves to the built-in profile — identical output to today.
- `lib/supabase/types.ts` gains the new columns and a `FitRulesetRow` type.
- The change is additive at the DB level and reversible by dropping the table and columns.

---

## 10. Open questions for the founder

> **Answered 2026-08-10** (founder, in session): Q1 — ship the placeholder Thai copy as-is.
> Q4 — build fit rules first, as specced; size labels stay deferred. Q2, Q3 and Q5 remain
> open and are unchanged below.

1. **Thai wording.** The labels in §6 are placeholders written by a non-native speaker.
   ~~They need review before implementation.~~ **Decided: ship as-is.** The founder accepted
   the placeholder strings rather than blocking implementation on copy review. They still
   go in `lib/i18n/strings.ts` under the normal `{ th, en }` shape, so replacing them later
   is a one-file edit with no code change. Worth a native-speaker pass before any retailer
   outside the founder's own shop sees the dashboard.
2. **Preset count.** No limit is proposed. If a shop creates 40 presets the garment-form
   select gets unwieldy — worth revisiting once there's real usage, not now.
3. **Calibration.** `fit_sessions` records every evaluation, and with §4.3 it now also
   records the rule that produced each one. Once real customers have used this, that data
   could suggest better numbers than the retailer's guess. Deliberately deferred, but the
   data is now being collected in a form that stays interpretable.

4. **Size labels — decide before the catalogue grows.** A garment today is one row with one
   measurement set and no size label. There is no way to know whether a 100cm chest was
   labelled M or L, and no concept of size variants of the same style.

   This blocks two things. Product-wise, a shop stocking one style in four sizes must
   create four unrelated garments, and the customer sees four cards instead of one item
   with a recommended size — which is the more natural interaction and the one that
   actually reduces returns.

   Data-wise, size labels are the join key for any size-curve or size-distribution
   analysis. Without them, accumulated sessions cannot answer "which sizes should be cut,
   and in what ratio" — one of the few questions a garment producer will reliably pay for.

   The cost of deferring is not the schema change; it is that retailers will have entered a
   catalogue that has to be re-entered or migrated by hand. **This is out of scope for this
   spec and needs its own design**, but the decision should be made before onboarding more
   retailers, not after.

   **Decided 2026-08-10: fit rules first, size labels still deferred.** The rework exposure
   this accepts is bounded and worth naming. §3–§5 (ease model, `easeRuleToBands`,
   `resolveRuleset`, engine signature) are indifferent to whether a garment row is a style
   or a size variant — they take measurements and a ruleset, and would survive the change
   untouched. §6.3, the garment-form UI, is what gets revisited: if a style later owns four
   size variants, "which rule applies" moves up a level from the garment row. That is one
   form and one resolution step, not a rewrite.

   The deadline is unchanged and still live: this decision buys time, it does not settle
   the question. Onboarding a second retailer is the point of no return, because from then
   on the migration cost is someone else's re-typing.

5. **Consent and secondary use.** If measurement data is ever used beyond serving the
   immediate fit check — aggregated, sold, or shared — Thailand's PDPA requires explicit,
   unbundled consent obtained *at or before* collection, and consent cannot be retrofitted
   onto records already gathered. Whether self-reported body measurements constitute
   sensitive biometric data under Thai law is unsettled, but a resale business model
   invites the strict reading. Out of scope here; flagged because the cost of addressing it
   rises with every record collected, and is near zero today.
