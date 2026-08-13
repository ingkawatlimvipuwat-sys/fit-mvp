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

**Branch:** `main` — at `6819c97`, pushed, deployed.
**Status as of 2026-08-11:** Phase 1 + language toggle + **custom fit rules** all live in
production. Prototype.

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

## Decided 2026-08-13 — garment edit page (spec approved, not yet built)

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

Design: **`specs/2026-08-13-garment-edit-design.md`**. Implementation plan still to be written.

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
| UX | No loading skeleton on shop browse page |
| UX | No back-navigation from hero page to shop browse page |
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
                           (47 Vitest tests across all three test files, all passing)
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
    AddGarmentModal.tsx  — garment form with Supabase Storage photo upload
```

---

## Open follow-ups (non-blocking)

- `lib/config/dimensions.ts`: make `ThresholdBand[]` `readonly`.
- `lib/i18n/strings.ts`: apply `as const` for narrower literal types.
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
