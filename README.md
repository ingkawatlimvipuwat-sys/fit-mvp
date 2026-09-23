# Fit MVP

A fit-checker web app for a Thai clothing retailer. Customers open a public shop link, enter
their body measurements, and get a per-dimension fit verdict — instead of guessing at a size
chart.

**Live:** https://fit-mvp-eight.vercel.app

Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Auth + Postgres + Storage) · Vercel

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Requires a `.env.local` with the three variables listed in `.env.example`. Get them from the
Supabase dashboard under Settings → API.

> **Note:** one Supabase project serves both local dev and production — there is no staging.
> Data you change locally is live data.

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

Database migrations in `supabase/migrations/` are **applied by hand** through the Supabase SQL
editor. They are not run by the deploy.

## Documentation

Start with **`docs/superpowers/resume.md`** — it opens with a plain-language summary of what
the app does today, then lists what's live and everything still to do.

- `docs/superpowers/resume.md` — status of record: what's live, the to-do list, environment.
- `docs/superpowers/decisions-and-lessons.md` — why the product is built the way it is (§2),
  and traps already paid for.
- `CLAUDE.md` — orientation for AI coding agents: shipping procedure, checks, landmines.
  Worth reading for humans too.
- `docs/superpowers/specs/` and `plans/` — design doc and task plan per feature.
- `docs/superpowers/archive/` — old handoff notes, kept for history.
