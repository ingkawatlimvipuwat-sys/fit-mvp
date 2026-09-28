# Fit MVP — agent orientation

Read this first. It is short on purpose. Follow the pointers for depth.

## What this is

A fit-checker web app for a Thai clothing retailer. Customers open a public shop link, enter
body measurements, and get a per-dimension fit verdict. Next.js 14 App Router + Supabase,
deployed on Vercel.

**Live:** https://fit-mvp-eight.vercel.app
**Repo:** `ingkawatlimvipuwat-sys/fit-mvp`
**Main checkout:** `C:\Users\Copter\Documents\Claude\Projects\Startup poor fools\fit-mvp`.
Git worktrees made from it for agents are fine. Any other clone is not: a stale one at
`Desktop\Claude code` was deleted 2026-08-11 — if a session opens there, `cd` here first.

## Shipping — read before you say "done"

**Pushing a `feature/*` branch does NOT update the live site.** Vercel's production site
builds from `main` only. This cost a full session on 2026-08-11: 20 commits sat
pushed-but-unmerged while the founder saw no change on the live site.

**Agents cannot push `main`.** `.claude/settings.json` denies `git push` to `main`, bare
`git push`, force pushes, `--no-verify` and Vercel production deploys — for every agent, in
every permission mode. This is deliberate (2026-09-28): the founder runs agents unattended in
Munder Difflin, a push to `main` is a live deploy, and the database has no staging copy. Do not
work around it (no pushing from another shell, no `HEAD:refs/heads/main` tricks). The rule
matches `main` anywhere in a push command, so keep `main` out of branch names.

**The founder ships by merging a pull request on GitHub** (decided 2026-09-28). When a branch
is ready: push it (`git push -u origin feature/your-branch`) and give the founder this link,
which opens a ready-to-fill pull request:

```
https://github.com/ingkawatlimvipuwat-sys/fit-mvp/compare/main...feature/your-branch?expand=1
```

On that page they press **Create pull request**, wait for Vercel's preview link to appear on
it, check the change there, and press **Merge pull request**. Merging is the deploy. Warn them
every time: **the preview site uses the live database**, so saving anything on it changes the
real shop. (`gh` is not authenticated here, so agents cannot open or merge the PR themselves —
that is fine; it keeps the button with the founder.)

After they merge, confirm the deploy actually landed — don't assume. Probe a route that exists only in the
new code and compare it against a route that doesn't:

```bash
curl -o /dev/null -s -w "%{http_code}\n" https://fit-mvp-eight.vercel.app/api/your-new-route
```

404 means the deploy has not landed. 401/405 means the route is live.

If live is stale, check `git log --oneline origin/main -1` **before** debugging anything else.

## Verification gates

Both must be green before merging. They catch different things:

```bash
npm test && npm run build
```

- **`tsc` clean does NOT mean the build passes.** `next lint` rejects unused imports that the
  typechecker ignores. An unused type import in a test file has blocked a build here.
- **`tsc` proves nothing about Supabase query shapes.** The clients are untyped, so
  `.from('garments')` returns `any`. A wrong field shape compiles clean and crashes at runtime.
  For anything touching a query result, tests and manual checks are the only real gate.
- The suite is **unit tests over `lib/` plus a few `jsdom` component tests** (the colour &
  fabric branch added the first component tests) — **no route or DB coverage at all**. Current
  counts are in `resume.md`. Anything touching an API route or the database needs a manual check.

## Landmines — do not relearn these

- **Circular import.** `lib/fit/rules.ts` must import from `lib/config/dimensions.ts` with
  `import type` ONLY. `dimensions.ts` imports `DEFAULT_RULE` as a value from `rules.ts`. A value
  import the other way makes `DEFAULT_RULE` `undefined` at module-init and silently breaks every
  dimension's bands. Do not "tidy" this.
- **Zod schemas here need `.strict()`.** Without it zod *strips* unknown keys instead of
  rejecting them, so a malformed rule parses "successfully" as an empty object and produces a
  wrong verdict rather than an error. That silent-wrong-answer class is the one to fear here.
- **Ease boundaries are inclusive-edge.** Ease exactly at `goodFrom` is `snug`, not `good_fit`.
  Fixtures using garment 96 / customer 100 land exactly on the boundary. Use 97 / 100 for
  anything meant to demonstrate `good_fit`. This mistake has been made twice.

## Working as a team (Munder Difflin)

Since 2026-09-28 the founder may run several agents at once through Munder Difflin, a desktop
app: an orchestrator ("Michael", address `god`) hands out tasks, and short-lived "temps" each
work in their own git worktree with **no permission prompts**. The rules below exist because
of that. They apply to single sessions too.

- **One task, one branch, one worktree.** Branch `feature/<short-name>` from `origin/main`.
  Never commit to another agent's branch. If your task needs files another agent is editing,
  tell `god` before starting rather than racing them.
- **A fresh worktree is not ready to run.** Run `npm install` (`node_modules/` is not shared)
  and copy `.env.local` over from the main checkout (it is gitignored, so worktrees lack it and
  the build fails without it). Never commit it and never print its contents.
- **The database is live.** Do not run SQL, apply migrations, or submit forms against the dev
  server unless the founder asked for that specific thing. For a schema change, write the
  migration file and hand the founder click-by-click SQL-editor steps.
- **Before reporting "ready to ship":** bring the branch up to date with `git merge
  origin/main` (not rebase — rebasing a pushed branch needs a force push, which is blocked),
  re-run `npm test && npm run build`, update `resume.md` on the branch, and push it. Your
  report gives the pull-request link (see Shipping), says what changed and what the gates
  showed, and lists exactly what the founder should click through on the preview site.
- **Questions for the founder go through `god`** as one short ASK ME card: the decision, your
  recommendation, and the options. Keep working on something else while you wait.
- **Spend like it is the founder's money.** Mechanical edits belong on Sonnet. Do not start
  helpers for work you can finish yourself.

## Where the docs are

| File | What it is |
|---|---|
| `docs/superpowers/resume.md` | **Status of record** — what's live, the one to-do list, environment, code map. Update it in place. |
| `docs/superpowers/decisions-and-lessons.md` | Settled decisions and paid-for traps, by topic. Read the section for the area you touch; add new lessons there. |
| `docs/superpowers/specs/`, `plans/` | Design doc and task plan per feature, as written at the time. Not updated afterwards. |
| `docs/superpowers/archive/` | Old handoff docs and the 2026-08-18 UX audit. History only — their live content was moved into the two files above. |

**Do not write a new handoff document.** Earlier sessions each wrote one, and the founder got
lost among them. Update `resume.md` and `decisions-and-lessons.md` instead.

## Working with the founder

Non-technical. Give click-by-click instructions for anything they must do themselves (SQL,
Vercel, `gh auth login`). Explain the why, not just the what. Never ask for credentials.

The founder makes product calls; you make implementation calls. When a decision is genuinely
theirs, ask with a recommendation rather than a survey of options. Features go brainstorm →
spec → plan → build, and the founder checks each one in a browser before it ships.

Cost-conscious: they have asked that mechanical/boilerplate edits be delegated to Sonnet
subagents, with design and verification kept in the main session. **Verify every subagent
report against actual repo state** — one previously reported a clean commit while leaving its
fix uncommitted in the working tree.

## Environment notes

- `gh` CLI is at `C:\Program Files\GitHub CLI\gh.exe`, **not on PATH**, and not authenticated.
  Invoke by full path. The repo is private, so `WebFetch` cannot inspect PRs.
- One Supabase project serves both local dev and production — there is no staging. Local
  changes to data are live changes. Migrations in `supabase/migrations/` are applied by hand
  via the Supabase SQL editor.
- Env vars (`.env.local`, gitignored; also set in Vercel): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
