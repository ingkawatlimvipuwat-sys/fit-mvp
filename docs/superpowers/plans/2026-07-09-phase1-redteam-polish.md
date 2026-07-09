# Plan — Phase 1 red-team fixes + polish (2026-07-09)

Scope approved by founder: bug fixes, UI polish, deferred-polish list, small UX features
(back link + garment strip for size comparison; garment delete with confirm).

## P0 — Bugs

1. **FitChecker.tsx robustness** (root cause of "can only click once")
   - Wrap submit in try/catch/finally; always reset loading; show friendly Thai/EN error.
   - Client validation: require ≥1 filled measurement before submit; inline warning.
   - Scroll result into view after success.
   - `inputMode="decimal"` on measurement inputs.
   - Distinct badge colors: loose = blue (was same yellow as snug).
2. **Login/signup robustness**: try/catch around auth calls; never show raw English
   errors like "Failed to fetch"; map to friendly Thai string.
3. **Require ≥1 measurement on add-garment** — server (400 + Thai message) and client.
4. **DB-down ≠ 404**: shop/hero pages throw on query error → error.tsx with friendly
   bilingual "temporarily unavailable" message, instead of silent notFound().

## P1 — UX features (founder-approved)

5. **Hero page**: back-to-shop link + horizontal strip of the shop's other garments
   (pre-filled measurements make re-checking one tap). No schema change.
6. **Dashboard management**: garment cards link to public page (preview, new tab);
   delete button w/ confirm → `DELETE /api/garments/[id]` (auth + ownership via RLS,
   removes row + Storage photo).

## P2 — Shell polish + deferred list

7. Landing page: bilingual, uses `t` strings, presentable hero.
8. Loading skeletons: `loading.tsx` for shop, garment, dashboard routes.
9. Metadata: proper title/description, simple SVG favicon.
10. Deferred items from resume.md: `readonly` bands, `as const` strings,
    `type="button"` on CopyPublicLink, Thai dimension labels in garment API errors,
    TODO comment in dashboard layout.

## Process

- Implementers: Sonnet subagents (SA-1 = items 1–3, SA-2 = items 5–6, SA-3 = items 4,7–10),
  run sequentially (shared `lib/i18n/strings.ts`).
- One combined code review subagent over the full diff at the end.
- Verify per task: `npm test` + `npm run build` (sandbox copy).
- No commits from agents; founder commits + pushes after browser test.

## Constraints

- Keep fit engine pure; keep dimensions config single-source; no VTO; no machine
  translation of retailer content; keep `main` deployable.
