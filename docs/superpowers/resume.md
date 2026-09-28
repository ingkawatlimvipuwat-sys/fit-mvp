# Fit MVP — current status

**This is the status page of record.** If another document disagrees with it, this one wins.
Update it in place; do not start a new handoff document.

- New agent? Read [`/CLAUDE.md`](../../CLAUDE.md) first (shipping, checks, landmines), then this.
- Past decisions and traps: [`decisions-and-lessons.md`](decisions-and-lessons.md).
- How each feature was designed and built: `specs/` and `plans/` (links in the table below).

---

## In plain words (as of 2026-09-23)

The app works and is live at https://fit-mvp-eight.vercel.app. A shop owner adds clothes with
their measurements and sets how tight or loose each item should fit. Shoppers open the shop's
link, type their body measurements (or pick their usual size and let the app estimate), and see
whether each part of the garment will be too tight, a good fit, or too loose. Shoppers can also
check a garment's true colour and fabric details. Everything works in Thai and English.

It is a prototype with one shop. **The main job before a second shop joins is a security
upgrade of Next.js** (the framework the app is built on) — see "To do" below.

---

## Status snapshot (as of 2026-09-23)

| Check | Result |
|---|---|
| Live site matches `main` | Yes — verified by live content probe after the `ee19a98` deploy |
| Tests (`npm test`) | 167 passing, 16 files |
| Build (`npm run build`) | Clean |
| Database migrations | 0001, 0002, 0003 — all applied to the live database |
| Last health check | 2026-09-23 |

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

---

## To do

One list, most important first. When you finish an item, delete it (git keeps the history).

### Before a second shop joins

1. **Upgrade Next.js 14.2 → 15.5** (needs React 19). As of 2026-09-23, `npm audit --omit=dev`
   reports 1 critical and 2 high findings covering ~18 Next advisories, and 14.2.35 is the last
   14.x release — no more fixes are coming. Some advisories do not apply here (Windows-hosted
   servers, Pages Router, Server Actions, the image optimizer, which is now off). Others target
   App Router caching and middleware redirects, which this app uses. Whether Vercel blocks them
   is unverified. Do it on its own branch with a full manual walkthrough.
2. **Check preset ownership.** `fit_ruleset_id` is checked to be a valid id but not that the
   preset belongs to the caller (`lib/garment/parse-form.ts`), so a hand-crafted request could
   attach another shop's preset.
3. **Decide whether public signup is intended.** Anyone can create a shop at `/signup` today.
4. **Decide on size labels** (S/M/L on garments) — see decisions-and-lessons §2.
5. **Confirm the Supabase secret key was rotated.** A key was found in plain text in a deleted
   clone on 2026-08-11 (never pushed to GitHub). Rotation was advised; it was never confirmed.
   Ask the founder.
6. **Proofread the copy.** The English was written as a fallback nobody expected to see and has
   never been proofread; the Thai has not had a native-speaker pass.

### Worth doing soon

7. **Walk the dashboard in a browser with a real login.** Not done since the 2026-08-18
   redesign — the header, tabs, fit-rules load-failure notice and discard guards are backed only
   by a clean build.
8. **Rate-limit `/api/fit/evaluate`.** It is public and saves a database row per call.
9. **A failed preset load shows `…` forever** in the garment form instead of an error
   (`GarmentForm.tsx`). Saving still keeps the right rule.
10. **A new per-garment override always starts from the default rule**, not the rule in force,
    so ticking it on a `slim` garment silently starts at regular's numbers (`FitRuleEditor`).
11. **`strandedDimensions()` blames the retailer** for a category change they did not make, if
    a dimension ever moves between categories in `dimensions.ts`. Compare against the garment's
    original category.
12. **Validation messages that are not Thai.** `parseGarmentFields()` returns English for four
    rare paths, and `app/api/garments/route.ts` shows raw dimension keys — map them with
    `dimensionByKey()`.
13. **A fabric photo cannot be removed, only replaced**, so a retailer cannot fully withdraw
    fabric information.
14. **A colour or fabric save can fail silently** — it logs and reports success.
15. **Check colour fidelity on a real phone** — a real garment under daylight next to its
    swatch on the live site. Planned after the 2026-09-11 deploy; not recorded as done.

### Housekeeping

16. Delete old branches: `feature/phase-1` (last commit 2026-06-09; its work was rebuilt in
    `main`) and the already-merged `origin/feature/custom-fit-rules`.
17. Delete the typo Storage bucket `garmet-photos` (the real one is `garment-photos`).
18. Delete live test data: the garment `TEST เสื้อผ้ายืด (ลบได้)` and the `ผ้ายืด` preset
    (holds default values, not stretchy ones).
19. Small code tidies: extract the file-extension sanitising duplicated in both garment routes;
    make `ThresholdBand[]` `readonly` in `dimensions.ts`; note in `app/dashboard/layout.tsx`
    that an orphaned retailer row can be fixed in Supabase Studio.
20. Take the minor dependency updates (`@supabase/supabase-js`, `zod`, `postcss`) with the
    Next upgrade.

### Later — ideas and phases, not started

- **Catalogue organisation** — categories, variants, sorting for shops with hundreds of items.
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

## Running the work in Munder Difflin (for the founder, since 2026-09-28)

Munder Difflin is the desktop app that runs a team of Claude agents. Michael (the orchestrator)
takes your requests and hands them to temporary agents called "temps". Each temp works in its
own copy of the code. Agents there act without asking permission, so the project has guardrails
built in: **no agent can put anything on the live site.** Only you can, with one command.

**Setting it up (once)**
1. In Munder Difflin, add the fit-mvp folder as a project:
   `C:\Users\Copter\Documents\Claude\Projects\Startup poor fools\fit-mvp`
2. In Settings → Autonomy & Budgets: set the default model to Sonnet, set a token limit per
   agent, and allow at most 2 temps at once to start with.
3. Optional: turn off the "Hourly ops standup" when nothing is running. It wakes Michael every
   hour, and each wake-up costs tokens.

**The everyday loop**
1. **Ask Michael for one thing**, naming the item on the to-do list above, for example: *"In
   fit-mvp, do to-do item 2 (preset ownership). Follow the project's CLAUDE.md."* Stick to one
   task at a time until you trust the setup.
2. **Answer the ASK ME cards.** Those are the decisions that are yours. Each one comes with a
   recommendation.
3. **When an agent says "ready to ship",** ask it to *"start the app so I can check it"*. Click
   through the steps it lists. Only look around: saving anything writes to the real shop's
   database.
4. **Ship it yourself.** Paste the one command the agent gave you into a terminal opened in
   the fit-mvp folder. Then ask the agent to *"confirm the deploy landed"*.
5. **If something looks wrong,** tell Michael. Nothing reaches the live site until you run step 4.

**What agents cannot do:** push to the live branch (`main`), deploy to Vercel, or force-push.
They are also told not to change the database without you asking. The blocking rules are in
`.claude/settings.json`, and the agent rules are in `CLAUDE.md` under "Working as a team".

## Environment (as of 2026-09-23)

- **Live site:** https://fit-mvp-eight.vercel.app — Vercel deploys **`main` only**.
- **Code:** GitHub `ingkawatlimvipuwat-sys/fit-mvp` (private). Only checkout:
  `C:\Users\Copter\Documents\Claude\Projects\Startup poor fools\fit-mvp`.
- **Database:** Supabase project `fit-mvp`, Singapore, free tier. **Serves both local dev and
  production — there is no staging.**
- **Migrations:** `supabase/migrations/`, applied by hand in the Supabase SQL editor. The
  deploy does not run them.
- **Photos:** Storage bucket `garment-photos` (public read).
- **Environment variables** (`.env.local`, gitignored; also set in Vercel):
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Founder:** Ingkawat Limvipuwat, commits as `ingkawat.limvipuwat@gmail.com`.

## Where the code is

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
