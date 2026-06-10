# Resume — Fit Recommendation MVP

> **For the agent starting a fresh session:** Read this first, then `docs/superpowers/plans/2026-05-25-fit-recommendation-mvp-phase1.md`. The plan is the canonical task list; this note is just "where are we right now."

## Project at a glance

Single-tenant web app for one Thai clothing retailer. Customers visit a public shop link, enter body measurements, get per-dimension fit feedback. Virtual try-on (VTO) is deferred to a separate Phase 2 project — Phase 1 leaves data hooks ready.

**User:** Ingkawat Limvipuwat (non-technical founder). Email on commits: `ingkawat.limvipuwat@gmail.com`. Walk through each step with explanations.

## Tech stack (locked)

- Next.js 14.2.35 App Router, TypeScript strict, Tailwind 3, App Router native (no Pages router)
- Supabase: Auth + Postgres + Storage (`garment-photos` bucket, public-read)
- `@supabase/supabase-js@2.106.x`, `@supabase/ssr@0.10.x`, `zod@4.x`, `vitest@4.x`, `server-only`
- Vercel deploy target (done — live)

## Current state

**Branch:** `main` (feature/phase-1 merged)
**Last commit:** `5d47deb fix(build): remove unused garmentMeasurements prop — ESLint no-unused-vars`

### Done — Phase 1 complete ✅

- ✅ **Phase 1.1 Scaffold** (Tasks 1–10): Next.js scaffolded, Vitest configured, Supabase project created + migration applied, client wrappers in `lib/supabase/`, Thai landing page.
- ✅ **Phase 1.2 Auth** (Tasks 11–14): i18n strings, signup, login, dashboard layout + middleware + logout.
- ✅ **Phase 1.3 Dashboard + Add garment** (Tasks 15–19): central `lib/config/dimensions.ts` + `fit-profiles.ts`, Storage bucket `garment-photos`, dashboard list + copy-link, add-garment form with photo upload.
- ✅ **Phase 1.4 Public shop + Hero fit checker** (Tasks 20–23): fit engine pure function + TDD tests, `customer_token` localStorage helper, `/shop/[shop_slug]` public browse page, hero fit-checker + `/api/fit/evaluate` + `/api/fit/last`.
- ✅ **Phase 1.5 Deploy** (Tasks 24–25): pushed to GitHub (`ingkawatlimvipuwat-sys/fit-mvp`), connected Vercel, live.

## Architecture decisions in force

- **Fit logic:** customer vs garment thresholds — garment measurements = the garment's own size (not the body it fits). `good_fit` means garment 1-5cm roomier than body. Per-dimension config + named fit profiles (`regular`/`slim`/`relaxed`) override the bands.
- **Modularity (Option B):** single `lib/config/dimensions.ts` is source of truth — forms, validation, fit engine all read from it. Adding a new dimension (e.g. `thigh_cm`) = one entry in that file; no DB migration (values live in `jsonb`).
- **Phase 2 readiness:** `fit_sessions.tryon_image_url` column reserved (always null in Phase 1), `customer_token` ties multiple sessions per anonymous customer for VTO accuracy improvements later. See spec §13.
- **Server-only boundary:** `lib/supabase/server.ts` has `import 'server-only'` at top. Admin (service-role) client lives there. Client components import only from `lib/supabase/browser.ts`.
- **MeasurementBag** typed as `Partial<Record<DimensionKey, number>>` — derived from `DimensionKey` in dimensions.ts (single source of truth).

## Environment

- **Supabase project:** `fit-mvp` (Singapore region, free tier).
- **Storage bucket:** `garment-photos` (public-read). Note: a typo bucket `garmet-photos` also exists — unused, harmless.
- **Env vars** (in `.env.local`, gitignored; also set in Vercel):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Open follow-ups (deferred polish)

- `lib/config/dimensions.ts`: make `ThresholdBand[]` `readonly`.
- `lib/i18n/strings.ts`: apply `as const` for narrower literal types.
- `app/dashboard/layout.tsx`: add TODO noting orphan-retailer-row is recoverable via Supabase Studio.
- `app/api/garments/route.ts`: map raw dimension keys to Thai labels via `dimensionByKey()` in error messages.
- `npm audit`: 5 vulnerabilities from Next.js 14.2 — unreachable; fix with Next.js 15 upgrade post-launch.
- `FitChecker.tsx` `garmentMeasurements` prop removed (ESLint build failure). Re-add in Phase 2 when client-side comparison display is built.
- Fit engine boundary tests at diff = ±1 and ±5 (suggested in code review, not blocking).

## Phase 2 notes

Phase 2 = Virtual Try-On (VTO). Hooks already in place:
- `fit_sessions.tryon_image_url` nullable column
- `customer_token` persisted per browser
- `fit_profile` column on garments
- `garment-photos` Storage bucket reusable
- See spec §13 for full readiness checklist
