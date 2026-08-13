# Garment Edit — design

**Date:** 2026-08-13
**Status:** approved, not yet built
**Closes:** the "Open decision" in `docs/superpowers/resume.md` — a retailer cannot apply a fit
rule to a garment they already own.

---

## 1. The problem

A fit rule can only be attached at `/dashboard/garment/new`. There is no garment edit page
anywhere in the app — the dashboard lists garments, previews them, and deletes them, nothing
more. A shop with an existing catalogue has to delete and re-create every item, re-uploading
photos, to use the custom-fit-rules feature at all.

This is not an implementation bug. The custom-fit-rules spec scoped rule attachment to the
new-garment form (§6.3) and the plan built that faithfully. The spec had a hole: nobody asked
*how does a shop owner apply a rule to the clothes they already have?*

The shipped feature is safe — existing garments keep their prior behaviour, guarded by a
byte-for-byte regression test — it is simply unreachable for anything created before a rule
existed.

## 2. Decisions taken

Three options were costed in `resume.md`. The founder chose the largest and closed the
question on 2026-08-13:

| Question | Decision |
|---|---|
| What is editable? | **Everything**: name, category, garment measurements, fit rule, and the photo. |
| Where does it live? | **A page of its own** at `/dashboard/garment/[id]/edit`, mirroring the add-garment page. |
| How is the form built? | **One shared component in two modes**, used by both the add and edit pages. |
| English? | **Strings written now, dashboard toggle deferred.** See §9. |

Rejected: a rule-only selector on the dashboard card (cheaper, but leaves name and measurement
mistakes uncorrectable and would need redoing); a modal (the rule editor plus photo swap make
it tall enough to scroll inside itself on a phone, which is the primary device); a duplicated
edit page (duplication is the failure mode this work exists to fix).

## 3. Files

| File | Change |
|---|---|
| `app/dashboard/garment/GarmentForm.tsx` | **New.** The form, extracted from the add page. Props: `mode: 'create' \| 'edit'`, `garmentId?`, `initial?`. |
| `app/dashboard/garment/new/page.tsx` | **Shrinks** to a thin wrapper rendering `<GarmentForm mode="create" />`. |
| `app/dashboard/garment/[id]/edit/page.tsx` | **New.** Server component: fetch garment scoped to the signed-in retailer, `notFound()` if absent, render `<GarmentForm mode="edit" …>`. |
| `app/api/garments/[id]/route.ts` | **Gains `PATCH`**, alongside the existing `DELETE`. |
| `app/dashboard/GarmentCard.tsx` | **Gains** an `แก้ไข` link in the footer bar, left of `ลบ`. |
| `lib/i18n/strings.ts` | **New labels**, each with both `th` and `en` populated. |

The card image keeps its current behaviour — it still opens the customer-facing preview in a
new tab.

## 4. Authorisation

The edit page loads the garment with `.eq('retailer_id', user.id)` and calls `notFound()` when
the query returns nothing. `PATCH` re-checks ownership independently before writing, with the
same filter, so a hand-crafted request cannot write to another shop's row. This mirrors the
existing `DELETE` handler.

An id belonging to another retailer therefore yields a 404 on read and a 404 on write — never
a partial disclosure, never a successful edit.

## 5. Reading the current rule back into the form

A garment carries three fields: `fit_profile` (always set), `fit_ruleset_id` (nullable),
`fit_rule_override` (nullable). The form has one grouped `<select>` plus one override
checkbox, so edit mode must reconstruct that UI state from the stored fields.

**Precedence — deliberately identical to `resolveRuleset()`:**

1. `fit_rule_override` present → checkbox ticked, its ruleset loaded into `FitRuleEditor`,
   select disabled.
2. else `fit_ruleset_id` present → select set to `preset:<id>`.
3. else → select set to `profile:<fit_profile>`.

Matching the engine's precedence is the point: **what the form displays is what the engine
uses.** They cannot disagree.

This mapping is a pure function and is the one piece of genuinely new logic worth unit-testing
(§8) — a bug here silently shows the retailer one rule while customers are scored under
another.

**Deleted presets need no special case.** `fit_ruleset_id` is declared
`on delete set null` (migration `0002`), so a deleted preset has already become `null` in the
row. Rule 3 applies and the form shows the profile — which is exactly what customers are
already getting.

## 6. Saving

### 6.1 Clearing an override

`POST /api/garments` treats an absent override as "there is none", which is correct when
nothing exists yet. Editing needs the opposite: **actively clearing** a custom rule to return
to a shop preset.

`PATCH` therefore takes explicit values rather than treating absence as no-change. Untick the
box and choose a preset, and the write sets `fit_rule_override = null` and
`fit_ruleset_id = <preset>`. The two columns remain mutually exclusive by construction,
enforced server-side exactly as `POST` does.

**Semantics, stated precisely:** the form always submits the complete set of editable fields,
and `PATCH` writes all of them — it is a full replacement of `name`, `category`,
`fit_profile`, `fit_ruleset_id`, `fit_rule_override` and `measurements`, not a merge of
whichever keys happen to be present. The single exception is `photo`, where absence
deliberately means "keep the current one" (§6.4); `photo_url` is the only column `PATCH` will
leave untouched. Choosing `PATCH` over `PUT` reflects that exception, and that the route does
not replace the whole row (`id`, `retailer_id`, `created_at` are never writable).

### 6.2 Validation

`PATCH` reuses the validators `POST` uses — `FitRulesetSchema`, `CATEGORY`, the profile-key
enum, the measurement bounds. Concretely: name non-empty; category one of `top|bottom|dress`;
`fit_profile` a known key; any override parsed through `FitRulesetSchema` (`.strict()`, so
unknown keys are **rejected** rather than stripped into an empty ruleset); `fit_ruleset_id` a
uuid; each measurement `0 < n <= 300`, at least one present.

Because both routes share the validators, a garment cannot be edited into a state the create
form would have refused.

> `.strict()` matters more than it looks. Without it zod strips unknown keys, so a malformed
> override parses "successfully" as an empty ruleset, `resolveRuleset()` returns that empty
> ruleset instead of falling back, and every dimension silently drops to its default — a wrong
> verdict, not an error. See `/CLAUDE.md` landmines.

### 6.3 Category change

`top` → `shoulder, chest, waist, length, sleeve`; `bottom` → `waist, hip, length`;
`dress` → all six. Changing category changes which measurement inputs exist.

- **While editing:** values typed for inputs that just disappeared are retained in component
  state, so switching back restores them. A misclick costs nothing.
- **On save:** only measurements belonging to the *new* category are persisted. The database
  never accumulates values for dimensions the garment does not have.
- **Before discarding:** if saving would drop values the retailer had entered, a confirmation
  names the affected dimensions first.

### 6.4 Photo replacement

The photo input is optional in edit mode. No file chosen → `photo_url` untouched.

A new file is written in this order, and the order is load-bearing:

1. Upload the new object to `garment-photos` under `${user.id}/${uuid}.${ext}` (same sanitised
   extension handling as `POST`).
2. Update the row's `photo_url` to the new public URL.
3. Best-effort delete of the old object.

If step 1 fails, nothing has changed and the original photo is intact. The row is never left
pointing at an object that does not exist. Step 3 failing leaves an orphaned file — harmless,
and the same trade-off `DELETE` already makes. Old-object deletion is guarded by the same
owner-prefix check the delete route uses — the derived storage path must start with the
signed-in retailer's id before anything is removed.

## 7. Deliberately unchanged

- **Fit history.** `fit_sessions` rows keep their `result` and their `applied_rule` snapshot.
  Editing a garment's measurements or rule never rewrites a past verdict. Future evaluations
  use the new values; recorded ones stay interpretable under the rule that produced them.
- **Customer-facing pages.** No code change to shop browse or the fit checker. They read the
  data being edited.
- **The fit engine.** `lib/fit/*` is untouched.
- **The database.** No migration. `fit_ruleset_id` and `fit_rule_override` already exist from
  `0002_fit_rulesets.sql`. Nothing to run in Supabase.

## 8. Verification

**Automated.** The suite is 47 pure unit tests over `lib/fit` — no route or DB coverage
anywhere. Building an integration harness is larger than this feature and stays deferred
(recorded in `resume.md`).

- **New:** unit tests for the §5 stored-fields → form-state mapping. Override wins; preset
  next; profile last; null `fit_ruleset_id` falls back to profile.
- **Unchanged:** all 47 existing tests must stay green. That is the evidence that extracting
  `GarmentForm` did not disturb the create path or the engine.
- Both `npm test` **and** `npm run build` must pass. A clean `tsc` does not mean the build
  passes here — `next lint` rejects unused imports the typechecker ignores.

**Manual — required, not optional.** The Supabase clients are untyped, so a wrong field shape
compiles clean and crashes at runtime for a real customer. Run against the live project (there
is no staging):

1. Add a garment — unchanged behaviour. *(Proves the extraction was safe.)*
2. Edit only the name — photo, measurements and rule all survive.
3. Attach a shop preset to a pre-existing garment. *(The reason this work exists.)*
4. Enable a custom rule, set numbers, save, reopen — numbers return.
5. Disable the custom rule and pick a preset — override cleared, preset in force.
6. Change category `top` → `bottom` — confirmation names the dropped dimensions; only
   new-category values are written.
7. Replace the photo — new image on the dashboard card and the public page.
8. Request another account's garment id — 404 on both the page and `PATCH`.
9. Run a customer fit check on an edited garment — the verdict reflects the new rule.

**Deploy probe.** `PATCH` is a new *method* on an existing path, so probing the path alone
proves nothing. Send a `PATCH` to `/api/garments/<uuid>`: **405** means the new code is not
live, **401** means it is.

## 9. Scope boundaries

Two things came up during design and are explicitly **not** part of this work:

- **Dashboard EN/TH toggle.** The dashboard is Thai-only: every component hardcodes `t.x.th`,
  and `LanguageProvider` wraps only `app/shop/[shop_slug]/layout.tsx`. Every new label added
  here gets a correct `en` value alongside its `th`, so no rework is needed later, but no
  English is rendered. Wiring the toggle through the dashboard is its own job — it touches
  every dashboard screen and warrants a quality pass over the existing English strings.
- **Dashboard visual design.** The founder noted the brainstorming mockups read better than
  the live dashboard's bare Tailwind. Agreed, and out of scope — a look-and-feel pass across
  the dashboard is separate work.

Both are recorded in `resume.md` under open follow-ups.

## 10. Shipping

Feature branch → both gates green → fast-forward merge to `main` → push. **Vercel builds
`main` only**; pushing the branch changes nothing on the live site. Confirm with the §8 deploy
probe before reporting the work as shipped. Full procedure in `/CLAUDE.md`.
