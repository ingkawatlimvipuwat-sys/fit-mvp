# Decisions and lessons

What this project has already decided, and the traps it has already paid for. Read the section
for the area you are about to touch. Each item is here once — if you learn something new, add it
to the right section rather than to a new document.

- **Current status and the to-do list** live in [`resume.md`](resume.md), not here.
- **The top three landmines** (circular import, zod `.strict()`, ease boundaries) and the
  **shipping procedure** live in [`/CLAUDE.md`](../../CLAUDE.md). They are not repeated here.
- Most items below were distilled on 2026-09-23 from the older handoff docs and feature
  write-ups now in [`archive/`](archive/). The dates show when each lesson was learned.

---

## 1. How the fit engine works (design in force)

- **The engine compares the customer's body with the garment's own measurements.** Fit rules are
  written in **ease** = `garment − customer`, meaning "how many cm roomier than the body". Default
  `good_fit` is 1–5 cm of ease. The engine works internally on `diff = customer − garment`, and a
  pure compiler (`easeRuleToBands()` in `lib/fit/rules.ts`) converts between the two.
  Full model: `specs/2026-08-06-custom-fit-rules-design.md` §3 and §4.4.
- **Negative ease means stretchy fabric.** A garment smaller than the body can still fit if it
  stretches. That is why there is no separate "stretch" flag.
- **Which rule applies:** a per-garment override, else the shop's preset, else the built-in
  profile (`regular` / `slim` / `relaxed`). Then per-dimension: that dimension's rule, else the
  ruleset's base, else the dimension's default. **An override replaces a preset; it does not
  merge with it**, so "which number is in force" can be answered from one place.
- **Every fit check stores the rule it used** (`fit_sessions.applied_rule`), written once and
  never updated. Rules are editable, so without this snapshot every past verdict would become
  unexplainable the moment a retailer edited a preset. Verified live 2026-08-11.
- **`lib/fit/engine.ts` is a pure function** — no database, no network. Keep it that way; it is
  the most valuable and most testable piece of the app.
- **`lib/config/dimensions.ts` is the single source of truth** for measurements. Forms,
  validation, the engine and labels all read it. Adding a dimension must stay a one-file edit —
  the founder asked for this explicitly.
- **The size helper's chart numbers are provisional** (`lib/config/sizeChart.ts`). Estimation
  picks the nearest size row; exact ties go to the **smaller** size to avoid over-sizing. It
  never fills length or sleeve, which are not body measurements. Spec:
  `specs/2026-09-16-size-helper-design.md`.

## 2. Product decisions — do not reopen without new evidence

- **Fit intelligence is the product, not pictures.** Virtual try-on is Phase 2, layered on top
  of a proven fit engine. Do not pull it forward.
- **Prove the core loop before adding features.** This is the smallest honest version of a real
  product.
- **Thai first, English second. Retailer content is never translated** — shop names and garment
  names stay exactly as typed.
- **The landing page is bilingual without a toggle** (Thai with English underneath). The
  founder liked it that way.
- **Thai and English UI copy shipped as placeholder** (accepted 2026-08-11). All of it is in
  `lib/i18n/strings.ts`. `feelCrisp` (`แข็งอยู่ทรง`) in particular is a best guess.
- **Fabric uses chips, not sliders** (2026-09-11). A slider would need new numeric columns, a
  migration and a shopper redesign; a 3-stop slider is only a skin over the same three words.
- **The thickness chip is not auto-picked from the typed g/m² value** (2026-09-11). Offered,
  never approved. A retailer can type 350 g/m² and tick "thin" and nothing stops them.
- **Accepted as fine for an MVP** (UX audit, 2026-08-18): native `confirm`/`alert` on garment
  delete; validation errors shown one at a time; `(cm)` in labels in both languages (do **not**
  "fix" this); `ไม่ได้ระบุ` rows for unfilled dimensions.
- **Fit rules are readable by anyone** (`fit_rule_override` and presets via `garments`' public
  read policy). They are the retailer's own thresholds, not customer data. **Never tell a
  retailer their rules are secret.** Reasoning: spec §4.2 and the comments in migration 0002.
- **Size labels (S/M/L on garments) are deferred** — but must be decided **before onboarding a
  second retailer**, because after that the migration cost is someone else's re-typing.
- **Public signup at `/signup` stays open** (2026-09-28, founder). Anyone can create a shop; this is
  intended, not an oversight. Do not add an invite gate without a new decision.

## 3. Next.js and React traps

- **A server component may import only components from a `'use client'` file.** Functions and
  values arrive as opaque references and crash at render (`emptyFabricForm is not a function`,
  2026-09-11). Put every shared function or value in `lib/`. Both gates are blind to this.
- **Next's patched `fetch` cached the admin client's database reads**, so public shop pages kept
  showing whatever the database said at server start — retailer edits never appeared until a
  redeploy. The admin client now passes `cache: 'no-store'` (2026-09-11). Do not remove it.
- **Never run `npm run build` while the dev server is running.** Both write `.next/`. Symptoms:
  unstyled pages, then `Cannot find module './NNN.js'`. Recovery: stop all node processes,
  delete `.next`, start one dev server. Safe order: `npm test` → stop dev server →
  `npm run build` → restart dev server.
- **Read `e.currentTarget` before any `await` in an event handler.** React nulls it once the
  handler stops running synchronously (`GarmentForm` `onSubmit`, fixed 2026-09-11).
- **The language toggle only works in client components.** `LanguageProvider` is React context.
  When a server component needs translated text, move that markup into a small client component
  (see `DashboardHeader.tsx`, `GarmentGrid.tsx`) rather than converting the page — that would move
  database work to the browser.
- **Server-side API error messages are Thai only.** The API chooses them on the server, and
  the signup page passes `data.error` through untranslated on purpose.
- **Browser tab titles are always Thai.** `metadata` runs on the server and cannot see
  `localStorage`. Fixing it needs the language in the URL or a cookie — a routing change.
- **The shopper's Fit panel stays mounted when another tab is shown** (hidden with the `hidden`
  attribute). Unmounting it would wipe a half-filled measurement form. Do not turn it into a
  conditional render, and do not put a `flex`/`grid` class on those wrappers — it beats
  `[hidden] { display: none }`.
- **Next 15 (upgraded 2026-09-29 from 14.2, with React 19): `params` and `cookies()` are now
  async.** Route `params` props became `Promise<{...}>` in every dynamic route and
  `generateMetadata` — the official codemod (`npx @next/codemod@latest next-async-request-api .`)
  handles those call sites correctly. It does **not** safely handle indirection: our
  `createSupabaseServerClient()` in `lib/supabase/server.ts` wraps `cookies()`, and the codemod's
  fallback for that case is the deprecated `UnsafeUnwrappedCookies` synchronous escape hatch. Do
  not keep that — make the wrapper `async`, `await cookies()` inside it, and add `await` at
  every one of its ~11 call sites (grep `= createSupabaseServerClient()` to find them all; every
  caller was already inside an `async` function, so this is a pure mechanical `await` insert).
  `middleware.ts` is unaffected — it reads `request.cookies` directly, not `next/headers`.
  `useSearchParams()` in client components is also unaffected (`app/login/page.tsx`).

## 4. Data and Supabase

- **There is no staging database.** One Supabase project serves local dev and production.
  Anything you write locally is written to the live site.
- **Apply an additive migration before merging the code that uses it.** Old code ignores new
  columns, but new code selecting a missing column breaks every page that queries it
  (colour & fabric, 2026-09-11). Probe the schema against the live database before merging.
- **"Absent" and "empty" mean different things in the garment API.** A missing `colours` field
  means "leave them alone"; `colours: []` means "delete them all". Collapsing the two would let
  any older client wipe a retailer's colours. `parseColoursField` returns a `present` flag for
  this, pinned by a regression test.
- **The fabric row is written with an explicit insert-or-update, not `.upsert()`.** Guessing
  PostgREST's conflict columns wrong would silently drop an existing fabric photo.
- **Never delete an old Storage photo until the new reference is saved.** Two separate bugs
  (2026-08-15, 2026-09-11) left a garment pointing at a deleted image.
- **Deleting a garment removes all three of its photos from Storage.** The database cascade
  removes child rows, but Storage files are outside the database and would be orphaned.
- **Colour and fabric writes log and continue on failure** rather than failing the save. A
  retailer whose colours failed to save sees success. Accepted for a one-retailer prototype.
- **A garment may only reference a fit preset its own shop owns** (2026-09-29). Enforced in app code by
  `checkRulesetOwnership()` (`lib/garment/ruleset-ownership.ts`), called by create and edit after the
  pure `parseGarmentFields()`. The lookup is scoped by `retailer_id`, so another shop's preset looks
  nonexistent (400), and a failed lookup is a 500, never a pass. No RLS or SQL change. Presets stay
  publicly readable by design (§2). Covered by unit tests only; the routes have no automated coverage.
- **`garments_public_read` looks vestigial** — no code reads garments with the anonymous client.
  Unverified whether removing it breaks anything.

## 5. Testing — what the suite can and cannot catch

- **The suite is unit tests over `lib/` plus a few component tests.** There are no route or
  database tests, because there is no staging database to run them against. API routes and
  queries need a manual check.
- **Component tests need two things this setup does not do for you:**
  - Vite 8 transforms JSX with **oxc, not esbuild**. `vitest.config.ts` sets
    `oxc: { jsx: { runtime: 'automatic' } }`; an `esbuild` block is silently ignored.
  - Every component test file needs an explicit `afterEach(cleanup)`. Auto-cleanup does not arm
    because vitest runs without `globals: true`; without it you get "multiple elements found".
  - Component test files opt into the browser environment with a
    `// @vitest-environment jsdom` comment at the top.
- **Code review has caught what tests and checklists missed.** Garment edit (2026-08-15) and
  colour & fabric (2026-09-11) each had three silent-wrong-data bugs found only in review. A
  manual checklist that looks at *current* behaviour cannot catch a wrong value that is
  currently outranked by something else. Treat review passes as load-bearing.
- **When confirming a new route is live, use controls.** A blanket 401 looks like success.
  Compare the new route against an existing route without that method (expect 405) and a
  nonexistent route (expect 404).

## 6. Working with agents and subagents

- **Verify every subagent report against the repo.** One reported a clean commit and passing
  tests while its fix sat uncommitted (2026-08-11). Check `git status --short`; if a report
  seems too clean, re-run the tests against the committed state.
- **Only one `next build` at a time in a shared working directory.** Concurrent builds corrupt
  `.next/` and produce phantom failures in other agents' files. Subagents run `npm test`,
  `npx tsc --noEmit` and `npx next lint`; the main session runs the one real build.
- **Commit with `git commit -- <paths>`.** Plain `git commit` takes everything staged, including
  other agents' files (2026-08-18).
- **Give parallel agents disjoint files**, and write shared copy (`lib/i18n/strings.ts`) up
  front in one commit so they cannot collide on it.
- **Never approve a permission rule with a credential typed into the command.** The rule stores
  the command word for word. Pass secrets through environment variables.

## 7. Windows environment

- **`LF will be replaced by CRLF` warnings on commit are cosmetic.** Ignore them.
- **PowerShell shows native-program stderr in red even on success** (`git clone`, `git push`).
  Check the actual result lines, not the colour.
- **The dev server dies after idle stretches.** Restart it; it comes up in about 5 seconds.
- A fresh clone needs `npm install` before anything else.

## 8. Shipping on Vercel

- **Only the `ingkawatlimvipuwat-sys` GitHub account may press "Merge pull request."** Vercel is
  on the Hobby plan, which blocks a deploy of this private repo when the latest commit's author
  is anyone else ("The Hobby Plan does not support collaboration for private repositories").
  Teammates can open PRs; the founder merges. Sharing a Vercel login does not help — Vercel
  checks the GitHub author, not who is logged in to Vercel (2026-09-30, PR #4).
- **Do not move the project to a new Vercel account to save seats.** A re-import gets a new
  `*.vercel.app` address, and every shop link already handed to customers points at
  `fit-mvp-eight.vercel.app` (`CopyPublicLink` builds links from the current origin).
- **A merged PR can still be missing files.** PR #4 imported a component that only existed on
  its author's machine, and `main` stopped building. A green build on the PR's Vercel preview
  is the check: do not merge a PR whose preview failed or never appeared.
- **A signed-in `gh` can deploy.** By 2026-10-01 `gh` was signed in as the founder, and the
  push denies did not cover `gh pr merge`. An agent merging through it would pass Vercel's author
  check and go live with no preview check. Since 2026-10-05 `.claude/settings.json` also denies
  `gh pr merge`, `gh api …merge…` and `gh api …contents…`. Agents open PRs; only the founder merges.
  Agents' worktrees only pick up a new deny rule after they `git merge origin/main`.
