# Fit Recommendation MVP — Design Spec

**Date:** 2026-05-25
**Status:** Approved (pending final spec review)
**Audience:** Single retailer (single-tenant MVP), Thai clothing market

## 1. Purpose

A web app where one retailer adds garments with measurements, and customers
visit a public link, enter their body measurements, and receive **per-dimension
fit feedback** (e.g. "Shoulder: too tight, Waist: good fit") plus an overall
verdict. Virtual try-on (VTO) is an optional add-on, not the core value.

The core value proposition is **fit intelligence**, not the try-on image.

## 2. Scope

### Phase 1 — in scope (this project)
- Retailer email + password auth (Supabase Auth)
- Retailer dashboard: list / add garments (photo required)
- Public shop browse page + public per-garment fit checker (the hero page)
- Per-dimension fit engine with tunable, profile-aware thresholds
- UI in Thai with English fallback strings
- Deploy to Vercel
- **Data + flow hooks ready for Phase 2 VTO** (see §13)

### Phase 2 — planned, not built in this project
- Virtual try-on (VTO) via FASHN.ai (a core value proposition, deferred until Phase 1 has validated the fit-intelligence value with real users)
- Try-on accuracy improvements that consume Phase 1 data (customer measurements, fit profile, per-dimension fit verdicts)

### Out of scope (do not build)
- Payments / billing
- Customer accounts (customers are anonymous)
- Inventory management beyond add/edit garments
- Analytics dashboard
- Native mobile app
- Runtime multi-language switcher (Thai-first, English as fallback copy only)
- Multi-tenant / multiple retailers (single-tenant MVP)

## 3. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14, App Router, TypeScript |
| Styling | Tailwind CSS |
| Auth / DB / Storage | Supabase (Postgres + Auth + Storage), free tier |
| VTO | FASHN.ai API (~$0.05/image) |
| Hosting | Vercel, free tier |

**Security rule:** secret keys (Supabase service-role key, FASHN API key) live
only in server-side API routes / server components, never shipped to the
browser. The browser uses only the Supabase anon key, which is gated by
Row-Level Security (RLS).

## 4. Architecture

```
Customer browser ─┐
Retailer browser ─┤
                  ▼
           Next.js (Vercel)
           ├── UI pages (React + Tailwind, Thai)
           └── API routes / server actions
                 │  (fit math, FASHN calls, secret keys)
        ┌────────┼─────────────┐
        ▼        ▼             ▼
   Supabase   Supabase     Supabase
   Auth       Postgres     Storage
                              │
                              ▼
                         FASHN.ai
```

## 5. Data model

Three tables (Postgres via Supabase). `jsonb` used for measurement bags so new
dimensions can be added without schema migrations.

### `retailers`
| column | type | notes |
|---|---|---|
| id | uuid (pk) | matches Supabase auth user id |
| email | text | |
| shop_name | text | |
| shop_slug | text (unique) | used in public URL `/shop/[slug]` |
| created_at | timestamptz | default now() |

### `garments`
| column | type | notes |
|---|---|---|
| id | uuid (pk) | |
| retailer_id | uuid (fk → retailers.id) | |
| name | text | |
| category | text | one of `top` / `bottom` / `dress` |
| photo_url | text | **required** |
| fit_profile | text | default `'regular'` (see §7) |
| measurements | jsonb | `{ shoulder_cm, chest_cm, waist_cm, hip_cm, length_cm, sleeve_cm }`, each optional |
| created_at | timestamptz | default now() |

### `fit_sessions`
| column | type | notes |
|---|---|---|
| id | uuid (pk) | |
| garment_id | uuid (fk → garments.id) | |
| customer_token | text (nullable) | opaque per-browser id (set via cookie/localStorage on first visit). Ties multiple sessions from the same customer together. Phase 1 benefit: pre-fill measurements for return visits. Phase 2 benefit: aggregated measurement history as a VTO input. |
| customer_measurements | jsonb | body measurements entered by customer |
| result | jsonb | computed per-dimension verdicts + overall |
| tryon_image_url | text (nullable) | reserved for Phase 2 (VTO); always null in Phase 1 — no migration needed when Phase 2 starts writing to it |
| created_at | timestamptz | default now() |

### Row-Level Security
- `retailers` / `garments`: a retailer can read/write only rows where
  `retailer_id = auth.uid()`.
- Public read access to `garments` (and the parent `retailers` slug/name) is
  needed for the `/shop` pages — exposed via a safe read path (public select
  policy limited to display columns, or a server route). No secret data in
  garments, so public select on display columns is acceptable.
- `fit_sessions`: insert allowed from public (anonymous customers create them);
  no public select of others' sessions required for MVP.

## 6. Modularity: central dimensions config (Option B)

A single config module is the source of truth for all measurement dimensions.
Forms, validation, the fit engine, and results display all read from it.
Adding a new dimension (e.g. `thigh_cm`) = add one entry; no DB migration
(values live in `jsonb`).

Each dimension entry contains:
- `key` (e.g. `shoulder_cm`)
- `labelTh`, `labelEn` (display labels)
- `categories` — which garment categories use this dimension
- `measureHintTh` / `measureHintEn` — "how to measure" guidance for customers
- `defaultThresholds` — the fit bands (see §7)

**Category → dimensions** is derived from each dimension's `categories` list:
- `top` → shoulder, chest, waist, length, sleeve
- `bottom` → waist, hip, length
- `dress` → shoulder, chest, waist, hip, length, sleeve

This drives the "only fill what applies to the category" behavior automatically
in both the retailer add form and the customer fit form.

## 7. Fit engine

A **pure function** (no DB, no network): inputs = garment measurements,
customer measurements, and the garment's `fit_profile`; output = per-dimension
verdicts + overall verdict. Pure = easy to unit-test and tune.

### Thresholds (default profile, seeded from original spec)
Comparison is `customer_value` vs `garment_value`:
| Condition | Verdict | Color |
|---|---|---|
| customer > garment + 1cm | Too tight | red |
| garment − 1cm ≤ customer ≤ garment + 1cm | Snug | yellow |
| garment − 5cm ≤ customer < garment − 1cm | Good fit | green |
| customer < garment − 5cm | Loose | yellow |

(Recall: garment values are the garment's own size, so a good fit means the
garment is 1–5cm roomier than the body.)

### Per-dimension thresholds
Each dimension carries its own default threshold band in the config, so
shoulders can demand a tighter match than the waist.

### Fit profiles (tunable, profile-aware)
Named profiles shift/override the per-dimension thresholds to express intended
style:
- `regular` (default)
- `slim` — tightens the "good fit" band (less ease)
- `relaxed` — widens it (more ease)

Resolution order in the engine: **per-dimension defaults → fit profile
override → (future) per-garment custom override**. A garment selects a profile
via `garments.fit_profile`.

Two modification paths, both supported:
- **By us:** edit the config file to adjust a profile's numbers or add a new
  profile (e.g. `oversized`). One file, no DB change.
- **By retailer:** choose a profile from a dropdown when adding/editing a
  garment. No code change.

Future extension (not built now): retailer-editable custom thresholds backed by
a DB column/table; the engine's resolution order already accommodates it.

### Comparison rules
- Only dimensions where **both** garment and customer have a value are scored.
- Dimensions missing on either side are shown as "not specified", not scored.
- **Overall verdict = worst per-dimension verdict.** All dimensions are shown.

## 8. Pages & flow

| Route | Audience | Description |
|---|---|---|
| `/signup` | Retailer | Email + password registration; creates `retailers` row + shop_slug |
| `/login` | Retailer | Email + password login |
| `/dashboard` | Retailer | List own garments; "Add garment"; copy public shop link |
| `/dashboard/garment/new` | Retailer | Form: name, category, **required photo upload**, fit profile, measurement fields shown per category |
| `/shop/[shop_slug]` | Public | Photo grid of the shop's garments |
| `/shop/[shop_slug]/[garment_id]` | Public | **Hero page**: garment photo + details; customer measurement form with "how to measure" hints; instant per-dimension fit results + overall verdict; optional "See it on you" (VTO) |

## 9. Phase 2: Virtual try-on (deferred, built on top of validated Phase 1)

VTO is a core value proposition but is intentionally deferred to a Phase 2
project, after Phase 1 has validated the fit-intelligence value with real
retailers and customers. Phase 1 is built with the data and flow hooks needed
for a clean Phase 2 integration (see §13).

### Planned Phase 2 flow
On the hero page, after fit results:
1. Customer taps "See it on you" and uploads a selfie.
2. A server API route sends the selfie + garment photo to FASHN.ai. Where the
   VTO API supports it, the customer's body measurements (current session and
   prior sessions linked via `customer_token`) and the garment's `fit_profile`
   are passed as additional hints to improve fit realism.
3. The result image is saved to Supabase Storage; its URL is stored on the
   `fit_session` (`tryon_image_url`) and displayed. Cached so re-views are free.
4. The per-dimension fit verdicts from §7 can be overlaid/annotated on the
   try-on image (e.g. "tight at shoulder"), turning the visual into actionable
   fit guidance rather than a decorative render.

**Privacy decision (current):** the customer's raw selfie is **not** persisted
— it is used only for the VTO call; only the generated result is stored. To
revisit at Phase 2 kickoff if explicit, consented retention would materially
improve try-on accuracy.

## 10. Testing

- **Fit engine:** automated unit tests covering each verdict band, profile
  shifts, missing-value handling, and overall = worst-dimension logic. Proven
  correct before UI wiring.
- **Manual test gates** after each build step (see §11).

## 11. Build order

### Phase 1 (this project; each step independently testable)
1. **Scaffold** — Next.js + Tailwind + TypeScript, Supabase client wiring, the
   3 tables + RLS. → confirm app runs locally.
2. **Auth** — signup / login. → create a test account.
3. **Dashboard + add garment** — incl. required photo upload to Storage and
   `fit_profile` selector. → add a real garment.
4. **Public shop + hero fit checker** — browse + fit results; `customer_token`
   set on first visit; returning-customer measurement pre-fill. → test as a
   "customer". (Fit-engine unit tests land here.)
5. **Deploy** — Vercel.

The assistant stops after each numbered step for the user to test before
continuing.

### Phase 2 (separate project, after Phase 1 validation)
1. VTO via FASHN.ai, using the §9 flow and consuming the Phase 1 hooks in §13.
2. Per-dimension fit overlay on the try-on image.
3. Revisit selfie retention with explicit customer consent if it materially
   improves try-on accuracy.

## 12. Prerequisites / environment notes

- **Node.js is not yet installed** on the dev machine — required (Node 22 LTS)
  before local development can start. Git is installed.
- Accounts created but projects not yet set up: Supabase project must be
  created in Phase 1; the assistant will walk the user through obtaining
  credentials and storing them in `.env.local` (never committed). FASHN key
  is not needed until Phase 2.

## 13. Phase 2 readiness — what Phase 1 leaves in place

Phase 1 deliberately builds the foundations Phase 2 needs, so adding VTO is
mostly UI + API wiring rather than a data-model overhaul.

- **Structured customer measurements** are persisted on every `fit_sessions`
  row (jsonb keyed by dimension key), immediately available to feed into the
  VTO call as body hints.
- **`customer_token`** ties multiple sessions from the same anonymous customer
  together without requiring signup, enabling: pre-fill of measurements on
  return visits (Phase 1 benefit), and aggregation of measurement history as a
  VTO input (Phase 2 accuracy benefit).
- **`garments.fit_profile`** is already structured data the VTO call can pass
  as a style hint (slim / regular / relaxed / future profiles).
- **`fit_sessions.result`** stores per-dimension verdicts, ready for the
  Phase 2 overlay/annotation pass on top of the try-on image.
- **`fit_sessions.tryon_image_url`** column is reserved (always null in
  Phase 1) so no migration is needed when Phase 2 starts writing to it.
- **Photo-required garments** guarantee every garment already has a usable
  image input for FASHN, with no Phase 2 backfill work.
- **Supabase Storage bucket layout** set up in Phase 1 for garment photos is
  reused for try-on results — no new infra spin-up in Phase 2.
