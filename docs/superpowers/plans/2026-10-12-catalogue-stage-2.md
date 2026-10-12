# Catalogue Stage 2 Implementation Plan — organising

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owners organise products: nested **folders** (side list, create / rename / move / delete-moves-up), **Move to…** for products and folders, **tags** (create, attach, filter), **search**, **sort**, and a **⚠ Needs attention** filter. Spec §8 "Stage 2".

**Spec:** `docs/superpowers/specs/2026-10-01-catalogue-organisation-design.md` — §3 rules 2, 5, 6; §5.1 dashboard; §5.2 product-page tags; §5.5 needs attention; §7 errors; §9 tests.

**Architecture:** No migration. All five catalogue tables already exist on the live database (0005 and 0006 applied 2026-10-07). New rules are pure functions in `lib/catalogue/` with unit tests; the few multi-statement database sequences (folder delete, tag attach) live in `lib/catalogue/*-ops.ts` and are tested against a small in-memory fake client. API routes stay thin: authenticate, validate with zod `.strict()`, call the lib, write. The dashboard keeps loading everything for the shop in a handful of flat queries (as Stage 1 does) and does folder scoping, search, tag filter and sort **in the browser** from pure functions; the current view lives in the address bar (`?folder=…&q=…&tags=…&sort=…&attention=1`) via `window.history`, so Back and refresh keep the owner's place without a server round trip.

**Tech stack:** Next.js 15.5 App Router, React 19, Supabase (untyped client, RLS), zod 4, Vitest 4, Tailwind 3.

---

## Split: two pull requests (2a, then 2b)

The whole stage is roughly 2,900 changed lines, over the ~1,500 reviewable guide. It ships as two PRs, each usable on its own:

| Part | Branch | Contents | Rough size |
|---|---|---|---|
| **2a — folders** | `feature/catalogue-stage-2` (this branch; it already holds this plan and Task 0) | Folder side list with nesting, phone "‹ back" header, New folder / Rename / Delete (contents move up), **Move to…** for products and folders, New product inside the current folder | ~1,600 (≈45% tests) |
| **2b — find** | `feature/catalogue-stage-2b`, branched from the **finished 2a tip** | Tags (create, attach, detach, filter), search, sort, ⚠ Needs attention filter, tag chips on cards | ~1,300 |

2b is stacked on 2a. Its PR is opened only after 2a is merged; before that, `git merge origin/main` into 2b so its compare page shows only 2b's commits. If the founder prefers one PR, build both parts on this branch in order and skip Task 10's push/report — nothing else changes.

---

## Open product questions — for the founder before building

The plan builds the **recommended** answer in each case. Each alternative is a small, local change.

1. **What does a folder show when no search or filter is on?**
   **Recommended (built):** everything inside it, *including* inside its subfolders. "All items" shows the whole shop, exactly like today's dashboard. One rule everywhere, a product can never be "lost" inside a deep folder, and it matches the spec's "search and filters cover the current folder and everything below it".
   *Alternative:* a folder shows only products filed directly in it (like Google Drive); "All items" still shows everything; search and filters still reach below. Changing later = `productsInView()` in `lib/catalogue/browse.ts` and its tests.
2. **Tags cannot be renamed or deleted shop-wide in Stage 2.** The spec lists create, attach, filter. **Recommended:** accept. A tag that is on no product is hidden from suggestions and from the filter, so a typo disappears once it is removed from its products (re-typing the same word later reuses it). Add rename/delete in Stage 3 if owners ask.
3. **Two pull requests instead of one** (see Split). **Recommended:** yes — two smaller preview checks are safer than one large one on a live database.

**Implementation choices the founder may veto (no answer needed):**
- New folder and Rename use the browser's own small name box (`window.prompt`), the same style as the delete confirmation the app already uses (accepted for the MVP, decisions-and-lessons §2).
- Folders are listed A–Z. There is no manual folder ordering (not in the spec).
- Folder names may repeat ("Sale" inside two different folders is fine); the spec sets no rule.
- Search matches product names only — not tags, not version picks (spec §5.1).
- Opening the dashboard fresh starts at All items, newest first; the address bar remembers the rest while you work.

---

## Schema facts this plan relies on (from the live migrations, not the spec sketch)

| Table | Facts that matter here |
|---|---|
| `folders` | `id`, `retailer_id` (cascade from retailers), `parent_id` → `folders(id)` **with no ON DELETE action** (deleting a folder that still has a subfolder fails with FK error 23503 — a safety net for rule 6), `name` check 1–60 chars, `created_at`. RLS `folders_owner_all`: `retailer_id = auth.uid()` on the row itself only. |
| `products` | `folder_id` → `folders(id)` **on delete set null**. `name` 1–120. |
| `tags` | `name` 1–30; **unique index on `(retailer_id, lower(name))`** — an insert of an existing name fails with 23505. |
| `product_tags` | PK `(product_id, tag_id)` — a second attach fails with 23505. RLS checks **only the product side** (`exists products … retailer_id = auth.uid()`). |
| `garments` | `product_id` NOT NULL since 0006. |

**Two holes the app must close itself (spec rule 2):** foreign-key checks ignore RLS, and the RLS `with check` clauses only look at the row being written. So the database would happily accept (a) a folder whose `parent_id` is another shop's folder, (b) a product whose `folder_id` is another shop's folder, (c) a `product_tags` row linking my product to **another shop's tag**. Every route below checks those ids against the caller's own rows (scoped by `retailer_id`) and answers 404 — the same as a nonexistent id (spec §7).

**Supabase trap:** `.eq('col', null)` never matches a NULL (it sends `col=eq.null`). Use `.is('col', null)` if you ever need it. Nothing in this plan filters on NULL; writing NULL as a *value* (`update({ parent_id: null })`) is fine.

---

## Standing rules (read before Task 1)

- **The database is live; there is no staging copy.** Never run SQL. Never start the dev server against it, never submit forms or call write APIs. The gates are `npm test` and `npm run build`; the founder checks behaviour on the Vercel preview.
- **No migration in Stage 2.** If you believe one is needed, stop and report to `god` — do not write one.
- Zod objects need `.strict()` (CLAUDE.md). Do not touch `lib/fit/rules.ts` / `lib/config/dimensions.ts` imports (circular-import landmine).
- Server-side error messages are Thai only (`t.<key>.th`). UI copy goes in `lib/i18n/strings.ts`, Thai first.
- A server component may import only *components* from a `'use client'` file; shared functions go in `lib/` (decisions §3).
- Commit with `git commit -m "…" -- <paths>` (never plain `git commit`). Use the commit trailer your session's instructions give. Never rebase; `git merge origin/main`. Never push `main`.
- Never use the words "mother/parent/base/main version" (spec §2). ("Parent folder" is fine — it is about folders.)
- Fresh worktree: `npm install`, then copy `.env.local` from the main checkout (never print or commit it). This plan's worktree is `C:\Users\Copter\Documents\Munder logs\worktrees\catalogue-stage-2`, already on `feature/catalogue-stage-2`.
- After every task: `npm test` green and `npx tsc --noEmit` clean. After every UI task also `npm run lint`. `npm run build` at the end of each part (never while a dev server runs).

---

## File map

**2a — folders**

| File | Responsibility |
|---|---|
| `lib/i18n/strings.ts`, `lib/supabase/types.ts` (modify) | 2a copy; `Folder` type |
| `lib/catalogue/folders.ts` (new) | Pure tree logic: display order, children, subtree, cycle check, ancestors, Move-to targets |
| `lib/catalogue/parse.ts` (modify) | `parseFolderName` |
| `lib/catalogue/ownership.ts` (modify) | `loadShopFolders`, `checkFolderOwnership` |
| `lib/catalogue/fake-supabase.ts` (new, **test helper only**) | In-memory query-builder stand-in that records calls |
| `lib/catalogue/folder-ops.ts` (new) | `checkFolderMove` (rule 5 + ownership), `deleteFolderMovingUp` (rule 6) |
| `lib/catalogue/browse.ts` (new) | Dashboard view ⇄ address bar; which products a view shows |
| `lib/catalogue/summary.ts` (modify) | Cards carry `folder_id` |
| `lib/catalogue/send-json.ts` (new) | Client JSON request helper used by the new screens |
| `app/api/folders/route.ts` (new) | POST create |
| `app/api/folders/[id]/route.ts` (new) | PATCH rename / move, DELETE (contents move up) |
| `app/api/products/route.ts`, `app/api/products/[id]/route.ts` (modify) | Accept `folder_id` |
| `app/dashboard/product/new/page.tsx`, `NewProductForm.tsx` (modify) | Create inside the current folder |
| `app/dashboard/ActionsMenu.tsx` (new) | `⋯` / "+ New" dropdown on `<details>` |
| `app/dashboard/FolderSidebar.tsx`, `FolderMobileNav.tsx`, `MoveToDialog.tsx`, `CatalogueBrowser.tsx` (new) | Dashboard organising UI |
| `app/dashboard/ProductGrid.tsx`, `app/dashboard/page.tsx` (modify); `AddProductLink.tsx` (delete) | Cards get `⋯ → Move to…`; page loads folders |

**2b — find**

| File | Responsibility |
|---|---|
| `lib/i18n/strings.ts`, `lib/supabase/types.ts` (modify) | 2b copy; `Tag` type |
| `lib/catalogue/tags.ts` (new) | Tag name matching, tags of a product, tags in use, suggestions |
| `lib/catalogue/parse.ts`, `ownership.ts` (modify) | `parseTagName`; `loadShopTags`, `checkTagOwnership` |
| `lib/catalogue/tag-ops.ts` (new) | `attachTagByName`, `detachTag` |
| `lib/catalogue/browse.ts`, `summary.ts` (modify) | Search, tag filter, attention filter, sort; cards carry tags |
| `app/api/products/[id]/tags/route.ts`, `app/api/products/[id]/tags/[tagId]/route.ts` (new) | Attach by name; detach |
| `app/dashboard/product/[id]/ProductTags.tsx` (new); `page.tsx`, `ProductEditor.tsx` (modify) | Tags in the product header |
| `app/dashboard/CatalogueToolbar.tsx` (new); `CatalogueBrowser.tsx`, `ProductGrid.tsx`, `page.tsx` (modify) | Toolbar; tag chips on cards |

---

# Part 2a — folders and Move to…

### Task 0: Docs fix (DONE by the planner, commit `docs: resume.md records that PR #15 merged before 0006 was applied`)

`resume.md` now says PR #15 merged first and 0006 was applied to the live database afterwards on 2026-10-07 (and why that order), and no to-do item says 0006 still has to ship. Nothing to do.

---

### Task 1: Strings and types (2a)

**Files:** Modify `lib/i18n/strings.ts`, `lib/supabase/types.ts`.

- [ ] **Step 1:** In `lib/supabase/types.ts`, after `ProductPicker`, add:
```ts
export interface Folder {
  id: string;
  retailer_id: string;
  /** Null = top level. */
  parent_id: string | null;
  name: string;
  created_at: string;
}
```
- [ ] **Step 2:** In `lib/i18n/strings.ts`, add these keys just before the closing `} as const;` under a `// Catalogue Stage 2a — folders` comment (keep the `{ th, en }` shape):

| key | th | en |
|---|---|---|
| `allItems` | ทั้งหมด | All items |
| `folders` | โฟลเดอร์ | Folders |
| `newMenu` | + สร้าง ▾ | + New ▾ |
| `newFolder` | โฟลเดอร์ใหม่ | New folder |
| `folderNamePrompt` | ชื่อโฟลเดอร์ | Folder name |
| `renameFolder` | เปลี่ยนชื่อ | Rename |
| `deleteFolder` | ลบโฟลเดอร์ | Delete folder |
| `confirmDeleteFolder` | ลบโฟลเดอร์ “{name}”? ของข้างในจะย้ายไปอยู่ที่ {target} ไม่มีสินค้าใดถูกลบ | Delete folder “{name}”? Everything inside moves to {target}. No product is deleted. |
| `topLevel` | ระดับบนสุด | Top level |
| `moveTo` | ย้ายไปที่… | Move to… |
| `currentPlace` | อยู่ที่นี่ | here now |
| `moreActions` | ตัวเลือกเพิ่มเติม | More actions |
| `folderCycle` | ย้ายโฟลเดอร์ไปไว้ในตัวเองหรือในโฟลเดอร์ย่อยของตัวเองไม่ได้ | A folder can't go inside itself or one of its own folders |
| `invalidFolderName` | ชื่อโฟลเดอร์ต้องยาว 1–60 ตัวอักษร | Folder names must be 1–60 characters |
| `emptyFolder` | ยังไม่มีสินค้าในโฟลเดอร์นี้ | No products in this folder yet |

- [ ] **Step 3:** `npx tsc --noEmit` clean; `npm test` green. Commit `feat: strings and Folder type for catalogue stage 2a`.

**Acceptance:** keys exist; nothing else changed.

---

### Task 2: Folder tree logic (`lib/catalogue/folders.ts`)

**Files:** Create `lib/catalogue/folders.ts`, `lib/catalogue/folders.test.ts`.

- [ ] **Step 1: Write the failing test** — `lib/catalogue/folders.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import {
  folderLines, childFolders, subtreeIds, wouldCreateCycle, ancestors, moveTargets, type FolderRow,
} from './folders';

const F = (id: string, parent_id: string | null, name = id): FolderRow => ({ id, name, parent_id });
// Shirts > Linen > Short sleeve ; Trousers ; Dresses  (deliberately out of order)
const TREE: FolderRow[] = [
  F('trousers', null, 'Trousers'),
  F('linen', 'shirts', 'Linen'),
  F('short', 'linen', 'Short sleeve'),
  F('shirts', null, 'Shirts'),
  F('dresses', null, 'Dresses'),
];

describe('folderLines', () => {
  it('lists depth-first with siblings A–Z', () => {
    expect(folderLines(TREE).map(f => [f.id, f.depth])).toEqual([
      ['dresses', 0], ['shirts', 0], ['linen', 1], ['short', 2], ['trousers', 0],
    ]);
  });
  it('sorts names case-insensitively and numerically', () => {
    expect(folderLines([F('x', null, 'b10'), F('y', null, 'B2'), F('z', null, 'a')]).map(f => f.name))
      .toEqual(['a', 'B2', 'b10']);
  });
  it('shows a folder whose parent is missing at the top level', () => {
    expect(folderLines([F('x', 'gone')]).map(f => [f.id, f.depth])).toEqual([['x', 0]]);
  });
  it('never loses folders caught in a cycle, and never loops', () => {
    expect(folderLines([F('a', 'b', 'A'), F('b', 'a', 'B')]).map(f => f.id).sort()).toEqual(['a', 'b']);
  });
  it('empty in, empty out', () => { expect(folderLines([])).toEqual([]); });
});

describe('childFolders', () => {
  it('top level, A–Z', () => {
    expect(childFolders(TREE, null).map(f => f.id)).toEqual(['dresses', 'shirts', 'trousers']);
  });
  it('direct children only', () => {
    expect(childFolders(TREE, 'shirts').map(f => f.id)).toEqual(['linen']);
  });
  it('unknown folder has none', () => { expect(childFolders(TREE, 'nope')).toEqual([]); });
});

describe('subtreeIds', () => {
  it('is the folder and every folder below it', () => {
    expect([...subtreeIds(TREE, 'shirts')].sort()).toEqual(['linen', 'shirts', 'short']);
  });
  it('a leaf is just itself', () => { expect([...subtreeIds(TREE, 'short')]).toEqual(['short']); });
  it('an unknown id is empty', () => { expect(subtreeIds(TREE, 'nope').size).toBe(0); });
  it('terminates on a cycle', () => { expect(subtreeIds([F('a', 'b'), F('b', 'a')], 'a').size).toBe(2); });
});

describe('wouldCreateCycle (rule 5)', () => {
  it('refuses moving a folder into itself', () => { expect(wouldCreateCycle(TREE, 'shirts', 'shirts')).toBe(true); });
  it('refuses its own child', () => { expect(wouldCreateCycle(TREE, 'shirts', 'linen')).toBe(true); });
  it('refuses a deep descendant', () => { expect(wouldCreateCycle(TREE, 'shirts', 'short')).toBe(true); });
  it('allows a sibling, an ancestor and the top level', () => {
    expect(wouldCreateCycle(TREE, 'short', 'trousers')).toBe(false);
    expect(wouldCreateCycle(TREE, 'short', 'shirts')).toBe(false);
    expect(wouldCreateCycle(TREE, 'linen', null)).toBe(false);
  });
});

describe('ancestors', () => {
  it('top level first, the folder itself excluded', () => {
    expect(ancestors(TREE, 'short').map(f => f.id)).toEqual(['shirts', 'linen']);
  });
  it('a top-level folder has none', () => { expect(ancestors(TREE, 'shirts')).toEqual([]); });
  it('terminates on a cycle', () => {
    expect(ancestors([F('a', 'b'), F('b', 'a')], 'a').map(f => f.id)).toEqual(['b']);
  });
});

describe('moveTargets', () => {
  it('moving a folder: Top level first; itself and everything below it disabled; its current parent marked', () => {
    const rows = moveTargets(TREE, { kind: 'folder', id: 'linen' });
    expect(rows[0]).toMatchObject({ id: null, disabled: false, current: false });
    const by = Object.fromEntries(rows.slice(1).map(r => [String(r.id), r]));
    expect(by.linen.disabled).toBe(true);
    expect(by.short.disabled).toBe(true);
    expect(by.shirts).toMatchObject({ current: true, disabled: true });
    expect(by.trousers).toMatchObject({ current: false, disabled: false });
  });
  it('moving a top-level product: Top level is current; every folder is allowed', () => {
    const rows = moveTargets(TREE, { kind: 'product', folderId: null });
    expect(rows[0]).toMatchObject({ current: true, disabled: true });
    expect(rows.slice(1).every(r => !r.disabled)).toBe(true);
  });
  it('folders are indented one level deeper than Top level', () => {
    expect(moveTargets(TREE, { kind: 'product', folderId: 'short' }).map(r => r.depth)).toEqual([0, 1, 1, 2, 3, 1]);
  });
});
```
- [ ] **Step 2: Run, expect FAIL** — `npx vitest run lib/catalogue/folders.test.ts` (module not found).
- [ ] **Step 3: Implement** — `lib/catalogue/folders.ts`
```ts
/** A folder as the dashboard and the folder API see it (spec §4.1). */
export interface FolderRow { id: string; name: string; parent_id: string | null }
export interface FolderLine extends FolderRow { depth: number }

const byName = (a: FolderRow, b: FolderRow) =>
  a.name.localeCompare(b.name, ['th', 'en'], { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id);

/**
 * Every folder exactly once, in display order: depth-first, siblings A–Z.
 * A folder whose parent is missing, or that sits in a cycle (rule 5 prevents
 * one, but two simultaneous moves could still make one), is shown at the top
 * level so it can never vanish from the list.
 */
export function folderLines(folders: FolderRow[]): FolderLine[] {
  const ids = new Set(folders.map(f => f.id));
  const kids = new Map<string | null, FolderRow[]>();
  for (const f of folders) {
    const key = f.parent_id !== null && ids.has(f.parent_id) ? f.parent_id : null;
    const list = kids.get(key);
    if (list) list.push(f); else kids.set(key, [f]);
  }
  for (const list of kids.values()) list.sort(byName);

  const out: FolderLine[] = [];
  const seen = new Set<string>();
  const walk = (f: FolderRow, depth: number) => {
    if (seen.has(f.id)) return;
    seen.add(f.id);
    out.push({ ...f, depth });
    for (const c of kids.get(f.id) ?? []) walk(c, depth + 1);
  };
  for (const f of kids.get(null) ?? []) walk(f, 0);
  for (const f of [...folders].sort(byName)) walk(f, 0); // rescue folders caught in a cycle
  return out;
}

/** Direct children of a folder (null = the top level), A–Z. */
export function childFolders(folders: FolderRow[], parentId: string | null): FolderLine[] {
  const lines = folderLines(folders);
  if (parentId === null) return lines.filter(l => l.depth === 0);
  const parent = lines.find(l => l.id === parentId);
  return parent ? lines.filter(l => l.parent_id === parentId && l.depth === parent.depth + 1) : [];
}

/** The folder and every folder below it. Empty for an unknown id. Cycle-safe. */
export function subtreeIds(folders: FolderRow[], rootId: string): Set<string> {
  const out = new Set<string>();
  if (!folders.some(f => f.id === rootId)) return out;
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (out.has(id)) continue;
    out.add(id);
    for (const f of folders) if (f.parent_id === id) stack.push(f.id);
  }
  return out;
}

/** Rule 5: would putting `folderId` under `newParentId` put it inside itself? Top level (null) never does. */
export function wouldCreateCycle(folders: FolderRow[], folderId: string, newParentId: string | null): boolean {
  if (newParentId === null) return false;
  return subtreeIds(folders, folderId).has(newParentId) || newParentId === folderId;
}

/** The folders above `id`, top level first, `id` itself excluded. Cycle-safe. */
export function ancestors(folders: FolderRow[], id: string): FolderRow[] {
  const byId = new Map(folders.map(f => [f.id, f]));
  const out: FolderRow[] = [];
  const seen = new Set<string>([id]);
  let cur = byId.get(id)?.parent_id ?? null;
  while (cur !== null && !seen.has(cur)) {
    const f = byId.get(cur);
    if (!f) break;
    out.unshift(f);
    seen.add(cur);
    cur = f.parent_id;
  }
  return out;
}

export interface MoveTarget {
  /** null = Top level. */
  id: string | null;
  name: string | null;
  depth: number;
  disabled: boolean;
  /** Where the thing being moved is now. */
  current: boolean;
}

/**
 * Rows for the "Move to…" chooser: Top level first, then every folder in
 * display order. Moving a folder disables it and everything below it
 * (rule 5). The current place is marked and disabled (moving there does nothing).
 */
export function moveTargets(
  folders: FolderRow[],
  moving: { kind: 'folder'; id: string } | { kind: 'product'; folderId: string | null },
): MoveTarget[] {
  const blocked = moving.kind === 'folder' ? subtreeIds(folders, moving.id) : new Set<string>();
  const currentId = moving.kind === 'folder'
    ? folders.find(f => f.id === moving.id)?.parent_id ?? null
    : moving.folderId;
  const rows: MoveTarget[] = [
    { id: null, name: null, depth: 0, disabled: currentId === null, current: currentId === null },
  ];
  for (const f of folderLines(folders)) {
    const current = f.id === currentId;
    rows.push({ id: f.id, name: f.name, depth: f.depth + 1, disabled: current || blocked.has(f.id), current });
  }
  return rows;
}
```
- [ ] **Step 4: Run, expect PASS.** `npx vitest run lib/catalogue/folders.test.ts`
- [ ] **Step 5:** `npx tsc --noEmit`. Commit `feat: folder tree logic (order, subtree, cycle check, move targets)`.

**Acceptance:** all `folders.test.ts` cases pass, including both cycle-safety cases.

---

### Task 3: Folder name parsing and shop-scoped folder reads

**Files:** Modify `lib/catalogue/parse.ts`, `lib/catalogue/parse.test.ts`, `lib/catalogue/ownership.ts`, `lib/catalogue/ownership.test.ts`.

- [ ] **Step 1: Failing tests.** Append to `parse.test.ts` (add `parseFolderName` to the existing `./parse` import, and add `import { t } from '@/lib/i18n/strings';` — the file does not import it yet):
```ts
describe('parseFolderName', () => {
  it('trims', () => { expect(parseFolderName('  Shirts ')).toEqual({ ok: true, value: 'Shirts' }); });
  it('accepts 60 characters, rejects blank and 61 with the Thai message', () => {
    expect(parseFolderName('x'.repeat(60)).ok).toBe(true);
    expect(parseFolderName('   ')).toEqual({ ok: false, error: t.invalidFolderName.th });
    expect(parseFolderName('x'.repeat(61)).ok).toBe(false);
  });
});
```
Append to `ownership.test.ts` (reuse its existing `fake`; add `loadShopFolders, checkFolderOwnership` to the import):
```ts
const FOLDERS = {
  folders: [
    { id: 'F1', retailer_id: 'A', name: 'Shirts', parent_id: null },
    { id: 'F2', retailer_id: 'B', name: 'Theirs', parent_id: null },
  ],
};

describe('loadShopFolders', () => {
  it("lists only the caller's folders", async () => {
    const r = await loadShopFolders(fake(FOLDERS), 'A');
    expect(r.ok && r.folders.map(f => f.id)).toEqual(['F1']);
  });
  it('fails closed with 500, never an empty list', async () => {
    expect(await loadShopFolders(fake(FOLDERS, 'folders'), 'A')).toMatchObject({ ok: false, status: 500 });
  });
});

describe('checkFolderOwnership', () => {
  it('accepts own folder', async () => {
    expect(await checkFolderOwnership(fake(FOLDERS), 'A', 'F1')).toEqual({ ok: true });
  });
  it("rejects another shop's folder as 404, same as nonexistent", async () => {
    expect(await checkFolderOwnership(fake(FOLDERS), 'A', 'F2')).toMatchObject({ ok: false, status: 404 });
    expect(await checkFolderOwnership(fake(FOLDERS), 'A', 'nope')).toMatchObject({ ok: false, status: 404 });
  });
  it('fails closed with 500', async () => {
    expect(await checkFolderOwnership(fake(FOLDERS, 'folders'), 'A', 'F1')).toMatchObject({ ok: false, status: 500 });
  });
});
```
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** In `parse.ts` add `import { t } from '@/lib/i18n/strings';` and:
```ts
export const parseFolderName = (raw: unknown) => named(raw, 60, t.invalidFolderName.th);
```
In `ownership.ts` add `import type { FolderRow } from './folders';` and:
```ts
/** The caller's folders, scoped by retailer_id. A failed read is a 500, never an empty list. */
export async function loadShopFolders(
  supabase: SupabaseClient, userId: string,
): Promise<{ ok: true; folders: FolderRow[] } | Failure> {
  const { data, error } = await supabase
    .from('folders').select('id, name, parent_id').eq('retailer_id', userId).order('name', { ascending: true });
  if (error) { console.error('folders lookup failed:', error); return fail500; }
  return { ok: true, folders: (data ?? []) as FolderRow[] };
}

/**
 * Is this folder the caller's? Used wherever a request names a folder to put
 * something in. Another shop's id looks nonexistent (404). The database would
 * accept it otherwise: foreign keys ignore RLS.
 */
export async function checkFolderOwnership(
  supabase: SupabaseClient, userId: string, folderId: string,
): Promise<{ ok: true } | Failure> {
  const { data, error } = await supabase
    .from('folders').select('id').eq('id', folderId).eq('retailer_id', userId).maybeSingle();
  if (error) { console.error('folder ownership lookup failed:', error); return fail500; }
  return data ? { ok: true } : fail404;
}
```
- [ ] **Step 4: Run, expect PASS.** `npx vitest run lib/catalogue`
- [ ] **Step 5:** Commit `feat: folder name parsing and shop-scoped folder reads`.

**Acceptance:** another shop's folder id is 404 in both functions; a failed lookup is 500.

---

### Task 4: Fake client, folder move check, delete-moves-up

**Files:** Create `lib/catalogue/fake-supabase.ts`, `lib/catalogue/folder-ops.ts`, `lib/catalogue/folder-ops.test.ts`.

- [ ] **Step 1: Write the test helper** — `lib/catalogue/fake-supabase.ts` (not a test file itself; imported only by `*.test.ts`):
```ts
/**
 * TEST HELPER ONLY — imported by *.test.ts files, never by app code.
 * An in-memory stand-in for the parts of the Supabase query builder the
 * catalogue lib uses: select / insert / update / delete, .eq / .in filters,
 * .order (ignored), .maybeSingle / .single, and awaiting the builder.
 * Every executed statement is recorded in `calls`, so tests can check order
 * and that every statement was scoped to the caller's shop.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type Row = Record<string, unknown>;
export type Op = 'select' | 'insert' | 'update' | 'delete';
export interface Call { table: string; op: Op; eq: Record<string, unknown>; values?: Row }
export interface FakeOptions {
  /** Make one table + operation return { error: { message: 'boom', code } }. */
  fail?: { table: string; op: Op; code?: string };
  /** Unique keys per table: an insert whose key matches an existing row fails with code 23505. */
  unique?: Record<string, (r: Row) => string>;
}

export function fakeSupabase(tables: Record<string, Row[]>, opts: FakeOptions = {}) {
  const calls: Call[] = [];
  let seq = 0;
  const client = {
    from(table: string) {
      let op: Op = 'select';
      let values: Row | undefined;
      const eq: Record<string, unknown> = {};
      const ins: [string, unknown[]][] = [];
      const matches = (r: Row) =>
        Object.entries(eq).every(([c, v]) => r[c] === v) && ins.every(([c, vs]) => vs.includes(r[c]));
      function run(single: boolean) {
        calls.push({ table, op, eq: { ...eq }, values });
        if (opts.fail && opts.fail.table === table && opts.fail.op === op) {
          return { data: null, error: { message: 'boom', code: opts.fail.code } };
        }
        const rows = tables[table] ?? (tables[table] = []);
        if (op === 'insert') {
          const row: Row = { id: `${table}-${++seq}`, ...values };
          const key = opts.unique?.[table];
          if (key && rows.some(r => key(r) === key(row))) {
            return { data: null, error: { message: 'duplicate key', code: '23505' } };
          }
          rows.push(row);
          return { data: single ? row : [row], error: null };
        }
        if (op === 'update') {
          for (const r of rows) if (matches(r)) Object.assign(r, values);
          return { data: null, error: null };
        }
        if (op === 'delete') {
          tables[table] = rows.filter(r => !matches(r));
          return { data: null, error: null };
        }
        const found = rows.filter(matches);
        return { data: single ? found[0] ?? null : found, error: null };
      }
      const b: Record<string, unknown> = {
        select: () => b,
        insert: (v: Row) => { op = 'insert'; values = v; return b; },
        update: (v: Row) => { op = 'update'; values = v; return b; },
        delete: () => { op = 'delete'; return b; },
        eq: (c: string, v: unknown) => { eq[c] = v; return b; },
        in: (c: string, vs: unknown[]) => { ins.push([c, vs]); return b; },
        order: () => b,
        maybeSingle: async () => run(true),
        single: async () => run(true),
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          Promise.resolve(run(false)).then(res, rej),
      };
      return b;
    },
  } as unknown as SupabaseClient;
  return { client, calls, tables };
}
```
- [ ] **Step 2: Write the failing test** — `lib/catalogue/folder-ops.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { t } from '@/lib/i18n/strings';
import { checkFolderMove, deleteFolderMovingUp } from './folder-ops';
import { fakeSupabase, type Row } from './fake-supabase';
import type { FolderRow } from './folders';

const MINE: FolderRow[] = [
  { id: 'shirts', name: 'Shirts', parent_id: null },
  { id: 'linen', name: 'Linen', parent_id: 'shirts' },
  { id: 'short', name: 'Short sleeve', parent_id: 'linen' },
];

describe('checkFolderMove', () => {
  it('allows a legal move and a move to the top level', () => {
    expect(checkFolderMove(MINE, 'short', 'shirts')).toEqual({ ok: true });
    expect(checkFolderMove(MINE, 'linen', null)).toEqual({ ok: true });
  });
  it("another shop's (or unknown) folder is 404", () => {
    expect(checkFolderMove(MINE, 'theirs', null)).toMatchObject({ ok: false, status: 404 });
  });
  it("another shop's (or unknown) destination is 404", () => {
    expect(checkFolderMove(MINE, 'linen', 'theirs')).toMatchObject({ ok: false, status: 404 });
  });
  it('a move into itself or below itself is 409 with the Thai message (rule 5)', () => {
    expect(checkFolderMove(MINE, 'shirts', 'short')).toEqual({ ok: false, status: 409, error: t.folderCycle.th });
    expect(checkFolderMove(MINE, 'shirts', 'shirts')).toMatchObject({ ok: false, status: 409 });
  });
});

function db(): Record<string, Row[]> {
  return {
    folders: [
      { id: 'shirts', retailer_id: 'A', name: 'Shirts', parent_id: null },
      { id: 'linen', retailer_id: 'A', name: 'Linen', parent_id: 'shirts' },
      { id: 'short', retailer_id: 'A', name: 'Short sleeve', parent_id: 'linen' },
      { id: 'long', retailer_id: 'A', name: 'Long sleeve', parent_id: 'linen' },
      // Impossible through the app; proves every statement is scoped to the caller.
      { id: 'theirs', retailer_id: 'B', name: 'Theirs', parent_id: 'linen' },
    ],
    products: [
      { id: 'p1', retailer_id: 'A', folder_id: 'linen' },
      { id: 'p2', retailer_id: 'A', folder_id: 'short' },
      { id: 'p3', retailer_id: 'A', folder_id: null },
      { id: 'pB', retailer_id: 'B', folder_id: 'linen' },
    ],
  };
}
const LINEN: FolderRow = { id: 'linen', name: 'Linen', parent_id: 'shirts' };
const find = (rows: Row[], id: string) => rows.find(r => r.id === id);

describe('deleteFolderMovingUp (rule 6)', () => {
  it('moves subfolders and products up one level, then deletes only the folder', async () => {
    const f = fakeSupabase(db());
    expect(await deleteFolderMovingUp(f.client, 'A', LINEN)).toEqual({ ok: true });
    expect(f.tables.folders.map(r => r.id)).not.toContain('linen');
    expect(find(f.tables.folders, 'short')?.parent_id).toBe('shirts');
    expect(find(f.tables.folders, 'long')?.parent_id).toBe('shirts');
    expect(find(f.tables.products, 'p1')?.folder_id).toBe('shirts');
    expect(find(f.tables.products, 'p2')?.folder_id).toBe('short'); // deeper contents untouched
    expect(f.tables.products).toHaveLength(4); // nothing deleted
  });
  it("a top-level folder's contents move to the top level", async () => {
    const f = fakeSupabase(db());
    await deleteFolderMovingUp(f.client, 'A', { id: 'shirts', name: 'Shirts', parent_id: null });
    expect(find(f.tables.folders, 'linen')?.parent_id).toBe(null);
  });
  it("every statement is scoped to the caller's shop", async () => {
    const f = fakeSupabase(db());
    await deleteFolderMovingUp(f.client, 'A', LINEN);
    expect(f.calls.every(c => c.eq.retailer_id === 'A')).toBe(true);
    expect(find(f.tables.folders, 'theirs')?.parent_id).toBe('linen');
    expect(find(f.tables.products, 'pB')?.folder_id).toBe('linen');
  });
  it('moves everything before deleting', async () => {
    const f = fakeSupabase(db());
    await deleteFolderMovingUp(f.client, 'A', LINEN);
    expect(f.calls.map(c => `${c.table}.${c.op}`)).toEqual(['folders.update', 'products.update', 'folders.delete']);
  });
  it('stops before deleting when moving products fails', async () => {
    const f = fakeSupabase(db(), { fail: { table: 'products', op: 'update' } });
    expect(await deleteFolderMovingUp(f.client, 'A', LINEN)).toMatchObject({ ok: false, status: 500 });
    expect(f.tables.folders.map(r => r.id)).toContain('linen');
    expect(f.calls.some(c => c.op === 'delete')).toBe(false);
  });
  it('stops at once when moving subfolders fails', async () => {
    const f = fakeSupabase(db(), { fail: { table: 'folders', op: 'update' } });
    expect(await deleteFolderMovingUp(f.client, 'A', LINEN)).toMatchObject({ ok: false, status: 500 });
    expect(f.calls.map(c => c.op)).toEqual(['update']);
  });
  it('reports a failed delete as 500', async () => {
    const f = fakeSupabase(db(), { fail: { table: 'folders', op: 'delete' } });
    expect(await deleteFolderMovingUp(f.client, 'A', LINEN)).toMatchObject({ ok: false, status: 500 });
  });
});
```
- [ ] **Step 3: Run, expect FAIL.**
- [ ] **Step 4: Implement** — `lib/catalogue/folder-ops.ts`
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { t } from '@/lib/i18n/strings';
import { wouldCreateCycle, type FolderRow } from './folders';

export type OpResult = { ok: true } | { ok: false; status: 404 | 409 | 500; error: string };

/**
 * Can folder `id` move under `newParentId` (null = top level)? `folders` must be
 * the caller's own folders (loadShopFolders, scoped by retailer_id), so another
 * shop's id — as the folder or the destination — is a 404, exactly like a
 * nonexistent one. Rule 5 (into itself or below itself) is a 409.
 */
export function checkFolderMove(folders: FolderRow[], id: string, newParentId: string | null): OpResult {
  if (!folders.some(f => f.id === id)) return { ok: false, status: 404, error: 'not found' };
  if (newParentId !== null && !folders.some(f => f.id === newParentId)) {
    return { ok: false, status: 404, error: 'not found' };
  }
  if (wouldCreateCycle(folders, id, newParentId)) return { ok: false, status: 409, error: t.folderCycle.th };
  return { ok: true };
}

/**
 * Rule 6: delete a folder without deleting anything in it. Its subfolders and
 * products move up one level (to its parent, or the top level), THEN the
 * folder row is deleted. Three statements, not a transaction: the order means
 * a failure part-way loses nothing (moved items are simply already moved, and
 * a retry finishes the job). The database also refuses the final delete while
 * any subfolder still points at it (folders.parent_id has no ON DELETE action).
 * `folder` must come from loadShopFolders (the caller's own).
 */
export async function deleteFolderMovingUp(
  supabase: SupabaseClient, userId: string, folder: FolderRow,
): Promise<OpResult> {
  const up = folder.parent_id;
  const fail = (step: string, error: unknown): OpResult => {
    console.error(`folder delete: ${step} failed:`, error);
    return { ok: false, status: 500, error: t.saveFailed.th };
  };

  const { error: foldersErr } = await supabase
    .from('folders').update({ parent_id: up }).eq('parent_id', folder.id).eq('retailer_id', userId);
  if (foldersErr) return fail('moving subfolders up', foldersErr);

  const { error: productsErr } = await supabase
    .from('products').update({ folder_id: up }).eq('folder_id', folder.id).eq('retailer_id', userId);
  if (productsErr) return fail('moving products up', productsErr);

  const { error: deleteErr } = await supabase
    .from('folders').delete().eq('id', folder.id).eq('retailer_id', userId);
  if (deleteErr) return fail('deleting the folder', deleteErr);

  return { ok: true };
}
```
- [ ] **Step 5: Run, expect PASS.** `npx vitest run lib/catalogue`
- [ ] **Step 6:** `npx tsc --noEmit && npm run lint` (the helper is linted too). Commit `feat: folder move check and delete-moves-up, with an in-memory test client`.

**Acceptance:** order is `folders.update → products.update → folders.delete`; every call carries `retailer_id`; any failure stops before the delete.

---

### Task 5: Dashboard view, cards carry `folder_id`, JSON helper

**Files:** Create `lib/catalogue/browse.ts`, `lib/catalogue/browse.test.ts`, `lib/catalogue/send-json.ts`, `lib/catalogue/send-json.test.ts`; Modify `lib/catalogue/summary.ts`, `lib/catalogue/summary.test.ts`.

- [ ] **Step 1: Failing tests.**

`browse.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseView, viewToQuery, productsInView } from './browse';
import type { FolderRow } from './folders';

const FOLDERS: FolderRow[] = [
  { id: 'shirts', name: 'Shirts', parent_id: null },
  { id: 'linen', name: 'Linen', parent_id: 'shirts' },
  { id: 'trousers', name: 'Trousers', parent_id: null },
];
const P = (id: string, folder_id: string | null) => ({ id, folder_id });
const PRODUCTS = [P('top', null), P('inShirts', 'shirts'), P('inLinen', 'linen'), P('inTrousers', 'trousers')];
const qs = (s: string) => new URLSearchParams(s);

describe('parseView', () => {
  it('reads a known folder', () => { expect(parseView(qs('folder=linen'), FOLDERS)).toEqual({ folderId: 'linen' }); });
  it("an unknown, deleted or another shop's folder falls back to All items", () => {
    expect(parseView(qs('folder=zzz'), FOLDERS)).toEqual({ folderId: null });
  });
  it('no folder is All items', () => { expect(parseView(qs(''), FOLDERS)).toEqual({ folderId: null }); });
});

describe('viewToQuery', () => {
  it('round-trips a folder', () => {
    expect(parseView(qs(viewToQuery({ folderId: 'linen' })), FOLDERS)).toEqual({ folderId: 'linen' });
  });
  it('All items is the empty query', () => { expect(viewToQuery({ folderId: null })).toBe(''); });
});

describe('productsInView (open question 1: a folder shows everything below it)', () => {
  it('All items shows every product, in the given order', () => {
    expect(productsInView(PRODUCTS, FOLDERS, { folderId: null }).map(p => p.id))
      .toEqual(['top', 'inShirts', 'inLinen', 'inTrousers']);
  });
  it('a folder shows its own products and those of every folder below it', () => {
    expect(productsInView(PRODUCTS, FOLDERS, { folderId: 'shirts' }).map(p => p.id)).toEqual(['inShirts', 'inLinen']);
  });
  it('a leaf folder shows only its own', () => {
    expect(productsInView(PRODUCTS, FOLDERS, { folderId: 'linen' }).map(p => p.id)).toEqual(['inLinen']);
  });
});
```
Append to `summary.test.ts`:
```ts
describe('summariseProducts folder_id', () => {
  it('passes folder_id through, null when absent', () => {
    const out = summariseProducts(
      [{ id: 'P1', name: 'a', created_at: '2026-01-01', folder_id: 'F1' }, prod('P2', '2026-01-01')], [], []);
    expect(out.map(p => p.folder_id)).toEqual(['F1', null]);
  });
});
```
`send-json.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendJson } from './send-json';

afterEach(() => { vi.unstubAllGlobals(); });
// Typed as fetch so toHaveBeenCalledWith checks real arguments (no unused params for lint).
const reply = (status: number, body: string) => vi.fn<typeof fetch>(async () => new Response(body, { status }));

describe('sendJson', () => {
  it('sends JSON and returns the body on success', async () => {
    const fetchMock = reply(200, JSON.stringify({ ok: true, id: 'x' }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await sendJson('/api/folders', 'POST', { name: 'a' })).toEqual({ ok: true, data: { ok: true, id: 'x' } });
    expect(fetchMock).toHaveBeenCalledWith('/api/folders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"name":"a"}',
    });
  });
  it('passes the server error text through', async () => {
    vi.stubGlobal('fetch', reply(409, JSON.stringify({ error: 'ย้ายไม่ได้' })));
    expect(await sendJson('/x', 'PATCH', {})).toEqual({ ok: false, error: 'ย้ายไม่ได้' });
  });
  it('a non-JSON error has no text', async () => {
    vi.stubGlobal('fetch', reply(500, 'oops'));
    expect(await sendJson('/x', 'DELETE')).toEqual({ ok: false });
  });
  it('a network failure never throws', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => { throw new Error('offline'); }));
    expect(await sendJson('/x', 'DELETE')).toEqual({ ok: false });
  });
});
```
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**

`lib/catalogue/browse.ts`:
```ts
import { subtreeIds, type FolderRow } from './folders';

/** What the dashboard is showing. Lives in the address bar (see viewToQuery). */
export interface DashboardView {
  /** null = All items. */
  folderId: string | null;
}

interface ParamsLike { get(name: string): string | null }

/** Read the view from the address bar. A folder that no longer exists, or is not the caller's, falls back to All items. */
export function parseView(params: ParamsLike, folders: FolderRow[]): DashboardView {
  const folder = params.get('folder');
  return { folderId: folder && folders.some(f => f.id === folder) ? folder : null };
}

/** The query string for a view, without the leading '?'. Empty for All items. */
export function viewToQuery(view: DashboardView): string {
  const p = new URLSearchParams();
  if (view.folderId) p.set('folder', view.folderId);
  return p.toString();
}

/**
 * The products a view shows, in the order given. All items = every product;
 * a folder = products in it or in any folder below it (open question 1).
 */
export function productsInView<T extends { folder_id: string | null }>(
  products: T[], folders: FolderRow[], view: DashboardView,
): T[] {
  if (view.folderId === null) return products;
  const ids = subtreeIds(folders, view.folderId);
  return products.filter(p => p.folder_id !== null && ids.has(p.folder_id));
}
```
`lib/catalogue/send-json.ts`:
```ts
/**
 * JSON request from the owner's screens. Never throws: a network failure or a
 * non-JSON error is { ok: false } with no text (the caller shows saveFailed).
 */
export async function sendJson(
  url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error?: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data };
    return typeof data?.error === 'string' ? { ok: false, error: data.error } : { ok: false };
  } catch {
    return { ok: false };
  }
}
```
(The test's `toHaveBeenCalledWith` expects `headers` and `body` keys to be present with values when a body is given; when no body is given they are `undefined` — that is fine.)

`lib/catalogue/summary.ts`: products input type becomes `{ id: string; name: string; created_at: string; folder_id?: string | null }[]`; add `folder_id: string | null;` to `ProductSummary` (after `created_at`) and `folder_id: p.folder_id ?? null,` to the returned object.
- [ ] **Step 4: Run, expect PASS.** `npx vitest run lib/catalogue`
- [ ] **Step 5:** `npx tsc --noEmit && npm run lint`. Commit `feat: dashboard view in the address bar, folder scoping, JSON helper`.

**Acceptance:** existing `summary.test.ts` cases still pass unchanged; new ones pass.

---

### Task 6: Folder API

**Files:** Create `app/api/folders/route.ts`, `app/api/folders/[id]/route.ts`.

No route tests exist in this repo (no staging database); the logic these call is unit-tested in Tasks 3–4. Keep the routes to exactly this shape.

- [ ] **Step 1: `app/api/folders/route.ts`**
```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { checkFolderOwnership } from '@/lib/catalogue/ownership';
import { parseFolderName } from '@/lib/catalogue/parse';
import { t } from '@/lib/i18n/strings';

const CreateBody = z.object({ name: z.string(), parent_id: z.uuid().nullable() }).strict();

/** Create a folder inside parent_id (null = top level). The parent must be the caller's own (rule 2). */
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = CreateBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  const name = parseFolderName(body.data.name);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });

  if (body.data.parent_id !== null) {
    const owns = await checkFolderOwnership(supabase, user.id, body.data.parent_id);
    if (!owns.ok) return NextResponse.json({ error: owns.error }, { status: owns.status });
  }

  const { data, error } = await supabase
    .from('folders')
    .insert({ retailer_id: user.id, parent_id: body.data.parent_id, name: name.value })
    .select('id')
    .single();
  if (error || !data) {
    console.error('folder insert failed:', error);
    return NextResponse.json({ error: t.saveFailed.th }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}
```
- [ ] **Step 2: `app/api/folders/[id]/route.ts`**
```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadShopFolders } from '@/lib/catalogue/ownership';
import { checkFolderMove, deleteFolderMovingUp } from '@/lib/catalogue/folder-ops';
import { parseFolderName } from '@/lib/catalogue/parse';
import { t } from '@/lib/i18n/strings';

type Params = { params: Promise<{ id: string }> };
const notFound = () => NextResponse.json({ error: 'not found' }, { status: 404 });

const PatchBody = z.object({
  name: z.string().optional(),
  parent_id: z.uuid().nullable().optional(),
}).strict();

/** Rename and/or move a folder. Body: { name?, parent_id? } (parent_id null = top level). */
export async function PATCH(req: Request, props: Params) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!z.uuid().safeParse(params.id).success) return notFound();

  const body = PatchBody.safeParse(await req.json().catch(() => null));
  if (!body.success || (body.data.name === undefined && body.data.parent_id === undefined)) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const update: { name?: string; parent_id?: string | null } = {};
  if (body.data.name !== undefined) {
    const name = parseFolderName(body.data.name);
    if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
    update.name = name.value;
  }

  const loaded = await loadShopFolders(supabase, user.id);
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  if (body.data.parent_id !== undefined) {
    const check = checkFolderMove(loaded.folders, params.id, body.data.parent_id);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
    update.parent_id = body.data.parent_id;
  } else if (!loaded.folders.some(f => f.id === params.id)) {
    return notFound();
  }

  const { error } = await supabase.from('folders').update(update).eq('id', params.id).eq('retailer_id', user.id);
  if (error) {
    console.error('folder update failed:', error);
    return NextResponse.json({ error: t.saveFailed.th }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Delete a folder; its subfolders and products move up one level (rule 6). Nothing else is deleted. */
export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!z.uuid().safeParse(params.id).success) return notFound();

  const loaded = await loadShopFolders(supabase, user.id);
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  const folder = loaded.folders.find(f => f.id === params.id);
  if (!folder) return notFound();

  const result = await deleteFolderMovingUp(supabase, user.id, folder);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
```
- [ ] **Step 3:** `npx tsc --noEmit && npm run lint && npm test`. Commit `feat: folder API (create, rename, move with cycle check, delete moves contents up)`.

**Acceptance (code review, not runtime):** every id from the request (`params.id`, `parent_id`) is checked against the caller's own folders before any write; every write carries `.eq('retailer_id', user.id)`.

---

### Task 7: Products accept a folder; New product inside the current folder

**Files:** Modify `app/api/products/route.ts`, `app/api/products/[id]/route.ts`, `app/dashboard/product/new/page.tsx`, `app/dashboard/product/new/NewProductForm.tsx`.

- [ ] **Step 1: `POST /api/products`.** Add `import { z } from 'zod';` and `import { checkFolderOwnership } from '@/lib/catalogue/ownership';`. Replace the body handling with:
```ts
const CreateBody = z.object({ name: z.string(), folder_id: z.uuid().nullable().optional() }).strict();
// inside POST, after the auth check:
const body = CreateBody.safeParse(await req.json().catch(() => null));
if (!body.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
const name = parseProductName(body.data.name);
if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
const folderId = body.data.folder_id ?? null;
if (folderId !== null) {
  const owns = await checkFolderOwnership(supabase, user.id, folderId);
  if (!owns.ok) return NextResponse.json({ error: owns.error }, { status: owns.status });
}
```
and insert `{ retailer_id: user.id, name: name.value, folder_id: folderId }`. Everything after (default pickers, rollback) stays exactly as is.
- [ ] **Step 2: `PATCH /api/products/[id]`** — rename and/or move. Replace the body handling with:
```ts
const PatchBody = z.object({
  name: z.string().optional(),
  folder_id: z.uuid().nullable().optional(),
}).strict();
// inside PATCH, after the auth check:
const body = PatchBody.safeParse(await req.json().catch(() => null));
if (!body.success || (body.data.name === undefined && body.data.folder_id === undefined)) {
  return NextResponse.json({ error: 'invalid body' }, { status: 400 });
}
const update: { name?: string; folder_id?: string | null } = {};
if (body.data.name !== undefined) {
  const name = parseProductName(body.data.name);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
  update.name = name.value;
}
if (body.data.folder_id !== undefined) {
  if (body.data.folder_id !== null) {
    const owns = await checkFolderOwnership(supabase, user.id, body.data.folder_id);
    if (!owns.ok) return NextResponse.json({ error: owns.error }, { status: owns.status });
  }
  update.folder_id = body.data.folder_id;
}
```
then the existing `loadProductContext` check, then `.update(update)` (same `.eq('id').eq('retailer_id')`). Update the doc comment: "Rename and/or move to a folder (null = top level)". `ProductEditor` keeps sending `{ name }` — still valid. Leave `DELETE` untouched.
- [ ] **Step 3: New product page.** `app/dashboard/product/new/page.tsx` becomes:
```tsx
import { z } from 'zod';
import NewProductForm from './NewProductForm';

export const metadata = { title: 'เพิ่มสินค้า — Fit MVP' };

/** ?folder=<id> creates the product in that folder (the server checks it is the caller's). */
export default async function NewProductPage(props: { searchParams: Promise<{ folder?: string | string[] }> }) {
  const { folder } = await props.searchParams;
  const folderId = typeof folder === 'string' && z.uuid().safeParse(folder).success ? folder : null;
  return <NewProductForm folderId={folderId} />;
}
```
`NewProductForm`: add prop `{ folderId }: { folderId: string | null }`; send `JSON.stringify({ name, folder_id: folderId })`; the Cancel link goes to `folderId ? \`/dashboard?folder=${folderId}\` : '/dashboard'`. Nothing else changes.
- [ ] **Step 4:** `npx tsc --noEmit && npm run lint && npm test`. Commit `feat: products can be created in and moved to a folder`.

**Acceptance:** a foreign or unknown `folder_id` returns 404 before any write; `{ name }` alone still renames.

---

### Task 8: Dashboard — folder side list, phone header, Move to…

**Files:** Create `app/dashboard/ActionsMenu.tsx`, `FolderSidebar.tsx`, `FolderMobileNav.tsx`, `MoveToDialog.tsx`, `CatalogueBrowser.tsx`; Modify `app/dashboard/ProductGrid.tsx`, `app/dashboard/page.tsx`; Delete `app/dashboard/AddProductLink.tsx` (only `page.tsx` imports it — confirm with `grep -rn AddProductLink app` first).

These are wiring over the tested `lib/` functions; there are no component tests. All copy comes from `t.*[lang]`.

- [ ] **Step 1: `ActionsMenu.tsx`** (client) — the `⋯` and "+ New ▾" dropdown:
```tsx
'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';

export interface MenuItem { text: string; onSelect?: () => void; href?: string; danger?: boolean }

/**
 * A small dropdown built on <details>, so it works on phones without extra
 * code. Closes after a choice or on a click anywhere else.
 */
export default function ActionsMenu({ trigger, ariaLabel, triggerClassName, items, disabled }: {
  trigger: React.ReactNode; ariaLabel: string; triggerClassName?: string; items: MenuItem[]; disabled?: boolean;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  const close = () => { if (ref.current) ref.current.open = false; };
  const itemClass = (danger?: boolean) =>
    `block w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${danger ? 'text-red-600' : 'text-gray-900'}`;

  return (
    <details ref={ref} className="relative shrink-0">
      <summary
        aria-label={ariaLabel}
        className={`cursor-pointer list-none [&::-webkit-details-marker]:hidden ${
          disabled ? 'pointer-events-none opacity-60 ' : ''}${triggerClassName ?? 'rounded px-2 text-gray-500 hover:bg-gray-100'}`}
      >
        {trigger}
      </summary>
      <ul className="absolute right-0 z-10 mt-1 w-44 rounded border bg-white py-1 shadow-lg">
        {items.map(i => (
          <li key={i.text}>
            {i.href ? (
              <Link href={i.href} onClick={close} className={itemClass(i.danger)}>{i.text}</Link>
            ) : (
              <button type="button" onClick={() => { close(); i.onSelect?.(); }} className={itemClass(i.danger)}>
                {i.text}
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
```
- [ ] **Step 2: `FolderSidebar.tsx`** (client, computer only). Props:
```ts
{ folders: FolderRow[]; currentId: string | null; onOpen: (id: string | null) => void;
  onRename: (f: FolderRow) => void; onMove: (f: FolderRow) => void; onDelete: (f: FolderRow) => void }
```
Root: `<nav aria-label={t.folders[lang]} className="hidden w-48 shrink-0 space-y-0.5 text-sm sm:block">`. First row: a button `📁 {t.allItems[lang]}` → `onOpen(null)`. Then one row per `folderLines(folders)` entry: a `<div className="flex items-center rounded ...">` with `style={{ paddingLeft: 4 + Math.min(f.depth, 6) * 12 }}` containing a `<button className="min-w-0 grow truncate py-1 text-left">📁 {f.name}</button>` → `onOpen(f.id)`, and an `<ActionsMenu trigger="⋯" ariaLabel={t.moreActions[lang]} items={[rename, moveTo, deleteFolder(danger)]} />`. The current row (`currentId`, or All items when null) gets `bg-blue-50 font-semibold`. **Do not put `overflow-hidden` on the row** (it would clip the dropdown); truncate only the name button.
- [ ] **Step 3: `FolderMobileNav.tsx`** (client, phone only; spec §5.1 "on a phone the folder list becomes a ‹ back header"). Same props as the sidebar. Root `<div className="space-y-2 sm:hidden">`.
  - At All items (`currentId === null`): a heading `t.allItems[lang]`.
  - Inside a folder: one row — button `‹ {parent name, or t.allItems if top level}` → `onOpen(current.parent_id)`; the current folder's name (bold, truncated, `grow`); an `ActionsMenu` (rename / move / delete) for the current folder. Parent name: `folders.find(f => f.id === current.parent_id)?.name`.
  - Below: `childFolders(folders, currentId)` as full-width buttons (`📁 name`, `rounded border bg-white px-3 py-2 text-left text-sm`) → `onOpen(f.id)`.
- [ ] **Step 4: `MoveToDialog.tsx`** (client). Props `{ title: string; targets: MoveTarget[]; busy: boolean; onChoose: (id: string | null) => void; onClose: () => void }`. A fixed overlay `<div role="dialog" aria-modal="true" className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>` holding a panel (`onClick={e => e.stopPropagation()}`, `max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-t bg-white p-4 sm:rounded`). Heading: `{t.moveTo[lang]} “{title}”`. One button per target: label `t.topLevel[lang]` for `id === null`, else `📁 {name}`, plus ` · {t.currentPlace[lang]}` when `current`; `disabled={r.disabled || busy}`; `style={{ paddingLeft: 8 + Math.min(r.depth, 7) * 12 }}`; `disabled:text-gray-400`; click → `onChoose(r.id)`. A Cancel button (`t.cancel`). Escape closes (a `keydown` listener in `useEffect`, removed on unmount).
- [ ] **Step 5: `ProductGrid.tsx`.** New props `{ products; shopSlug; emptyText: string; onMove: (p: ProductSummary) => void }`. The empty state shows `emptyText` (the caller decides which text). Grid classes `grid grid-cols-2 gap-4 lg:grid-cols-3`. **Move `overflow-hidden` off the `<li>`** onto the photo box (`aspect-square overflow-hidden rounded-t bg-gray-100`), otherwise the `⋯` dropdown is clipped. The footer is always rendered: `flex items-center justify-between border-t px-3 py-2`, holding the existing preview link (when `shopSlug`) or an empty `<span />`, and `<ActionsMenu trigger="⋯" ariaLabel={t.moreActions[lang]} items={[{ text: t.moveTo[lang], onSelect: () => onMove(p) }]} />`.
- [ ] **Step 6: `CatalogueBrowser.tsx`** (client) — the dashboard body. Write it as:
```tsx
'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { moveTargets, type FolderRow } from '@/lib/catalogue/folders';
import { parseView, viewToQuery, productsInView, type DashboardView } from '@/lib/catalogue/browse';
import { sendJson } from '@/lib/catalogue/send-json';
import type { ProductSummary } from '@/lib/catalogue/summary';
import ActionsMenu from './ActionsMenu';
import FolderSidebar from './FolderSidebar';
import FolderMobileNav from './FolderMobileNav';
import MoveToDialog from './MoveToDialog';
import ProductGrid from './ProductGrid';

type Moving = { kind: 'folder'; folder: FolderRow } | { kind: 'product'; product: ProductSummary };

export default function CatalogueBrowser({ products, folders, shopSlug }: {
  products: ProductSummary[]; folders: FolderRow[]; shopSlug: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [lang] = useLanguage();
  const view = parseView(params, folders);
  const [moving, setMoving] = useState<Moving | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * The address bar holds the view, so Back and refresh keep the owner's place.
   * Next 15 keeps useSearchParams in step with window.history, so this does
   * not reload the page or re-query the database.
   */
  function go(next: DashboardView, mode: 'push' | 'replace' = 'push') {
    const qs = viewToQuery(next);
    const url = qs ? `?${qs}` : window.location.pathname;
    if (mode === 'push') window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
  }

  async function run(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<boolean> {
    setBusy(true);
    setMessage(null);
    const r = await sendJson(url, method, body);
    setBusy(false);
    if (!r.ok) { setMessage(r.error ?? t.saveFailed[lang]); return false; }
    router.refresh();
    return true;
  }

  async function newFolder() {
    const name = window.prompt(t.folderNamePrompt[lang]);
    if (name === null || !name.trim()) return;
    await run('/api/folders', 'POST', { name: name.trim(), parent_id: view.folderId });
  }
  async function renameFolder(f: FolderRow) {
    const name = window.prompt(t.folderNamePrompt[lang], f.name);
    if (name === null || !name.trim() || name.trim() === f.name) return;
    await run(`/api/folders/${f.id}`, 'PATCH', { name: name.trim() });
  }
  async function deleteFolder(f: FolderRow) {
    const target = folders.find(x => x.id === f.parent_id)?.name ?? t.topLevel[lang];
    const text = t.confirmDeleteFolder[lang].replace('{name}', f.name).replace('{target}', target);
    if (!window.confirm(text)) return;
    const ok = await run(`/api/folders/${f.id}`, 'DELETE');
    if (ok && view.folderId === f.id) go({ ...view, folderId: f.parent_id }, 'replace');
  }
  async function moveTo(targetId: string | null) {
    const m = moving;
    if (!m) return;
    setMoving(null);
    if (m.kind === 'folder') await run(`/api/folders/${m.folder.id}`, 'PATCH', { parent_id: targetId });
    else await run(`/api/products/${m.product.id}`, 'PATCH', { folder_id: targetId });
  }

  const shown = productsInView(products, folders, view);
  const folderProps = {
    folders,
    currentId: view.folderId,
    onOpen: (id: string | null) => go({ ...view, folderId: id }),
    onRename: renameFolder,
    onMove: (f: FolderRow) => setMoving({ kind: 'folder', folder: f }),
    onDelete: deleteFolder,
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ActionsMenu
          trigger={t.newMenu[lang]}
          ariaLabel={t.newMenu[lang]}
          triggerClassName="rounded bg-gray-900 px-4 py-2 text-sm text-white"
          disabled={busy}
          items={[
            { text: t.newFolder[lang], onSelect: newFolder },
            { text: t.newProduct[lang], href: `/dashboard/product/new${view.folderId ? `?folder=${view.folderId}` : ''}` },
          ]}
        />
      </div>
      {message && <p role="alert" className="text-sm text-red-600">{message}</p>}
      <FolderMobileNav {...folderProps} />
      <div className="flex gap-6">
        <FolderSidebar {...folderProps} />
        <div className="min-w-0 grow">
          <ProductGrid
            products={shown}
            shopSlug={shopSlug}
            emptyText={products.length === 0 ? t.noGarments[lang] : t.emptyFolder[lang]}
            onMove={p => setMoving({ kind: 'product', product: p })}
          />
        </div>
      </div>
      {moving && (
        <MoveToDialog
          title={moving.kind === 'folder' ? moving.folder.name : moving.product.name}
          targets={moveTargets(folders, moving.kind === 'folder'
            ? { kind: 'folder', id: moving.folder.id }
            : { kind: 'product', folderId: moving.product.folder_id })}
          busy={busy}
          onChoose={moveTo}
          onClose={() => setMoving(null)}
        />
      )}
    </div>
  );
}
```
- [ ] **Step 7: `app/dashboard/page.tsx`.** Add `folder_id` to the products select; add a fifth query `supabase.from('folders').select('id, name, parent_id').eq('retailer_id', user.id)`. Keep each result object (not just `data`) so errors are visible; if the products, pickers, garments or folders query returns an `error`, `console.error` it and `throw new Error('dashboard data unavailable')` (same as the product page — an empty dashboard would wrongly say "no garments yet"). Remove the `AddProductLink` import and element; the header row keeps only `<h1>`. Render `CopyPublicLink` as now, then:
```tsx
<Suspense fallback={null}>
  <CatalogueBrowser products={cards} folders={(folders ?? []) as FolderRow[]} shopSlug={retailer?.shop_slug ?? null} />
</Suspense>
```
(`Suspense` from `react`; `useSearchParams` inside a dynamic page does not suspend, the boundary is a guard for the build.) Cast products as `{ id: string; name: string; created_at: string; folder_id: string | null }[]`. Delete `app/dashboard/AddProductLink.tsx`.
- [ ] **Step 8:** `npx tsc --noEmit && npm run lint && npm test`. Commit `feat: dashboard folder list, phone back header, Move to…`.

**Acceptance (review):** no `overflow-hidden` on any element that contains an `ActionsMenu`; folder clicks call `go()` (no `router.push`); every write calls `router.refresh()` after success; the shopper pages are untouched (`git diff --stat origin/main -- app/shop` is empty).

---

### Task 9: Docs for 2a

**Files:** Modify `docs/superpowers/resume.md`, `docs/superpowers/decisions-and-lessons.md`.

- [ ] **Step 1: `resume.md`** — snapshot heading to today's date and this branch; Tests row = the real `npm test` count; add a What's live row "Catalogue Stage 2a — folders and Move to…" marked *built, not shipped — PR pending* (the founder's merge makes it shipped; the next agent updates the date); in To do item 1, say Stage 2a is built and 2b (tags, search, sort, Needs attention filter) is next, then Stage 3. File map: add `api/folders/`.
- [ ] **Step 2: `decisions-and-lessons.md`** —
  - §2: fix the stale end of the "Catalogue Stage 1" bullet: since PR #15 / 0006 every garment has a product, the "Garments not in a product yet" section and the no-product code paths are gone.
  - §2: add "Catalogue Stage 2a (built 2026-10-xx)": a folder shows everything below it (open question 1's answer — record what the founder chose); folders listed A–Z; New folder / Rename use `window.prompt`; folder delete moves contents up and is three ordered statements, not a transaction (why it is safe).
  - §4: add "Foreign keys ignore RLS, and our RLS `with check` only looks at the row being written: a folder's `parent_id`, a product's `folder_id` and a `product_tags.tag_id` can name another shop's row unless app code checks it (`checkFolderOwnership`, `checkFolderMove`, and in 2b the tag checks)." and "`.eq(col, null)` never matches NULL; use `.is(col, null)`."
  - §3: add "The dashboard's view (folder, and in 2b search/tags/sort/filter) lives in the address bar via `window.history.pushState/replaceState`; Next 15 keeps `useSearchParams` in step, so Back works and nothing reloads. Don't switch to `router.push` for it — that re-runs every dashboard query."
- [ ] **Step 3:** Commit `docs: record catalogue stage 2a`.

---

### Task 10: Gates, push, report (2a)

- [ ] **Step 1:** `git fetch origin && git merge origin/main` (never rebase). Resolve conflicts keeping both sides' intent.
- [ ] **Step 2:** `npm install` if `package-lock.json` changed upstream (then `git checkout -- package-lock.json` if it is only dirtied). `.env.local` copied from the main checkout. No dev server running. `npm test && npm run build` — both green.
- [ ] **Step 3:** Update the test count in `resume.md` if it changed; commit. `git push -u origin feature/catalogue-stage-2`.
- [ ] **Step 4: Report to `god`:** head sha, test count, build result, the compare link
  `https://github.com/ingkawatlimvipuwat-sys/fit-mvp/compare/main...feature/catalogue-stage-2?expand=1`,
  "no migration — nothing to run in Supabase", the **preview uses the LIVE database** warning, and this checklist:

#### Preview checklist 2a (phone AND computer)

Use only folders named **TEST ลบได้ …** and a product named **TEST ลบได้ / delete me**; delete them at the end.
1. Dashboard: computer shows a folder list on the left starting with "ทั้งหมด / All items"; every product is still there, newest first. Phone shows "ทั้งหมด" with no side list.
2. **+ สร้าง ▾ → โฟลเดอร์ใหม่** "TEST ลบได้ A" → it appears at the top level.
3. Open A → **+ สร้าง ▾ → โฟลเดอร์ใหม่** "TEST ลบได้ B" → shown indented under A.
4. In B → **+ สร้าง ▾ → เพิ่มสินค้า** "TEST ลบได้ / delete me" → back on the dashboard it shows in B, in A, and in All items.
5. Card **⋯ → ย้ายไปที่…**: B is marked "อยู่ที่นี่" and greyed; choose **ระดับบนสุด** → it leaves A and B, still in All items.
6. Folder A **⋯ → ย้ายไปที่…**: A and B are greyed (a folder can't go inside itself).
7. B **⋯ → เปลี่ยนชื่อ** → "TEST ลบได้ C". Move the product into C.
8. A **⋯ → ลบโฟลเดอร์**: the message says the contents move to ระดับบนสุด → A is gone, C is now top level, the product is still in C.
9. Phone: open C → header shows "‹ ทั้งหมด"; tap it to go back. Browser Back returns to the folder you were in. Refresh keeps the folder.
10. Shopper side unchanged: the shop page and an old garment link look as before (shoppers never see folders).
11. Clean up: delete the product (product page → ลบ), then delete folder C.

---

# Part 2b — tags, search, sort, Needs attention filter

### Task 11: Branch, strings and types (2b)

- [ ] **Step 1:** From the finished 2a tip: `git switch -c feature/catalogue-stage-2b` (do this only after Task 10 is pushed and reviewed). If 2a has been merged by now, `git merge origin/main` first.
- [ ] **Step 2:** `lib/supabase/types.ts`: add
```ts
export interface Tag { id: string; retailer_id: string; name: string; created_at: string }
```
- [ ] **Step 3:** `lib/i18n/strings.ts`, under `// Catalogue Stage 2b — find`:

| key | th | en |
|---|---|---|
| `searchProducts` | ค้นหาชื่อสินค้า | Search product names |
| `tags` | แท็ก | Tags |
| `filterByTag` | + กรองด้วยแท็ก | + Filter by tag |
| `addTagPlaceholder` | เพิ่มแท็ก แล้วกด Enter | Add a tag, then press Enter |
| `removeTag` | เอาแท็ก {name} ออก | Remove tag {name} |
| `invalidTagName` | ชื่อแท็กต้องยาว 1–30 ตัวอักษร | Tag names must be 1–30 characters |
| `sortLabel` | เรียงตาม | Sort |
| `sortNewest` | ใหม่สุด | Newest |
| `sortOldest` | เก่าสุด | Oldest |
| `sortNameAZ` | ชื่อ ก–ฮ, A–Z | Name A–Z |
| `sortNameZA` | ชื่อ ฮ–ก, Z–A | Name Z–A |
| `noMatches` | ไม่พบสินค้าที่ตรงกับตัวกรอง | No products match these filters |
| `clearFilters` | ล้างตัวกรอง | Clear filters |

- [ ] **Step 4:** `npx tsc --noEmit && npm test`. Commit `feat: strings and Tag type for catalogue stage 2b`.

---

### Task 12: Tag logic (`lib/catalogue/tags.ts`, `parseTagName`)

**Files:** Create `lib/catalogue/tags.ts`, `lib/catalogue/tags.test.ts`; Modify `lib/catalogue/parse.ts`, `parse.test.ts`.

- [ ] **Step 1: Failing tests** — `tags.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { normTag, findTagByName, tagsOfProduct, tagsInUse, tagSuggestions, type TagRow } from './tags';

const TAGS: TagRow[] = [{ id: 's', name: 'Summer' }, { id: 'a', name: 'Sale' }, { id: 'o', name: 'Old typo' }];
const LINKS = [
  { product_id: 'P1', tag_id: 's' }, { product_id: 'P1', tag_id: 'a' },
  { product_id: 'P2', tag_id: 'a' },
  { product_id: 'P1', tag_id: 'foreign' }, // another shop's tag id: never shown
];

describe('normTag', () => { it('trims and lowercases', () => { expect(normTag('  SALE ')).toBe('sale'); }); });

describe('findTagByName', () => {
  it('matches trimmed and case-insensitively', () => { expect(findTagByName(TAGS, ' sale ')?.id).toBe('a'); });
  it('null when absent', () => { expect(findTagByName(TAGS, 'Winter')).toBe(null); });
});

describe('tagsOfProduct', () => {
  it("a product's own tags, A–Z, ignoring ids outside the shop's tags", () => {
    expect(tagsOfProduct('P1', TAGS, LINKS).map(t => t.name)).toEqual(['Sale', 'Summer']);
  });
  it('none', () => { expect(tagsOfProduct('P3', TAGS, LINKS)).toEqual([]); });
});

describe('tagsInUse (open question 2: a tag on no product is hidden)', () => {
  it('only tags on at least one product, A–Z', () => {
    expect(tagsInUse(TAGS, LINKS).map(t => t.id)).toEqual(['a', 's']);
  });
});

describe('tagSuggestions', () => {
  it('in-use tags not already on this product', () => {
    expect(tagSuggestions(tagsInUse(TAGS, LINKS), tagsOfProduct('P2', TAGS, LINKS)).map(t => t.id)).toEqual(['s']);
  });
});
```
Append to `parse.test.ts`:
```ts
describe('parseTagName', () => {
  it('trims; 1–30 characters; Thai message', () => {
    expect(parseTagName(' Sale ')).toEqual({ ok: true, value: 'Sale' });
    expect(parseTagName('x'.repeat(30)).ok).toBe(true);
    expect(parseTagName('x'.repeat(31))).toEqual({ ok: false, error: t.invalidTagName.th });
    expect(parseTagName('').ok).toBe(false);
  });
});
```
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** `parse.ts`: `export const parseTagName = (raw: unknown) => named(raw, 30, t.invalidTagName.th);`

`lib/catalogue/tags.ts`:
```ts
export interface TagRow { id: string; name: string }
export interface ProductTagRow { product_id: string; tag_id: string }

/** Tags compare trimmed and case-insensitively, like the database's unique index on lower(name). */
export const normTag = (s: string): string => s.normalize('NFC').trim().toLowerCase();

const byName = (a: TagRow, b: TagRow) =>
  a.name.localeCompare(b.name, ['th', 'en'], { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id);

export function findTagByName(tags: TagRow[], name: string): TagRow | null {
  const n = normTag(name);
  return tags.find(tag => normTag(tag.name) === n) ?? null;
}

/** One product's tags, A–Z. Links to ids outside `tags` (the caller's own) are ignored. */
export function tagsOfProduct(productId: string, tags: TagRow[], links: ProductTagRow[]): TagRow[] {
  const ids = new Set(links.filter(l => l.product_id === productId).map(l => l.tag_id));
  return tags.filter(tag => ids.has(tag.id)).sort(byName);
}

/** The shop's tags that are on at least one product, A–Z. A tag on no product is hidden everywhere. */
export function tagsInUse(tags: TagRow[], links: ProductTagRow[]): TagRow[] {
  const used = new Set(links.map(l => l.tag_id));
  return tags.filter(tag => used.has(tag.id)).sort(byName);
}

/** Suggestions while typing on a product page: tags in use that this product does not have yet. */
export function tagSuggestions(inUse: TagRow[], attached: TagRow[]): TagRow[] {
  const on = new Set(attached.map(tag => tag.id));
  return inUse.filter(tag => !on.has(tag.id));
}
```
- [ ] **Step 4: Run, expect PASS.** Commit `feat: tag matching, tags in use, suggestions`.

---

### Task 13: Shop-scoped tag reads, attach and detach

**Files:** Modify `lib/catalogue/ownership.ts`, `ownership.test.ts`; Create `lib/catalogue/tag-ops.ts`, `tag-ops.test.ts`.

- [ ] **Step 1: Failing tests.** In `ownership.test.ts`, mirror Task 3's folder tests for `loadShopTags` (lists only the caller's tags; 500 on error) and `checkTagOwnership` (own → ok; another shop's or unknown → 404; error → 500), with data `{ tags: [{ id: 'T1', retailer_id: 'A', name: 'Sale' }, { id: 'T2', retailer_id: 'B', name: 'Theirs' }] }`.

`tag-ops.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { attachTagByName, detachTag } from './tag-ops';
import { fakeSupabase, type Row } from './fake-supabase';

const UNIQUE = {
  tags: (r: Row) => `${r.retailer_id}|${String(r.name).toLowerCase()}`,
  product_tags: (r: Row) => `${r.product_id}|${r.tag_id}`,
};
function db(): Record<string, Row[]> {
  return {
    tags: [
      { id: 'T1', retailer_id: 'A', name: 'Sale' },
      { id: 'TB', retailer_id: 'B', name: 'Summer' },
    ],
    product_tags: [],
  };
}

describe('attachTagByName', () => {
  it('reuses an existing tag, case-insensitively', async () => {
    const f = fakeSupabase(db(), { unique: UNIQUE });
    expect(await attachTagByName(f.client, 'A', 'P1', 'sALE')).toMatchObject({ ok: true, tag: { id: 'T1' } });
    expect(f.tables.tags).toHaveLength(2);
    expect(f.tables.product_tags).toMatchObject([{ product_id: 'P1', tag_id: 'T1' }]);
  });
  it("creates a new tag for the caller, never reusing another shop's tag of the same name", async () => {
    const f = fakeSupabase(db(), { unique: UNIQUE });
    const r = await attachTagByName(f.client, 'A', 'P1', 'Summer');
    expect(r.ok && r.tag.id).not.toBe('TB');
    expect(f.tables.tags.filter(x => x.retailer_id === 'A' && x.name === 'Summer')).toHaveLength(1);
    expect(f.tables.product_tags).toMatchObject([{ product_id: 'P1', tag_id: r.ok ? r.tag.id : '' }]);
  });
  it('attaching a tag the product already has is fine', async () => {
    const data = db();
    data.product_tags.push({ product_id: 'P1', tag_id: 'T1' });
    const f = fakeSupabase(data, { unique: UNIQUE });
    expect(await attachTagByName(f.client, 'A', 'P1', 'Sale')).toMatchObject({ ok: true });
    expect(f.tables.product_tags).toHaveLength(1);
  });
  it('fails closed when the tag lookup fails', async () => {
    const f = fakeSupabase(db(), { fail: { table: 'tags', op: 'select' } });
    expect(await attachTagByName(f.client, 'A', 'P1', 'Sale')).toMatchObject({ ok: false, status: 500 });
  });
  it('fails closed on an unexplained duplicate-name clash', async () => {
    const f = fakeSupabase(db(), { fail: { table: 'tags', op: 'insert', code: '23505' } });
    expect(await attachTagByName(f.client, 'A', 'P1', 'Winter')).toMatchObject({ ok: false, status: 500 });
    expect(f.tables.product_tags).toHaveLength(0);
  });
  it('fails closed when linking fails for another reason', async () => {
    const f = fakeSupabase(db(), { fail: { table: 'product_tags', op: 'insert', code: 'XX000' } });
    expect(await attachTagByName(f.client, 'A', 'P1', 'Sale')).toMatchObject({ ok: false, status: 500 });
  });
});

describe('detachTag', () => {
  it('removes only the link; the tag itself stays', async () => {
    const data = db();
    data.product_tags.push({ product_id: 'P1', tag_id: 'T1' }, { product_id: 'P2', tag_id: 'T1' });
    const f = fakeSupabase(data);
    expect(await detachTag(f.client, 'A', 'P1', 'T1')).toEqual({ ok: true });
    expect(f.tables.product_tags).toEqual([{ product_id: 'P2', tag_id: 'T1' }]);
    expect(f.tables.tags).toHaveLength(2);
  });
  it("another shop's tag id is 404 and nothing is deleted", async () => {
    const f = fakeSupabase(db());
    expect(await detachTag(f.client, 'A', 'P1', 'TB')).toMatchObject({ ok: false, status: 404 });
    expect(f.calls.some(c => c.op === 'delete')).toBe(false);
  });
  it('fails closed when the delete fails', async () => {
    const f = fakeSupabase(db(), { fail: { table: 'product_tags', op: 'delete' } });
    expect(await detachTag(f.client, 'A', 'P1', 'T1')).toMatchObject({ ok: false, status: 500 });
  });
});
```
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** In `ownership.ts` (import `type TagRow` from `./tags`), same pattern as the folder functions:
```ts
export async function loadShopTags(supabase: SupabaseClient, userId: string):
  Promise<{ ok: true; tags: TagRow[] } | Failure> {
  const { data, error } = await supabase.from('tags').select('id, name').eq('retailer_id', userId);
  if (error) { console.error('tags lookup failed:', error); return fail500; }
  return { ok: true, tags: (data ?? []) as TagRow[] };
}

export async function checkTagOwnership(supabase: SupabaseClient, userId: string, tagId: string):
  Promise<{ ok: true } | Failure> {
  const { data, error } = await supabase
    .from('tags').select('id').eq('id', tagId).eq('retailer_id', userId).maybeSingle();
  if (error) { console.error('tag ownership lookup failed:', error); return fail500; }
  return data ? { ok: true } : fail404;
}
```
`lib/catalogue/tag-ops.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { t } from '@/lib/i18n/strings';
import { checkTagOwnership, loadShopTags, type Failure } from './ownership';
import { findTagByName, type TagRow } from './tags';

const fail500: Failure = { ok: false, status: 500, error: t.saveFailed.th };
const UNIQUE_VIOLATION = '23505';

/**
 * Attach a tag to a product by name (spec §5.2: typing an existing tag reuses
 * it; a new word creates it). The product must already be verified as the
 * caller's (loadProductContext). The tag is only ever looked up among the
 * caller's own tags, so another shop's tag can never be linked (product_tags
 * RLS checks only the product side).
 */
export async function attachTagByName(
  supabase: SupabaseClient, userId: string, productId: string, name: string,
): Promise<{ ok: true; tag: TagRow } | Failure> {
  const loaded = await loadShopTags(supabase, userId);
  if (!loaded.ok) return loaded;
  let tag = findTagByName(loaded.tags, name);

  if (!tag) {
    const { data, error } = await supabase
      .from('tags').insert({ retailer_id: userId, name }).select('id, name').single();
    if (error?.code === UNIQUE_VIOLATION) {
      // Created a moment ago (another tab): read again and reuse it.
      const again = await loadShopTags(supabase, userId);
      if (!again.ok) return again;
      tag = findTagByName(again.tags, name);
      if (!tag) { console.error('tag name clash but no matching tag found:', name); return fail500; }
    } else if (error || !data) {
      console.error('tag insert failed:', error);
      return fail500;
    } else {
      tag = data as TagRow;
    }
  }

  const { error: linkErr } = await supabase.from('product_tags').insert({ product_id: productId, tag_id: tag.id });
  if (linkErr && linkErr.code !== UNIQUE_VIOLATION) { // already attached is fine
    console.error('product tag insert failed:', linkErr);
    return fail500;
  }
  return { ok: true, tag };
}

/** Remove one tag from one (already verified) product. Another shop's tag id is a 404. The tag row stays. */
export async function detachTag(
  supabase: SupabaseClient, userId: string, productId: string, tagId: string,
): Promise<{ ok: true } | Failure> {
  const owns = await checkTagOwnership(supabase, userId, tagId);
  if (!owns.ok) return owns;
  const { error } = await supabase.from('product_tags').delete().eq('product_id', productId).eq('tag_id', tagId);
  if (error) { console.error('product tag delete failed:', error); return fail500; }
  return { ok: true };
}
```
`Failure` is already exported from `ownership.ts`.
- [ ] **Step 4: Run, expect PASS.** `npx tsc --noEmit && npm run lint`. Commit `feat: shop-scoped tag reads, attach by name, detach`.

**Acceptance:** no code path accepts a tag **id** for attaching; detach checks the tag id against the caller's tags first.

---

### Task 14: Search, tag filter, attention filter, sort; cards carry tags

**Files:** Modify `lib/catalogue/browse.ts`, `browse.test.ts`, `lib/catalogue/summary.ts`, `summary.test.ts`.

- [ ] **Step 1: Failing tests.** Rewrite `browse.test.ts` for the full view (the 2a cases stay, with the new shape):
```ts
import { describe, it, expect } from 'vitest';
import { parseView, viewToQuery, productsInView, sortProducts, matchesSearch, isFiltered, DEFAULT_VIEW, type DashboardView } from './browse';
import type { FolderRow } from './folders';

const FOLDERS: FolderRow[] = [
  { id: 'shirts', name: 'Shirts', parent_id: null },
  { id: 'linen', name: 'Linen', parent_id: 'shirts' },
  { id: 'trousers', name: 'Trousers', parent_id: null },
];
const TAG_IDS = ['sale', 'summer'];
const P = (id: string, name: string, created_at: string, folder_id: string | null, tags: string[] = [], needsAttention = false) =>
  ({ id, name, created_at, folder_id, needsAttention, tags: tags.map(t => ({ id: t, name: t })) });
const PRODUCTS = [
  P('p1', 'Linen Shirt', '2026-03-01', 'linen', ['sale', 'summer']),
  P('p2', 'linen tunic', '2026-02-01', 'linen', ['sale'], true),
  P('p3', 'Chinos', '2026-04-01', 'trousers', ['summer']),
  P('p4', 'เสื้อลินิน', '2026-01-01', null),
];
const qs = (s: string) => new URLSearchParams(s);
const V = (over: Partial<DashboardView>): DashboardView => ({ ...DEFAULT_VIEW, ...over });
const ids = (xs: { id: string }[]) => xs.map(x => x.id);

describe('parseView', () => {
  it('reads every field', () => {
    expect(parseView(qs('folder=linen&q=shirt&tags=sale,summer&sort=az&attention=1'), FOLDERS, TAG_IDS))
      .toEqual({ folderId: 'linen', q: 'shirt', tagIds: ['sale', 'summer'], sort: 'az', attention: true });
  });
  it('defaults', () => { expect(parseView(qs(''), FOLDERS, TAG_IDS)).toEqual(DEFAULT_VIEW); });
  it('drops unknown folders, unknown or repeated tags and bad sorts', () => {
    expect(parseView(qs('folder=zzz&tags=sale,zzz,sale&sort=price'), FOLDERS, TAG_IDS))
      .toEqual(V({ tagIds: ['sale'] }));
  });
  it('caps the search at 100 characters', () => {
    expect(parseView(qs(`q=${'x'.repeat(150)}`), FOLDERS, TAG_IDS).q).toHaveLength(100);
  });
});

describe('viewToQuery', () => {
  it('the default view is the empty query', () => { expect(viewToQuery(DEFAULT_VIEW)).toBe(''); });
  it('round-trips', () => {
    const v = V({ folderId: 'linen', q: 'เสื้อ', tagIds: ['sale', 'summer'], sort: 'za', attention: true });
    expect(parseView(qs(viewToQuery(v)), FOLDERS, TAG_IDS)).toEqual(v);
  });
  it('omits a blank search', () => { expect(viewToQuery(V({ q: '   ' }))).toBe(''); });
});

describe('matchesSearch', () => {
  it('substring, trimmed, case-insensitive; blank matches all', () => {
    expect(matchesSearch('Linen Shirt', '  SHIRT ')).toBe(true);
    expect(matchesSearch('Linen Shirt', 'tunic')).toBe(false);
    expect(matchesSearch('เสื้อลินิน', 'ลินิน')).toBe(true);
    expect(matchesSearch('anything', '')).toBe(true);
  });
});

describe('sortProducts', () => {
  it('newest and oldest by created_at', () => {
    expect(ids(sortProducts(PRODUCTS, 'newest'))).toEqual(['p3', 'p1', 'p2', 'p4']);
    expect(ids(sortProducts(PRODUCTS, 'oldest'))).toEqual(['p4', 'p2', 'p1', 'p3']);
  });
  it('name A–Z and Z–A, case-insensitive', () => {
    const latin = PRODUCTS.slice(0, 3);
    expect(ids(sortProducts(latin, 'az'))).toEqual(['p3', 'p1', 'p2']);
    expect(ids(sortProducts(latin, 'za'))).toEqual(['p2', 'p1', 'p3']);
  });
  it('does not change the input array', () => {
    const copy = [...PRODUCTS];
    sortProducts(PRODUCTS, 'az');
    expect(PRODUCTS).toEqual(copy);
  });
});

describe('productsInView', () => {
  it('All items, no filters: every product, newest first', () => {
    expect(ids(productsInView(PRODUCTS, FOLDERS, DEFAULT_VIEW))).toEqual(['p3', 'p1', 'p2', 'p4']);
  });
  it('a folder covers everything below it', () => {
    expect(ids(productsInView(PRODUCTS, FOLDERS, V({ folderId: 'shirts' })))).toEqual(['p1', 'p2']);
  });
  it('search covers the current folder and below only', () => {
    expect(ids(productsInView(PRODUCTS, FOLDERS, V({ folderId: 'trousers', q: 'linen' })))).toEqual([]);
    expect(ids(productsInView(PRODUCTS, FOLDERS, V({ q: 'linen' })))).toEqual(['p1', 'p2']);
  });
  it('several tags = products having ALL of them', () => {
    expect(ids(productsInView(PRODUCTS, FOLDERS, V({ tagIds: ['sale'] })))).toEqual(['p1', 'p2']);
    expect(ids(productsInView(PRODUCTS, FOLDERS, V({ tagIds: ['sale', 'summer'] })))).toEqual(['p1']);
  });
  it('Needs attention keeps only flagged products', () => {
    expect(ids(productsInView(PRODUCTS, FOLDERS, V({ attention: true })))).toEqual(['p2']);
  });
  it('filters combine', () => {
    expect(ids(productsInView(PRODUCTS, FOLDERS, V({ folderId: 'linen', tagIds: ['summer'], q: 'shirt' })))).toEqual(['p1']);
  });
});

describe('isFiltered', () => {
  it('search, tags or attention count; folder and sort do not', () => {
    expect(isFiltered(V({ folderId: 'linen', sort: 'az' }))).toBe(false);
    expect(isFiltered(V({ q: ' x ' }))).toBe(true);
    expect(isFiltered(V({ tagIds: ['sale'] }))).toBe(true);
    expect(isFiltered(V({ attention: true }))).toBe(true);
  });
});
```
Append to `summary.test.ts`:
```ts
describe('summariseProducts tags', () => {
  it("attaches each product's own tags A–Z; none when tagging is omitted", () => {
    const tags = [{ id: 'b', name: 'Summer' }, { id: 'a', name: 'Sale' }];
    const links = [{ product_id: 'P1', tag_id: 'b' }, { product_id: 'P1', tag_id: 'a' }, { product_id: 'P1', tag_id: 'foreign' }];
    const [p] = summariseProducts([prod('P1', '2026-01-01')], [], [], { tags, productTags: links });
    expect(p.tags.map(x => x.name)).toEqual(['Sale', 'Summer']);
    expect(summariseProducts([prod('P1', '2026-01-01')], [], [])[0].tags).toEqual([]);
  });
});
```
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Replace `lib/catalogue/browse.ts` with:
```ts
import { subtreeIds, type FolderRow } from './folders';

export type SortKey = 'newest' | 'oldest' | 'az' | 'za';
const SORTS: readonly SortKey[] = ['newest', 'oldest', 'az', 'za'];

/** What the dashboard is showing. Lives in the address bar (see viewToQuery). */
export interface DashboardView {
  /** null = All items. */
  folderId: string | null;
  /** As typed (matching trims it). */
  q: string;
  /** Products must have ALL of these (spec §5.1). */
  tagIds: string[];
  sort: SortKey;
  /** ⚠ Needs attention only. */
  attention: boolean;
}
export const DEFAULT_VIEW: DashboardView = { folderId: null, q: '', tagIds: [], sort: 'newest', attention: false };

/** What productsInView needs from a card (ProductSummary has all of it). */
export interface ViewProduct {
  id: string; name: string; created_at: string; folder_id: string | null;
  needsAttention: boolean; tags: { id: string }[];
}

interface ParamsLike { get(name: string): string | null }

/**
 * Read the view from the address bar. Unknown folders (deleted, or another
 * shop's) fall back to All items; unknown tag ids and sorts are dropped.
 */
export function parseView(params: ParamsLike, folders: FolderRow[], knownTagIds: string[]): DashboardView {
  const folder = params.get('folder');
  const known = new Set(knownTagIds);
  const sort = params.get('sort') as SortKey | null;
  return {
    folderId: folder && folders.some(f => f.id === folder) ? folder : null,
    q: (params.get('q') ?? '').slice(0, 100),
    tagIds: [...new Set((params.get('tags') ?? '').split(',').filter(id => known.has(id)))],
    sort: sort !== null && SORTS.includes(sort) ? sort : 'newest',
    attention: params.get('attention') === '1',
  };
}

/** The query string for a view, without the leading '?'. Empty for the default view. */
export function viewToQuery(view: DashboardView): string {
  const p = new URLSearchParams();
  if (view.folderId) p.set('folder', view.folderId);
  if (view.q.trim()) p.set('q', view.q);
  if (view.tagIds.length > 0) p.set('tags', view.tagIds.join(','));
  if (view.sort !== 'newest') p.set('sort', view.sort);
  if (view.attention) p.set('attention', '1');
  return p.toString();
}

const norm = (s: string) => s.normalize('NFC').trim().toLowerCase();

/** Product-name search: trimmed, case-insensitive substring. A blank search matches everything. */
export function matchesSearch(name: string, q: string): boolean {
  const n = norm(q);
  return n === '' || norm(name).includes(n);
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, ['th', 'en'], { sensitivity: 'base', numeric: true });

/** A sorted copy. Ties fall back to newest first, then id, so the order is stable. */
export function sortProducts<T extends { id: string; name: string; created_at: string }>(products: T[], sort: SortKey): T[] {
  const newest = (a: T, b: T) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id);
  const cmp: (a: T, b: T) => number =
    sort === 'newest' ? newest
    : sort === 'oldest' ? (a, b) => newest(b, a)
    : sort === 'az' ? (a, b) => byName(a, b) || newest(a, b)
    : (a, b) => byName(b, a) || newest(a, b);
  return [...products].sort(cmp);
}

/** Search, tags or ⚠ is on (folder and sort are not "filters" for the empty-state text). */
export const isFiltered = (v: DashboardView): boolean => v.q.trim() !== '' || v.tagIds.length > 0 || v.attention;

/**
 * The cards a view shows. Folder scope: All items = every product; a folder =
 * products in it or any folder below it (open question 1). Search, tags and
 * ⚠ apply within that scope (spec §5.1). Then sorted.
 */
export function productsInView<T extends ViewProduct>(products: T[], folders: FolderRow[], view: DashboardView): T[] {
  const scope = view.folderId === null ? null : subtreeIds(folders, view.folderId);
  return sortProducts(products.filter(p =>
    (scope === null || (p.folder_id !== null && scope.has(p.folder_id)))
    && matchesSearch(p.name, view.q)
    && view.tagIds.every(id => p.tags.some(tag => tag.id === id))
    && (!view.attention || p.needsAttention),
  ), view.sort);
}
```
`summary.ts`: `import { tagsOfProduct, type ProductTagRow, type TagRow } from './tags';` add `tags: TagRow[]` to `ProductSummary`; add a fourth parameter `tagging: { tags: TagRow[]; productTags: ProductTagRow[] } = { tags: [], productTags: [] }` and `tags: tagsOfProduct(p.id, tagging.tags, tagging.productTags),` to the returned object.

`CatalogueBrowser.tsx` must still compile after this task: change its `parseView(params, folders)` call to `parseView(params, folders, [])` for now (Task 17 passes the real tag ids).
- [ ] **Step 4: Run, expect PASS.** `npx tsc --noEmit && npm run lint && npm test`. Commit `feat: dashboard search, tag filter, attention filter and sort`.

**Acceptance:** `npm test` green; the 2a dashboard still builds.

---

### Task 15: Tag API

**Files:** Create `app/api/products/[id]/tags/route.ts`, `app/api/products/[id]/tags/[tagId]/route.ts`.

- [ ] **Step 1: `POST /api/products/[id]/tags`** — body `{ name }`:
```ts
const AttachBody = z.object({ name: z.string() }).strict();
```
Auth (401) → `z.uuid()` on `params.id` else 404 → body (400 `invalid body`) → `parseTagName` (400 with its Thai error) → `loadProductContext(supabase, user.id, params.id)` (its status) → `attachTagByName(supabase, user.id, params.id, name.value)` (its status) → `{ ok: true, tag }`.
- [ ] **Step 2: `DELETE /api/products/[id]/tags/[tagId]`** — auth → both ids `z.uuid()` else 404 → `loadProductContext` (status) → `detachTag(supabase, user.id, params.id, params.tagId)` (status) → `{ ok: true }`. `type Params = { params: Promise<{ id: string; tagId: string }> }`.
- [ ] **Step 3:** `npx tsc --noEmit && npm run lint && npm test`. Commit `feat: tag API (attach by name, detach)`.

**Acceptance (review):** product ownership is checked before any tag write in both routes.

---

### Task 16: Tags in the product header

**Files:** Create `app/dashboard/product/[id]/ProductTags.tsx`; Modify `app/dashboard/product/[id]/page.tsx`, `ProductEditor.tsx`.

- [ ] **Step 1: `page.tsx`** — add to its `Promise.all`: `supabase.from('tags').select('id, name').eq('retailer_id', user.id)` and `supabase.from('product_tags').select('product_id, tag_id')` (RLS returns only the caller's links; `tagsOfProduct`/`tagsInUse` ignore anything outside the caller's tags anyway). On either error: `console.error` and `throw new Error('product data unavailable')`. Compute `attached = tagsOfProduct(ctx.id, tags, links)` and `suggestions = tagSuggestions(tagsInUse(tags, links), attached)`; pass both to `ProductEditor` as `tags` and `tagSuggestions` (plain arrays of `{ id, name }`).
- [ ] **Step 2: `ProductTags.tsx`** (client). Props `{ productId: string; tags: TagRow[]; suggestions: TagRow[] }`. Renders, in one wrapping row: each tag as a chip `rounded-full border bg-gray-50 px-2 py-0.5 text-xs` with its name and a `✕` button (`aria-label={t.removeTag[lang].replace('{name}', tag.name)}`) → `sendJson(\`/api/products/${productId}/tags/${tag.id}\`, 'DELETE')` → on ok `router.refresh()`; then a `<form onSubmit>` with `<input list="shop-tag-suggestions" maxLength={30} placeholder={t.addTagPlaceholder[lang]} aria-label={t.tags[lang]} …>` and `<datalist id="shop-tag-suggestions">` of `suggestions` names. Submit (Enter, or the phone's Go key): trimmed blank → nothing; else `sendJson(\`/api/products/${productId}/tags\`, 'POST', { name: trimmed })` → ok: clear the input, `router.refresh()`; error: show `r.error ?? t.saveFailed[lang]` under the row (`text-xs text-red-600`). Disable the input while a request runs.
- [ ] **Step 3: `ProductEditor.tsx`** — add props `tags: TagRow[]; tagSuggestions: TagRow[]`; render `<ProductTags productId={productId} tags={tags} suggestions={tagSuggestions} />` directly under the product-name input, inside the existing header `div`. Nothing else in the editor changes.
- [ ] **Step 4:** `npx tsc --noEmit && npm run lint && npm test`. Commit `feat: tags on the product page (typing suggests, Enter creates)`.

---

### Task 17: Dashboard toolbar and tag chips on cards

**Files:** Create `app/dashboard/CatalogueToolbar.tsx`; Modify `app/dashboard/CatalogueBrowser.tsx`, `ProductGrid.tsx`, `app/dashboard/page.tsx`.

- [ ] **Step 1: `page.tsx`** — add the same two queries as Task 16 (`tags` scoped by `retailer_id`; `product_tags`), included in the error check. `cards = summariseProducts(products, pickers, versions, { tags, productTags: links })`. Pass `tags={tagsInUse(tags, links)}` to `CatalogueBrowser`.
- [ ] **Step 2: `CatalogueToolbar.tsx`** (client). Props `{ view: DashboardView; tags: TagRow[]; onChange: (next: DashboardView) => void }`. One row that wraps on a phone (`flex flex-wrap items-center gap-2`):
  - **Search** — `<input type="search" placeholder={t.searchProducts[lang]} className="min-w-[8rem] grow …">` with a local `draft` state. Push it to the view 250 ms after typing stops: `useEffect(() => { const h = setTimeout(() => { if (draft !== view.q) { sent.current = draft; onChange({ ...view, q: draft }); } }, 250); return () => clearTimeout(h); }, [draft])` (disable the exhaustive-deps lint for that one line with a comment saying why). Keep a `sent` ref and resync from the address bar only when the change came from elsewhere (Back, Clear): `useEffect(() => { if (view.q !== sent.current) { sent.current = view.q; setDraft(view.q); } }, [view.q]);` — without the ref, a keystroke typed while the address bar updates would be overwritten.
  - **Tag filter** — a `<select value="">` whose first option is `t.filterByTag[lang]` (empty value) and whose other options are the tags not yet selected; choosing one → `onChange({ ...view, tagIds: [...view.tagIds, id] })`. Hide the select when `tags` is empty. Each selected tag as a chip (`bg-blue-50 border-blue-300`) with `✕` → remove that id.
  - **Sort** — `<select aria-label={t.sortLabel[lang]}>` with `newest`, `oldest`, `az`, `za` → `t.sortNewest/sortOldest/sortNameAZ/sortNameZA`.
  - **⚠ Needs attention** — a toggle button `⚠ {t.needsAttention[lang]}`, `aria-pressed={view.attention}`, highlighted when on.
  - **Clear** — shown only when `isFiltered(view)`: `onChange({ ...view, q: '', tagIds: [], attention: false })` (keeps folder and sort).
- [ ] **Step 3: `CatalogueBrowser.tsx`** — new prop `tags: TagRow[]`; `parseView(params, folders, tags.map(x => x.id))`. Put `<CatalogueToolbar view={view} tags={tags} onChange={v => go(v, 'replace')} />` in the top row to the left of the "+ สร้าง ▾" menu (`flex items-start gap-2`, toolbar `grow`). Folder changes keep using `go(…, 'push')` and keep the other filters (spread `view`). Empty text for `ProductGrid`: `products.length === 0 ? t.noGarments : isFiltered(view) ? t.noMatches : t.emptyFolder`.
- [ ] **Step 4: `ProductGrid.tsx`** — under the version count, when `p.tags.length > 0`, show up to three tag names as small grey chips and `+N` for the rest (mockup: "12 versions · Sale").
- [ ] **Step 5:** `npx tsc --noEmit && npm run lint && npm test`. Commit `feat: dashboard toolbar (search, tag filter, sort, needs attention) and tag chips`.

**Acceptance (review):** filter changes use `replaceState` (Back does not step through every keystroke); folder changes use `pushState`; no `router.push`/`router.replace` for view changes.

---

### Task 18: Docs for 2b

- [ ] **Step 1: `resume.md`** — snapshot, test count; What's live row "Catalogue Stage 2b — tags, search, sort, Needs attention filter" (*built, not shipped — PR pending*); To do item 1 → "Catalogue Stage 3" only (drag-and-drop, reorder picker values, rough edges from Stages 1–2, and tag rename/delete if open question 2 was deferred).
- [ ] **Step 2: `decisions-and-lessons.md`** — §2 "Catalogue Stage 2b": tags attach by name only, never by id (why: `product_tags` RLS checks only the product); a tag on no product is hidden, not deleted (open question 2's answer); search = product names only; several tags = AND; the dashboard filters in the browser over one load of the shop's products. §5: the catalogue's multi-statement lib functions are tested with `lib/catalogue/fake-supabase.ts` — it checks call order and `retailer_id` scoping, not real SQL or RLS.
- [ ] **Step 3:** Commit `docs: record catalogue stage 2b`.

---

### Task 19: Gates, push, report (2b)

- [ ] **Step 1:** If 2a is merged: `git fetch origin && git merge origin/main`. If it is not merged yet: still push 2b, but tell `god` the compare page will also show 2a's commits until 2a is merged, and the founder must merge 2a first.
- [ ] **Step 2:** `npm test && npm run build` green (no dev server, `.env.local` present). Update the test count; commit.
- [ ] **Step 3:** `git push -u origin feature/catalogue-stage-2b`.
- [ ] **Step 4: Report to `god`:** sha, test count, build, compare link `https://github.com/ingkawatlimvipuwat-sys/fit-mvp/compare/main...feature/catalogue-stage-2b?expand=1`, "no migration", the LIVE-database warning, and:

#### Preview checklist 2b (phone AND computer)

Use only a product named **TEST ลบได้ / delete me**; delete it at the end.
1. Create the TEST product. In its header type "TEST tag" + Enter → a chip appears. Type "test TAG" + Enter → still one chip (the same tag was reused). Add "TEST tag2".
2. Dashboard: the TEST card shows both tags. **+ กรองด้วยแท็ก → TEST tag** → only the TEST product; add **TEST tag2** → still only it; remove both filters.
3. Search "delete me" → only the TEST product. Search "ลบได้" → it too.
4. Sort: ชื่อ ก–ฮ, ชื่อ ฮ–ก, เก่าสุด, ใหม่สุด each reorder the cards.
5. **⚠ ต้องแก้ไข** → the TEST product is listed (it has no versions yet).
6. Open a folder, search: only that folder and the folders inside it are searched.
7. Open a product from a filtered list, press Back → the search and filters are still there. Refresh keeps them.
8. On the product page remove both tags (✕) → they disappear from the dashboard tag filter and from the suggestions.
9. Shop pages unchanged; shoppers never see tags.
10. Delete the TEST product. (Its two tag rows stay in the database, invisible because no product uses them — expected.)

---

## Self-review

- **Spec coverage (Stage 2):** folders side list with nesting (Tasks 2, 8), phone back header (8), create (6, 8), rename (6, 8), delete moves up — rule 6 (4, 6, 8), Move to… for products and folders (2, 4, 6, 7, 8), New folder / New product in the current folder (7, 8), rule 5 cycle refusal incl. deep descendants (2, 4, 6), tags create/attach/filter (12, 13, 15, 16, 17), search and sort (14, 17), Needs attention filter (14, 17 — the §5.5 rules themselves were built and tested in Stage 1), search/filter scope = current folder and below (14). Rule 2 ownership: folder ids (3, 4, 6, 7), tag ids (13, 15), product ids (existing `loadProductContext`). §7: ownership failures are 404, cycle is a plain 409 message, nothing moves.
- **§9 tests:** folder delete moves children up; cycle rejection including deep descendants; every new ownership check rejects another shop's folder / tag id (product and picker were Stage 1).
- **Not in this plan (Stage 3 or never):** drag-and-drop, reordering picker values or folders, tag rename/delete, bulk move, shopper-facing anything.
- **Names used across tasks:** `FolderRow`, `FolderLine`, `folderLines`, `childFolders`, `subtreeIds`, `wouldCreateCycle`, `ancestors`, `MoveTarget`, `moveTargets`, `parseFolderName`, `parseTagName`, `loadShopFolders`, `checkFolderOwnership`, `loadShopTags`, `checkTagOwnership`, `fakeSupabase`, `checkFolderMove`, `deleteFolderMovingUp`, `OpResult`, `DashboardView`, `DEFAULT_VIEW`, `SortKey`, `ViewProduct`, `parseView`, `viewToQuery`, `matchesSearch`, `sortProducts`, `isFiltered`, `productsInView`, `TagRow`, `ProductTagRow`, `normTag`, `findTagByName`, `tagsOfProduct`, `tagsInUse`, `tagSuggestions`, `attachTagByName`, `detachTag`, `sendJson`.
