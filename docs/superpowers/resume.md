# Resume — Fit Recommendation MVP

> **For the agent starting a fresh session:** Read `/CLAUDE.md` first (shipping procedure,
> verification gates, landmines), then this file for current state and the file map.
>
> **This is the state doc of record.** Three handoff docs already exist because each session
> wrote a new one, which is why the founder got lost. Update this file; do not add a fourth.

---

## Project at a glance

Single-tenant web app for one Thai clothing retailer. Customers visit a public shop link, enter body measurements, get per-dimension fit feedback. Virtual try-on (VTO) is deferred to Phase 2. Phase 1 leaves data hooks ready.

**User:** Ingkawat Limvipuwat (non-technical founder). Email on commits: `ingkawat.limvipuwat@gmail.com`. Walk through each step with explanations.

---

## Tech stack (locked)

- Next.js 14.2.35 App Router, TypeScript strict, Tailwind 3, App Router native (no Pages router)
- Supabase: Auth + Postgres + Storage (`garment-photos` bucket, public-read)
- `@supabase/supabase-js@2.106.x`, `@supabase/ssr@0.10.x`, `zod@4.x`, `vitest@4.x`, `server-only`
- Vercel deploy target — **live**

---

## Current state

**Branch:** `main` — at `d56230a`, pushed, deployed (verified by route probe, not assumed).
**Status as of 2026-09-11:** Phase 1 + language toggle + **custom fit rules** + **garment
edit page** all live in production. Prototype. 155 tests (89 pure + 66 added by the colour &
fabric branch, which includes this project's first component tests).

**Colour & fabric is BUILT but NOT SHIPPED** — see its section below. The migration must be
applied before that branch is merged, or every shopper garment page 500s.

**Live:** https://fit-mvp-eight.vercel.app

### How this gets to production

Vercel builds **`main` only**. Pushing a `feature/*` branch puts code on GitHub but changes
nothing on the live site. Merge to `main` and push, then verify the deploy landed by probing a
route that only exists in the new code (404 = not deployed). Full procedure in `/CLAUDE.md`.

This bit the project on 2026-08-11: `feature/custom-fit-rules` sat pushed-but-unmerged, 20
commits ahead, while the live site showed none of it. Merged and deployed the same day.

### Done

- ✅ **Phase 1.1 Scaffold** (Tasks 1–10): Next.js, Vitest, Supabase project + migration, client wrappers, Thai landing page.
- ✅ **Phase 1.2 Auth** (Tasks 11–14): i18n strings, signup, login, dashboard layout + middleware + logout.
- ✅ **Phase 1.3 Dashboard + Add garment** (Tasks 15–19): `lib/config/dimensions.ts` + `fit-profiles.ts`, Storage bucket `garment-photos`, dashboard list + copy-link, add-garment form with photo upload.
- ✅ **Phase 1.4 Public shop + Hero fit checker** (Tasks 20–23): fit engine + TDD, `customer_token` localStorage helper, `/shop/[shop_slug]` browse, hero fit-checker + `/api/fit/evaluate` + `/api/fit/last`.
- ✅ **Phase 1.5 Deploy** (Tasks 24–25): GitHub (`ingkawatlimvipuwat-sys/fit-mvp`), Vercel, live.
- ✅ **Language toggle**: EN/TH toggle in shop header, persisted to `localStorage('fitmvp.lang')`, switches all UI labels. Shop name and garment names stay as retailer-entered text.
- ✅ **Custom fit rules** (merged + deployed 2026-08-11): retailers define their own fit
  thresholds in **ease** (`garment − customer` = "how many cm roomier than the body"). Preset
  CRUD at `/dashboard/fit-rules`, per-garment override on the new-garment form, and an
  `applied_rule` snapshot on every `fit_session` so historical verdicts stay interpretable
  after a preset is edited. Negative ease expresses stretchy fabric, so no separate stretch
  flag was needed. Design: `specs/2026-08-06-custom-fit-rules-design.md` §3 and §4.4.

---

## Garment edit page — SHIPPED 2026-08-15

**A retailer cannot apply a fit rule to a garment they already own.**

A rule can only be attached at `/dashboard/garment/new`. There is no garment edit page — the
dashboard lists and deletes, nothing more. So a shop with an existing catalogue would have to
delete and re-create every item, re-uploading photos, to use the feature at all.

This is not an implementation bug: the spec scoped it to the new-garment form and the plan
built that faithfully. **The spec had a hole.** The feature is shipped and safe — existing
garments keep their previous behaviour, guarded by a byte-for-byte regression test — it is
simply unreachable for anything created before a rule existed.

**Resolved 2026-08-13.** The founder chose the largest of the three options: a **full edit
page** at `/dashboard/garment/[id]/edit` covering name, category, garment measurements, fit
rule **and photo replacement**, built from a `GarmentForm` component shared with the
add-garment page (create/edit modes) plus a new `PATCH /api/garments/[id]`.

No migration needed — `fit_ruleset_id` and `fit_rule_override` already exist.

**Shipped 2026-08-15.** Merged `feature/garment-edit` → `main` as a clean fast-forward
(`2f91831..d56230a`, 16 commits, 18 files) and pushed. 89 tests, clean build. Founder ran the
manual checks locally first.

**Deploy verified by probe, not assumed** — and verified against three controls, because a
blanket 401 would otherwise look like success: `PATCH /api/garments/<uuid>` → **401** (handler
live), `PATCH /api/garments` → **405** (route exists, no PATCH export, so the 401 is not
blanket), nonexistent route → **404** (no Vercel deployment protection faking it).

Design: **`specs/2026-08-13-garment-edit-design.md`**.
Plan: **`plans/2026-08-13-garment-edit.md`** — read its "Post-review amendments" section, which
records what changed during execution and supersedes the earlier task text.

**Three bugs were found by review, none by tests, and none detectable by the §8 checklist.**
All three were silent-wrong-data that would surface long after the change:
- Attaching a preset to an existing garment overwrote its stored `fit_profile` with `regular`.
  Verdicts stayed correct (a preset outranks the profile), but deleting that preset later would
  drop the garment to `regular` rather than its real profile — contradicting what
  `t.fitRuleDeleteConfirm` promises the retailer. Now pinned by a regression test.
- `PATCH` rewrote `photo_url` on every save using a value read earlier in the request, so a
  concurrent save could leave a garment pointing at a just-deleted Storage object.
- Ticking "custom rule for this garment" left the disabled select still displaying the shop
  preset that the save was about to discard.

The lesson for future specs here: a manual checklist that only inspects *current* behaviour
cannot catch a wrong value that is currently outranked by something else.

---

## RESOLVED — the fit-rules page was effectively unreachable (found 2026-08-15, fixed 2026-08-18)

**The only route to `/dashboard/fit-rules` is the words `กฎของร้าน` as small grey text in the
dashboard header, beside Logout** (`app/dashboard/layout.tsx:30`). Nothing on the dashboard
page itself points to it.

The founder — who commissioned the feature and whose account owns a preset — concluded it had
never been built, and believed an entire session's work had been lost. Diagnosis needed a
direct query against the live database to prove otherwise. A retailer being onboarded would
simply never find it.

**Nothing is wrong with the feature.** Verified 2026-08-15: `fit_rulesets` exists and holds the
`ผ้ายืด` preset; a garment references it; another carries a `fit_rule_override`; migration 0002
is fully applied; exactly one auth account exists and it owns that preset; anon is correctly
blocked. This is a discoverability defect, not a code defect.

**A second, compounding problem:** `app/dashboard/fit-rules/page.tsx:13` destructures only
`data` and discards the query error, so a genuine database failure renders as
`ยังไม่มีกฎของร้าน` — "no shop rules yet" — indistinguishable from a healthy empty account.
That ambiguity is why a database probe was needed rather than a glance at the screen. Fix
regardless of what happens to navigation.

**Resolved 2026-08-18.** The founder chose tabs under the header. `app/dashboard/DashboardNav.tsx`
renders a Garments / กฎของร้าน tab row on every dashboard route, so the rules page has a
permanent visible entry point and dashboard subpages have a way back. The swallowed query
error is fixed too: `app/dashboard/fit-rules/page.tsx` now surfaces `t.fitRulesLoadFailed`
and suppresses the "no rules yet" empty state when the load actually failed.

## Colour & fabric reference — BUILT on `feature/colour-fabric`, NOT SHIPPED (2026-09-11)

Early user feedback: buyers get garments whose colour or fabric finish does not match the
photo. Founder brainstormed and approved a design: colour swatches (hex + name, unlimited
list) and fabric chips (finish / thickness / stretch / feel) plus a collapsed technical tier,
shown as **Fit / Colour / Fabric** tabs on the shopper garment page and colour dots on the
shop grid. Separate tables `garment_colours`, `garment_fabric`; one new column on `garments`.

Spec: **`specs/2026-09-10-colour-fabric-design.md`**
Plan: **`plans/2026-09-11-colour-fabric.md`** — read its two sections at the end,
"Post-review amendments" and "ORDERING IS NOT OPTIONAL", before doing anything with this branch.

**State:** 14 commits on `feature/colour-fabric`, 155 tests passing, clean build. Nothing merged,
nothing pushed, migration NOT applied. The live site is untouched.

### Two things must happen before this ships, in this order

**1. Apply the migration FIRST, before merging.** Verified against the live database on
2026-09-11: `garments?select=true_colour_photo_url` returns `400 / 42703 column does not exist`.
The shopper garment page's existing guard rethrows anything that is not `PGRST116`, so merging
before the SQL runs **500s every shopper garment page** — the one page customers actually use.
The migration is purely additive (one nullable column, two new tables, their policies) and the
deployed code references none of it, so applying it while `main` is still the old code is safe and
is the correct order. Re-probe and confirm 200 before merging.

**2. Founder manual check (~10 min), and proofread the Thai.** On a phone: add a garment with 3
colours and fabric set, open the shop link, confirm the swatches look like the real garment under
daylight. Then edit, remove one colour, save, confirm the other two survived. Then edit again
changing *only the name* and confirm the colours and both photos are still there — that last step
is the "absent means keep" invariant seen from outside. Thai copy in `strings.ts` is a first draft;
`feelCrisp` (`แข็งอยู่ทรง`, for "crisp") is the one most worth a second opinion.

### What the tests do and do not cover

This branch added the project's **first component tests** — `jsdom` + `@testing-library/react`,
with `oxc: { jsx: { runtime: 'automatic' } }` in `vitest.config.ts`. Component test files opt into
jsdom per file with a `// @vitest-environment jsdom` docblock, so the pure tests still run in node.

Two harness traps, both already paid for:
- `tsconfig.json` sets `"jsx": "preserve"` for Next, and **vite 8 transforms with oxc, not
  esbuild** — an `esbuild: { jsx: 'automatic' }` block is silently ignored with only a warning.
- **`@testing-library/react`'s auto-cleanup does not arm on this project** because vitest runs
  without `globals: true`. Every component test file needs an explicit `afterEach(cleanup)` or
  renders leak between tests and you get "multiple elements found".

Still **no route or database coverage**. The API behaviour in `app/api/garments/*` is pinned only
at the pure-parser layer (`colour-fabric-regression.test.ts`), the same way `round-trip.test.ts`
pins the edit page. There is no staging Supabase — one project serves dev and production — so
route tests would write to live data.

### Three bugs found by review, none by tests

- **PATCH deleted the old fabric photo when nothing pointed at the new one.** The write that would
  have referenced the upload sits behind `if (fabricParse.present)`, so a request carrying a fabric
  photo and no `fabric` field destroyed the stored object while the surviving row still referenced
  it — a permanently broken image. Same shape as the `photo_url` concurrency bug from the edit page.
  Fixed in `59814f2`.
- **`GarmentForm` read `e.currentTarget` about twenty lines into `onSubmit`.** Correct today, but
  React nulls it once the handler stops running synchronously, so any future `await` added above
  that line would have made both new photo uploads silently stop working. Hoisted in `975a4b9`.
- **`isFabricEmpty` was typed `Record<string, unknown>`**, which an interface without an index
  signature is not assignable to, so every caller holding a real database row needed its own double
  cast. Widened to `object` with one internal cast in `148944d`.

### Decisions worth knowing

- **Absent vs empty is load-bearing and the spec never stated it.** An absent `colours` field means
  "leave the data alone"; a present `[]` means "replace it with nothing". Colours are replace-all,
  so collapsing the two would let any client that predates this feature silently wipe a retailer's
  colour list. `parseColoursField` returns a `present` flag for exactly this, and the regression
  test pins it.
- **The fabric row is written with an explicit insert-or-update, not `.upsert()`.** The spec said
  upsert; PostgREST's `ON CONFLICT` column set is not obvious and guessing it wrong would silently
  drop an existing `fabric_photo_url` on any save without a new file.
- **`DELETE` now cleans up all three photos.** The cascade removes the child rows; Storage objects
  are not in the database and would have been orphaned forever.
- **The two new shopper queries joined the existing `Promise.all`**, and the grid does one grouped
  colour query for the whole page — no N+1.
- **The Fit panel stays mounted when another tab is active**, hidden by the `hidden` attribute.
  `FitChecker` holds the shopper's typed measurements in local state, so unmounting it would clear
  a half-filled form. Pinned by a test; do not "tidy" it into a conditional render, and do not put
  a `flex`/`grid` class on those wrappers (a display utility beats `[hidden] { display: none }`).

### Known gaps, deliberately left

- **There is no way to remove a fabric photo**, only to replace it. So once a fabric row has a
  photo it can never become empty enough to be deleted. Harmless, but it means a retailer cannot
  fully retract fabric information.
- **Child-row writes log and continue rather than failing the request.** A retailer whose colours
  silently failed to save sees a successful save. Acceptable for a one-retailer prototype.
- AI colour extraction, catalogue organisation, and colour search/filter are all deferred by the
  spec's section 9.

Second feedback item — **catalogue organisation** (categories, variants, sorting for shops
with hundreds of items) — is deliberately deferred to its own future spec.

## UX audit executed — 2026-08-18

Branch `feature/ux-audit-2026-08-18`, 14 commits. Source: `docs/superpowers/ux-audit-2026-08-18.md`.
Run as six parallel Sonnet subagents on disjoint file sets, with all shared Thai copy written
into `lib/i18n/strings.ts` up front as a single commit so the agents could not collide on it.

**Shipped:**

| Item | What changed |
|---|---|
| A1 | Dashboard header is now dark (`bg-gray-900`) with a `แดชบอร์ดร้านค้า` badge — it can no longer be mistaken for the white customer header. This was the root cause of the founder's "which side am I on" complaint. |
| A2 | Per-page titles on dashboard, login, signup, both garment form routes, shop, and garment. The garment and edit routes name the item, so two tabs are tellable apart. |
| B1 | Login ⇄ signup cross-links, plus a "back to home" link on both. |
| B2 | Three Thai-first not-found boundaries, each with a route home: root (`ไม่พบหน้านี้`), shop-level for a bad slug (`ไม่พบร้านค้านี้`), and garment-level for a dead item link (`ไม่พบสินค้านี้`). The shop/garment split came out of the live walkthrough — one boundary served both, so a truncated shop link wrongly answered "item not found". |
| B3 + C2 | `DashboardNav.tsx` tab row — see the resolved section above. |
| B4 | Customer header shop name is a link to the shop. |
| B5 | Logged-out redirect carries `?reason=auth`; login shows a notice instead of appearing to jump at random. |
| B6 | Landing page tells customers to open the link their shop sent them. |
| C1 | Fit results no longer print the raw signed diff. See the commit — the sign convention is the important part. |
| C3 | fit-rules load failure is surfaced instead of reading as "no rules yet". |
| C4 | Wrong email/password gets its own Thai message; everything else still falls back to the generic one, and raw Supabase English still never reaches the UI. |
| C5 | Pre-filled measurements are explained, with a clear button. |
| D2 | Cancel confirms before discarding typed work, on both the garment form and the fit-rules editor. |
| D3 | Ticking "ปรับเฉพาะสินค้านี้" seeds the editor from the rule actually in force, not the global default. |
| D4 | Rule summary phrases negative ease as "แคบกว่าตัว" instead of rendering an unreadable `-4–3`. |

**Not done, deliberately:**

- ~~**C6 — dashboard EN/TH toggle.**~~ Done 2026-08-18 after the founder asked for it — see
  "Language coverage" below.
- **D1** (native `confirm`/`alert` on garment delete), **D5** (one validation error at a time),
  **D6** (hardcoded `(cm)` — the audit explicitly says do not "fix" this), **D7** (`ไม่ได้ระบุ`
  rows for unfilled dimensions). All judged acceptable for an MVP.

**Verification:** `npm test` 89 passing, `npm run build` clean, 16 routes. The suite still
covers `lib/fit` only — every change above is UI and none of it is under test.

The **customer side was walked in a browser** against a local dev server on 2026-08-18 and
confirmed live: per-page titles (`test — Fit MVP`, `test shirt — test`), the shop name as a
working link, all three not-found boundaries, the prefill notice with a `type="button"` clear
control, and the C1 result wording — garment chest 66 vs customer 70 renders
`คับเกินไป` + `เล็กกว่าตัว 4.0 ซม.`, shoulder 69 vs 65 renders `พอดี` + `ใหญ่กว่าตัว 4.0 ซม.`,
and unfilled dimensions show no number at all. That walkthrough wrote one `fit_sessions` row
to the live database, since there is no staging.

The **dashboard side has still NOT been seen in a browser** — it needs a logged-in session.
The dark header, the badge, the nav tabs, the logout contrast fix, the fit-rules load-failure
notice, and both discard guards are backed only by a clean build. Worth ten minutes with a
real login before trusting them.

**Process note for the next agent.** Six agents sharing one working directory produced two real
hazards, both worth avoiding rather than rediscovering:
1. **Concurrent `next build` corrupts a shared `.next/`.** Three agents hit phantom failures in
   each other's files before builds were centralised. Have subagents run
   `npm test` + `npx tsc --noEmit` + `npx next lint`, and run the one authoritative
   `npm run build` yourself after they land.
2. **`git commit` commits the whole index, not just what you staged.** A `git add <path>`
   followed by `git commit` swept three agents' staged files into one unrelated commit. Use
   `git commit -- <paths>`, which commits the named paths regardless of index state. The
   history was split back apart afterwards and the resulting tree verified identical, but it
   is far cheaper not to do it in the first place.

---

## Language coverage — where TH/EN works, and where it cannot

Added 2026-08-18 (audit item C6 plus follow-ups the founder asked for).

**The toggle now covers:** the customer shop pages (as before), login, signup, and the whole
retailer dashboard — header, nav tabs, garment list and cards, the garment form, and the
fit-rules pages including the rule editor.

**The landing page is bilingual without a toggle.** It shows Thai with muted English beneath,
including on the login and signup buttons. It is a server component and the founder liked the
side-by-side reading, so it was deliberately left that way.

**How it is wired.** `LanguageProvider` (`lib/hooks/useLanguage.tsx`) now wraps three subtrees:
`app/shop/[shop_slug]/layout.tsx`, `app/login/layout.tsx` + `app/signup/layout.tsx`, and
`app/dashboard/layout.tsx`. One `localStorage` key (`fitmvp.lang`) backs all of them, so the
preference is per-browser and shared across the retailer and customer sides. `app/LanguageToggle.tsx`
is the single shared control; it takes `tone="dark"` on the dashboard header because its active
state is a dark pill that would be invisible on `bg-gray-900`.

**The constraint that shaped the work:** `LanguageProvider` is React context, so ONLY client
components can call `useLanguage()`. Several dashboard routes are async server components that
query Supabase and cannot. Rather than converting them (which would have moved database work to
the client), their text-bearing markup was extracted into small client components:
`DashboardHeader.tsx`, `AddGarmentLink.tsx` and `GarmentGrid.tsx` came out of
`layout.tsx`/`page.tsx`, and the fit-rules heading and load-failure line moved into
`FitRulesManager`. **If you add a user-visible string to a server component, this is the pattern
to follow.**

**What is still Thai-only, and why:**

- **Browser tab titles.** `metadata` and `generateMetadata` run on the server before any client
  code, so they cannot see `localStorage`. Every title is Thai. Fixing this properly needs the
  language in the URL or a cookie — a routing change, not a string change.
- **Server-side API error messages** (e.g. `app/api/garments/route.ts`, `app/api/signup/route.ts`)
  are Thai strings chosen on the server. The signup page deliberately passes `data.error`
  through untranslated because the API owns that copy.
- **`(cm)` in measurement labels** — Latin in both languages. Audit item D6 says explicitly not
  to "fix" this.

**The English is not proofread.** `strings.ts` carried `en` values for every key from early on,
but they were written as a fallback nobody expected to see. They are now visible on every screen.
A copy pass is worth doing before showing this to an English-speaking retailer.

---

## Architecture decisions in force

- **Fit logic:** customer vs garment thresholds — garment measurements = the garment's own size. `good_fit` = garment 1–5 cm roomier than body. Per-dimension config + named fit profiles (`regular`/`slim`/`relaxed`) override the bands.
- **Modularity:** single `lib/config/dimensions.ts` is source of truth — forms, validation, fit engine, and dimension labels all read from it. Adding a new dimension = one entry there; no DB migration.
- **Phase 2 readiness:** `fit_sessions.tryon_image_url` column reserved (always null in Phase 1). `customer_token` ties multiple sessions per anonymous customer. See spec §13.
- **Server-only boundary:** `lib/supabase/server.ts` has `import 'server-only'`. Admin (service-role) client lives there. Client components import only from `lib/supabase/browser.ts`.
- **MeasurementBag** typed as `Partial<Record<DimensionKey, number>>` — derived from `DimensionKey` in dimensions.ts.
- **Language:** React Context via `LanguageProvider` (`lib/hooks/useLanguage.tsx`) wraps the shop route via `app/shop/[shop_slug]/layout.tsx`. `useLanguage()` hook reads/writes context + localStorage. All shop client components call `useLanguage()` — they share one context so toggling in ShopHeader reactively updates FitChecker and NoGarments.
- **Language scope:** only built-in UI strings (from `lib/i18n/strings.ts` and `DIMENSIONS[*].labelEn/measureHintEn`). Retailer content (shop name, garment names) is never translated.

---

## Prototype status

This is a working prototype. It is used in production but has rough edges that need attention before a real launch.

### Known deferred-polish items

| Area | Item |
|------|------|
| ~~Fit engine~~ | ~~Boundary tests at diff = ±1 and ±5~~ — done, see `resolve.test.ts` |
| Types | `lib/config/dimensions.ts`: make `ThresholdBand[]` `readonly` |
| Types | `lib/i18n/strings.ts`: apply `as const` for narrower literal types |
| Dashboard | `app/dashboard/layout.tsx`: add comment noting orphan-retailer-row is recoverable via Supabase Studio |
| API | `app/api/garments/route.ts`: map raw dimension keys to Thai labels in error messages |
| Security | `npm audit`: 5 vulnerabilities from Next.js 14.2 — unreachable in this app; fix with Next.js 15 upgrade post-launch |
| FitChecker | `garmentMeasurements` prop removed to fix ESLint build failure. Re-add in Phase 2 for client-side comparison display |
| ~~UX~~ | ~~No loading skeleton on shop browse page~~ — done, `loading.tsx` exists for browse and garment pages. Stale entry, verified live 2026-08-18. |
| ~~UX~~ | ~~No back-navigation from hero page to shop browse page~~ — done, `BackLink.tsx` ships `← กลับไปหน้าร้าน`. Stale entry, verified live 2026-08-18. |
| ~~UX~~ | ~~**Full UX audit 2026-08-18**~~ — executed 2026-08-18 on `feature/ux-audit-2026-08-18`. Sections A, B, C1/C3/C4/C5 and D2/D3/D4 are done. See "UX audit executed" below for what remains. The audit doc itself stays as the record of what was found. |
| UX | Language preference tied to browser localStorage, not to a customer account — if the customer switches device or browser, preference resets |
| Storage | Typo bucket `garmet-photos` exists in Supabase Storage alongside the correct `garment-photos` — unused, harmless, but delete it eventually |

### Things that will definitely need changing before production

- **Customer account system (Phase 3):** measurements and language preference should be tied to an account, not to device localStorage. The `customer_token` pattern is an anonymous MVP placeholder.
- **Multi-shop support:** currently the app assumes one retailer = one shop. The schema supports more, but the UX, pricing, and onboarding flow don't.
- **Fit engine calibration:** the threshold bands (±1 cm snug, 1–5 cm good fit, >5 cm loose) are best guesses. Real-world testing with actual garments + actual customers will produce better numbers.

---

## Environment

- **Live site:** https://fit-mvp-eight.vercel.app — Vercel, auto-deploys from **`main` only**.
- **Supabase project:** `fit-mvp` (Singapore region, free tier). **One project serves both local
  dev and production — there is no staging.** Local data changes are live changes, and a
  migration applied from a dev session is applied to production.
- **Migrations:** `supabase/migrations/` (`0001_initial.sql`, `0002_fit_rulesets.sql`). Applied
  by hand through the Supabase SQL editor, not by tooling. Both are applied.
- **GitHub repo:** `ingkawatlimvipuwat-sys/fit-mvp`
- **Storage bucket:** `garment-photos` (public-read).
- **Test data left live** (deliberately, 2026-08-11): a garment named `TEST เสื้อผ้ายืด (ลบได้)`
  is on the public shop page, and the `ผ้ายืด` preset holds default values (`-1/1/5`) rather
  than stretchy ones — it was overwritten to prove a counterfactual. Safe to delete.
- **Env vars** (in `.env.local`, gitignored; also set in Vercel):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

---

## File map (key files for next agent)

```
lib/
  config/
    dimensions.ts        — DimensionKey, DIMENSIONS[], dimensionsForCategory(), dimensionByKey()
    fit-profiles.ts      — named fit profiles (regular/slim/relaxed)
  fit/
    rules.ts             — EaseRule, FitRuleset, DEFAULT_RULE, easeRuleToBands() [pure]
    rules.test.ts        — compiler + regression guard vs. the pre-change bands
    rule-schema.ts       — zod schemas shared by API routes and the client editor
    resolve.ts           — resolveRuleset(), builtinRuleset() [pure, no I/O]
    resolve.test.ts      — schema validation + resolution precedence + boundaries
    engine.ts            — evaluateFit(garment, customer, ruleset) → FitResult
    engine.test.ts       — engine behaviour
    rule-selection.ts    — ruleSelectionForGarment(): stored rule columns → edit-form state.
                           Mirrors resolveRuleset() precedence so the form always displays the
                           rule the engine actually applies. [pure]
    rule-selection.test.ts
  garment/
    parse-form.ts        — parseGarmentFields(): the single definition of "a valid garment",
                           shared by POST and PATCH so they cannot drift. No photo, no I/O. [pure]
    parse-form.test.ts
    form-fields.ts       — activeMeasurements(), strandedDimensions(), buildGarmentFields():
                           form state → the flat field set the API parses. [pure]
    form-fields.test.ts
    round-trip.test.ts   — stored columns survive ruleSelectionForGarment → buildGarmentFields
                           → parseGarmentFields unchanged, in all three rule states. The only
                           automated defence against a column-name slip, given untyped clients.
                           (89 Vitest tests across 7 files, all passing)
  hooks/
    useLanguage.tsx      — LanguageProvider + useLanguage() hook (Lang = 'th' | 'en')
  i18n/
    strings.ts           — t: { key: { th, en } } — all UI copy
  supabase/
    server.ts            — createSupabaseAdminClient(), createSupabaseServerClient() [server-only]
    browser.ts           — createSupabaseBrowserClient()
    types.ts             — DB row types, MeasurementBag, Category
  customer-token.ts      — getOrCreateCustomerToken() — UUID in localStorage

app/
  shop/[shop_slug]/
    layout.tsx           — LanguageProvider wrapper (server component rendering client provider)
    page.tsx             — browse page (server, force-dynamic)
    ShopHeader.tsx       — shop name + TH/EN toggle (client)
    NoGarments.tsx       — localized empty state (client)
    [garment_id]/
      page.tsx           — hero page (server, force-dynamic)
      FitChecker.tsx     — measurements form + results (client, uses useLanguage)
  api/fit/
    evaluate/route.ts    — POST: validate → fetch garment → evaluateFit → insert fit_session
    last/route.ts        — GET: return last customer_measurements for token
  dashboard/
    page.tsx             — retailer garment list + copy-link
    layout.tsx           — auth guard (middleware-backed)
    CopyPublicLink.tsx   — client component (useEffect for window.origin, avoids hydration mismatch)
    GarmentCard.tsx      — card with preview link, แก้ไข (edit) and ลบ (delete)
    garment/
      GarmentForm.tsx    — THE garment form, create + edit modes. Props are a discriminated
                           union, so mode="edit" cannot compile without `initial`. Measurement
                           inputs are controlled and keyed across all categories, so switching
                           category hides values rather than losing them.
      new/page.tsx       — wrapper: <GarmentForm mode="create" />
      [id]/edit/page.tsx — owner-scoped fetch → notFound() → <GarmentForm mode="edit" />
  api/garments/
    route.ts             — POST (create)
    [id]/route.ts        — PATCH (full replacement of editable columns; photo absent = keep)
                           and DELETE, sharing removeStoredPhoto()/removeStoredObject()
```

---

## Open follow-ups (non-blocking)

- `lib/config/dimensions.ts`: make `ThresholdBand[]` `readonly`.
- ~~`lib/i18n/strings.ts`: apply `as const`~~ — already done; the file has ended with `} as const;` for some time. Stale entry, removed 2026-08-15.
- **`fit_ruleset_id` is validated as a uuid but never checked for ownership** (`lib/garment/parse-form.ts`). The foreign key proves the preset exists, not that it belongs to the caller, so a hand-crafted POST/PATCH could attach another shop's preset and `/api/fit/evaluate` would resolve it. Harmless while there is one retailer; fix before onboarding a second.
- **The preset stand-in label `…` becomes permanent if `/api/fit-rulesets` fails to load.** `GarmentForm.tsx` conflates "not loaded yet" with "load failed", so in edit mode a network error leaves the retailer looking at an ellipsis where their garment's rule should be. Saving still preserves the correct id, so no data is harmed.
- **`strandedDimensions()` would blame the retailer for a change they didn't make** if a dimension is ever moved between categories in `lib/config/dimensions.ts`. The confirmation says "you changed the category"; every existing garment would pop it on save. Compare against the garment's original category before warning.
- **`parseGarmentFields()` returns English for four validation paths** (`name required`, `invalid category`, `invalid fit_profile`, `invalid fit_ruleset_id`) while its other messages are Thai. The client validates ahead of all four, so they are normally unreachable — a stale tab could surface them.
- **The file-extension sanitisation is duplicated** verbatim between `app/api/garments/route.ts` and `app/api/garments/[id]/route.ts`. Both must produce the same Storage key shape; extract if either is touched again.
- **`FitRuleEditor` always seeds a new override from `DEFAULT_RULE`**, never from the profile or preset currently in force, so ticking the override on a `slim` garment silently starts at regular's numbers.
- `app/dashboard/layout.tsx`: add TODO noting orphan-retailer-row is recoverable via Supabase Studio.
- `app/api/garments/route.ts`: map raw dimension keys to Thai labels via `dimensionByKey()` in error messages.
- `npm audit`: 5 vulnerabilities from Next.js 14.2 — unreachable; fix with Next.js 15 upgrade post-launch.
- `FitChecker.tsx` `garmentMeasurements` prop removed (ESLint). Re-add in Phase 2 for client-side comparison display.
- ~~Fit engine boundary tests at diff = ±1 and ±5.~~ Done in `lib/fit/resolve.test.ts`.
- **Fit rule summary reads wrong for negative ease.** `summarize()` in `app/dashboard/fit-rules/FitRulesManager.tsx` renders a rule as "พอดีเมื่อกว้างกว่าตัว {goodFrom}–{goodTo} ซม." That template assumes positive ease, so a stretchy rule shows "กว้างกว่าตัว -4–3 ซม." — "wider than the body by minus four cm". Verdicts are unaffected; only this one-line list summary. It misreads precisely for the stretchy case the feature exists for, so worth fixing before more retailers see the dashboard.
- **Integration-test harness.** The suite is pure unit tests over `lib/fit` — no route or DB coverage anywhere. The one guarantee this leaves unverified by CI is that `/api/fit/evaluate` writes the correct `applied_rule` and that it stays put when a preset is edited. Verified manually for now.
- **`tsc` clean does not mean `build` clean** on this project — `next lint` catches unused imports that the typechecker ignores. Run both before claiming green.
- **Supabase clients are untyped** (no generated `Database` generic), so `.from('garments')` returns `any`. A wrong field shape compiles clean and fails at runtime. Do not treat a green typecheck as verification for anything touching a query result.
- **Dashboard is Thai-only — no EN/TH toggle.** Every dashboard component hardcodes `t.x.th`; `LanguageProvider` wraps `app/shop/[shop_slug]/layout.tsx` only, so the toggle exists on customer-facing pages and nowhere else. `strings.ts` already carries `en` for everything, so the work is wiring the dashboard components to `useLanguage()` — plus a quality pass over the existing English, which was written as placeholder. Raised by the founder 2026-08-13; scoped out of the garment-edit work, which still writes correct `en` values for every new label so none of it needs redoing.
- **Dashboard visual design is bare.** The founder saw the brainstorming mockups on 2026-08-13 and preferred them to the live dashboard's unstyled Tailwind. A look-and-feel pass across the dashboard is wanted, deliberately deferred so it does not ride along with a functional fix.

---

## Phase 2 notes (VTO)

Hooks already in place for Phase 2 Virtual Try-On:
- `fit_sessions.tryon_image_url` nullable column (always null in Phase 1)
- `customer_token` persisted per browser
- `fit_profile` column on garments
- `garment-photos` Storage bucket reusable
- See spec §13 for full readiness checklist

## Phase 3 notes (Customer accounts)

Deferred. Will centralize:
- Body measurements (so customers don't re-enter per shop)
- Language preference (so switching device doesn't reset language)
- Fit history across shops

Current `customer_token` (opaque UUID, localStorage) is the placeholder. Phase 3 replaces it with authenticated sessions.
