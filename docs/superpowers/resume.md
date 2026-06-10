# Resume — Fit Recommendation MVP

> **For the agent starting a fresh session:** Read this first, then `docs/superpowers/plans/2026-05-25-fit-recommendation-mvp-phase1.md`. The plan is the canonical task list; this note is just "where are we right now."

## Project at a glance

Single-tenant web app for one Thai clothing retailer. Customers visit a public shop link, enter body measurements, get per-dimension fit feedback. Virtual try-on (VTO) is deferred to a separate Phase 2 project — Phase 1 leaves data hooks ready.

**User:** Ingkawat Limvipuwat (non-technical founder). Email on commits: `ingkawat.limvipuwat@gmail.com`. Walk through each step with explanations.

## Tech stack (locked)

- Next.js 14.2.35 App Router, TypeScript strict, Tailwind 3, App Router native (no Pages router)
- Supabase: Auth + Postgres + Storage (`garment-photos` bucket, public-read)
- `@supabase/supabase-js@2.106.x`, `@supabase/ssr@0.10.x`, `zod@4.x`, `vitest@4.x`, `server-only`
- Vercel deploy target (Task 25, not done yet)

## Current state

**Branch:** `feature/phase-1`
**Last commit:** `726124a fix(garments): network-error recovery + Storage orphan cleanup + ext sanitization`

### Done (Phase 1.1–1.3)

- ✅ **Phase 1.1 Scaffold** (Tasks 1–10): Next.js scaffolded, Vitest configured, Supabase project created + migration applied, client wrappers in `lib/supabase/`, Thai landing page.
- ✅ **Phase 1.2 Auth** (Tasks 11–14): i18n strings, signup (with friendly Thai slug-collision message + orphan-user cleanup), login (with friendly Thai for invalid credentials + autoComplete attrs), dashboard layout + middleware + logout.
- ✅ **Phase 1.3 Dashboard + Add garment** (Tasks 15–19): central `lib/config/dimensions.ts` + `fit-profiles.ts`, Storage bucket `garment-photos` created with `auth_upload` INSERT policy + public-read, dashboard list + copy-link, add-garment form with photo upload (network-error recovery, Storage orphan cleanup, ext sanitization).

### Remaining (Phase 1.4 + 1.5)

- ⬜ **Phase 1.4 Public shop + Hero fit checker** (Tasks 20–23):
  - Task 20: Fit engine pure function + Vitest TDD tests.
  - Task 21: `customer_token` localStorage helper.
  - Task 22: `/shop/[shop_slug]` public browse page.
  - Task 23: Hero fit-checker page (`/shop/[shop_slug]/[garment_id]`) + `/api/fit/evaluate` route + `/api/fit/last` route for pre-fill.
- ⬜ **Phase 1.5 Deploy** (Tasks 24–25):
  - Task 24: Push to GitHub (likely done as part of the Cowork migration before this note's session resumed).
  - Task 25: Connect Vercel + paste env vars + deploy.

## Architecture decisions in force

- **Fit logic:** customer vs garment thresholds — garment measurements = the garment's own size (not the body it fits). `good_fit` means garment 1-5cm roomier than body. Per-dimension config + named fit profiles (`regular`/`slim`/`relaxed`) override the bands.
- **Modularity (Option B):** single `lib/config/dimensions.ts` is source of truth — forms, validation, fit engine all read from it. Adding a new dimension (e.g. `thigh_cm`) = one entry in that file; no DB migration (values live in `jsonb`).
- **Phase 2 readiness:** `fit_sessions.tryon_image_url` column reserved (always null in Phase 1), `customer_token` ties multiple sessions per anonymous customer for VTO accuracy improvements later. See spec §13.
- **Server-only boundary:** `lib/supabase/server.ts` has `import 'server-only'` at top. Admin (service-role) client lives there. Client components import only from `lib/supabase/browser.ts`.

## Environment

- **Supabase project:** `fit-mvp` (Singapore region, free tier).
- **Env vars** (in `.env.local`, gitignored):
  - `NEXT_PUBLIC_SUPABASE_URL` — the project URL.
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — `sb_publishable_*` format (new Supabase format, works with `@supabase/supabase-js@2.106+`).
  - `SUPABASE_SERVICE_ROLE_KEY` — `sb_secret_*` format.
- **Storage bucket:** `garment-photos`, public-read, with `auth_upload` INSERT policy for `authenticated` role checking `bucket_id = 'garment-photos'`.

## Workflow conventions in use

- **Skill:** `superpowers:subagent-driven-development` (we dispatch implementer subagents per task, then spec compliance review subagent, then code quality review subagent).
- **Pragmatic adaptation:** for verbatim-from-plan config files (small, all-or-nothing), the two reviews are combined into one subagent. For tasks with architectural surface (e.g. multipart upload, fit engine, API routes), reviews are split.
- **Tiny fix-ups** (1–3 line edits from review findings) are applied inline by the controller instead of dispatching a fix subagent — saves a loop.
- **Phase gates:** between each phase, the user runs a manual browser test before the next phase starts. Plan §11 lists what to test at each gate.
- **Caveman skill:** installed for token savings — should be available in this new session if Cowork detected and installed it cleanly. If not present, run `npx -y github:JuliusBrussee/caveman` and verify the skill lands in `~/.claude/skills/caveman/`.

## Open follow-ups (deferred minor items)

These were noted in code reviews and intentionally deferred:

- `lib/config/dimensions.ts`: make `ThresholdBand[]` `readonly` (defense in depth).
- `lib/i18n/strings.ts`: apply `as const` for narrower literal types.
- `app/dashboard/layout.tsx`: add a TODO comment noting the orphan-retailer-row state is recoverable via Supabase Studio.
- `app/dashboard/CopyPublicLink.tsx`: add `type="button"` to the copy button.
- `app/api/garments/route.ts` error messages: map raw dimension keys (e.g. `shoulder_cm`) to Thai labels via `dimensionByKey()` for user-facing strings.
- `npm audit`: 5 vulnerabilities inherited from Next.js 14.2 — all unreachable in this code path; close them with a post-launch upgrade to Next.js 15.

## Resume command for the new session

> Continue Phase 1.4 of the Fit Recommendation MVP. Read `docs/superpowers/resume.md` then `docs/superpowers/plans/2026-05-25-fit-recommendation-mvp-phase1.md`. Next task is **Task 20: Fit engine pure function with TDD tests**. Use the subagent-driven-development skill, dispatch an implementer subagent for Task 20.
