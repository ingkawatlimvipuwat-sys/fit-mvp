# Handoff — Custom Fit Rules (2026-08-11)

> ## ⚠️ SUPERSEDED — this is a historical document
>
> **The work described here was merged and deployed to production on 2026-08-11.** Sections 1
> and 2 below described a pre-merge state and are kept only as a record of what was decided.
>
> **For current state, read `/CLAUDE.md` then `docs/superpowers/resume.md`.**
>
> Still worth reading here: **§3** (design rationale — the ease model, why `applied_rule`
> exists) and **§4** (traps that cost real time). Those remain accurate.
>
> The older `handoff-fable5.md` is still worth reading for **product intent** (§2) and
> **how to work with the founder** (§3).

---

## 1. Where things stood at the time of writing — RESOLVED

> **Resolution (2026-08-11):** merged to `main` as a clean fast-forward and pushed
> (`7386d01 → 6819c97`, 20 commits). Verified live: `/api/fit-rulesets` returns **401** where
> a nonexistent route returns 404, confirming the new routes are deployed and auth-guarded.
>
> **Root cause of the delay:** the branch was pushed to GitHub but never merged, and Vercel
> builds `main` only — so "pushed" looked like "shipped" while production ran June's code.
> The shipping procedure is now written down in `/CLAUDE.md`.

Retailer-defined fit rules are **built, tested, and pushed — but not merged.** Branch
`feature/custom-fit-rules` is 17 commits ahead of `main` at `7f44ced`, fully pushed, and a
PR is open. `origin/main` is still `7386d01`, so **production has none of this code.**
47 tests pass, `tsc` / `next lint` / `next build` are all clean, and the migration
`0002_fit_rulesets.sql` has already been applied to the live Supabase project. The feature
was verified end-to-end against the live database by hand, including the two guarantees no
test covers.

---

## 2. The product gap — STILL OPEN, but no longer blocks merging

> **Status (2026-08-11):** merged anyway, deliberately. The gap does not make anything
> unsafe — existing garments keep their prior behaviour, guarded by a byte-for-byte
> regression test — the feature is just unreachable for garments created earlier. The
> founder's choice between the three options below is **still pending**; it is tracked in
> `resume.md` under "Open decision". Confirm before building.

**A retailer cannot apply a fit rule to a garment they already own.**

The only place a rule can be attached is `/dashboard/garment/new`. There is no garment edit
page anywhere in this app — the dashboard lists garments and lets you delete them, nothing
more. So a shop with an existing catalogue has to delete and re-create every item
(re-uploading photos) to use this feature at all.

This is not a bug in the implementation. The spec scoped §6.3 to the new-garment form only,
and the plan implemented that faithfully. **The spec had a hole**, and the founder found it
within minutes of looking at the real product. The obvious product question — *how does a
shop owner apply a rule to the clothes they already have?* — was never asked during spec
review.

The founder was mid-decision on this when the session ended. The options put to them:

| Option | Cost | Notes |
|---|---|---|
| Rule selector on dashboard garment cards + `PATCH /api/garments/[id]` | ~1 hour | Smallest fix that makes the feature usable. Reuses `FitRuleEditor` unchanged. **Recommended.** |
| Full `/dashboard/garment/[id]/edit` page | Own spec + plan | Wanted eventually; covers name, photo, measurements, rule. |
| Merge as-is, fix later | 0 | Ships a feature that only applies to garments created from now on. |

**Confirm the founder's choice before doing anything else.** Do not assume.

---

## 3. What was actually built

The design doc is `specs/2026-08-06-custom-fit-rules-design.md` (read §3 and §4.4 — they
carry the whole model). The task-by-task plan is `plans/2026-08-10-custom-fit-rules.md`.

**The core idea:** every retailer-facing surface speaks **ease** = `garment − customer` =
"how many cm roomier than the body". The engine still works internally on
`diff = customer − garment`. A pure compiler bridges them. Negative ease means the garment
measures *smaller* than the body — which is how stretchy fabric gets expressed, and why no
separate "stretch" flag was needed. That single reframing is the feature.

**New pure modules** (all unit-tested, no I/O):
- `lib/fit/rules.ts` — `EaseRule`, `FitRuleset`, `DEFAULT_RULE`, `easeRuleToBands()`
- `lib/fit/rule-schema.ts` — zod schemas shared by API routes *and* the client editor
- `lib/fit/resolve.ts` — `resolveRuleset()`, `builtinRuleset()`

**Resolution precedence** (§4.4 of the spec): `override ?? preset ?? builtinProfile`, then
per-dimension `perDimension[d] ?? base ?? d.defaultRule`. An override **replaces** a preset
rather than merging — deliberately, so "which number is in force" is answerable from one
place.

**Data model:** `fit_rulesets` table (RLS-scoped to owner), `garments.fit_ruleset_id` +
`garments.fit_rule_override` (mutually exclusive, enforced server-side in
`app/api/garments/route.ts`), and `fit_sessions.applied_rule` — a snapshot of the ruleset
that produced each verdict, written once and never updated.

**Why `applied_rule` exists:** rules are editable. Without the snapshot, every historical
session becomes uninterpretable the moment a retailer edits a preset. This was verified
live: a session evaluated under `-6/-4/3` still reports those numbers after the preset was
overwritten with `-1/1/5`. The old numbers exist nowhere else in the database.

---

## 4. Traps that cost real time — do not relearn these

**`tsc` clean does NOT mean the build passes.** `next lint` catches unused imports that the
typechecker ignores. An unused `type` import in a test file blocked `npm run build` while
`tsc` reported zero errors. **Always run both.**

**`tsc` proves nothing about Supabase query shapes.** `createSupabaseAdminClient()` returns
an untyped client, so `garment.fit_profile` is `any`. When `evaluateFit`'s signature
changed, the evaluate route would have **compiled clean and crashed at runtime on every
customer fit check** — a bare string has no `.perDimension`. For anything touching a query
result, tests and manual verification are the only real gate.

**Boundary values bite twice.** Ease exactly at `goodFrom` is `snug`, not `good_fit` (see
the verdict table in spec §3.2). Test fixtures using garment 96 / customer 100 give ease
of exactly −4 and land on the boundary. Use 97 / 100 (ease −3) for anything meant to
demonstrate `good_fit`. This error was made **twice** — once in the unit test, caught in
self-review, and again in the plan's manual smoke-test steps, caught only during the live
walkthrough. **The plan file still contains the wrong numbers in Task 14.**

**Verify subagent reports; do not trust them.** One subagent reported "47 passing" and a
clean commit while leaving its fix **uncommitted in the working tree**. As committed, that
commit failed a test. Always check `git status --short` and, when a report seems too clean,
stash and re-run against the committed state.

**The bug that fix addressed is worth understanding.** Without `.strict()` on
`FitRulesetSchema`, zod *strips* unknown keys instead of rejecting them — so a malformed
override like `{ nonsense: true }` parsed **successfully** as an empty ruleset.
`resolveRuleset` then returned that empty ruleset instead of falling back to the garment's
`fit_profile`, silently dropping every dimension to its default. A wrong verdict, not an
error. That class of failure is the one to fear in this codebase.

**Circular import hazard.** `lib/fit/rules.ts` must import from `lib/config/dimensions.ts`
with **`import type` only**. `dimensions.ts` imports `DEFAULT_RULE` as a *value* from
`rules.ts`. A value import in the other direction creates a runtime cycle and makes
`DEFAULT_RULE` `undefined` at module-init — every dimension silently getting broken bands.
Do not "tidy" that into a plain import.

---

## 5. Verification status — what is and isn't covered

**Covered by CI** (47 tests, `npm test`):
- Regression guard: `easeRuleToBands(DEFAULT_RULE)` reproduces the pre-change hardcoded
  bands byte-for-byte, asserted against a frozen golden literal. **If this fails, existing
  garments changed behaviour.**
- Built-in `slim`/`relaxed` equivalence, boundary placement, negative ease, resolution
  precedence, empty snug zone, schema rejection, malformed-rule fallback.

**NOT covered by CI — manual only:**
- That `/api/fit/evaluate` writes the correct `applied_rule`, and that it stays put when a
  preset is edited. **There is no integration-test harness in this project** — the entire
  suite is pure unit tests over `lib/fit`. Building one is larger than the feature it would
  guard, so this was consciously deferred, not overlooked.

**Verified by hand on 2026-08-11** against the live database: preset CRUD, the live preview,
validation blocking an unsaveable rule, the grouped select, the returning-customer pre-fill,
and the headline counterfactual — garment 97cm + body 100cm returning `good_fit` under
`-6/-4/3` and `too_tight` under the default, same measurements, only the rule differing.

---

## 6. Environment — corrections to the older handoff

**The `Desktop\Claude code` clone is GONE.** It was a stale second checkout, one commit
behind and missing the specs, and it was the directory Claude Code sessions defaulted into.
Its contents were deleted on 2026-08-11 (501 MB). An empty folder may still remain — it was
the live session's working directory and could not remove itself. If a session opens there,
it is a leftover shell, **not a checkout**.

**The only checkout is:**
`C:\Users\Copter\Documents\Claude\Projects\Startup poor fools\fit-mvp`

**A Supabase secret key was found in plaintext** in the deleted clone's
`.claude/settings.local.json`, baked into an approved `curl` permission rule. It was
gitignored (never reached GitHub) and the file is destroyed. **Rotation was advised but not
confirmed done — check with the founder.** The general lesson: an approved permission rule
stores the command *verbatim*, so never approve one with a credential typed inline. Pass
secrets via env vars so the rule records only the variable name.

**`gh` CLI** is installed at `C:\Program Files\GitHub CLI\gh.exe` but was **not
authenticated** as of this handoff, and it is not on the shell's PATH — invoke by full path.
The repo is private, so `WebFetch` cannot inspect PRs.

**Test data left live** at the founder's request: a garment named `TEST เสื้อผ้ายืด (ลบได้)`
is on the public shop page, and the `ผ้ายืด` preset currently holds default values
(`-1/1/5`) rather than the stretchy ones, because it was overwritten to prove the
counterfactual.

---

## 7. Decisions already made — do not reopen

- **Thai UI copy ships as placeholder.** The founder accepted the spec's non-native strings
  rather than blocking on copy review (spec §10.1). They live in `lib/i18n/strings.ts`, so
  replacing them is a one-file edit. Worth a native-speaker pass before any retailer outside
  the founder's own shop sees the dashboard.
- **Size labels stay deferred** (spec §10.4), with the deadline intact: decide **before
  onboarding a second retailer**, because after that the migration cost is someone else's
  re-typing. §3–§5 of this feature are indifferent to a later size-variant change; §6.3, the
  garment form, is what gets revisited.
- **`fit_rule_override` is anon-readable** and this is accepted, with reasoning recorded in
  spec §4.2 and in the migration's comments. `garments` carries a blanket anon SELECT policy.
  It is the retailer's own thresholds, not customer data. **Do not tell retailers their rules
  are secret.** A noted follow-up: `garments_public_read` looks vestigial, since no code path
  uses the anon client for garments.

---

## 8. Known follow-ups (all recorded in `resume.md`)

- **Summary misreads negative ease.** `summarize()` in `FitRulesManager.tsx` renders
  "พอดีเมื่อกว้างกว่าตัว -4–3 ซม." — "wider than the body by minus four cm". Display only;
  verdicts unaffected. Misreads precisely for the stretchy case the feature exists for.
- No integration-test harness (see §5).
- `tsc`-clean ≠ safe on Supabase query results (see §4).

---

## 9. First moves

> **Superseded — step 1 is stale.** `feature/custom-fit-rules` is merged; work from `main`.
> Current orientation lives in `/CLAUDE.md`. Steps 2 and 4–6 still apply as written.

1. ~~`cd` to the Documents checkout. Confirm `git branch --show-current` →
   `feature/custom-fit-rules`.~~ Work from `main` (at `6819c97` or later).
2. `npm install` if fresh, then `npm test` (**expect 47 passing**) and `npm run build`
   (expect green). If either fails, stop and diagnose — do not build on a broken base.
3. **Ask the founder which option from §2 they want** *if you are picking up the garment-edit
   gap.* It no longer gates everything — the feature is shipped — but it is still unanswered.
4. Whatever you build, keep `main` deployable — it auto-deploys to Vercel. Merging to `main`
   **is** the deploy step; pushing a feature branch is not.
5. The founder is non-technical: give click-by-click instructions for anything they must do
   themselves (SQL, Vercel, `gh auth login`), and never ask them to hand over credentials.
6. Delegate mechanical work to Sonnet subagents — the founder is cost-conscious and asked
   for this explicitly. Keep design, verification, and judgment in the main session, and
   **verify every subagent report against the actual repo state** (see §4).
