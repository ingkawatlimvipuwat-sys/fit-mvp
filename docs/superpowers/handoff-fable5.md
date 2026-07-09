# Handoff — Fit Recommendation MVP (for Fable 5)

> **You are picking up an in-flight prototype.** This document is the *intent* brief:
> why this project exists, who you're working with, how work has been done, and what
> decisions are already settled. For the mechanical current-state detail (file map,
> deferred-polish list, env vars), read `docs/superpowers/resume.md` immediately after
> this. For the original task-by-task plan, read
> `docs/superpowers/plans/2026-05-25-fit-recommendation-mvp-phase1.md`.

---

## 1. What you're inheriting (one paragraph)

A working, deployed prototype of a **fit-recommendation web app** for a single Thai
clothing retailer. A retailer adds garments with measurements; customers open a public
link, type in their body measurements, and get **per-dimension fit feedback** ("Shoulder:
too tight, Waist: good fit") plus an overall verdict. It is live on Vercel, backed by
Supabase, and the code is on GitHub (`ingkawatlimvipuwat-sys/fit-mvp`). Phase 1 is
complete. The current git HEAD is `f403320` on `main`; working tree is clean; all 12
Vitest tests pass and `npm run build` is green.

---

## 2. Product intent (the "why", so you make aligned decisions)

- **The core value prop is fit intelligence, not imagery.** The whole point is telling a
  customer *how a specific garment will actually fit their body*, dimension by dimension.
  Virtual try-on (VTO) imagery is deliberately **Phase 2** — a visual enhancement layered
  on top of a validated fit engine, not the foundation. Do not let VTO creep into Phase 1
  thinking.
- **Smallest honest version of a real product.** This is an MVP to demonstrate the value
  prop to real Thai retailers and customers, then iterate on real-world data. It is not
  meant to be feature-complete. When choosing between "more features" and "prove the core
  loop works", choose the core loop.
- **Modularity is a stated goal, not a nice-to-have.** The founder explicitly wants the
  measurement model to be swappable — new dimensions/metrics added later without a
  rewrite. This is why `lib/config/dimensions.ts` is the single source of truth that
  drives forms, validation, the fit engine, and labels. Preserve that. Adding a dimension
  should stay a one-file edit.
- **Thai-first, English-fallback.** UI copy is Thai by default; a customer-facing EN/TH
  toggle exists on shop pages. Retailer-entered content (shop name, garment names) is
  never machine-translated. Keep that boundary.

---

## 3. Who you're working with

- **Ingkawat Limvipuwat** — a **non-technical founder**. Commits authored as
  `ingkawat.limvipuwat@gmail.com`.
- **Implications for how you should behave:**
  - Explain what you're doing and why, in plain language, before and after significant
    steps. Avoid unexplained jargon.
  - The founder cannot debug code themselves. When something needs their action, give
    exact, click-by-click instructions (which button, which menu, what to paste).
  - They test features in the browser at phase boundaries; you set up those tests with
    clear expected outcomes.
  - They make product calls; you make implementation calls and recommend, not survey.
    When a decision is genuinely theirs (auth method, whether photos are required, fit
    semantics), ask with a clear recommendation. Otherwise pick the sensible default and
    say so.

---

## 4. How the work has been done (process to continue)

This project was built with the **superpowers workflow**: brainstorm → written spec →
written plan → task-by-task execution with review gates. Concretely:

- **Execution model:** `superpowers:subagent-driven-development`. For each task, an
  *implementer* subagent writes the code (often verbatim from the plan), then a
  *spec-compliance* reviewer verifies it matches the plan, then a *code-quality* reviewer
  looks for real defects. Findings get fixed before moving on.
- **Pragmatic adaptations that emerged (keep these):**
  - For **verbatim-from-plan config files** (small, all-or-nothing), the two reviews are
    **combined into one** subagent pass to save tokens.
  - For tasks with **real architectural surface** (API routes, the fit engine, the hero
    page), reviews are **split** into two passes.
  - **Trivial fixes (1–3 lines)** from review findings are applied **inline by the
    controller** rather than dispatching a fix subagent — saves a full loop.
- **Phase gates:** between phases, the founder runs a manual browser test before the next
  phase starts. Do not skip these; they are the founder's confidence checkpoints.
- **Review discipline pays off here.** The reviewers caught real issues during Phase 1 —
  orphaned auth users on signup failure, orphaned Storage files on insert failure, a
  permanent-loading-state bug on network failure, path-traversal in an upload filename,
  RLS over-exposure of biometric data. Treat the review passes as load-bearing, not
  ceremony.

---

## 5. Current state (summary — detail in resume.md)

**Done:** Phases 1.1–1.5 (scaffold, auth, dashboard + add-garment, public shop + hero fit
checker, deploy) plus a language toggle. Live on Vercel.

**Architecture in force (do not casually change):**
- Fit logic compares **customer body** vs **garment's own size**. `good_fit` means the
  garment is 1–5 cm roomier than the body. Per-dimension threshold bands, overridable by
  named fit profiles (`regular`/`slim`/`relaxed`).
- The fit engine (`lib/fit/engine.ts`) is a **pure function** with unit tests — no DB, no
  network. Keep it pure; it's the most valuable and most testable piece.
- **Server-only boundary:** `lib/supabase/server.ts` starts with `import 'server-only'`
  and holds the service-role (admin) client. Client components import only from
  `lib/supabase/browser.ts`. Never leak the service-role key into a client bundle.
- **Row-Level Security** gates all data access. Public shop reads go through a limited
  surface; customer measurement sessions are inserted anonymously via a `customer_token`.
- **Phase 2 hooks already in place:** `fit_sessions.tryon_image_url` (nullable, always
  null in Phase 1), `customer_token` per-browser, `fit_profile` on garments, the
  `garment-photos` Storage bucket. See spec §13.

**What's likely next (not yet started):** the deferred-polish list in `resume.md`
(~11 items: readonly types, friendlier Thai error messages, a loading skeleton, back-nav
on the hero page, a stray typo Storage bucket to delete, etc.) and eventually Phase 2
(VTO via FASHN.ai). **Confirm scope with the founder before assuming** — the last stated
intent was *polish, not new features*.

---

## 6. Environment reality (important — this has been bumpy)

- **Primary local repo:** `C:\Users\Copter\Desktop\Claude code` (Windows, PowerShell +
  Git-bash). This is where Phase 1 was built and is the canonical working copy.
- **A second clone exists** at `C:\Users\Copter\Desktop\Munder work folder\fit-mvp` for
  use with **Munder Difflin** (a community multi-agent orchestration harness the founder
  is trying — https://github.com/chaitanyagiri/munder-difflin). It was cloned from GitHub
  at HEAD `f403320` with `.env.local` copied in. If you are running inside Munder Difflin,
  you are probably in *that* clone — `git pull` first to get anything committed since.
- **Two environment migrations were attempted and abandoned:** Cowork (its sandbox blocks
  outbound git + all shell exec — fatal for a build workflow that needs `npm`/`tsc`/git)
  and an initial Munder Difflin attempt that stalled on the Claude CLI not being on PATH.
  The CLI is now installed at `C:\Users\Copter\.local\bin\claude.exe` (v2.1.183) with a
  wrapper shim at `C:\Users\Copter\AppData\Roaming\npm\claude.cmd`.
- **Windows gotchas that recur:** LF→CRLF warnings on every commit (cosmetic, ignore);
  PowerShell flags `git clone`/native-exe stderr as "errors" even on success (check the
  verification lines, not the red text); `node_modules` is gitignored so **any fresh clone
  needs `npm install` before `npm run dev`/`build`/`test`**.
- **The dev server dies between idle stretches.** That's expected on this setup; just
  restart it (`npm run dev`) — it comes up in ~5s.

---

## 7. Guardrails / things not to do

- **Don't push broken commits to `main`** — it auto-deploys to Vercel. Run `npm test` and
  `npm run build` before any push.
- **Don't commit `.env.local`** (gitignored; contains the Supabase service-role secret).
- **Don't machine-translate retailer content.** Only built-in UI strings are bilingual.
- **Don't pull VTO forward** into Phase 1. It's Phase 2, layered on the validated engine.
- **Don't restructure the dimensions/fit-profile config** in a way that breaks the
  "add a dimension = one file edit" property.
- **If working under Munder Difflin:** its design is single-committer (the harness owns
  git; agents don't commit directly). Respect whatever commit boundary the harness
  enforces rather than calling `git commit` yourself.

---

## 8. Cost / model guidance (carried over from the founder's constraints)

The founder is on a plan with real usage limits and has hit the cap twice. Practical
guidance that's been working:
- **Sonnet handles the remaining work well** — it was the reviewer and implementer through
  Phase 1 and caught real bugs. Reserve heavier models for a specific review that seems
  off, not as the default.
- Keep controller narration tight; apply trivial fixes inline; combine reviews for
  verbatim config files. These are the levers that kept token spend down.

---

## 9. First moves when you start

1. Read `docs/superpowers/resume.md` (state + file map + deferred-polish list).
2. If in a fresh clone: `npm install`, then `npm test` (expect 12 passing) and
   `npm run build` (expect green) to confirm the environment is sound.
3. Ask the founder what this session is for — most likely **polish** (pick from the
   deferred list, highest user-facing value first) rather than new features. Get an
   explicit answer before writing code.
4. Work one item at a time; verify with `npm test` + `npm run build`; keep `main`
   deployable.
