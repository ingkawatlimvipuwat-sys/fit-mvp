# Fit MVP — agent orientation

Read this first. It is short on purpose. Follow the pointers for depth.

## What this is

A fit-checker web app for a Thai clothing retailer. Customers open a public shop link, enter
body measurements, and get a per-dimension fit verdict. Next.js 14 App Router + Supabase,
deployed on Vercel.

**Live:** https://fit-mvp-eight.vercel.app
**Repo:** `ingkawatlimvipuwat-sys/fit-mvp`
**Only checkout:** `C:\Users\Copter\Documents\Claude\Projects\Startup poor fools\fit-mvp`
(A stale second clone at `Desktop\Claude code` was deleted 2026-08-11. If a session opens
there, it is an empty leftover shell — `cd` here first.)

## Shipping — read before you say "done"

**Pushing a `feature/*` branch does NOT update the live site.** Vercel builds `main` and only
`main`. This cost a full session on 2026-08-11: 20 commits sat pushed-but-unmerged while the
founder saw no change on the live site.

To ship:

```bash
git checkout main && git merge --ff-only feature/your-branch && git push origin main
```

Then confirm the deploy actually landed — don't assume. Probe a route that exists only in the
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
- The suite is **pure unit tests over `lib/fit`** — no route or DB coverage at all. Currently
  47 tests. Anything touching an API route or the database needs a manual check.

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

## Where the docs are

| File | What it is |
|---|---|
| `docs/superpowers/resume.md` | **State of record** — current status, file map, open follow-ups. Update this. |
| `docs/superpowers/handoff-2026-08-11-custom-fit-rules.md` | Historical. Design rationale (§3) and traps (§4) still worth reading. Status header is superseded by `resume.md`. |
| `docs/superpowers/handoff-fable5.md` | Historical. Product intent (§2) and how to work with the founder (§3) still apply. Its §6 environment notes are stale. |
| `docs/superpowers/specs/` | Design docs per feature. |
| `docs/superpowers/plans/` | Task-by-task implementation plans. |

There are three handoff docs because each session wrote a new one. **Do not add a fourth** —
update `resume.md` instead.

## Working with the founder

Non-technical. Give click-by-click instructions for anything they must do themselves (SQL,
Vercel, `gh auth login`). Explain the why, not just the what. Never ask for credentials.

Cost-conscious: they have asked that mechanical/boilerplate edits be delegated to Sonnet
subagents, with design and verification kept in the main session. **Verify every subagent
report against actual repo state** — one previously reported a clean commit while leaving its
fix uncommitted in the working tree.

## Environment notes

- `gh` CLI is at `C:\Program Files\GitHub CLI\gh.exe`, **not on PATH**, and not authenticated.
  Invoke by full path. The repo is private, so `WebFetch` cannot inspect PRs.
- **Local dev does not use the hosted project.** `npm run setup:local` starts Postgres + Auth
  + Storage in Docker (Colima on this Mac), applies `supabase/migrations/`, seeds a demo shop,
  and writes `.env.local` to `http://127.0.0.1:54321`. Demo login: `demo@example.com` /
  `password123`. Wipe with `npm run db:reset`.
- The hosted Supabase project is production only (Vercel env vars). Migrations still have to
  be applied there by hand via the SQL editor before merging schema-dependent code — local
  apply does not reach production.
- Env vars (`.env.local`, gitignored; also set in Vercel): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
