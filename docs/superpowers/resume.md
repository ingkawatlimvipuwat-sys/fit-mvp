# Fit MVP — current status

**This is the status page of record.** If another document disagrees with it, this one wins.
Update it in place; do not start a new handoff document.

- New agent? Read [`/CLAUDE.md`](../../CLAUDE.md) first (shipping, checks, landmines), then this.
- Past decisions and traps: [`decisions-and-lessons.md`](decisions-and-lessons.md).
- How each feature was designed and built: `specs/` and `plans/` (links in the table below).

---

## In plain words (as of 2026-09-29)

The app works and is live at https://fit-mvp-eight.vercel.app. A shop owner adds clothes with
their measurements and sets how tight or loose each item should fit. Shoppers open the shop's
link, type their body measurements (or pick their usual size and let the app estimate), and see
whether each part of the garment will be too tight, a good fit, or too loose. Shoppers can also
check a garment's true colour and fabric details. Everything works in Thai and English.

It is a prototype with one shop, built on Next.js 15.5 and React 19 (upgraded 2026-09-29 from
14.2/React 18 — see decisions-and-lessons.md §3).

---

## Status snapshot (as of 2026-10-05, branch `feature/catalogue-stage-1`)

| Check | Result |
|---|---|
| Live site matches `main` | Yes, as of `ed8da4b` (PR #9, try-on). Checked 2026-10-05: live serves `public/try-on/result.png` byte-for-byte |
| Tests (`npm test`) | 258 passing, 29 files. The two `TryOn.test.tsx` failures were fixed by PR #10 and no longer occur |
| Build (`npm run build`) | Clean |
| `npm audit --omit=dev` | 2 vulnerabilities (1 high, 1 moderate) — down from 1 critical + 2 high (~18 Next advisories) on 14.2. The remaining high is `postcss@8.4.31` bundled *inside* `next`'s own `node_modules` (build-time CSS processing only, not user input); our own `postcss` dep is 8.5.28, already patched. Clears when Next ships its own postcss bump, or on a future Next 16 upgrade. |
| Database migrations | 0001, 0002, 0003 and 0004 (size label) applied to the live database (0004 verified with a read-only select, 2026-10-07). **0005 (catalogue) is written, NOT run anywhere** (no local database exists to try it on) — one transaction, run once; the founder runs it before merging Stage 1, steps are in PR #14 |
| Last health check | 2026-09-23 |

**Incident, 2026-10-05:** PR #13 (`feature/size-labels`, a branch meant to stay parked) was merged by mistake on 2026-10-05 before migration 0004 had been run. The code selects `size_label`, so the live dashboard, the garment edit page and the shop garment pages errored with Postgres error 42703 (column does not exist) until the founder ran `0004_size_label.sql`. Lesson: a pushed branch that is ahead of `main` makes GitHub show a "Compare & pull request" banner, which invites a merge. Warn the founder before pushing any parked branch, and never push one at all unless asked.

## What's live

| Feature | Shipped | What it does | Design / plan |
|---|---|---|---|
| Core fit checker | 2026-06-10 | Retailer signup and dashboard, add garments with photo, public shop page, per-dimension fit verdict | `specs/2026-05-25-fit-recommendation-mvp-design.md`, `plans/2026-05-25-…-phase1.md` |
| Language toggle | 2026-06-10, extended 2026-08-18 | TH/EN on shop, login, signup and the whole dashboard | `specs/2026-06-10-language-toggle-design.md` |
| Red-team fixes & polish | 2026-07-09 | Fit-checker and login robustness, friendly errors, back link, other-garments strip, garment delete | `plans/2026-07-09-phase1-redteam-polish.md` |
| Custom fit rules | 2026-08-11 | Retailers set their own tight / good / loose thresholds, as shop presets or per garment | `specs/2026-08-06-custom-fit-rules-design.md` |
| Garment edit page | 2026-08-15 | Edit name, category, measurements, fit rule and photo of an existing garment | `specs/2026-08-13-garment-edit-design.md` |
| UX audit fixes | 2026-08-18 | Dark dashboard header, Garments / Rules tabs, page titles, not-found pages, clearer errors | `archive/ux-audit-2026-08-18.md` |
| Colour & fabric | 2026-09-11 | Colour swatches with hex codes, fabric chips (finish, thickness, stretch, feel), Fit / Colour / Fabric tabs | `specs/2026-09-10-colour-fabric-design.md` |
| Size helper | 2026-09-17 | "Not sure of your measurements?" — fill from a size, or estimate the blanks from what you know | `specs/2026-09-16-size-helper-design.md` |
| Health-check fixes | 2026-09-23 | Bad requests get 400 instead of 500; unused image optimizer switched off | — |
| Preset ownership check | 2026-10-01 | A garment can only use a fit-rule preset that belongs to the same shop | — |
| Catalogue Stage 1 — products, versions, shopper pickers | built 2026-10-05, **not shipped** until the PR is merged and 0005 is run | Owner groups garments into products (one per Shopee listing, one shopper link `/shop/<slug>/p/<id>`); each version is a full garment with a pick per picker (Size, Colour, …); shopper picks, then checks fit. Old garment links redirect. Dashboard shows product cards | `specs/2026-10-01-catalogue-organisation-design.md`, `plans/2026-10-05-catalogue-stage-1.md` |
| Try-on (stub) | 2026-10-03 | Shopper uploads or takes a photo; after a fake 0.9 s wait the page shows a fixed sample image (`public/try-on/result.png`). The photo never leaves the phone. No real try-on model yet | — |

---

## To do

One list, most important first. When you finish an item, delete it (git keeps the history).

### Now

1. **Try-on leftovers.** The stub is live (PR #9). Still missing from the first try-on commit:
   `scripts/local-db.mjs` and the Supabase local config that the `db:*` npm scripts call, so
   those scripts fail. `package.json` lists `postcss` twice. Ask patriya-piyawiroj for the files
   or delete the scripts.

### Before a second shop joins

1. **Catalogue Stages 2 and 3** (Stage 1 is built, see What's live): folders and tags,
   Move to…, search, sort, filter, Needs attention filter; then drag-and-drop and reordering
   picker values. `specs/2026-10-01-catalogue-organisation-design.md` §8. After Stage 1 is live,
   a follow-up migration re-runs the backfill and sets `garments.product_id` NOT NULL.
2. **Confirm the Supabase secret key was rotated.** A key was found in plain text in a deleted
   clone on 2026-08-11 (never pushed to GitHub). Rotation was advised; it was never confirmed.
   Ask the founder.
3. **Proofread the copy.** The English was written as a fallback nobody expected to see and has
   never been proofread; the Thai has not had a native-speaker pass.

### Worth doing soon

4. **Walk the dashboard in a browser with a real login.** Not done since the 2026-08-18
   redesign — the header, tabs, fit-rules load-failure notice and discard guards are backed only
   by a clean build.
5. **Rate-limit `/api/fit/evaluate`.** It is public and saves a database row per call.
6. **A failed preset load shows `…` forever** in the garment form instead of an error
   (`GarmentForm.tsx`). Saving still keeps the right rule.
7. **A new per-garment override always starts from the default rule**, not the rule in force,
   so ticking it on a `slim` garment silently starts at regular's numbers (`FitRuleEditor`).
8. **`strandedDimensions()` blames the retailer** for a category change they did not make, if
   a dimension ever moves between categories in `dimensions.ts`. Compare against the garment's
   original category.
9. **Validation messages that are not Thai.** `parseGarmentFields()` returns English for four
   rare paths, and `app/api/garments/route.ts` shows raw dimension keys — map them with
   `dimensionByKey()`.
10. **A fabric photo cannot be removed, only replaced**, so a retailer cannot fully withdraw
    fabric information.
11. **A colour or fabric save can fail silently** — it logs and reports success.
12. **Check colour fidelity on a real phone** — a real garment under daylight next to its
    swatch on the live site. Planned after the 2026-09-11 deploy; not recorded as done.

### Housekeeping

13. Delete old branches: `feature/phase-1` (last commit 2026-06-09; its work was rebuilt in
    `main`) and the already-merged `origin/feature/custom-fit-rules`.
14. Delete the typo Storage bucket `garmet-photos` (the real one is `garment-photos`).
15. Delete live test data: the garment `TEST เสื้อผ้ายืด (ลบได้)` and the `ผ้ายืด` preset
    (holds default values, not stretchy ones).
16. Small code tidies: extract the file-extension sanitising duplicated in both garment routes;
    make `ThresholdBand[]` `readonly` in `dimensions.ts`; note in `app/dashboard/layout.tsx`
    that an orphaned retailer row can be fixed in Supabase Studio.

### Later — ideas and phases, not started

- **For the founder's partners, not agents:** Shopee's rule against outside links, a possible
  Shopee partnership, a "Back to Shopee" button, picks carried in the link. See the catalogue
  spec §11. Do not build any of these without a decision.
- **Dashboard visual design pass** — the founder preferred the brainstorming mockups.
- **Teen and kids sizing**, and an optional **age question** (needs its own spec, including
  consent rules for minors). See `specs/2026-09-16-size-helper-design.md` §10.
- **AI colour extraction, colour search and filter** (colour & fabric spec §9).
- **Integration tests** for API routes — needs a staging database first.
- **English browser tab titles** — needs the language in the URL or a cookie.
- **Fit engine calibration** — the default bands are best guesses until real data exists.
- **Phase 2 — virtual try-on.** Ready: `fit_sessions.tryon_image_url` (always empty for now),
  `customer_token`, the `garment-photos` bucket. Re-add the `garmentMeasurements` prop to
  `FitChecker` for side-by-side display. See the core design spec §13.
- **Phase 3 — customer accounts**, replacing the anonymous `customer_token`, so measurements and
  language follow the shopper across devices and shops.
- **Several shops** — the database supports it; signup, pricing and onboarding do not.

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
- **Local stack (2026-09-12):** Docker (Colima on this Mac) + `npx supabase start`. Postgres,
  Auth, Storage, and Studio all run on this machine. `npm run setup:local` starts them, applies
  every file in `supabase/migrations/`, seeds `demo@example.com` / `password123` (shop slug
  `demo`), and writes `.env.local` to `http://127.0.0.1:54321`. Studio: http://127.0.0.1:54323.
  This is now the default way to run the app; local data never touches production.
- **Hosted Supabase project:** `fit-mvp` (Singapore region, free tier) — **production only**,
  via Vercel env vars. Do not point `.env.local` at it.
- **Migrations:** `supabase/migrations/` (`0001_initial.sql`, `0002_fit_rulesets.sql`,
  `0003_colour_fabric.sql`). Applied automatically to the local stack. The hosted project is
  still updated by hand through the Supabase SQL editor — local apply does not reach it. All
  three are applied in production.
- **GitHub repo:** `ingkawatlimvipuwat-sys/fit-mvp`
- **Storage bucket:** `garment-photos` (public-read). Declared for local in
  `supabase/config.toml`; policies in `supabase/seed.sql`.
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
lib/                         pure logic — this is where the tests are
  config/dimensions.ts       every measurement the app knows (single source of truth)
  config/fit-profiles.ts     built-in profiles: regular / slim / relaxed
  config/sizeChart.ts        size helper's body chart (provisional numbers)
  fit/                       the engine, rules, rule resolution, size estimation
  garment/                   parsing and validating garment forms, colour & fabric, photos
  i18n/strings.ts            every piece of UI text, Thai and English
  hooks/useLanguage.tsx      the language toggle's shared state
  supabase/server.ts         database clients for the server only (holds the secret key)
  supabase/browser.ts        database client safe for the browser
  customer-token.ts          anonymous shopper id kept in the browser

scripts/
  local-db.mjs           — `npm run setup:local`: start Docker/Colima, supabase start, write .env.local

supabase/
  config.toml            — local stack (Auth, Storage bucket garment-photos, site_url localhost)
  seed.sql               — local-only: storage policies + demo@example.com / password123
  migrations/            — 0001–0005 (0004 size label, 0005 catalogue; hosted status: see snapshot)

app/
  shop/[shop_slug]/          public shop page; [garment_id]/ is the garment page + FitChecker
  dashboard/                 retailer side: garment list, garment/ form, fit-rules/
  login/, signup/            retailer accounts
  api/fit/                   evaluate (run a fit check), last (shopper's last measurements)
  api/garments/              create, edit, delete garments
  api/fit-rulesets/          create, edit, delete shop presets
  api/signup/                create a retailer account and shop

middleware.ts                refreshes the login session on every request
supabase/migrations/         database schema, applied by hand
```
