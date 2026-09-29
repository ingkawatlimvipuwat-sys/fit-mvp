# Fit MVP

A fit-checker web app for a Thai clothing retailer. Customers open a public shop link, enter
their body measurements, and get a per-dimension fit verdict — instead of guessing at a size
chart.

**Live:** https://fit-mvp-eight.vercel.app

Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Auth + Postgres + Storage) · Vercel

## Running locally

Local development uses a **local** Postgres + Auth + Storage stack (via Docker). It does not
talk to the hosted Supabase project, so nothing you do here can change live data.

1. Install dependencies: `npm install`
2. Start Docker. On this Mac that is Colima (`colima start`); Docker Desktop works too.
3. One-time (or whenever the local stack is down):

```bash
npm run setup:local
```

That starts local Postgres/Auth/Storage, applies every file in `supabase/migrations/`, seeds a
demo shop, and writes `.env.local` pointing at `http://127.0.0.1:54321`.

4. Run the app:

```bash
npm run dev
```

Open http://localhost:3000.

| | |
|---|---|
| Demo login | `demo@example.com` / `password123` |
| Demo shop | http://localhost:3000/shop/demo |
| Local Studio | http://127.0.0.1:54323 |

Other database commands: `npm run db:stop`, `npm run db:reset` (wipe and re-seed),
`npm run db:status`.

Production on Vercel still uses the hosted project. Those keys live in the Vercel dashboard,
not in `.env.local`.

## Checks

```bash
npm test && npm run build
```

Both must pass before merging. They catch different problems: `npm run build` runs `next lint`,
which rejects unused imports that the typechecker ignores. A clean `tsc` is not enough.

## Deploying

**Vercel builds `main` and only `main`.** Pushing a `feature/*` branch puts your code on GitHub
but changes nothing on the live site.

```bash
git checkout main && git merge --ff-only feature/your-branch && git push origin main
```

The deploy runs automatically and takes 1–2 minutes. Confirm it landed rather than assuming —
open the Vercel dashboard's Deployments tab, or probe a route that exists only in the new code
(a 404 means it hasn't deployed yet).

Database migrations in `supabase/migrations/` are applied automatically to the **local** stack
on `setup:local` / `db:reset`. The hosted project is still updated by hand through the
Supabase SQL editor — they are not run by the Vercel deploy.

## Documentation

- `CLAUDE.md` — orientation for AI coding agents: shipping procedure, verification gates, known
  landmines. Worth reading for humans too.
- `docs/superpowers/resume.md` — state of record: current status, file map, open decisions.
- `docs/superpowers/specs/` — design docs per feature.
- `docs/superpowers/plans/` — task-by-task implementation plans.
