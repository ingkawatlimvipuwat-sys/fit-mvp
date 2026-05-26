# Fit Recommendation MVP — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 1 of the fit-recommendation MVP — a single-tenant web app where one Thai retailer adds garments with measurements and customers get per-dimension fit feedback on a public link. VTO is intentionally deferred to a separate Phase 2 project, but Phase 1 leaves the data and flow hooks in place.

**Architecture:** Next.js 14 App Router (TypeScript) + Tailwind, with Supabase (Postgres + Auth + Storage) as the entire backend. Secrets live only in server-side route handlers. A central `dimensions` config drives forms, validation, and the fit engine so adding a new measurement = one file edit. The fit engine is a pure function with comprehensive unit tests.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase (`@supabase/ssr`, `@supabase/supabase-js`), Vitest, Zod.

---

## How to use this plan

- **Each task ends with a commit.** You will leave the repo in a working state after every task.
- **Phase boundaries are STOP-AND-TEST gates.** At the end of each phase, the user (Ingkawat, non-technical founder) tests in the browser before continuing.
- **Manual steps are clearly marked `[MANUAL]`** — these need the user to act (install software, click in a UI, paste a value). Show the exact instructions; do not skip the explanation.
- **Run from project root:** `C:/Users/Copter/Desktop/Claude code/`. The repo is already `git init`'d with a `.gitignore` and the design spec committed.
- **TDD applies** to the fit engine and other pure-logic files. UI pages use manual smoke tests at phase gates (TDD for React components is overkill for this MVP).

---

## Prerequisites checklist (cover before Task 1)

- [x] Git installed
- [x] GitHub account created (`ingkawatlimvipuwat-sys`, email `ingkawat.limvipuwat@gmail.com`)
- [x] Repo initialized with local git identity
- [x] Spec committed
- [ ] Node.js 22 LTS installed (Task 1)
- [ ] Supabase account created (user did this; project not yet created — Task 7)
- [ ] Vercel account created (user did this; deploy in Task 29)

---

# PHASE 1.1 — PROJECT SCAFFOLD

End-of-phase test: `npm run dev` serves a landing page at `http://localhost:3000` with Tailwind styling, the database has the 3 tables visible in Supabase Studio, and the Vitest test runner executes successfully.

---

### Task 1: [MANUAL] Install Node.js 22 LTS

**Files:** none.

- [ ] **Step 1: User installs Node.js**

Tell the user:
> Go to https://nodejs.org/en/download. Download **Node.js 22 LTS** for Windows (the `.msi` Installer). Run it, accept the defaults, finish. Close and reopen this terminal/Claude Code window so the new PATH takes effect.

- [ ] **Step 2: Verify install**

Run (PowerShell):
```powershell
node --version; npm --version
```
Expected: `v22.x.x` and `10.x.x` (or higher).

- [ ] **Step 3: No commit needed** — nothing changed in the repo.

---

### Task 2: Create the Next.js project in place

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `postcss.config.js`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

- [ ] **Step 1: Scaffold Next.js into the current folder**

Run (PowerShell):
```powershell
npx create-next-app@14 . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint --use-npm
```
When prompted to use the current directory (which is not empty because of `.git`, `.gitignore`, `docs/`), answer **Yes**. This installs Next.js 14 with TypeScript, Tailwind, App Router, no `src/` folder, and the `@/*` import alias.

- [ ] **Step 2: Verify the dev server starts**

Run:
```powershell
npm run dev
```
Open `http://localhost:3000` in a browser — the Next.js starter page should appear. Then stop the server (Ctrl+C in the terminal).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 14 app with TypeScript and Tailwind"
```

---

### Task 3: Install runtime + test dependencies

**Files:** `package.json`

- [ ] **Step 1: Install Supabase + Zod**

```powershell
npm install @supabase/supabase-js @supabase/ssr zod
```

- [ ] **Step 2: Install Vitest as dev dependency**

```powershell
npm install -D vitest @vitest/ui
```

- [ ] **Step 3: Add a test script to `package.json`**

In `package.json`, in the `"scripts"` block, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```
(Keep the existing `dev`, `build`, `start`, `lint` scripts.)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add supabase, zod, and vitest dependencies"
```

---

### Task 4: Create Vitest config

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: Write the config**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

- [ ] **Step 2: Smoke-test the runner with a trivial test**

Create `lib/__smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 3: Run tests**

```powershell
npm test
```
Expected: 1 passed.

- [ ] **Step 4: Delete the smoke test**

Delete `lib/__smoke.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts
git commit -m "chore: configure Vitest for lib/ tests"
```

---

### Task 5: Create `.env.example` and update `.gitignore`

**Files:**
- Create: `.env.example`
- Modify: `.gitignore` (already excludes `.env*` — verify)

- [ ] **Step 1: Verify `.gitignore` already ignores env files**

Open `.gitignore`. Confirm these lines exist (they were added during brainstorming):
```
.env
.env.*
!.env.example
```
If missing, add them.

- [ ] **Step 2: Write `.env.example`**

`.env.example`:
```
# Supabase — get these from https://supabase.com/dashboard/project/<your-project>/settings/api
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 3: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: add .env.example template"
```

---

### Task 6: [MANUAL] Create the Supabase project and capture credentials

**Files:** `.env.local` (created locally, NOT committed)

- [ ] **Step 1: User creates a Supabase project**

Tell the user:
> 1. Go to https://supabase.com/dashboard. Click **New Project**.
> 2. Organization: your personal one. Name: `fit-mvp`. Database password: generate a strong one and **save it in a password manager** — you'll rarely need it but it can't be recovered.
> 3. Region: **Southeast Asia (Singapore)** (closest to Thailand).
> 4. Pricing plan: **Free**.
> 5. Click **Create new project**. Wait ~2 minutes for provisioning.

- [ ] **Step 2: User collects 3 values**

Tell the user:
> Once the project is ready, go to **Project Settings → API** (gear icon, then "API" in the left menu). You need 3 things:
> 1. **Project URL** (under "Project URL")
> 2. **anon / public key** (under "Project API keys")
> 3. **service_role key** (under "Project API keys") — click "Reveal" to see it. **This is a secret — never paste it in chat, never commit it.**
>
> Paste these 3 values into the next message.

- [ ] **Step 3: Write `.env.local` (Claude writes the file using the user-supplied values)**

`.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=<user-supplied>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<user-supplied>
SUPABASE_SERVICE_ROLE_KEY=<user-supplied>
```

- [ ] **Step 4: Verify the file is NOT tracked by git**

```powershell
git status
```
Expected: `.env.local` does NOT appear (it's gitignored).

- [ ] **Step 5: No commit** — `.env.local` is intentionally not in git.

---

### Task 7: Database migration — tables and RLS

**Files:**
- Create: `supabase/migrations/0001_initial.sql`

- [ ] **Step 1: Write the migration SQL**

`supabase/migrations/0001_initial.sql`:
```sql
-- =============================================================
-- Fit Recommendation MVP — initial schema
-- =============================================================

-- ---------- retailers ----------
create table public.retailers (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  shop_name   text not null,
  shop_slug   text not null unique,
  created_at  timestamptz not null default now()
);

alter table public.retailers enable row level security;

-- Retailers can read their own row
create policy "retailers_self_read"
  on public.retailers for select
  using (auth.uid() = id);

-- Retailers can insert their own row (during signup)
create policy "retailers_self_insert"
  on public.retailers for insert
  with check (auth.uid() = id);

-- Retailers can update their own row
create policy "retailers_self_update"
  on public.retailers for update
  using (auth.uid() = id);

-- Public can read shop_name + shop_slug only (for /shop pages).
-- We expose this via a view to limit columns.
create view public.shops as
  select id, shop_name, shop_slug from public.retailers;
grant select on public.shops to anon;

-- ---------- garments ----------
create table public.garments (
  id            uuid primary key default gen_random_uuid(),
  retailer_id   uuid not null references public.retailers(id) on delete cascade,
  name          text not null,
  category      text not null check (category in ('top','bottom','dress')),
  photo_url     text not null,
  fit_profile   text not null default 'regular',
  measurements  jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index garments_retailer_id_idx on public.garments(retailer_id);

alter table public.garments enable row level security;

-- Retailers can CRUD their own garments
create policy "garments_owner_all"
  on public.garments for all
  using (auth.uid() = retailer_id)
  with check (auth.uid() = retailer_id);

-- Public can read any garment (needed for /shop pages). Display columns only —
-- but there are no secret columns on garments, so a blanket public select is OK.
create policy "garments_public_read"
  on public.garments for select
  to anon
  using (true);

-- ---------- fit_sessions ----------
create table public.fit_sessions (
  id                     uuid primary key default gen_random_uuid(),
  garment_id             uuid not null references public.garments(id) on delete cascade,
  customer_token         text,
  customer_measurements  jsonb not null,
  result                 jsonb not null,
  tryon_image_url        text,                       -- reserved for Phase 2; null in Phase 1
  created_at             timestamptz not null default now()
);

create index fit_sessions_garment_id_idx on public.fit_sessions(garment_id);
create index fit_sessions_customer_token_idx on public.fit_sessions(customer_token);

alter table public.fit_sessions enable row level security;

-- Public can insert their own fit sessions (anonymous customers)
create policy "fit_sessions_public_insert"
  on public.fit_sessions for insert
  to anon
  with check (true);

-- Public can read fit_sessions back by customer_token (for return-visit pre-fill).
-- They can only see rows matching a token they hold. Token is opaque per-browser.
create policy "fit_sessions_public_read_by_token"
  on public.fit_sessions for select
  to anon
  using (customer_token is not null);
-- Note: this allows reading rows with non-null tokens; the client filters by its own token.
-- For MVP this is acceptable. Tightening would require a passing-token-as-filter scheme.

-- Retailers can read fit_sessions for their own garments (basic analytics later)
create policy "fit_sessions_retailer_read"
  on public.fit_sessions for select
  using (
    exists (
      select 1 from public.garments g
      where g.id = fit_sessions.garment_id and g.retailer_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Commit the migration**

```bash
git add supabase/migrations/0001_initial.sql
git commit -m "feat(db): initial schema for retailers, garments, fit_sessions with RLS"
```

---

### Task 8: [MANUAL] Apply the migration in Supabase Studio

**Files:** none (manual SQL execution).

- [ ] **Step 1: User runs the SQL in the Supabase SQL Editor**

Tell the user:
> 1. Open your Supabase project dashboard.
> 2. Click **SQL Editor** in the left menu → **New Query**.
> 3. Open `supabase/migrations/0001_initial.sql` from this project in a text editor, copy its entire contents, paste into the SQL Editor.
> 4. Click **Run** (or press `Ctrl+Enter`). It should report **Success. No rows returned.**

- [ ] **Step 2: Verify tables exist**

Tell the user:
> In Supabase Studio, click **Table Editor** in the left menu. You should see `retailers`, `garments`, and `fit_sessions` listed.

- [ ] **Step 3: No commit** — applied in Supabase, file already committed.

---

### Task 9: Supabase client wrappers

**Files:**
- Create: `lib/supabase/browser.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/types.ts`

- [ ] **Step 1: Browser client (uses anon key, safe to expose)**

`lib/supabase/browser.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Server client (used in route handlers and server components)**

`lib/supabase/server.ts`:
```ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server client tied to the request's cookies. Use in route handlers and
 * server components for any operation that runs as the logged-in user.
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }); } catch { /* read-only context */ }
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch { /* read-only context */ }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Service-role client (server-only, bypasses RLS — use sparingly)**

Append to `lib/supabase/server.ts`:
```ts
import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client. BYPASSES RLS — never expose to the browser.
 * Use only for admin-style operations that the user can't do themselves.
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

- [ ] **Step 4: Minimal shared types**

`lib/supabase/types.ts`:
```ts
export type Category = 'top' | 'bottom' | 'dress';

export type MeasurementBag = Partial<Record<
  'shoulder_cm' | 'chest_cm' | 'waist_cm' | 'hip_cm' | 'length_cm' | 'sleeve_cm',
  number
>>;

export interface Retailer {
  id: string;
  email: string;
  shop_name: string;
  shop_slug: string;
  created_at: string;
}

export interface Garment {
  id: string;
  retailer_id: string;
  name: string;
  category: Category;
  photo_url: string;
  fit_profile: string;
  measurements: MeasurementBag;
  created_at: string;
}

export interface FitSession {
  id: string;
  garment_id: string;
  customer_token: string | null;
  customer_measurements: MeasurementBag;
  result: unknown;
  tryon_image_url: string | null;
  created_at: string;
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/supabase
git commit -m "feat(supabase): add browser, server, and admin client wrappers + types"
```

---

### Task 10: Replace the starter landing page

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx` (set Thai-aware language)

- [ ] **Step 1: Update root layout to set lang="th"**

`app/layout.tsx` — replace the contents with:
```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fit MVP',
  description: 'หาขนาดที่ใช่สำหรับคุณ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Replace `app/page.tsx`**

`app/page.tsx`:
```tsx
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      <h1 className="text-3xl font-semibold">Fit MVP</h1>
      <p className="mt-3 text-gray-600">หาขนาดที่ใช่สำหรับลูกค้าของคุณ</p>
      <div className="mt-8 flex gap-4">
        <Link href="/login" className="rounded bg-gray-900 px-4 py-2 text-white">เข้าสู่ระบบ</Link>
        <Link href="/signup" className="rounded border border-gray-300 px-4 py-2">สมัครสมาชิก</Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Smoke-test the dev server**

```powershell
npm run dev
```
Open `http://localhost:3000`. Confirm the page shows "Fit MVP" + the two Thai buttons. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/page.tsx
git commit -m "feat(ui): replace starter with Thai landing page"
```

---

## 🛑 PHASE 1.1 GATE — USER TEST

Pause. Confirm with the user:
- `npm run dev` runs cleanly.
- Landing page loads at `http://localhost:3000` with Thai text and two buttons.
- Supabase Studio shows the 3 tables.
- `npm test` shows "no test files" (expected — we'll add tests soon).

---

# PHASE 1.2 — AUTH

End-of-phase test: a user can sign up at `/signup`, get redirected to `/dashboard`, log out, log back in at `/login`. Protected pages bounce non-logged-in users to `/login`.

---

### Task 11: i18n strings module (Thai-first)

**Files:**
- Create: `lib/i18n/strings.ts`

- [ ] **Step 1: Write the strings file**

`lib/i18n/strings.ts`:
```ts
/**
 * Thai-first UI strings with English fallback. No runtime switcher — one
 * file, two fields per key. Components import what they need.
 */
export const t = {
  appName: { th: 'Fit MVP', en: 'Fit MVP' },

  // Landing
  tagline: { th: 'หาขนาดที่ใช่สำหรับลูกค้าของคุณ', en: 'Find the right fit for your customers' },
  login: { th: 'เข้าสู่ระบบ', en: 'Log in' },
  signup: { th: 'สมัครสมาชิก', en: 'Sign up' },
  logout: { th: 'ออกจากระบบ', en: 'Log out' },

  // Auth forms
  email: { th: 'อีเมล', en: 'Email' },
  password: { th: 'รหัสผ่าน', en: 'Password' },
  shopName: { th: 'ชื่อร้าน', en: 'Shop name' },
  shopSlug: { th: 'ลิงก์ร้าน (ตัวอักษรภาษาอังกฤษและ -)', en: 'Shop URL slug' },
  signupSubmit: { th: 'สร้างบัญชี', en: 'Create account' },
  loginSubmit: { th: 'เข้าสู่ระบบ', en: 'Log in' },
  authError: { th: 'เกิดข้อผิดพลาด กรุณาลองใหม่', en: 'An error occurred. Please try again.' },

  // Dashboard
  dashboardTitle: { th: 'แดชบอร์ดของร้าน', en: 'Shop dashboard' },
  addGarment: { th: 'เพิ่มเสื้อผ้า', en: 'Add garment' },
  noGarments: { th: 'ยังไม่มีเสื้อผ้า เพิ่มชิ้นแรกเลย', en: 'No garments yet. Add your first one.' },
  publicLink: { th: 'ลิงก์สาธารณะของร้าน', en: 'Public shop link' },
  copyLink: { th: 'คัดลอกลิงก์', en: 'Copy link' },

  // Garment form
  garmentName: { th: 'ชื่อเสื้อผ้า', en: 'Garment name' },
  category: { th: 'ประเภท', en: 'Category' },
  catTop: { th: 'เสื้อ', en: 'Top' },
  catBottom: { th: 'กางเกง/กระโปรง', en: 'Bottom' },
  catDress: { th: 'เดรส', en: 'Dress' },
  fitProfile: { th: 'ทรงการตัด', en: 'Fit profile' },
  profileRegular: { th: 'ทรงปกติ', en: 'Regular' },
  profileSlim: { th: 'ทรงเข้ารูป', en: 'Slim' },
  profileRelaxed: { th: 'ทรงหลวม', en: 'Relaxed' },
  photo: { th: 'รูปภาพ', en: 'Photo' },
  photoRequired: { th: 'จำเป็นต้องอัปโหลดรูป', en: 'Photo is required' },
  save: { th: 'บันทึก', en: 'Save' },

  // Customer-facing
  yourMeasurements: { th: 'ขนาดของคุณ', en: 'Your measurements' },
  checkFit: { th: 'ตรวจสอบความพอดี', en: 'Check fit' },
  overall: { th: 'สรุป', en: 'Overall' },
  verdictTooTight: { th: 'คับเกินไป', en: 'Too tight' },
  verdictSnug: { th: 'พอดีตัว', en: 'Snug' },
  verdictGood: { th: 'พอดี', en: 'Good fit' },
  verdictLoose: { th: 'หลวม', en: 'Loose' },
  verdictUnknown: { th: 'ไม่ได้ระบุ', en: 'Not specified' },
};

export type StringKey = keyof typeof t;
export function th(key: StringKey): string { return t[key].th; }
export function en(key: StringKey): string { return t[key].en; }
```

- [ ] **Step 2: Commit**

```bash
git add lib/i18n
git commit -m "feat(i18n): add Thai-first strings module with English fallback"
```

---

### Task 12: Signup page

**Files:**
- Create: `app/signup/page.tsx`
- Create: `app/api/signup/route.ts`

- [ ] **Step 1: Signup API route (creates Supabase auth user + retailer row)**

`app/api/signup/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  shop_name: z.string().min(1).max(80),
  shop_slug: z.string().regex(/^[a-z0-9-]{3,40}$/, 'lowercase letters, digits, dashes only (3–40 chars)'),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { email, password, shop_name, shop_slug } = parsed.data;

  // 1. Create the auth user (also signs them in via cookies)
  const supabase = createSupabaseServerClient();
  const { data: signupData, error: signupError } = await supabase.auth.signUp({ email, password });
  if (signupError || !signupData.user) {
    return NextResponse.json({ error: signupError?.message ?? 'signup failed' }, { status: 400 });
  }

  // 2. Insert the retailer row using the admin client (bypasses RLS during insert
  //    because the user's session may not be fully propagated yet).
  const admin = createSupabaseAdminClient();
  const { error: insertError } = await admin.from('retailers').insert({
    id: signupData.user.id,
    email,
    shop_name,
    shop_slug,
  });
  if (insertError) {
    // Slug collision is the common case
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Signup page UI**

`app/signup/page.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n/strings';

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === 'string' ? data.error : t.authError.th);
      return;
    }
    router.push('/dashboard');
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold">{t.signup.th}</h1>
      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <Field name="shop_name" label={t.shopName.th} />
        <Field name="shop_slug" label={t.shopSlug.th} pattern="[a-z0-9-]{3,40}" />
        <Field name="email" label={t.email.th} type="email" />
        <Field name="password" label={t.password.th} type="password" minLength={8} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? '…' : t.signupSubmit.th}
        </button>
      </form>
    </main>
  );
}

function Field(props: {
  name: string; label: string; type?: string; pattern?: string; minLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-sm text-gray-700">{props.label}</span>
      <input
        required
        name={props.name}
        type={props.type ?? 'text'}
        pattern={props.pattern}
        minLength={props.minLength}
        className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
      />
    </label>
  );
}
```

- [ ] **Step 3: Manual test**

Run `npm run dev`. Open `http://localhost:3000/signup`. Submit the form with a real email + 8-char+ password + a slug like `mytest-shop`. Confirm the browser navigates to `/dashboard` (which 404s for now — that's fine; we build it next).

- [ ] **Step 4: Verify a row exists in `retailers` table** via Supabase Studio → Table Editor → `retailers`.

- [ ] **Step 5: Commit**

```bash
git add app/signup app/api/signup
git commit -m "feat(auth): signup page + API route creating retailer row"
```

---

### Task 13: Login page

**Files:**
- Create: `app/login/page.tsx`

- [ ] **Step 1: Login page (uses Supabase browser client directly — no API route needed)**

`app/login/page.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { t } from '@/lib/i18n/strings';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold">{t.login.th}</h1>
      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <label className="block">
          <span className="text-sm text-gray-700">{t.email.th}</span>
          <input required name="email" type="email" className="mt-1 block w-full rounded border border-gray-300 px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">{t.password.th}</span>
          <input required name="password" type="password" className="mt-1 block w-full rounded border border-gray-300 px-3 py-2" />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? '…' : t.loginSubmit.th}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/login
git commit -m "feat(auth): login page"
```

---

### Task 14: Auth-gated dashboard layout + logout

**Files:**
- Create: `app/dashboard/layout.tsx`
- Create: `app/dashboard/page.tsx` (placeholder; real list in Task 19)
- Create: `middleware.ts`

- [ ] **Step 1: Middleware that refreshes Supabase session cookies**

`middleware.ts`:
```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );
  // Touch the session so it refreshes on every request.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 2: Auth-gated layout — redirects to /login if not signed in**

`app/dashboard/layout.tsx`:
```tsx
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { t } from '@/lib/i18n/strings';
import LogoutButton from './LogoutButton';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: retailer } = await supabase
    .from('retailers')
    .select('shop_name, shop_slug')
    .eq('id', user.id)
    .single();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <Link href="/dashboard" className="font-semibold">
          {retailer?.shop_name ?? t.dashboardTitle.th}
        </Link>
        <LogoutButton />
      </header>
      <main className="mx-auto max-w-4xl p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Logout button (client component)**

`app/dashboard/LogoutButton.tsx`:
```tsx
'use client';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { t } from '@/lib/i18n/strings';

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
      }}
      className="text-sm text-gray-600 hover:text-gray-900"
    >
      {t.logout.th}
    </button>
  );
}
```

- [ ] **Step 4: Placeholder dashboard page (real list in Task 18)**

`app/dashboard/page.tsx`:
```tsx
import { t } from '@/lib/i18n/strings';
export default function DashboardPage() {
  return <p className="text-gray-600">{t.noGarments.th}</p>;
}
```

- [ ] **Step 5: Manual test the full auth loop**

Run `npm run dev`. Visit `http://localhost:3000/dashboard` while logged out → should redirect to `/login`. Log in → should land on dashboard showing shop name + "no garments yet". Click "ออกจากระบบ" → should return to login.

- [ ] **Step 6: Commit**

```bash
git add middleware.ts app/dashboard
git commit -m "feat(auth): middleware + dashboard layout with logout"
```

---

## 🛑 PHASE 1.2 GATE — USER TEST

Pause. User tests:
- `/signup` creates an account and lands on dashboard.
- Logging out returns to login.
- Logging back in returns to dashboard.
- Visiting `/dashboard` while logged out redirects to login.

---

# PHASE 1.3 — DASHBOARD + ADD GARMENT

End-of-phase test: retailer can add a garment with a real photo and measurements, see it on the dashboard list, and view the public link.

---

### Task 15: Central dimensions config

**Files:**
- Create: `lib/config/dimensions.ts`

- [ ] **Step 1: Write the dimensions registry**

`lib/config/dimensions.ts`:
```ts
import type { Category } from '@/lib/supabase/types';

export type DimensionKey =
  | 'shoulder_cm' | 'chest_cm' | 'waist_cm' | 'hip_cm' | 'length_cm' | 'sleeve_cm';

/**
 * Each band is a difference (customer - garment) range, inclusive of lower bound.
 * Verdict resolution iterates in this order; first match wins.
 */
export interface ThresholdBand {
  min: number;          // inclusive lower bound on (customer - garment)
  max: number;          // exclusive upper bound on (customer - garment)
  verdict: 'too_tight' | 'snug' | 'good_fit' | 'loose';
}

export interface Dimension {
  key: DimensionKey;
  labelTh: string;
  labelEn: string;
  measureHintTh: string;
  measureHintEn: string;
  categories: Category[];
  defaultBands: ThresholdBand[];   // ordered top-down by verdict severity
}

const INF = Number.POSITIVE_INFINITY;

/** Default bands per the design spec (§7). Most dimensions share these defaults. */
const DEFAULT_BANDS: ThresholdBand[] = [
  { min: 1,    max: INF,  verdict: 'too_tight' }, // customer > garment + 1
  { min: -1,   max: 1,    verdict: 'snug' },      // within ±1
  { min: -5,   max: -1,   verdict: 'good_fit' },  // 1–5cm smaller than garment
  { min: -INF, max: -5,   verdict: 'loose' },     // > 5cm smaller
];

export const DIMENSIONS: Dimension[] = [
  {
    key: 'shoulder_cm',
    labelTh: 'ไหล่', labelEn: 'Shoulder',
    measureHintTh: 'วัดจากปลายไหล่ข้างหนึ่งถึงอีกข้าง',
    measureHintEn: 'Measure from one shoulder tip to the other.',
    categories: ['top', 'dress'],
    defaultBands: DEFAULT_BANDS,
  },
  {
    key: 'chest_cm',
    labelTh: 'รอบอก', labelEn: 'Chest',
    measureHintTh: 'วัดรอบส่วนที่กว้างที่สุดของอก',
    measureHintEn: 'Measure around the fullest part of the chest.',
    categories: ['top', 'dress'],
    defaultBands: DEFAULT_BANDS,
  },
  {
    key: 'waist_cm',
    labelTh: 'รอบเอว', labelEn: 'Waist',
    measureHintTh: 'วัดรอบส่วนที่แคบที่สุดของเอว',
    measureHintEn: 'Measure around the narrowest part of the waist.',
    categories: ['top', 'bottom', 'dress'],
    defaultBands: DEFAULT_BANDS,
  },
  {
    key: 'hip_cm',
    labelTh: 'รอบสะโพก', labelEn: 'Hip',
    measureHintTh: 'วัดรอบส่วนที่กว้างที่สุดของสะโพก',
    measureHintEn: 'Measure around the fullest part of the hips.',
    categories: ['bottom', 'dress'],
    defaultBands: DEFAULT_BANDS,
  },
  {
    key: 'length_cm',
    labelTh: 'ความยาว', labelEn: 'Length',
    measureHintTh: 'วัดจากบนสุดถึงล่างสุดของเสื้อผ้า',
    measureHintEn: 'Measure top to bottom of the garment.',
    categories: ['top', 'bottom', 'dress'],
    defaultBands: DEFAULT_BANDS,
  },
  {
    key: 'sleeve_cm',
    labelTh: 'ความยาวแขน', labelEn: 'Sleeve',
    measureHintTh: 'วัดจากไหล่ถึงข้อมือ',
    measureHintEn: 'Measure from shoulder to wrist.',
    categories: ['top', 'dress'],
    defaultBands: DEFAULT_BANDS,
  },
];

export function dimensionsForCategory(c: Category): Dimension[] {
  return DIMENSIONS.filter(d => d.categories.includes(c));
}

export function dimensionByKey(key: string): Dimension | undefined {
  return DIMENSIONS.find(d => d.key === key);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/config/dimensions.ts
git commit -m "feat(config): central dimensions registry with per-category mapping"
```

---

### Task 16: Fit profiles config

**Files:**
- Create: `lib/config/fit-profiles.ts`

- [ ] **Step 1: Write fit profiles**

`lib/config/fit-profiles.ts`:
```ts
import type { ThresholdBand, DimensionKey } from './dimensions';

/**
 * A profile is an OPTIONAL per-dimension override map. Missing keys mean
 * "use the dimension's default bands". Bands are full replacements, not deltas.
 */
export interface FitProfile {
  key: string;
  labelTh: string;
  labelEn: string;
  overrides: Partial<Record<DimensionKey, ThresholdBand[]>>;
}

const INF = Number.POSITIVE_INFINITY;

/** Slim: tighten "good fit" by 2cm — i.e. acceptable ease shrinks to 0..3cm. */
const SLIM_DEFAULT: ThresholdBand[] = [
  { min: 1,    max: INF, verdict: 'too_tight' },
  { min: -1,   max: 1,   verdict: 'snug' },
  { min: -3,   max: -1,  verdict: 'good_fit' },
  { min: -INF, max: -3,  verdict: 'loose' },
];

/** Relaxed: widen "good fit" by 3cm — acceptable ease extends to 1..8cm. */
const RELAXED_DEFAULT: ThresholdBand[] = [
  { min: 1,    max: INF, verdict: 'too_tight' },
  { min: -1,   max: 1,   verdict: 'snug' },
  { min: -8,   max: -1,  verdict: 'good_fit' },
  { min: -INF, max: -8,  verdict: 'loose' },
];

export const FIT_PROFILES: FitProfile[] = [
  { key: 'regular', labelTh: 'ทรงปกติ',  labelEn: 'Regular', overrides: {} },
  {
    key: 'slim', labelTh: 'ทรงเข้ารูป', labelEn: 'Slim',
    overrides: {
      shoulder_cm: SLIM_DEFAULT, chest_cm: SLIM_DEFAULT,
      waist_cm: SLIM_DEFAULT, hip_cm: SLIM_DEFAULT,
    },
  },
  {
    key: 'relaxed', labelTh: 'ทรงหลวม', labelEn: 'Relaxed',
    overrides: {
      shoulder_cm: RELAXED_DEFAULT, chest_cm: RELAXED_DEFAULT,
      waist_cm: RELAXED_DEFAULT, hip_cm: RELAXED_DEFAULT,
    },
  },
];

export function fitProfileByKey(key: string): FitProfile {
  return FIT_PROFILES.find(p => p.key === key) ?? FIT_PROFILES[0]!;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/config/fit-profiles.ts
git commit -m "feat(config): fit profiles (regular/slim/relaxed) with per-dimension overrides"
```

---

### Task 17: [MANUAL] Create the Storage bucket

**Files:** none (manual Supabase UI step).

- [ ] **Step 1: User creates the bucket**

Tell the user:
> 1. In your Supabase dashboard, click **Storage** in the left menu.
> 2. Click **New bucket**. Name: `garment-photos`. Toggle **Public bucket: ON**. Click **Save**.
> 3. Open **Policies** for the new bucket. The default public-read policy is fine.
> 4. Add an **INSERT** policy so authenticated users can upload:
>    - Click **New policy** → **For full customization** → name it `auth_upload`.
>    - Allowed operations: check **INSERT**.
>    - Target roles: `authenticated`.
>    - USING expression: leave blank. WITH CHECK expression: `bucket_id = 'garment-photos'`.
>    - Save.

- [ ] **Step 2: Verify**

Tell the user to confirm `garment-photos` appears in the Storage list with a public badge.

- [ ] **Step 3: No commit.**

---

### Task 18: Dashboard — list garments and show public link

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Replace placeholder with the real list**

`app/dashboard/page.tsx`:
```tsx
import Link from 'next/link';
import Image from 'next/image';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { t } from '@/lib/i18n/strings';
import CopyPublicLink from './CopyPublicLink';

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // layout already redirects

  const [{ data: retailer }, { data: garments }] = await Promise.all([
    supabase.from('retailers').select('shop_slug, shop_name').eq('id', user.id).single(),
    supabase.from('garments').select('id, name, category, photo_url, created_at').eq('retailer_id', user.id).order('created_at', { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{retailer?.shop_name}</h1>
        <Link href="/dashboard/garment/new" className="rounded bg-gray-900 px-4 py-2 text-sm text-white">
          {t.addGarment.th}
        </Link>
      </div>

      {retailer?.shop_slug && (
        <CopyPublicLink slug={retailer.shop_slug} />
      )}

      {!garments || garments.length === 0 ? (
        <p className="text-gray-600">{t.noGarments.th}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {garments.map(g => (
            <li key={g.id} className="overflow-hidden rounded border bg-white">
              <div className="relative aspect-square bg-gray-100">
                {/* photo_url is a public Supabase Storage URL */}
                {g.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.photo_url} alt={g.name} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="p-3">
                <div className="text-sm font-medium">{g.name}</div>
                <div className="text-xs text-gray-500">{g.category}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Copy-link client component**

`app/dashboard/CopyPublicLink.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { t } from '@/lib/i18n/strings';

export default function CopyPublicLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== 'undefined' ? `${window.location.origin}/shop/${slug}` : `/shop/${slug}`;
  return (
    <div className="flex items-center gap-3 rounded border bg-white p-3 text-sm">
      <span className="text-gray-600">{t.publicLink.th}:</span>
      <code className="grow truncate">{link}</code>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="rounded border px-2 py-1"
      >
        {copied ? '✓' : t.copyLink.th}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/dashboard
git commit -m "feat(dashboard): list garments and show public shop link"
```

---

### Task 19: Add-garment form

**Files:**
- Create: `app/dashboard/garment/new/page.tsx`
- Create: `app/api/garments/route.ts`

- [ ] **Step 1: API route — receives multipart form, uploads photo, inserts row**

`app/api/garments/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { dimensionsForCategory } from '@/lib/config/dimensions';
import { fitProfileByKey, FIT_PROFILES } from '@/lib/config/fit-profiles';
import type { Category, MeasurementBag } from '@/lib/supabase/types';

const CATEGORY = z.enum(['top', 'bottom', 'dress']);
const PROFILE_KEYS = FIT_PROFILES.map(p => p.key) as [string, ...string[]];

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();

  const name = String(form.get('name') ?? '').trim();
  const categoryRaw = String(form.get('category') ?? '');
  const fit_profile = String(form.get('fit_profile') ?? 'regular');
  const photo = form.get('photo');

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const catParse = CATEGORY.safeParse(categoryRaw);
  if (!catParse.success) return NextResponse.json({ error: 'invalid category' }, { status: 400 });
  const category: Category = catParse.data;
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: 'photo required' }, { status: 400 });
  }
  if (!z.enum(PROFILE_KEYS).safeParse(fit_profile).success) {
    return NextResponse.json({ error: 'invalid fit_profile' }, { status: 400 });
  }
  fitProfileByKey(fit_profile); // resolves or falls back; OK

  // Collect measurements only for dimensions this category uses
  const measurements: MeasurementBag = {};
  for (const d of dimensionsForCategory(category)) {
    const raw = form.get(d.key);
    if (raw === null || raw === '') continue;
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0 || num > 300) {
      return NextResponse.json({ error: `invalid value for ${d.key}` }, { status: 400 });
    }
    measurements[d.key] = num;
  }

  // Upload photo to Storage
  const ext = photo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from('garment-photos').upload(path, photo, {
    cacheControl: '3600', upsert: false, contentType: photo.type || 'image/jpeg',
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  const { data: { publicUrl } } = supabase.storage.from('garment-photos').getPublicUrl(path);

  // Insert row
  const { data: row, error: insErr } = await supabase
    .from('garments')
    .insert({ retailer_id: user.id, name, category, fit_profile, photo_url: publicUrl, measurements })
    .select('id')
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: row.id });
}
```

- [ ] **Step 2: Add-garment page UI (client component)**

`app/dashboard/garment/new/page.tsx`:
```tsx
'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { dimensionsForCategory } from '@/lib/config/dimensions';
import { FIT_PROFILES } from '@/lib/config/fit-profiles';
import { t } from '@/lib/i18n/strings';
import type { Category } from '@/lib/supabase/types';

export default function NewGarmentPage() {
  const router = useRouter();
  const [category, setCategory] = useState<Category>('top');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dims = useMemo(() => dimensionsForCategory(category), [category]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch('/api/garments', { method: 'POST', body: form });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === 'string' ? data.error : t.authError.th);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold">{t.addGarment.th}</h1>

      <label className="block">
        <span className="text-sm text-gray-700">{t.garmentName.th}</span>
        <input required name="name" className="mt-1 block w-full rounded border border-gray-300 px-3 py-2" />
      </label>

      <label className="block">
        <span className="text-sm text-gray-700">{t.category.th}</span>
        <select
          name="category" required value={category}
          onChange={e => setCategory(e.target.value as Category)}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        >
          <option value="top">{t.catTop.th}</option>
          <option value="bottom">{t.catBottom.th}</option>
          <option value="dress">{t.catDress.th}</option>
        </select>
      </label>

      <label className="block">
        <span className="text-sm text-gray-700">{t.fitProfile.th}</span>
        <select name="fit_profile" defaultValue="regular" className="mt-1 block w-full rounded border border-gray-300 px-3 py-2">
          {FIT_PROFILES.map(p => <option key={p.key} value={p.key}>{p.labelTh}</option>)}
        </select>
      </label>

      <label className="block">
        <span className="text-sm text-gray-700">{t.photo.th}</span>
        <input required name="photo" type="file" accept="image/*" className="mt-1 block w-full text-sm" />
      </label>

      <fieldset className="space-y-3 rounded border p-4">
        <legend className="px-2 text-sm font-medium">{t.yourMeasurements.th}</legend>
        {dims.map(d => (
          <label key={d.key} className="block">
            <span className="text-sm text-gray-700">{d.labelTh} (cm)</span>
            <input
              name={d.key} type="number" step="0.1" min="1" max="300"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
        ))}
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit" disabled={loading}
        className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
      >
        {loading ? '…' : t.save.th}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Manual test**

Run dev server, log in, go to `/dashboard/garment/new`. Fill name="เสื้อทดสอบ", category=top, fit_profile=regular, photo=any JPEG, chest_cm=100, shoulder_cm=44, length_cm=68. Submit → should return to dashboard with the garment visible.

- [ ] **Step 4: Verify the row in Supabase** Table Editor → `garments`. Confirm `measurements` jsonb has the values.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/garment app/api/garments
git commit -m "feat(garments): add-garment form with photo upload and category-driven measurements"
```

---

## 🛑 PHASE 1.3 GATE — USER TEST

User confirms: adding a garment works end-to-end, the dashboard list shows it with photo, the public-link banner shows a `/shop/<slug>` URL (the actual shop page is still a 404 — built next).

---

# PHASE 1.4 — PUBLIC SHOP + HERO FIT CHECKER

End-of-phase test: opening the public link in a private browser window shows the shop's garments; opening a garment shows the photo + a measurement form; submitting returns per-dimension fit verdicts + overall. Returning to the same garment pre-fills measurements.

---

### Task 20: Fit engine — pure function with TDD

**Files:**
- Create: `lib/fit/engine.ts`
- Create: `lib/fit/engine.test.ts`

- [ ] **Step 1: Write the failing tests FIRST**

`lib/fit/engine.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { evaluateFit } from './engine';

describe('evaluateFit — per-dimension bands (regular profile)', () => {
  // Per spec §7: customer vs garment
  //  > +1cm  -> too_tight
  //  ±1cm    -> snug
  //  1-5 cm smaller -> good_fit
  //  > 5cm smaller -> loose
  it('too_tight when customer > garment + 1', () => {
    const r = evaluateFit({ chest_cm: 100 }, { chest_cm: 102 }, 'regular');
    expect(r.dimensions.chest_cm?.verdict).toBe('too_tight');
  });
  it('snug when customer within ±1', () => {
    const r = evaluateFit({ chest_cm: 100 }, { chest_cm: 100 }, 'regular');
    expect(r.dimensions.chest_cm?.verdict).toBe('snug');
  });
  it('good_fit when customer is 1-5cm smaller', () => {
    const r = evaluateFit({ chest_cm: 100 }, { chest_cm: 97 }, 'regular');
    expect(r.dimensions.chest_cm?.verdict).toBe('good_fit');
  });
  it('loose when customer is >5cm smaller', () => {
    const r = evaluateFit({ chest_cm: 100 }, { chest_cm: 90 }, 'regular');
    expect(r.dimensions.chest_cm?.verdict).toBe('loose');
  });
});

describe('evaluateFit — fit profile shifts the bands', () => {
  it('slim tightens good_fit (acceptable ease shrinks to 0..3)', () => {
    // garment 100, customer 96 → diff -4 → still good_fit on regular,
    // but loose on slim (slim good_fit band is -3..-1).
    const regular = evaluateFit({ chest_cm: 100 }, { chest_cm: 96 }, 'regular');
    const slim    = evaluateFit({ chest_cm: 100 }, { chest_cm: 96 }, 'slim');
    expect(regular.dimensions.chest_cm?.verdict).toBe('good_fit');
    expect(slim.dimensions.chest_cm?.verdict).toBe('loose');
  });
  it('relaxed widens good_fit (acceptable ease extends to 1..8)', () => {
    // garment 100, customer 93 → diff -7 → loose on regular, good_fit on relaxed.
    const regular = evaluateFit({ chest_cm: 100 }, { chest_cm: 93 }, 'regular');
    const relaxed = evaluateFit({ chest_cm: 100 }, { chest_cm: 93 }, 'relaxed');
    expect(regular.dimensions.chest_cm?.verdict).toBe('loose');
    expect(relaxed.dimensions.chest_cm?.verdict).toBe('good_fit');
  });
});

describe('evaluateFit — missing values', () => {
  it('marks unknown when garment lacks the dimension', () => {
    const r = evaluateFit({}, { chest_cm: 95 }, 'regular');
    expect(r.dimensions.chest_cm?.verdict).toBe('unknown');
  });
  it('marks unknown when customer lacks the dimension', () => {
    const r = evaluateFit({ chest_cm: 100 }, {}, 'regular');
    expect(r.dimensions.chest_cm?.verdict).toBe('unknown');
  });
});

describe('evaluateFit — overall verdict (worst wins)', () => {
  it('overall = too_tight if any dimension is too_tight', () => {
    const r = evaluateFit(
      { chest_cm: 100, waist_cm: 80 },
      { chest_cm: 102, waist_cm: 78 }, // chest too tight, waist good
      'regular'
    );
    expect(r.overall).toBe('too_tight');
  });
  it('overall ignores unknown dimensions', () => {
    const r = evaluateFit(
      { chest_cm: 100 },
      { chest_cm: 97, waist_cm: 70 }, // only chest scored (good_fit)
      'regular'
    );
    expect(r.overall).toBe('good_fit');
  });
  it('overall = unknown when no dimension can be scored', () => {
    const r = evaluateFit({}, {}, 'regular');
    expect(r.overall).toBe('unknown');
  });
});

describe('evaluateFit — unknown fit profile falls back to regular', () => {
  it('falls back when given a nonexistent profile key', () => {
    const r = evaluateFit({ chest_cm: 100 }, { chest_cm: 97 }, 'banana');
    expect(r.dimensions.chest_cm?.verdict).toBe('good_fit');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
npm test
```
Expected: all tests fail with "evaluateFit is not defined" (or similar).

- [ ] **Step 3: Implement the engine**

`lib/fit/engine.ts`:
```ts
import { DIMENSIONS, dimensionByKey, type DimensionKey, type ThresholdBand } from '@/lib/config/dimensions';
import { fitProfileByKey } from '@/lib/config/fit-profiles';
import type { MeasurementBag } from '@/lib/supabase/types';

export type Verdict = 'too_tight' | 'snug' | 'good_fit' | 'loose' | 'unknown';

export interface DimensionResult {
  verdict: Verdict;
  customer: number | null;
  garment: number | null;
  diff: number | null;     // customer - garment, or null if unknown
}

export interface FitResult {
  dimensions: Partial<Record<DimensionKey, DimensionResult>>;
  overall: Verdict;
}

const SEVERITY: Record<Verdict, number> = {
  too_tight: 4, loose: 3, snug: 2, good_fit: 1, unknown: 0,
};

function matchBand(diff: number, bands: ThresholdBand[]): Verdict {
  for (const b of bands) {
    if (diff >= b.min && diff < b.max) return b.verdict;
  }
  // Safety net: should never reach here if bands cover -∞..+∞
  return 'unknown';
}

export function evaluateFit(
  garment: MeasurementBag,
  customer: MeasurementBag,
  fitProfileKey: string
): FitResult {
  const profile = fitProfileByKey(fitProfileKey);
  const result: FitResult = { dimensions: {}, overall: 'unknown' };
  let worstScored: Verdict | null = null;

  for (const dim of DIMENSIONS) {
    const g = garment[dim.key];
    const c = customer[dim.key];
    if (g === undefined || c === undefined) {
      result.dimensions[dim.key] = { verdict: 'unknown', customer: c ?? null, garment: g ?? null, diff: null };
      continue;
    }
    const bands = profile.overrides[dim.key] ?? dim.defaultBands;
    const diff = c - g;
    const verdict = matchBand(diff, bands);
    result.dimensions[dim.key] = { verdict, customer: c, garment: g, diff };
    if (worstScored === null || SEVERITY[verdict] > SEVERITY[worstScored]) {
      worstScored = verdict;
    }
  }

  result.overall = worstScored ?? 'unknown';
  return result;
}
```

- [ ] **Step 4: Run tests — verify all pass**

```powershell
npm test
```
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add lib/fit
git commit -m "feat(fit): pure fit engine with per-dimension bands and profile overrides + tests"
```

---

### Task 21: `customer_token` helper

**Files:**
- Create: `lib/customer-token.ts`

- [ ] **Step 1: Write the helper**

`lib/customer-token.ts`:
```ts
/**
 * Opaque per-browser ID. Stored in localStorage (NOT a cookie — keeps it
 * fully client-side and out of server logs). Send it explicitly with any
 * request that should record / pre-fill measurements.
 */
const KEY = 'fitmvp.customer_token';

export function getOrCreateCustomerToken(): string {
  if (typeof window === 'undefined') return '';
  let t = window.localStorage.getItem(KEY);
  if (!t) {
    t = crypto.randomUUID();
    window.localStorage.setItem(KEY, t);
  }
  return t;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/customer-token.ts
git commit -m "feat: customer_token localStorage helper"
```

---

### Task 22: Public shop browse page

**Files:**
- Create: `app/shop/[shop_slug]/page.tsx`

- [ ] **Step 1: Write the page**

`app/shop/[shop_slug]/page.tsx`:
```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ShopPage({ params }: { params: { shop_slug: string } }) {
  // Use admin client for public read because anon RLS is set up but using the
  // admin client here keeps the server component simple. No secrets leak.
  const supabase = createSupabaseAdminClient();
  const { data: shop } = await supabase
    .from('shops')
    .select('id, shop_name, shop_slug')
    .eq('shop_slug', params.shop_slug)
    .single();
  if (!shop) notFound();

  const { data: garments } = await supabase
    .from('garments')
    .select('id, name, category, photo_url')
    .eq('retailer_id', shop.id)
    .order('created_at', { ascending: false });

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold">{shop.shop_name}</h1>
      {!garments || garments.length === 0 ? (
        <p className="mt-6 text-gray-600">ยังไม่มีสินค้า</p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {garments.map(g => (
            <li key={g.id}>
              <Link href={`/shop/${params.shop_slug}/${g.id}`} className="block overflow-hidden rounded border bg-white">
                <div className="aspect-square bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.photo_url} alt={g.name} className="h-full w-full object-cover" />
                </div>
                <div className="p-3 text-sm">{g.name}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/shop
git commit -m "feat(shop): public shop browse page"
```

---

### Task 23: Hero fit-checker page — display + form + submit

**Files:**
- Create: `app/shop/[shop_slug]/[garment_id]/page.tsx`
- Create: `app/shop/[shop_slug]/[garment_id]/FitChecker.tsx`
- Create: `app/api/fit/evaluate/route.ts`

- [ ] **Step 1: API route — evaluates fit and saves a session**

`app/api/fit/evaluate/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { evaluateFit } from '@/lib/fit/engine';
import { DIMENSIONS } from '@/lib/config/dimensions';
import type { MeasurementBag } from '@/lib/supabase/types';

const Body = z.object({
  garment_id: z.string().uuid(),
  customer_token: z.string().optional(),
  customer_measurements: z.record(z.string(), z.number().positive().max(300)),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { garment_id, customer_token, customer_measurements } = parsed.data;

  // Whitelist measurement keys to known dimensions only
  const validKeys = new Set(DIMENSIONS.map(d => d.key));
  const cleanCustomer: MeasurementBag = {};
  for (const [k, v] of Object.entries(customer_measurements)) {
    if (validKeys.has(k as never)) (cleanCustomer as Record<string, number>)[k] = v;
  }

  const supabase = createSupabaseAdminClient();
  const { data: garment, error: gErr } = await supabase
    .from('garments')
    .select('measurements, fit_profile')
    .eq('id', garment_id)
    .single();
  if (gErr || !garment) return NextResponse.json({ error: 'garment not found' }, { status: 404 });

  const result = evaluateFit(garment.measurements as MeasurementBag, cleanCustomer, garment.fit_profile);

  await supabase.from('fit_sessions').insert({
    garment_id,
    customer_token: customer_token ?? null,
    customer_measurements: cleanCustomer,
    result,
  });

  return NextResponse.json({ result });
}
```

- [ ] **Step 2: Last-session API route (for pre-fill)**

Create `app/api/fit/last/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const garment_id = url.searchParams.get('garment_id');
  if (!token) return NextResponse.json({ measurements: null });

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('fit_sessions')
    .select('customer_measurements, garment_id, created_at')
    .eq('customer_token', token)
    .order('created_at', { ascending: false })
    .limit(1);
  if (garment_id) query = query.eq('garment_id', garment_id);

  const { data } = await query;
  return NextResponse.json({ measurements: data?.[0]?.customer_measurements ?? null });
}
```

- [ ] **Step 3: Hero page (server component) — fetches garment, renders FitChecker**

`app/shop/[shop_slug]/[garment_id]/page.tsx`:
```tsx
import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { dimensionsForCategory } from '@/lib/config/dimensions';
import FitChecker from './FitChecker';
import type { Category, MeasurementBag } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function HeroPage({
  params,
}: { params: { shop_slug: string; garment_id: string } }) {
  const supabase = createSupabaseAdminClient();
  const { data: garment } = await supabase
    .from('garments')
    .select('id, name, category, photo_url, fit_profile, measurements')
    .eq('id', params.garment_id)
    .single();
  if (!garment) notFound();

  const dims = dimensionsForCategory(garment.category as Category);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <div className="aspect-square overflow-hidden rounded bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={garment.photo_url} alt={garment.name} className="h-full w-full object-cover" />
      </div>
      <h1 className="mt-4 text-2xl font-semibold">{garment.name}</h1>

      <FitChecker
        garmentId={garment.id}
        dimensions={dims.map(d => ({
          key: d.key, labelTh: d.labelTh, hintTh: d.measureHintTh,
        }))}
        garmentMeasurements={garment.measurements as MeasurementBag}
      />
    </main>
  );
}
```

- [ ] **Step 4: FitChecker client component (form + results + pre-fill + submit)**

`app/shop/[shop_slug]/[garment_id]/FitChecker.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { t } from '@/lib/i18n/strings';
import { getOrCreateCustomerToken } from '@/lib/customer-token';
import type { MeasurementBag } from '@/lib/supabase/types';

type DimInfo = { key: string; labelTh: string; hintTh: string };
type Verdict = 'too_tight' | 'snug' | 'good_fit' | 'loose' | 'unknown';

interface FitResult {
  overall: Verdict;
  dimensions: Record<string, { verdict: Verdict; customer: number | null; garment: number | null; diff: number | null }>;
}

const VERDICT_LABEL: Record<Verdict, string> = {
  too_tight: t.verdictTooTight.th, snug: t.verdictSnug.th,
  good_fit: t.verdictGood.th, loose: t.verdictLoose.th, unknown: t.verdictUnknown.th,
};
const VERDICT_COLOR: Record<Verdict, string> = {
  too_tight: 'bg-red-100 text-red-800',
  snug: 'bg-yellow-100 text-yellow-800',
  good_fit: 'bg-green-100 text-green-800',
  loose: 'bg-yellow-100 text-yellow-800',
  unknown: 'bg-gray-100 text-gray-600',
};

export default function FitChecker({
  garmentId, dimensions, garmentMeasurements,
}: {
  garmentId: string; dimensions: DimInfo[]; garmentMeasurements: MeasurementBag;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<FitResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Pre-fill from the customer's last session (any garment of this shop is fine).
  useEffect(() => {
    const token = getOrCreateCustomerToken();
    fetch(`/api/fit/last?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(j => {
        if (j.measurements && typeof j.measurements === 'object') {
          const pre: Record<string, string> = {};
          for (const [k, v] of Object.entries(j.measurements)) {
            if (typeof v === 'number') pre[k] = String(v);
          }
          setValues(pre);
        }
      });
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true);
    const measurements: Record<string, number> = {};
    for (const d of dimensions) {
      const v = values[d.key];
      if (v && v.trim() !== '') {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) measurements[d.key] = n;
      }
    }
    const res = await fetch('/api/fit/evaluate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        garment_id: garmentId,
        customer_token: getOrCreateCustomerToken(),
        customer_measurements: measurements,
      }),
    });
    const j = await res.json();
    setLoading(false);
    if (res.ok) setResult(j.result);
  }

  return (
    <section className="mt-8 space-y-6">
      <form className="space-y-4 rounded border bg-white p-4" onSubmit={onSubmit}>
        <h2 className="text-lg font-medium">{t.yourMeasurements.th}</h2>
        {dimensions.map(d => (
          <label key={d.key} className="block">
            <span className="text-sm text-gray-700">{d.labelTh} (cm)</span>
            <span className="block text-xs text-gray-500">{d.hintTh}</span>
            <input
              type="number" step="0.1" min="1" max="300"
              value={values[d.key] ?? ''}
              onChange={e => setValues(v => ({ ...v, [d.key]: e.target.value }))}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
        ))}
        <button
          type="submit" disabled={loading}
          className="w-full rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? '…' : t.checkFit.th}
        </button>
      </form>

      {result && (
        <div className="space-y-3 rounded border bg-white p-4">
          <div className={`inline-block rounded px-3 py-1 text-sm ${VERDICT_COLOR[result.overall]}`}>
            {t.overall.th}: {VERDICT_LABEL[result.overall]}
          </div>
          <ul className="divide-y">
            {dimensions.map(d => {
              const r = result.dimensions[d.key];
              const v = r?.verdict ?? 'unknown';
              return (
                <li key={d.key} className="flex items-center justify-between py-2 text-sm">
                  <span>{d.labelTh}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${VERDICT_COLOR[v]}`}>
                    {VERDICT_LABEL[v]}
                    {r?.diff !== null && r?.diff !== undefined ? ` (${r.diff > 0 ? '+' : ''}${r.diff.toFixed(1)}cm)` : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Manual end-to-end test**

Run dev server. Open `http://localhost:3000/shop/<your-slug>` in an **incognito window**. Click your garment. Enter measurements (e.g. chest 97 if your garment chest is 100) and submit. Confirm:
- Per-dimension verdicts show with colors.
- Overall verdict shows.
- Re-loading the hero page pre-fills the values you entered.
- In Supabase Studio → `fit_sessions`, a new row appears with `customer_token` populated.

- [ ] **Step 6: Commit**

```bash
git add app/shop/[shop_slug]/[garment_id] app/api/fit
git commit -m "feat(shop): hero fit-checker with pre-fill and persistence"
```

---

## 🛑 PHASE 1.4 GATE — USER TEST

Full end-to-end test in the user's own words. The product now has its core value prop working locally.

---

# PHASE 1.5 — DEPLOY

End-of-phase: the app is live at a `*.vercel.app` URL, connected to the same Supabase project, with auto-deploy on `git push`.

---

### Task 24: Push to GitHub

**Files:** none directly; uses the existing repo.

- [ ] **Step 1: [MANUAL] Create an empty GitHub repo**

Tell the user:
> 1. Go to https://github.com/new.
> 2. Repository name: `fit-mvp`. Owner: your account. Visibility: **Private** is fine for now.
> 3. **Do NOT** check "Add a README", "Add .gitignore", or "Choose a license" — the repo is already initialized locally.
> 4. Click **Create repository**.
> 5. On the next page, copy the URL under "…or push an existing repository from the command line". It will look like `https://github.com/<your-username>/fit-mvp.git`.

- [ ] **Step 2: Set the remote and push**

Run (with the URL from the previous step):
```bash
git remote add origin https://github.com/<your-username>/fit-mvp.git
git branch -M main
git push -u origin main
```
If prompted to authenticate, GitHub will open a browser to sign in.

- [ ] **Step 3: Verify** by refreshing the GitHub repo page — you should see all the files and the commit history.

- [ ] **Step 4: No new commit** — push only.

---

### Task 25: [MANUAL] Deploy to Vercel

**Files:** none.

- [ ] **Step 1: User imports the repo into Vercel**

Tell the user:
> 1. Go to https://vercel.com/new.
> 2. Click **Import** next to your `fit-mvp` GitHub repo (you may need to install Vercel on your GitHub account first — follow the prompts).
> 3. Framework Preset: **Next.js** (auto-detected).
> 4. Root directory: leave as default.
> 5. Build & output settings: leave as default.
> 6. **Environment Variables** — click "Add" 3 times and paste the same values from your local `.env.local`:
>    - `NEXT_PUBLIC_SUPABASE_URL`
>    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
>    - `SUPABASE_SERVICE_ROLE_KEY` (this one is server-side; Vercel will keep it secret)
> 7. Click **Deploy**. Wait ~2 minutes.
> 8. When it finishes, click **Visit** — your app is live.

- [ ] **Step 2: Smoke test the live site**

Tell the user to:
- Visit the Vercel URL.
- Sign up with a NEW email (the test data from local dev is in the same Supabase project, so the previous account also works for login).
- Add a garment, open the public shop link, submit measurements.

- [ ] **Step 3: Confirm auto-deploy works**

Tell the user:
> Future `git push` to `main` will auto-deploy. No more clicking required.

- [ ] **Step 4: No new commit.**

---

## 🛑 PHASE 1.5 GATE — DONE

Phase 1 is shipped. The fit-recommendation MVP is live. Phase 2 (VTO) can be planned as a separate project that consumes the hooks listed in spec §13.

---

## Spec coverage checklist

| Spec section | Covered by |
|---|---|
| §2 Phase 1 in scope | Tasks 1–25 |
| §2 Phase 2 deferred | Explicitly excluded from build; hooks in Tasks 7, 15, 19, 23 |
| §3 Tech stack | Tasks 2, 3 |
| §4 Architecture | Tasks 9, 14 (secrets server-side); Task 7 (RLS) |
| §5 Data model — retailers | Task 7, 12 |
| §5 Data model — garments (+ fit_profile col) | Task 7, 19 |
| §5 Data model — fit_sessions (+ customer_token) | Task 7, 23 |
| §5 RLS | Task 7 |
| §6 Central dimensions config (Option B) | Task 15 |
| §6 Category → dimensions map | Task 15 (`dimensionsForCategory`) |
| §7 Per-dimension thresholds | Task 15 |
| §7 Fit profiles | Task 16 |
| §7 Engine resolution order | Task 20 (`evaluateFit`) |
| §7 Overall = worst dimension | Task 20 test + impl |
| §7 Missing values → unknown | Task 20 test + impl |
| §8 Pages | Tasks 10, 12, 13, 14, 18, 19, 22, 23 |
| §9 Phase 2 VTO | Out of scope (acknowledged) |
| §10 Testing — fit engine | Task 20 |
| §10 Testing — manual gates | Phase gates after 10, 14, 19, 23, 25 |
| §11 Build order | Phases 1.1–1.5 |
| §12 Prereqs | Task 1 (Node), Task 6 (Supabase project), Task 17 (Storage) |
| §13 Phase 2 readiness — measurements | Task 7 (jsonb), Task 19 (writes) |
| §13 Phase 2 readiness — customer_token | Task 7, 21, 23 |
| §13 Phase 2 readiness — fit_profile column | Task 7, 19 |
| §13 Phase 2 readiness — tryon_image_url reserved | Task 7 (nullable column, never written) |
| §13 Phase 2 readiness — photo required | Task 7, 19 |
| §13 Phase 2 readiness — storage bucket reusable | Task 17 |
