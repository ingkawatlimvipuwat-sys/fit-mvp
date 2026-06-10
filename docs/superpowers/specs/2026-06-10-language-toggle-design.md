# Language Toggle — Design Spec

**Date:** 2026-06-10  
**Feature:** EN/TH language toggle on customer-facing shop pages  
**Status:** Approved for implementation

---

## 1. Scope

A TH ↔ EN language toggle on every customer-facing shop page (`/shop/[shop_slug]` and `/shop/[shop_slug]/[garment_id]`). The retailer dashboard stays Thai-only.

**Switches language:** measurement labels, measurement hints, fit verdicts, button text, empty-state text, section headings.  
**Does not switch:** shop name, garment names — these are retailer-entered content and stay as typed.

---

## 2. Architecture

### `lib/hooks/useLanguage.ts` (new)

Client hook. Reads `'fitmvp.lang'` from localStorage on mount; defaults to `'th'`. Returns `[lang, setLang]`. `setLang` writes back to localStorage.

```ts
export type Lang = 'th' | 'en';
export function useLanguage(): [Lang, (l: Lang) => void]
```

SSR-safe: `useState('th')` is the default — hydration always matches server (Thai), then `useEffect` corrects to stored preference.

### `app/shop/[shop_slug]/ShopHeader.tsx` (new)

Client component. Receives `shopName: string` as a prop (passed from the server component). Renders shop name on the left, TH|EN pill toggle on the right. Calls `useLanguage()` internally — the toggle is self-contained.

### `app/shop/[shop_slug]/NoGarments.tsx` (new)

Tiny client component. Renders the empty-state paragraph in the active language. Needed because the browse page is a server component and the empty-state text must react to language.

### `app/shop/[shop_slug]/page.tsx` (update)

Add `<ShopHeader shopName={shop.shop_name} />` before `<main>`. Replace hardcoded `'ยังไม่มีสินค้า'` with `<NoGarments />`.

### `app/shop/[shop_slug]/[garment_id]/page.tsx` (update)

Add `<ShopHeader shopName={garment.name}` — no, shop name not available here. Actually: fetch shop name alongside garment, pass to ShopHeader.  
**Decision:** pass shop slug as display fallback OR fetch shop name. We fetch — one extra query, worth it for consistency. Pass `shopName` to ShopHeader.

Extend `dims.map(...)` to include `labelEn` and `hintEn` alongside the existing Thai fields.

### `app/shop/[shop_slug]/[garment_id]/FitChecker.tsx` (update)

- Add `labelEn: string; hintEn: string` to `DimInfo`.
- Import and call `useLanguage()`. 
- Move `VERDICT_LABEL` inside the component body (computed from `t[key][lang]` per render).
- All render expressions switch on `lang`: `lang === 'th' ? d.labelTh : d.labelEn`, `t.checkFit[lang]`, etc.

---

## 3. Data flow

```
localStorage('fitmvp.lang') ──► useLanguage()
                                    │
                          ┌─────────┴──────────┐
                    ShopHeader             FitChecker
                  (toggle write)        (label render)
                          │
                    NoGarments
                  (empty state)
```

Each component calls `useLanguage()` independently. They share the same localStorage key, so they stay in sync across renders (React state is per-component, but toggling in ShopHeader triggers a re-render of FitChecker only if they share a parent or context). 

**Issue:** two separate `useLanguage()` calls = two separate React states. Toggling in ShopHeader won't automatically re-render FitChecker.

**Resolution:** Use React Context. `LanguageProvider` wraps the shop layout. `useLanguage()` reads from context. ShopHeader writes to context. FitChecker reads from context.

### Revised architecture

- `lib/hooks/useLanguage.tsx` — exports `LanguageProvider` (context + localStorage persistence) and `useLanguage()` hook.
- `app/shop/[shop_slug]/layout.tsx` — new client layout wrapping all shop pages with `<LanguageProvider>`.
- All other components call `useLanguage()` — reads from context, always in sync.

---

## 4. Prototype status (documentation-only)

No visible UI element. Add a "Prototype notes" section to `docs/superpowers/resume.md` listing deferred-polish items and known limitations. Useful for the next agent session to understand what's rough.

---

## 5. Files created / modified

| File | Action |
|------|--------|
| `lib/hooks/useLanguage.tsx` | New — context provider + hook |
| `app/shop/[shop_slug]/layout.tsx` | New — client layout with LanguageProvider |
| `app/shop/[shop_slug]/ShopHeader.tsx` | New — header + toggle |
| `app/shop/[shop_slug]/NoGarments.tsx` | New — localized empty state |
| `app/shop/[shop_slug]/page.tsx` | Update — add ShopHeader, NoGarments |
| `app/shop/[shop_slug]/[garment_id]/page.tsx` | Update — fetch shop name, add ShopHeader, pass En dim fields |
| `app/shop/[shop_slug]/[garment_id]/FitChecker.tsx` | Update — useLanguage, all strings |
| `docs/superpowers/resume.md` | Update — prototype notes + handover |
