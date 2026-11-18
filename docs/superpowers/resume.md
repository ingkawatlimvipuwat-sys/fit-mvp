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

## Status snapshot (as of 2026-11-16, `main` at `d9eab7f`)

| Check | Result |
|---|---|
| Live site matches `main` | Yes. `main` is `d9eab7f` (PR #22, per-shop save limit + phone polish), merged 2026-11-16 and verified live the same day (Vercel reported success for that commit and the new phone CSS rule is in the served stylesheet). Before it: PR #21 (Catalogue Stage 3), PR #20 (Thai errors, fabric photo removal), PR #19 (docs), PR #18 (reliability fixes) |
| Tests (`npm test`) | 495 passing, 48 files on `main`; 511 passing, 50 files on branch `feature/ui-redesign` (which also carries the health-check branch). `npx tsc --noEmit` is clean on both branches (the one old error, in `lib/garment/colour-fabric-regression.test.ts`, is fixed there) |
| Build (`npm run build`) | Clean |
| `npm audit --omit=dev` | On `main` (Next 15.5.26, zod 4.6.5): 4 vulnerabilities (1 critical, 3 high) — new advisories published since October against `next`, `zod` and `source-map-js`. Branch `feature/health-check-2026-11-16` moves to Next 15.5.29, zod 4.6.7, source-map-js 1.2.2 and React 19.3.1, which brings it back to 2 (1 high, 1 moderate): the `postcss@8.4.31` bundled *inside* `next` (build-time CSS only, not user input), which clears only on a Next 16 upgrade. None of the Next advisories is known to be reachable here (hosted on Vercel, image optimizer off, no Server Actions), but the patch is cheap |
| Database migrations | 0001, 0002, 0003 and 0004 (size label) applied to the live database (0004 verified with a read-only select, 2026-10-07). 0005 (catalogue) applied to the live database by the founder before PR #14 merged, 2026-10-07. 0006 (`product_id` NOT NULL) applied to the live database on 2026-10-07, **after** PR #15 was merged — in that order on purpose: code from before PR #15 could still create a garment without a product, and 0006's backfill catches any such row before setting NOT NULL. **0007** (`fit_sessions_created_at_idx`, an index that keeps the fit-session write cap fast) run by the founder in the SQL editor on 2026-10-27, after PR #18 merged. **0008** (`product_pickers.value_order`, the owner's order of picker values) run by the founder in the SQL editor on 2026-10-27, **before** PR #21 merged, and checked read-only. All eight migrations are applied |
| Supabase keys | Rotated 2026-10-12 to Supabase's new key format (see Environment). The legacy JWT `anon` / `service_role` keys are disabled |
| Last health check | 2026-11-16. Tests, build, type check, audit, live route probes (public pages 200, dashboard redirects to login, write routes refuse anonymous calls, bad input gets 400), Row-Level Security switched on for all 11 tables in the migration files (the live database itself was not inspected). Found: the new advisories above; the main checkout had Next 14 / React 18 in `node_modules` while `package.json` says 15 — local checks were running the wrong version until `npm ci` (run `npm ci` after any pull that changes `package-lock.json`); live pages that read data took about 7.5 seconds and came back empty at first, then answered normally later the same day — most likely the free-plan pause again |

**Outage, 2026-10-26:** the Supabase free plan **paused the project** after about 12 days with no activity. Every live page that reads data (the shop pages, the dashboard, login) failed until the founder restored the project in the Supabase dashboard. Nothing was lost. **Decision (founder, 2026-10-26): stay on the free plan and restore by hand when it pauses** — no Pro upgrade, no keep-alive ping. See decisions-and-lessons.md §4.

**If the live shop shows errors:** first open the Supabase dashboard (https://supabase.com/dashboard) and look at the `fit-mvp` project. If it says **Paused**, press **Restore project** and wait a few minutes until it shows as healthy. Then open the shop link and the dashboard on the live site and check that products load. Only if the project is not paused, start debugging (and check `git log --oneline origin/main -1` against what is live).

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
| Catalogue Stage 1 — products, versions, shopper pickers | shipped 2026-10-07 (PR #14, 0005 applied; follow-up PR #15 merged, then 0006 applied, same day) | Owner groups garments into products (one per Shopee listing, one shopper link `/shop/<slug>/p/<id>`); each version is a full garment with a pick per picker (Size, Colour, …); shopper picks, then checks fit. Old garment links redirect to the product page. Dashboard shows product cards | `specs/2026-10-01-catalogue-organisation-design.md`, `plans/2026-10-05-catalogue-stage-1.md` |
| Catalogue Stage 2a — folders and Move to… | 2026-10-14 (PR #16; no migration) | Nested folders in a side list (phone: a ‹ back header), New folder / Rename / Delete (contents move up, nothing is deleted), **Move to…** for products and folders, New product inside the current folder. A folder shows everything below it | `specs/2026-10-01-catalogue-organisation-design.md`, `plans/2026-10-12-catalogue-stage-2.md` |
| Catalogue Stage 2b — tags, search, sort, Needs attention filter | 2026-10-14 (PR #17; no migration) | Owners tag products on the product page (type a word + Enter; an existing tag is reused), and the dashboard gets a toolbar: search by product name, filter by one or more tags (a product must have all), sort (newest, oldest, name A–Z / Z–A) and a ⚠ Needs attention toggle. Everything filters in the browser and lives in the address bar, so Back and refresh keep the place. Tags cannot be renamed or deleted yet; a tag on no product is simply hidden | `specs/2026-10-01-catalogue-organisation-design.md`, `plans/2026-10-12-catalogue-stage-2.md` |
| Reliability fixes | 2026-10-27 (PR #18; migration 0007, an index) | Six fixes: the public fit check is rate-limited and its fit-session saves are capped (#5); a failed shop-rule load shows an error instead of `…` (#6); a per-garment override starts from the rule in force, also on edit and duplicate (#7); the "Changing category will discard…" warning only blames the retailer's own changes (#8); garment validation errors are Thai, with no zod English or raw keys (#9); a colour or fabric save failure now reaches the retailer (#11) | `plans/2026-10-26-reliability-fixes.md` |
| Thai errors everywhere + remove a fabric photo | 2026-10-27 (PR #20; no migration; checked on the preview by Claude in the founder's browser) | Products, folders, tags, options and fit rules now answer in Thai (`loginRequired`, `requestInvalid`, `itemNotFound`, `invalidProductName`, `invalidPickerName`, `invalidPickerValues`, `loadFailed`); fit-rule database errors are logged, never shown. The garment form has a **ลบรูปผ้านี้** tick under the fabric close-up: the row stops pointing at the photo, then the stored file is deleted (only after the write succeeded). Ticking it on a duplicate saves the copy without the photo. Decision logic: `lib/garment/fabric-photo.ts` | `plans/2026-10-27-thai-errors-and-fabric-photo-remove.md` |
| Catalogue Stage 3 — drag-and-drop, value order, tag rename/delete, name boxes | 2026-10-27 (PR #21; migration 0008; also fixed Duplicate, broken since Stage 1) | On a computer, drag a product card or a folder onto a folder in the left list (or onto ทั้งหมด) to move it; phones keep ⋯ → Move to…. Picker values (Size S/M/L) can be reordered with ↑ ↓ on the product page and shoppers see them in that order (`orderedValues` in `lib/catalogue/picks.ts`). A **🏷 จัดการแท็ก / Manage tags** panel on the dashboard renames and deletes tags shop-wide (a taken name is refused, never merged; deleting removes the tag from every product but never deletes a product). New folder, Rename folder and tag rename use an in-page name box instead of `window.prompt` | `plans/2026-10-27-catalogue-stage-3.md`, `specs/2026-10-01-catalogue-organisation-design.md` §8 |
| Per-shop save limit + phone polish | 2026-11-16 (PR #22; no migration) | The fit-session write cap counts each shop separately (through the garment; `countRecentShopSessions`), so one busy or attacked shop cannot stop another shop's saves. Phone check of 2026-11-06 (375px emulation, look-only) fixes: fields are 16px on phones so iPhones do not zoom in, the ⋯ menu no longer runs off the left edge, the copy-link button no longer wraps into three lines, bigger tap areas on ⋯, ✕ and the small links | — |
| UI redesign, stages 1–3 — shopper product page | 2026-11-16 (PR #24; no migration) | Direction A "Quiet" (founder's choice, 2026-11-16). Foundation: IBM Plex Sans Thai via `next/font`, colour tokens in `tailwind.config.ts`, shared `Button` / `Chip` / `Card` / `Field` / `VerdictChip` in `app/components/ui/`. Shopper product page: two-column measurement fields with the unit inside the box, size helper as one card, summary card with the verdict as a heading and a count built by `lib/fit/summary.ts`, a tight-to-loose bar per scored measurement (`lib/fit/ease-bar.ts`; `/api/fit/evaluate` now also returns `rules`, the rule in force per scored measurement, display only), new verdict colours that differ in lightness as well as hue, try-on marked ตัวอย่าง / Sample (removed again by PR #27). Checked by Claude in a browser at phone width on a throwaway page with a mocked fit-check response — the real product page with real data has **not** been walked. Shop browse page, forms, login: still the old look. **Stage 4, the dashboard list screen** (branch `feature/ui-redesign-dashboard`, built on top of this one, also PR pending): white header with the สินค้า / กฎของร้าน tabs and the copy-link button in it, folder list, toolbar, product cards, dialogs and menus in the new look; icons are inline SVGs in `app/dashboard/icons.tsx`. Checked by Claude at computer and phone width on a throwaway page with sample data — not with a real login. **Stage 5, every remaining screen** (branch `feature/ui-redesign-rest`, on top of stage 4, also PR pending): home, login, signup, shop browse page, colour and fabric tabs, not-found and error pages, and inside the dashboard the product page, garment form and fit-rules pages. Presentation only — a before/after comparison of every form field name, input attribute, event handler, `fetch`/`sendJson` call, confirm and redirect in `app/` came out identical. More shared pieces in `app/components/ui/` (`Notice`, `Select`, `Textarea`, `FileInput`, `CheckRow`, `TextButton`, `LinkButton`, `PageShell`, `icons`). Checked by Claude at phone width: the garment form (everything expanded), login and signup — no sideways scroll, every control at least 44px. **Not** checked: any screen with a real login or real data, the product page, the fit-rules pages, saving anything | `specs/2026-11-16-ui-redesign-design.md` |
| Try-on (OpenArt) — **merged but not working** | 2026-11-18 (PR #27, by patriya-piyawiroj; no migration) | Replaces the stub. The shopper block posts the photo and the garment id to `/api/try-on` and polls it, and the server is meant to send both to OpenArt and return the generated image. **That route is not in the repository** (no `app/api/try-on` on any branch, checked 2026-11-18), so on the live site every try-on attempt gets a 404 and shows "could not create the photo". Needs the route file from patriya-piyawiroj, then `OPENART_TOKEN` (and `OPENART_REFRESH_TOKEN` + `OPENART_CLIENT_ID`) in Vercel on Production and Preview. The redesign's ตัวอย่าง / Sample label was removed by this PR on purpose, since the image is meant to be real | — |

---

## To do

One list, most important first. When you finish an item, delete it (git keeps the history).

### Now

**The founder is preparing a demo (decided 2026-11-16).** Demo prep comes first.

1. **Before the demo.** Check the Supabase project is not paused that morning (see the status
   snapshot). Delete the live test garment `TEST เสื้อผ้ายืด (ลบได้)` and the `ผ้ายืด` preset —
   both show on the real shop. Walk the whole flow once on a phone and once on a computer.
   Proofread the Thai on the screens the demo will show.
2. **Try-on is broken on the live site: the `/api/try-on` route is missing.** PR #27 shipped the
   shopper block but not the server route it calls, so every attempt 404s. Get the route file from
   patriya-piyawiroj (or hide the block for the demo). After that, it needs an OpenArt token:
   the shopper block calls OpenArt. Until `OPENART_TOKEN` is set in Vercel (Production and Preview), and on any
   preview deploy, the button answers "service is temporarily unavailable". The same sentence
   is what shoppers see when the OpenArt account is out of credits. A successful generation
   spends real credits. Copy the token from `openart login` (`~/.openart/cli-credentials.json`);
   if that file has `refresh_token` and `client_id`, set `OPENART_REFRESH_TOKEN` and
   `OPENART_CLIENT_ID` too, or the access token will expire and try-on will stop.
3. **No real-shopper evidence yet.** The original plan was to prove the fit check with real
   shoppers before building try-on. The fit bands are still best guesses and nothing records
   whether a verdict was right. Not needed for a demo; needed before claiming accuracy.
4. **UI redesign — remaining stages.** Stages 1–3 are live (PR #24).
   Stage 4 (dashboard list) is on `feature/ui-redesign-dashboard` and stage 5 (every other
   screen) on `feature/ui-redesign-rest`. Still to build: the "other sizes of this product" row
   (stage 6, after the demo — it needs a read-only endpoint that checks several versions without
   saving a session each).
5. **Local database scripts may still be missing.** `scripts/local-db.mjs`, `supabase/config.toml`
   and `supabase/seed.sql` were left out of an earlier try-on commit. `setup:local` and `db:*`
   need them. Ask patriya-piyawiroj for the files or delete the scripts if they are still absent.

### Before a second shop joins

6. **Proofread the copy.** The English was written as a fallback nobody expected to see and has
   never been proofread; the Thai has not had a native-speaker pass.

### Worth doing soon

7. **Walk the dashboard in a browser with a real login.** Not done since the 2026-08-18
   redesign — the header, tabs, fit-rules load-failure notice and discard guards are backed only
   by a clean build.
8. **Check colour fidelity on a real phone** — a real garment under daylight next to its
   swatch on the live site. Planned after the 2026-09-11 deploy; not recorded as done.

### Housekeeping

9. Delete old branches: `feature/phase-1` (last commit 2026-06-09; its work was rebuilt in
    `main`) and the already-merged `origin/feature/custom-fit-rules`.
10. Delete the typo Storage bucket `garmet-photos` (the real one is `garment-photos`).
11. Small code tidies: extract the file-extension sanitising duplicated in both garment routes;
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
| Security | `npm audit`: see the status snapshot; what remains needs a Next 16 upgrade |
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
- **Hosted Supabase project:** `fit-mvp` (Singapore region, free tier — it pauses after about a week with no activity and must be restored by hand; see the status snapshot) — **production only**,
  via Vercel env vars. Do not point `.env.local` at it.
- **Migrations:** `supabase/migrations/` (`0001_initial.sql`, `0002_fit_rulesets.sql`,
  `0003_colour_fabric.sql` … `0008_picker_value_order.sql`). Applied automatically to the local stack. The hosted project is
  still updated by hand through the Supabase SQL editor — local apply does not reach it. All eight are applied in production.
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
  - **Key rotation, 2026-10-12:** the app moved to Supabase's new API keys. The
    `sb_publishable_…` key is in `NEXT_PUBLIC_SUPABASE_ANON_KEY` and the `sb_secret_…` key is in
    `SUPABASE_SERVICE_ROLE_KEY`; the variable names did not change. Both Vercel and `.env.local`
    were updated, and the legacy JWT `anon` / `service_role` keys were disabled in Supabase. This
    closes the 2026-08-11 finding of a key in plain text in a deleted clone.

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
  migrations/            — 0001–0008 (0004 size label, 0005 catalogue, 0006 product_id NOT NULL, 0007 optional fit_sessions index, 0008 picker value order; hosted status: see snapshot)

app/
  shop/[shop_slug]/          public shop page; [garment_id]/ is the garment page + FitChecker
  dashboard/                 retailer side: garment list, garment/ form, fit-rules/
  login/, signup/            retailer accounts
  api/fit/                   evaluate (run a fit check), last (shopper's last measurements)
  api/garments/              create, edit, delete garments
  api/folders/               create a folder; rename, move, delete (contents move up)
  api/tags/                  rename a tag shop-wide, delete a tag (comes off every product)
  api/fit-rulesets/          create, edit, delete shop presets
  api/signup/                create a retailer account and shop

middleware.ts                refreshes the login session on every request
supabase/migrations/         database schema, applied by hand
```
