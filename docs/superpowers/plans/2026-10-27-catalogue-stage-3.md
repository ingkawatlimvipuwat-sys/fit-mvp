# Catalogue Stage 3 Implementation Plan — finishing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The four pieces the founder chose on 2026-10-27:
1. **Drag-and-drop on a computer** — drag a product card or a folder onto a folder in the left list (or onto "ทั้งหมด / All items" = top level) to move it. Phones keep **⋯ → Move to…**.
2. **Reorder picker values** with ↑ ↓ buttons on the product page (phone and computer); shoppers see each picker's values in that order.
3. **Rename and delete tags shop-wide** from a **🏷 จัดการแท็ก / Manage tags** panel on the dashboard.
4. **In-page name boxes** instead of `window.prompt` for New folder and Rename folder (the same component renames tags).

**Spec:** `docs/superpowers/specs/2026-10-01-catalogue-organisation-design.md` — §3 rules 2 and 5, §4.5 (Stage 3 value order "needs its own small column"), §5.1 ("computer — drag a card onto a folder in the left list (Stage 3)"), §7 errors, §8 Stage 3.

**Architecture:** One additive migration, `0008_picker_value_order.sql` (already written by the planner, Task 0): `product_pickers.value_order text[] not null default '{}'`. Every new rule is a pure function in `lib/catalogue/` with unit tests: `orderedValues` / `moveItem` (picks.ts), `dropVerdict` (folders.ts), `tagUsage` / `tagNameClash` (tags.ts), and two shop-scoped database sequences `renameTag` / `deleteTag` (tag-ops.ts, tested with `fake-supabase.ts`). Drag-and-drop is **native HTML5** (no library) and reuses the existing move routes, so rule 5 stays enforced by `checkFolderMove` on the server; the browser only decides what to highlight. New UI pieces are small client components that take their side effects as props (`onSubmit`, `onSave`, `onDropOn`…), so jsdom component tests need no router or fetch mocks.

**Tech stack:** Next.js 15.5 App Router, React 19, Supabase (untyped client, RLS), zod 4, Vitest 4 (+ jsdom, @testing-library/react), Tailwind 3. **No new dependency.**

**Baseline (planner, 2026-10-27, branch at `origin/main` `ba4f7ca`):** `npm test` = **428 passed, 44 files**. `npx tsc --noEmit` reports one pre-existing error, `lib/garment/colour-fabric-regression.test.ts(49,70)` (`present` on `FabricParse`) — known (resume.md, Housekeeping), not yours to fix; vitest and `next build` do not type-check that file. Any **other** tsc error is yours.

---

## Why native drag-and-drop, not a library

- The only drop targets are rows of one list (the folder sidebar) and the only gesture is "pick up, drop on a row". No sorting animations, no drop between items, no touch. Native `draggable` + `dragover`/`drop` covers exactly that in Chrome, Edge, Firefox and Safari on a computer.
- The founder decided phones keep **Move to…**, so the main reason to take a library (touch support: dnd-kit, react-dnd's touch backend) does not apply.
- A library adds ~10–30 kB to the dashboard and a dependency to keep patched (`npm audit` already carries two advisories via Next). No concrete benefit here.
- Known native quirks are handled in the plan, not by a library: Firefox needs `dataTransfer.setData` in `dragstart`; Chrome can cancel a drag if the DOM changes during `dragstart` (state updates are deferred with `setTimeout(…, 0)`); a refused drop fires `dragleave` before `dragend` (the plan never relies on `dragleave`); `dragover` cannot read the drag data (the dragged item lives in React state).

---

## Open product questions — for the founder (the plan builds the recommended answer)

1. **Renaming a tag to a name another tag already has.** Tag names are unique per shop, ignoring capitals.
   **Recommended (built):** refuse with a Thai message — "มีแท็กชื่อ “Sale” อยู่แล้ว กรุณาใช้ชื่ออื่น". Nothing changes. The owner can delete one of the two tags first if they really mean them to be one.
   *Alternative:* merge — the renamed tag's products move onto the existing tag and the renamed tag disappears. It cannot be undone and is easy to trigger by a typo, which is why it is not recommended. Changing later = `renameTag` in `lib/catalogue/tag-ops.ts` plus a confirm message.
2. **Values the owner has not placed yet go to the end.** When a new value appears (a new version with Size "XXL", or a version's Size retyped from "M" to "XL"), shoppers see it **after** the values the owner ordered, until the owner moves it. Before the owner reorders anything, the order is exactly today's (first used).
   **Recommended (built):** yes, end of the list (the founder's own rule in the Stage 3 brief).
3. **The Manage tags panel also lists tags that are on no product** (today they are hidden everywhere), marked "ยังไม่ได้ใช้กับสินค้าใด / Not on any product", so old typos can finally be deleted.
   **Recommended (built):** yes.
4. **Drag-and-drop only where the main pointer is a mouse or trackpad** (`(pointer: fine)`). iPads and touch laptops in tablet mode keep **Move to…** only.
   **Recommended (built):** yes — touch drag in browsers is unreliable and the founder chose Move to… for phones.
5. **One pull request** for all four pieces (~1,500 changed lines, about half of them tests).
   **Recommended (built):** one PR, one preview check, one migration step. If the founder prefers two smaller checks, split after Task 6 (3a = migration + value order, Tasks 1–6; 3b = name boxes, tags, drag-and-drop, Tasks 7–11) — nothing else changes.

**Implementation choices the founder may veto (no answer needed):**
- After any move (drag or Move to…) a grey line says "ย้าย “{name}” ไปที่ {folder} แล้ว", because the moved card usually disappears from the folder being viewed.
- Dropping a folder **back on its own row** is treated as "changed my mind" (nothing happens, no message). Dropping it on one of **its own subfolders** is refused visibly: the row turns red while hovered, a red bar at the bottom of the screen explains why, and after release the red message stays at the top of the page.
- The folder list does not stay pinned while the page scrolls. To drag a card from far down a long list, drag it towards the top edge of the window; the browser scrolls up by itself. (Pinning it would clip the ⋯ menus — see Risks.)
- Value order is set per picker, under the picker's name on the product page, behind a "จัดลำดับ / Reorder" link so the page stays short.
- Folders stay listed A–Z (no manual folder order). Picker *rows* (Size above Colour) are not reorderable in this stage.
- Deleting a tag uses the browser's own confirm box, like every other delete.

---

## Schema facts this plan relies on (from the live migrations)

| Table | Facts that matter here |
|---|---|
| `product_pickers` | `id`, `product_id` → `products` on delete cascade, `name` 1–30, `position`. RLS `product_pickers_owner_all` checks the parent product's `retailer_id`. **After 0008:** `value_order text[] not null default '{}'`. Old code inserts without it (default fills it) and selects named columns only. |
| `tags` | `name` 1–30; **unique index `(retailer_id, lower(name))`** → an update to a taken name fails with `23505`. RLS `tags_owner_all`. |
| `product_tags` | `tag_id` → `tags(id)` **on delete cascade**, `product_id` → `products(id)` on delete cascade. So **deleting a tag row removes every link to it in the same statement** (referential actions run inside the database and are not blocked by RLS). No separate link delete is needed. RLS checks only the product side — the reason tags attach by name only (decisions §2). |
| `folders` / `products` | Unchanged. Moves go through the existing `PATCH /api/folders/[id]` (`checkFolderMove`, rule 5, 409 `folderCycle`) and `PATCH /api/products/[id]` (`checkFolderOwnership`). |

**Shop isolation (rule 2) for the new routes:** `PATCH`/`DELETE /api/tags/[id]` look the tag up among the caller's own tags (`loadShopTags` / `checkTagOwnership`, scoped by `retailer_id`) before any write, and every write carries `.eq('retailer_id', user.id)`. Another shop's tag id answers 404, exactly like a nonexistent id. The picker-order route reuses `loadProductContext` (product scoped by `retailer_id`) and checks the picker id is one of that product's pickers.

**Value order — the rule (one pure function, used by the owner page, the version form's suggestions and the shopper page):**
`orderedValues(versions, pickerId, stored)`:
1. Start from today's list: `valueOrder(versions, pickerId)` — each distinct value (trimmed, case-insensitive) once, in the order the versions were created, shown in the first version's spelling.
2. Walk `stored` (`product_pickers.value_order`) in order; each entry that matches (trimmed, case-insensitive) a value from step 1 is placed next, **in the versions' spelling**. Entries matching nothing (stale: the version was deleted or its pick retyped) are skipped; a repeated entry counts once.
3. Every value not placed yet follows, in first-used order.

What happens when…
| Event | Effect |
|---|---|
| Owner never reordered (`'{}'`) | Exactly today's first-used order. |
| Picker renamed | Nothing: order lives on the picker row, picks are keyed by picker id. |
| Picker removed | Its row (and its order) is deleted with it. |
| Picker added | Starts with `'{}'` = first-used order. |
| A version's pick retyped "M" → "XL" | "M" is stale (skipped; dropped from storage on the next reorder save); "XL" goes after the ordered values. If "M" is typed again later before the next save, it gets its old place back. |
| Case or spaces change only ("black" → "Black ") | Same value: keeps its place. Display spelling = the first-created version's. |
| Version deleted | Its value disappears if no other version uses it (stale entry skipped). |
| A value only on incomplete versions | Shown on the owner page (all versions), not to shoppers (rule 9: complete versions only) — same as today. |

**Saving:** the client sends the whole list it shows; the server stores `orderedValues(currentVersions, pickerId, sentList)` — so stale entries are pruned, unknown strings are dropped, and a value added in another tab since the page loaded is kept (at the end). No 409 for a stale page. Two tabs reordering at once: last save wins.

---

## Standing rules (read before Task 1)

- **The database is live; there is no staging copy.** Never run SQL. Never start the dev server against it, never submit forms or call write APIs. The gates are `npm test` and `npm run build`; the founder checks behaviour on the Vercel preview. Ignore CLAUDE.md's `npm run setup:local` bullet (its script files are missing and this machine is Windows).
- **Do not edit `0008_picker_value_order.sql`.** If you believe it is wrong, stop and report to `god`.
- Zod objects need `.strict()` (CLAUDE.md). Do not touch `lib/fit/rules.ts` / `lib/config/dimensions.ts` imports (circular-import landmine).
- Server error messages are Thai only (`t.<key>.th`). Every user-visible string is a `{ th, en }` key in `lib/i18n/strings.ts`; no English codes in `error` fields.
- A server component may import only *components* from a `'use client'` file; shared functions and constants go in `lib/` (decisions §3).
- No `overflow-hidden`/`overflow-auto` on any element that contains an `ActionsMenu` (it clips the dropdown).
- Component test files start with `// @vitest-environment jsdom`, wrap renders in `<LanguageProvider>`, and call `afterEach(cleanup)` (decisions §5).
- Unused imports and variables fail `next lint` (and so the build) even when tsc is happy.
- Commit with `git commit -m "…" -- <paths>` (never plain `git commit`), ending the message with the trailer your session's instructions give. **Push after every task** (`git push -u origin feature/catalogue-stage-3` the first time, then `git push`) — a PC blue-screen once wiped unpushed work. Never rebase; `git merge origin/main`. Never push `main`, never force-push.
- Never use the words "mother/parent/base/main version" (spec §2). ("Parent folder" is fine.)
- Worktree: `C:\Users\Copter\Documents\Munder logs\worktrees\catalogue-stage-3`, branch `feature/catalogue-stage-3`, `.env.local` already copied (never print or commit it), `npm install` done.
- After every task: `npm test` green and `npx tsc --noEmit` shows only the one known error. After every UI task also `npm run lint`. `npm run build` in Task 13 (never while a dev server runs).

---

## File map

| File | Responsibility |
|---|---|
| `supabase/migrations/0008_picker_value_order.sql` (new, **done**) | `product_pickers.value_order` |
| `lib/catalogue/migration.test.ts` (modify) | 0008 stays additive and idempotent |
| `lib/i18n/strings.ts`, `lib/supabase/types.ts` (modify) | Stage 3 copy; `value_order` on `ProductPicker` |
| `lib/catalogue/picks.ts` (modify) | `PickerDef.value_order?`, `orderedValues`, `moveItem`; `usedValuesByPicker` uses the stored order |
| `lib/catalogue/folders.ts` (modify) | `DragItem`, `DropVerdict`, `DRAG_TYPE`, `dropVerdict` |
| `lib/catalogue/tags.ts` (modify) | `TagUsage`, `tagUsage`, `tagNameClash` |
| `lib/catalogue/tag-ops.ts` (modify) | `renameTag`, `deleteTag` |
| `lib/catalogue/ownership.ts` (modify) | picker select adds `value_order` |
| `app/api/products/[id]/pickers/[pickerId]/route.ts` (modify) | PATCH accepts `value_order` (zod strict, uuid checks) |
| `app/shop/[shop_slug]/p/[product_id]/page.tsx`, `ProductView.tsx` (modify) | Shopper buttons in the owner's order |
| `app/dashboard/product/[id]/PickerValueOrder.tsx` + `.test.tsx` (new); `ProductEditor.tsx`, `page.tsx` (modify) | ↑ ↓ value order on the product page |
| `app/dashboard/NameForm.tsx` + `.test.tsx`, `ModalSheet.tsx`, `NameDialog.tsx` (new); `MoveToDialog.tsx` (modify) | In-page name box; shared dialog shell |
| `app/api/tags/[id]/route.ts` (new) | PATCH rename, DELETE |
| `app/dashboard/ManageTagsDialog.tsx` + `.test.tsx` (new); `CatalogueToolbar.tsx`, `app/dashboard/page.tsx` (modify) | Manage tags panel |
| `lib/hooks/useFinePointer.ts` (new) | Is the main pointer a mouse/trackpad? |
| `app/dashboard/FolderSidebar.tsx` + `FolderSidebar.test.tsx` (new test); `ProductGrid.tsx`, `CatalogueBrowser.tsx` (modify) | Drag-and-drop |
| `docs/superpowers/resume.md`, `decisions-and-lessons.md` (modify) | Records |

---

### Task 0: Migration file and this plan (DONE by the planner)

`supabase/migrations/0008_picker_value_order.sql` and this plan are committed on `feature/catalogue-stage-3`. Nothing to do.

---

### Task 1: Strings, types, migration test

**Files:** Modify `lib/i18n/strings.ts`, `lib/supabase/types.ts`, `lib/catalogue/migration.test.ts`.

- [ ] **Step 1:** In `lib/supabase/types.ts`, add to `interface ProductPicker` after `position: number;`:
```ts
  /** Owner's order of this picker's values (migration 0008). Empty = first-used order. See orderedValues(). */
  value_order: string[];
```
(Check nothing constructs a `ProductPicker` literal: `grep -rn "ProductPicker" app lib`. If something does, add `value_order: []` there.)

- [ ] **Step 2:** In `lib/i18n/strings.ts`, add these keys just before the closing `} as const;` under a `// Catalogue Stage 3 — finishing` comment (keep the `{ th, en }` shape; `{…}` are placeholders filled with `.replace`):

| key | th | en |
|---|---|---|
| `create` | สร้าง | Create |
| `close` | ปิด | Close |
| `renameFolderTitle` | เปลี่ยนชื่อโฟลเดอร์ | Rename folder |
| `dragHint` | ลากไปวางบนโฟลเดอร์ทางซ้ายเพื่อย้าย | Drop on a folder on the left to move it |
| `dropAlreadyHere` | อยู่ที่นี่อยู่แล้ว | Already here |
| `movedTo` | ย้าย “{name}” ไปที่ {target} แล้ว | Moved “{name}” to {target} |
| `valueOrderLabel` | ลำดับที่ลูกค้าเห็น | Order shoppers see |
| `reorderValues` | จัดลำดับ | Reorder |
| `doneReorder` | เสร็จแล้ว | Done |
| `moveValueUp` | เลื่อน {value} ขึ้น | Move {value} up |
| `moveValueDown` | เลื่อน {value} ลง | Move {value} down |
| `manageTags` | จัดการแท็ก | Manage tags |
| `tagNameLabel` | ชื่อแท็ก | Tag name |
| `renameTag` | เปลี่ยนชื่อ | Rename |
| `renameTagNamed` | เปลี่ยนชื่อแท็ก {name} | Rename tag {name} |
| `deleteTagNamed` | ลบแท็ก {name} | Delete tag {name} |
| `tagUsedOn` | ใช้กับสินค้า {n} รายการ | On {n} products |
| `tagUnused` | ยังไม่ได้ใช้กับสินค้าใด | Not on any product |
| `confirmDeleteTag` | ลบแท็ก “{name}”? แท็กนี้จะถูกเอาออกจากสินค้า {n} รายการ ตัวสินค้าไม่ถูกลบ | Delete tag “{name}”? It comes off {n} products. No product is deleted. |
| `tagNameTaken` | มีแท็กชื่อ “{name}” อยู่แล้ว กรุณาใช้ชื่ออื่น | A tag called “{name}” already exists. Please choose another name. |
| `noTagsYet` | ยังไม่มีแท็ก | No tags yet |

(`save`, `cancel`, `delete`, `folderNamePrompt`, `newFolder`, `folderCycle`, `topLevel`, `saveFailed`, `itemNotFound`, `requestInvalid`, `loginRequired`, `invalidTagName` already exist — reuse them.)

- [ ] **Step 3:** Append to `lib/catalogue/migration.test.ts`:
```ts
const raw8 = readFileSync(join(process.cwd(), 'supabase/migrations/0008_picker_value_order.sql'), 'utf8');
const sql8 = raw8.replace(/--.*$/gm, '').toLowerCase();

describe('0008_picker_value_order.sql (Stage 3, additive)', () => {
  it('is one transaction', () => {
    expect(sql8.trim().startsWith('begin;')).toBe(true);
    expect(sql8.trim().endsWith('commit;')).toBe(true);
    expect(sql8.split('begin;')).toHaveLength(2);
    expect(sql8.split('commit;')).toHaveLength(2);
  });
  it('adds value_order with a default, idempotently, so live code keeps working', () => {
    expect(sql8).toMatch(/alter table public\.product_pickers\s+add column if not exists value_order text\[\] not null default '\{\}'/);
  });
  it('never drops, renames or tightens anything, and adds no policy', () => {
    expect(sql8).not.toMatch(/\bdrop\b/);
    expect(sql8).not.toMatch(/rename/);
    expect(sql8).not.toMatch(/set not null/);
    expect(sql8).not.toMatch(/create policy/);
  });
});
```
- [ ] **Step 4:** `npx tsc --noEmit` (only the known error); `npm test` green. Commit `feat: stage 3 strings, value_order type, 0008 migration test`; push.

**Acceptance:** keys exist; the three new migration tests pass.

---

### Task 2: Value order logic (`orderedValues`, `moveItem`)

**Files:** Modify `lib/catalogue/picks.ts`, `lib/catalogue/picks.test.ts`.

- [ ] **Step 1: Failing tests.** In `picks.test.ts`, add `orderedValues, moveItem, usedValuesByPicker` to the `./picks` import and append:
```ts
describe('orderedValues (Stage 3 value order)', () => {
  // first-used order of 'size' across these: S, M, L
  const SIZES = [
    v('1', { size: 'S' }, '2026-01-01T00:00:01Z'),
    v('2', { size: 'M' }, '2026-01-01T00:00:02Z'),
    v('3', { size: 'L' }, '2026-01-01T00:00:03Z'),
    v('4', { size: 'm ' }, '2026-01-01T00:00:04Z'),
  ];
  it('no stored order (empty, null or undefined) is exactly first-used order', () => {
    expect(orderedValues(SIZES, 'size', [])).toEqual(['S', 'M', 'L']);
    expect(orderedValues(SIZES, 'size', null)).toEqual(['S', 'M', 'L']);
    expect(orderedValues(SIZES, 'size')).toEqual(['S', 'M', 'L']);
  });
  it('follows the stored order', () => {
    expect(orderedValues(SIZES, 'size', ['L', 'M', 'S'])).toEqual(['L', 'M', 'S']);
  });
  it('puts values missing from the list after the listed ones, in first-used order', () => {
    expect(orderedValues(SIZES, 'size', ['L'])).toEqual(['L', 'S', 'M']);
  });
  it('ignores stale entries (no version uses them any more)', () => {
    expect(orderedValues(SIZES, 'size', ['XL', 'L', 'XS'])).toEqual(['L', 'S', 'M']);
  });
  it('matches trimmed and case-insensitively, showing the versions\' own spelling', () => {
    expect(orderedValues(SIZES, 'size', [' l ', 'm'])).toEqual(['L', 'M', 'S']);
  });
  it('counts a repeated entry once', () => {
    expect(orderedValues(SIZES, 'size', ['M', 'm', 'S'])).toEqual(['M', 'S', 'L']);
  });
  it('ignores blank stored entries and blank picks', () => {
    const vs = [...SIZES, v('5', { size: '  ' }, '2026-01-01T00:00:05Z')];
    expect(orderedValues(vs, 'size', ['', 'L'])).toEqual(['L', 'S', 'M']);
  });
  it('only shows values of the versions it is given (the shopper page passes complete versions only)', () => {
    expect(orderedValues(SIZES.slice(0, 2), 'size', ['L', 'M', 'S'])).toEqual(['M', 'S']);
  });
  it('a picker no version uses has no values', () => {
    expect(orderedValues(SIZES, 'colour', ['Black'])).toEqual([]);
    expect(orderedValues([], 'size', ['S'])).toEqual([]);
  });
  it('a retyped pick ("M" → "XL") drops M and adds XL after the ordered values', () => {
    const retyped = SIZES.filter(x => x.id !== '2' && x.id !== '4').concat(v('2', { size: 'XL' }, '2026-01-01T00:00:02Z'));
    expect(orderedValues(retyped, 'size', ['L', 'M', 'S'])).toEqual(['L', 'S', 'XL']);
  });
});

describe('moveItem', () => {
  it('moves one step up or down', () => {
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  });
  it('leaves the list unchanged at the edges and out of range', () => {
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 5, -1)).toEqual(['a', 'b']);
  });
  it('never mutates its input', () => {
    const list = ['a', 'b'];
    moveItem(list, 0, 1);
    expect(list).toEqual(['a', 'b']);
  });
});

describe('usedValuesByPicker', () => {
  it("uses each picker's stored order", () => {
    const pickers = [{ id: 'size', name: 'Size', position: 0, value_order: ['M', 'L'] }, { id: 'colour', name: 'Colour', position: 1 }];
    expect(usedValuesByPicker(VERSIONS, pickers)).toEqual({ size: ['M', 'L'], colour: ['Black', 'Green'] });
  });
});
```
- [ ] **Step 2: Run, expect FAIL** — `npx vitest run lib/catalogue/picks.test.ts`.
- [ ] **Step 3: Implement** in `lib/catalogue/picks.ts`:
  - Change `PickerDef` to:
```ts
export interface PickerDef {
  id: string; name: string; position: number;
  /** product_pickers.value_order (migration 0008). Absent or empty = first-used order. */
  value_order?: string[] | null;
}
```
  - Add after `valueOrder`:
```ts
/**
 * Display values for one picker in the owner's order (Stage 3). Values named in
 * `stored` come first, in its order; the rest follow in first-used order
 * (valueOrder). Stale entries (no version uses them) and repeats are skipped.
 * Matching is trimmed and case-insensitive; the spelling shown is the versions'.
 * The ONE ordering rule: used by the owner page, the version form and the shopper page.
 */
export function orderedValues(
  versions: VersionPicks[], pickerId: string, stored?: readonly string[] | null,
): string[] {
  const used = valueOrder(versions, pickerId);
  const byNorm = new Map(used.map(x => [normPick(x), x]));
  const placed = new Set<string>();
  const out: string[] = [];
  for (const s of stored ?? []) {
    const n = normPick(s);
    const shown = byNorm.get(n);
    if (shown === undefined || placed.has(n)) continue;
    placed.add(n);
    out.push(shown);
  }
  for (const x of used) if (!placed.has(normPick(x))) out.push(x);
  return out;
}

/** A copy of `list` with item `index` swapped one step up (-1) or down (+1). Unchanged at the edges. */
export function moveItem<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const out = [...list];
  const to = index + delta;
  if (index < 0 || index >= out.length || to < 0 || to >= out.length) return out;
  [out[index], out[to]] = [out[to], out[index]];
  return out;
}
```
  - Change `usedValuesByPicker` body to `return Object.fromEntries(pickers.map(p => [p.id, orderedValues(versions, p.id, p.value_order)]));` and its comment to "…in the owner's order (orderedValues)".
- [ ] **Step 4: Run, expect PASS** (the existing `valueOrder` test is unchanged and still passes).
- [ ] **Step 5:** `npx tsc --noEmit`. Commit `feat: picker value order rule (orderedValues, moveItem)`; push.

**Acceptance:** every case above passes; `valueOrder` is untouched.

---

### Task 3: Drop rule for drag-and-drop (`dropVerdict`)

**Files:** Modify `lib/catalogue/folders.ts`, `lib/catalogue/folders.test.ts`.

- [ ] **Step 1: Failing tests.** Add `dropVerdict, type DragItem` to the `./folders` import in `folders.test.ts` and append (reuses the file's `TREE`: Shirts > Linen > Short sleeve; Trousers; Dresses):
```ts
describe('dropVerdict (drag-and-drop, rule 5)', () => {
  const product = (folderId: string | null): DragItem => ({ kind: 'product', id: 'p', name: 'P', folderId });
  const folder = (id: string): DragItem => ({ kind: 'folder', id, name: id });

  it('a product can go to any other folder or the top level', () => {
    expect(dropVerdict(TREE, product('linen'), 'trousers')).toBe('ok');
    expect(dropVerdict(TREE, product('linen'), null)).toBe('ok');
    expect(dropVerdict(TREE, product(null), 'short')).toBe('ok');
  });
  it('a product dropped where it already is does nothing', () => {
    expect(dropVerdict(TREE, product('linen'), 'linen')).toBe('here');
    expect(dropVerdict(TREE, product(null), null)).toBe('here');
  });
  it('a folder dropped on its own row is a cancel, not an error', () => {
    expect(dropVerdict(TREE, folder('shirts'), 'shirts')).toBe('self');
  });
  it('a folder cannot go into its own subfolder, however deep', () => {
    expect(dropVerdict(TREE, folder('shirts'), 'linen')).toBe('cycle');
    expect(dropVerdict(TREE, folder('shirts'), 'short')).toBe('cycle');
  });
  it('a folder dropped on its current parent does nothing', () => {
    expect(dropVerdict(TREE, folder('linen'), 'shirts')).toBe('here');
    expect(dropVerdict(TREE, folder('trousers'), null)).toBe('here');
  });
  it('a folder can go to a sibling, an ancestor\'s level or the top level', () => {
    expect(dropVerdict(TREE, folder('short'), 'trousers')).toBe('ok');
    expect(dropVerdict(TREE, folder('short'), 'shirts')).toBe('ok');
    expect(dropVerdict(TREE, folder('linen'), null)).toBe('ok');
  });
  it('a folder that no longer exists cannot be dropped anywhere', () => {
    expect(dropVerdict(TREE, folder('gone'), 'trousers')).toBe('here');
  });
});
```
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — append to `lib/catalogue/folders.ts`:
```ts
/** The dataTransfer type our drags carry (Firefox will not start a drag without some data). */
export const DRAG_TYPE = 'application/x-fit-catalogue-item';

/** What the owner is dragging on the dashboard. `name` is only for the "Moved …" notice. */
export type DragItem =
  | { kind: 'folder'; id: string; name: string }
  | { kind: 'product'; id: string; name: string; folderId: string | null };

/**
 * ok    = dropping here moves it.
 * here  = it is already here; dropping does nothing.
 * self  = a folder over its own row; dropping does nothing (a cancel, no message).
 * cycle = a folder over one of its own subfolders: refused, and the owner is told why (rule 5).
 */
export type DropVerdict = 'ok' | 'here' | 'self' | 'cycle';

/** What a drop of `item` on `targetId` (null = All items / top level) would do. The server re-checks (checkFolderMove). */
export function dropVerdict(folders: FolderRow[], item: DragItem, targetId: string | null): DropVerdict {
  if (item.kind === 'product') return item.folderId === targetId ? 'here' : 'ok';
  const self = folders.find(f => f.id === item.id);
  if (!self) return 'here';
  if (targetId === item.id) return 'self';
  if (wouldCreateCycle(folders, item.id, targetId)) return 'cycle';
  return self.parent_id === targetId ? 'here' : 'ok';
}
```
- [ ] **Step 4: Run, expect PASS.** `npx tsc --noEmit`. Commit `feat: drop rule for dragging products and folders`; push.

**Acceptance:** all `dropVerdict` cases pass; earlier `folders.test.ts` cases unchanged.

---

### Task 4: Tag usage, name clash, rename and delete (lib)

**Files:** Modify `lib/catalogue/tags.ts`, `tags.test.ts`, `tag-ops.ts`, `tag-ops.test.ts`.

- [ ] **Step 1: Failing tests — `tags.test.ts`** (add `tagUsage, tagNameClash` to the import; reuses `TAGS` = Summer, Sale, Old typo and `LINKS`, which include a link to a `'foreign'` tag id):
```ts
describe('tagUsage', () => {
  it('every shop tag A–Z with its product count, unused tags included, foreign links ignored', () => {
    expect(tagUsage(TAGS, LINKS)).toEqual([
      { id: 'o', name: 'Old typo', count: 0 },
      { id: 'a', name: 'Sale', count: 2 },
      { id: 's', name: 'Summer', count: 1 },
    ]);
  });
  it('counts a product once even if the link is listed twice', () => {
    expect(tagUsage([{ id: 'a', name: 'Sale' }], [
      { product_id: 'P1', tag_id: 'a' }, { product_id: 'P1', tag_id: 'a' },
    ])[0].count).toBe(1);
  });
});

describe('tagNameClash', () => {
  it('finds another tag with the same name, trimmed and ignoring capitals', () => {
    expect(tagNameClash(TAGS, 's', ' SALE ')?.id).toBe('a');
  });
  it('a tag never clashes with itself (changing only capitals is allowed)', () => {
    expect(tagNameClash(TAGS, 'a', 'SALE')).toBe(null);
  });
  it('a free name has no clash', () => { expect(tagNameClash(TAGS, 'a', 'Winter')).toBe(null); });
});
```
- [ ] **Step 2: Failing tests — `tag-ops.test.ts`** (add `renameTag, deleteTag` to the import; the file's `db()` has `T1` Sale for shop A and `TB` Summer for shop B; add `{ id: 'T2', retailer_id: 'A', name: 'Summer' }` inside the new describe blocks as shown):
```ts
describe('renameTag', () => {
  const withT2 = () => { const d = db(); d.tags.push({ id: 'T2', retailer_id: 'A', name: 'Summer' }); return d; };

  it("renames the caller's tag, scoped to the caller's shop", async () => {
    const f = fakeSupabase(withT2());
    expect(await renameTag(f.client, 'A', 'T1', 'Big sale')).toEqual({ ok: true, tag: { id: 'T1', name: 'Big sale' } });
    expect(f.tables.tags.find(x => x.id === 'T1')?.name).toBe('Big sale');
    expect(f.calls.filter(c => c.op === 'update')).toEqual([
      { table: 'tags', op: 'update', eq: { id: 'T1', retailer_id: 'A' }, values: { name: 'Big sale' } },
    ]);
  });
  it("another shop's tag is a 404 and nothing is written", async () => {
    const f = fakeSupabase(withT2());
    expect(await renameTag(f.client, 'A', 'TB', 'Mine now')).toMatchObject({ ok: false, status: 404 });
    expect(f.calls.some(c => c.op === 'update')).toBe(false);
  });
  it('a name another of my tags has is refused with 409 naming that tag, nothing written', async () => {
    const f = fakeSupabase(withT2());
    const r = await renameTag(f.client, 'A', 'T1', 'summer');
    expect(r).toMatchObject({ ok: false, status: 409, error: t.tagNameTaken.th.replace('{name}', 'Summer') });
    expect(f.calls.some(c => c.op === 'update')).toBe(false);
  });
  it("another shop's tag of that name is not a clash", async () => {
    const f = fakeSupabase(db());
    expect(await renameTag(f.client, 'A', 'T1', 'Summer')).toMatchObject({ ok: true });
  });
  it('changing only capitals is allowed', async () => {
    const f = fakeSupabase(withT2());
    expect(await renameTag(f.client, 'A', 'T1', 'SALE')).toMatchObject({ ok: true, tag: { name: 'SALE' } });
  });
  it('the exact same name is a no-op with no write', async () => {
    const f = fakeSupabase(withT2());
    expect(await renameTag(f.client, 'A', 'T1', 'Sale')).toMatchObject({ ok: true });
    expect(f.calls.some(c => c.op === 'update')).toBe(false);
  });
  it('a clash the database catches (another tab) is still a 409', async () => {
    const f = fakeSupabase(withT2(), { fail: { table: 'tags', op: 'update', code: '23505' } });
    expect(await renameTag(f.client, 'A', 'T1', 'Winter')).toMatchObject({ ok: false, status: 409 });
  });
  it('fails closed: lookup or update failure is a 500', async () => {
    expect(await renameTag(fakeSupabase(withT2(), { fail: { table: 'tags', op: 'select' } }).client, 'A', 'T1', 'X'))
      .toMatchObject({ ok: false, status: 500 });
    expect(await renameTag(fakeSupabase(withT2(), { fail: { table: 'tags', op: 'update', code: 'XX000' } }).client, 'A', 'T1', 'X'))
      .toMatchObject({ ok: false, status: 500 });
  });
});

describe('deleteTag', () => {
  it("deletes the caller's tag with one statement scoped to the shop (links go by ON DELETE CASCADE)", async () => {
    const f = fakeSupabase(db());
    expect(await deleteTag(f.client, 'A', 'T1')).toEqual({ ok: true });
    expect(f.tables.tags.map(x => x.id)).toEqual(['TB']);
    expect(f.calls.filter(c => c.op === 'delete')).toEqual([
      { table: 'tags', op: 'delete', eq: { id: 'T1', retailer_id: 'A' }, values: undefined },
    ]);
  });
  it("another shop's tag is a 404 and nothing is deleted", async () => {
    const f = fakeSupabase(db());
    expect(await deleteTag(f.client, 'A', 'TB')).toMatchObject({ ok: false, status: 404 });
    expect(f.calls.some(c => c.op === 'delete')).toBe(false);
  });
  it('fails closed when the lookup fails, before any delete', async () => {
    const f = fakeSupabase(db(), { fail: { table: 'tags', op: 'select' } });
    expect(await deleteTag(f.client, 'A', 'T1')).toMatchObject({ ok: false, status: 500 });
    expect(f.calls.some(c => c.op === 'delete')).toBe(false);
  });
  it('a failed delete is a 500', async () => {
    const f = fakeSupabase(db(), { fail: { table: 'tags', op: 'delete' } });
    expect(await deleteTag(f.client, 'A', 'T1')).toMatchObject({ ok: false, status: 500 });
  });
});
```
(`tag-ops.test.ts` must also `import { t } from '@/lib/i18n/strings';` if it does not already.)
- [ ] **Step 3: Run, expect FAIL.**
- [ ] **Step 4: Implement — `lib/catalogue/tags.ts`** (append):
```ts
export interface TagUsage extends TagRow { count: number }

/** Every one of the shop's tags, used or not, A–Z, with how many products carry it (Manage tags). Links to ids outside `tags` are ignored. */
export function tagUsage(tags: TagRow[], links: ProductTagRow[]): TagUsage[] {
  const products = new Map<string, Set<string>>();
  for (const l of links) {
    const set = products.get(l.tag_id) ?? new Set<string>();
    set.add(l.product_id);
    products.set(l.tag_id, set);
  }
  return [...tags].sort(byName).map(tag => ({ ...tag, count: products.get(tag.id)?.size ?? 0 }));
}

/** Another of the shop's tags already called `name` (compared like the unique index), or null. */
export function tagNameClash(tags: TagRow[], tagId: string, name: string): TagRow | null {
  const n = normTag(name);
  return tags.find(tag => tag.id !== tagId && normTag(tag.name) === n) ?? null;
}
```
- [ ] **Step 5: Implement — `lib/catalogue/tag-ops.ts`** (update the `./tags` import to add `tagNameClash`; append):
```ts
export type TagOpFailure = { ok: false; status: 404 | 409 | 500; error: string };

/**
 * Rename one of the caller's tags shop-wide. Another shop's id is a 404. A name
 * another of the caller's tags already has is refused (409, naming it) — never
 * merged (Stage 3 open question 1). The unique index on (retailer_id, lower(name))
 * catches a clash created meanwhile in another tab (23505 → 409).
 */
export async function renameTag(
  supabase: SupabaseClient, userId: string, tagId: string, name: string,
): Promise<{ ok: true; tag: TagRow } | TagOpFailure> {
  const loaded = await loadShopTags(supabase, userId);
  if (!loaded.ok) return loaded;
  const tag = loaded.tags.find(x => x.id === tagId);
  if (!tag) return { ok: false, status: 404, error: t.itemNotFound.th };
  const clash = tagNameClash(loaded.tags, tagId, name);
  if (clash) return { ok: false, status: 409, error: t.tagNameTaken.th.replace('{name}', clash.name) };
  if (tag.name === name) return { ok: true, tag };

  const { error } = await supabase.from('tags').update({ name }).eq('id', tagId).eq('retailer_id', userId);
  if (error?.code === UNIQUE_VIOLATION) return { ok: false, status: 409, error: t.tagNameTaken.th.replace('{name}', name) };
  if (error) { console.error('tag rename failed:', error); return fail500; }
  return { ok: true, tag: { id: tagId, name } };
}

/**
 * Delete one of the caller's tags. product_tags.tag_id is ON DELETE CASCADE
 * (0005), so this one statement also removes it from every product. Another
 * shop's id is a 404, checked before the delete.
 */
export async function deleteTag(
  supabase: SupabaseClient, userId: string, tagId: string,
): Promise<{ ok: true } | Failure> {
  const owns = await checkTagOwnership(supabase, userId, tagId);
  if (!owns.ok) return owns;
  const { error } = await supabase.from('tags').delete().eq('id', tagId).eq('retailer_id', userId);
  if (error) { console.error('tag delete failed:', error); return fail500; }
  return { ok: true };
}
```
- [ ] **Step 6: Run, expect PASS.** `npx tsc --noEmit`. Commit `feat: tag usage, rename and delete (shop-scoped)`; push.

**Acceptance:** every statement in `renameTag`/`deleteTag` carries `retailer_id`; another shop's id never reaches a write.

---

### Task 5: Value order — read paths and the save route

**Files:** Modify `lib/catalogue/ownership.ts`, `app/api/products/[id]/pickers/[pickerId]/route.ts`, `app/shop/[shop_slug]/p/[product_id]/page.tsx`, `app/shop/[shop_slug]/p/[product_id]/ProductView.tsx`.

> From this task on, the code selects `value_order`. That is why migration 0008 must run on the live database **before** the merge (see the founder section). Nothing here can be checked against a database by you; review it carefully.

- [ ] **Step 1: `lib/catalogue/ownership.ts`** — in `loadProductContext`, change the picker select to `.select('id, name, position, value_order')`. Nothing else. (The version form's suggestions and the owner product page now get the stored order through `usedValuesByPicker`.)
- [ ] **Step 2: Shopper page `page.tsx`** — change the picker query to `.select('id, name, position, value_order')`.
- [ ] **Step 3: `ProductView.tsx`** — import `orderedValues` instead of `valueOrder` and render `{orderedValues(versions, p.id, p.value_order).map(value => { … })}`. Nothing else changes (the button markup, greying and `FitChecker` stay exactly as they are).
- [ ] **Step 4: Picker PATCH route** — replace the `PATCH` handler in `app/api/products/[id]/pickers/[pickerId]/route.ts` (keep `DELETE` as is, but add the same uuid check at its top):
```ts
import { z } from 'zod';
import { clashesAfterRemoval, orderedValues, versionLabel } from '@/lib/catalogue/picks';

const PatchBody = z.object({
  name: z.string().optional(),
  /** The picker's values in the order the owner wants shoppers to see them. */
  value_order: z.array(z.string().max(60)).max(500).optional(),
}).strict();

const badIds = (p: { id: string; pickerId: string }) =>
  !z.uuid().safeParse(p.id).success || !z.uuid().safeParse(p.pickerId).success;

/**
 * Rename a picker and/or set the order of its values. Body: { name?, value_order? }.
 * Picks are keyed by picker id, so a rename touches one row only. The stored
 * order is recomputed from the product's current versions (orderedValues):
 * stale entries are dropped, unknown strings ignored, and a value added since
 * the page loaded is kept at the end — so a stale page can never lose a value.
 */
export async function PATCH(req: Request, props: Params) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t.loginRequired.th }, { status: 401 });
  if (badIds(params)) return NextResponse.json({ error: t.itemNotFound.th }, { status: 404 });

  const body = PatchBody.safeParse(await req.json().catch(() => null));
  if (!body.success || (body.data.name === undefined && body.data.value_order === undefined)) {
    return NextResponse.json({ error: t.requestInvalid.th }, { status: 400 });
  }
  const update: { name?: string; value_order?: string[] } = {};
  if (body.data.name !== undefined) {
    const name = parsePickerName(body.data.name);
    if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
    update.name = name.value;
  }

  const found = await loadProductContext(supabase, user.id, params.id);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });
  if (!found.ctx.pickers.some(p => p.id === params.pickerId)) {
    return NextResponse.json({ error: t.itemNotFound.th }, { status: 404 });
  }
  if (body.data.value_order !== undefined) {
    update.value_order = orderedValues(found.ctx.versions, params.pickerId, body.data.value_order);
  }

  const { error } = await supabase
    .from('product_pickers').update(update)
    .eq('id', params.pickerId).eq('product_id', params.id);
  if (error) {
    console.error('picker update failed:', error);
    return NextResponse.json({ error: t.saveFailed.th }, { status: 500 });
  }
  return NextResponse.json({ ok: true, value_order: update.value_order });
}
```
(`req.json()` on an empty or non-JSON body becomes `null` → zod fails → 400 `requestInvalid`. The only existing caller, `ProductEditor.renamePicker`, sends `{ name }`, which still passes `.strict()`.)
- [ ] **Step 5:** `npx tsc --noEmit && npm run lint && npm test`. Commit `feat: shoppers see picker values in the owner's order; picker PATCH saves value_order`; push.

**Acceptance (review):** the product's ownership and the picker's membership are checked before the update; the update is scoped by `product_id`; the stored list is always `orderedValues(...)` output, never the raw request; `git diff origin/main -- app/shop` touches only the two lines named above.

---

### Task 6: ↑ ↓ value order on the product page

**Files:** Create `app/dashboard/product/[id]/PickerValueOrder.tsx`, `app/dashboard/product/[id]/PickerValueOrder.test.tsx`; Modify `app/dashboard/product/[id]/ProductEditor.tsx`, `app/dashboard/product/[id]/page.tsx`.

- [ ] **Step 1: Failing component test** — `PickerValueOrder.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import PickerValueOrder from './PickerValueOrder';

afterEach(cleanup);
const mount = (values: string[], onSave: (o: string[]) => Promise<string | null>) =>
  render(<LanguageProvider><PickerValueOrder values={values} onSave={onSave} /></LanguageProvider>);
const items = () => screen.getAllByRole('listitem').map(li => li.textContent?.replace(/[↑↓]/g, '').trim());

describe('PickerValueOrder', () => {
  it('shows nothing for fewer than two values', () => {
    const { container } = mount(['S'], vi.fn());
    expect(container.textContent).toBe('');
  });
  it('shows the order as one line until Reorder is pressed', () => {
    mount(['S', 'M', 'L'], vi.fn());
    expect(screen.getByText(/S · M · L/)).toBeTruthy();
    expect(screen.queryByRole('listitem')).toBeNull();
    fireEvent.click(screen.getByText(t.reorderValues.th));
    expect(items()).toEqual(['S', 'M', 'L']);
  });
  it('the first ↑ and the last ↓ are disabled', () => {
    mount(['S', 'M', 'L'], vi.fn());
    fireEvent.click(screen.getByText(t.reorderValues.th));
    expect((screen.getByLabelText(t.moveValueUp.th.replace('{value}', 'S')) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText(t.moveValueDown.th.replace('{value}', 'L')) as HTMLButtonElement).disabled).toBe(true);
  });
  it('a click shows the new order at once and saves the whole list', async () => {
    const onSave = vi.fn(async () => null);
    mount(['S', 'M', 'L'], onSave);
    fireEvent.click(screen.getByText(t.reorderValues.th));
    fireEvent.click(screen.getByLabelText(t.moveValueUp.th.replace('{value}', 'L')));
    expect(items()).toEqual(['S', 'L', 'M']);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(['S', 'L', 'M']));
  });
  it('clicks made while a save runs are sent together afterwards (latest wins)', async () => {
    let release: (v: string | null) => void = () => {};
    const onSave = vi.fn(() => new Promise<string | null>(r => { release = r; }));
    mount(['S', 'M', 'L'], onSave);
    fireEvent.click(screen.getByText(t.reorderValues.th));
    fireEvent.click(screen.getByLabelText(t.moveValueUp.th.replace('{value}', 'L')));   // S L M (sending)
    fireEvent.click(screen.getByLabelText(t.moveValueUp.th.replace('{value}', 'L')));   // L S M (queued)
    fireEvent.click(screen.getByLabelText(t.moveValueDown.th.replace('{value}', 'S'))); // L M S (replaces queued)
    release(null);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave).toHaveBeenLastCalledWith(['L', 'M', 'S']);
  });
  it('a failed save shows the error and goes back to the saved order', async () => {
    mount(['S', 'M', 'L'], vi.fn(async () => 'บันทึกไม่สำเร็จ'));
    fireEvent.click(screen.getByText(t.reorderValues.th));
    fireEvent.click(screen.getByLabelText(t.moveValueDown.th.replace('{value}', 'S')));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(items()).toEqual(['S', 'M', 'L']);
  });
});
```
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement `PickerValueOrder.tsx`:**
```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { moveItem } from '@/lib/catalogue/picks';

/**
 * The order shoppers see one picker's values in, with ↑ ↓ buttons (phone and
 * computer). Each click shows the new order at once and saves the whole list.
 * Clicks made while a save runs are sent together when it finishes (latest wins),
 * so responses can never arrive out of order.
 */
export default function PickerValueOrder({ values, onSave }: {
  /** Current order from the server (orderedValues). */
  values: string[];
  /** Save the whole list; resolve null on success or the error text. */
  onSave: (order: string[]) => Promise<string | null>;
}) {
  const [lang] = useLanguage();
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState(values);
  const [error, setError] = useState<string | null>(null);
  const queued = useRef<string[] | null>(null);
  const sending = useRef(false);
  const saved = useRef(values);
  saved.current = values;

  // router.refresh() after a save brings the server's list: adopt it unless more clicks are waiting.
  const valuesKey = values.join('\u0000');
  useEffect(() => { if (!sending.current) setOrder(saved.current); }, [valuesKey]);

  if (values.length < 2) return null;

  async function flush() {
    if (sending.current) return;
    sending.current = true;
    while (queued.current) {
      const next = queued.current;
      queued.current = null;
      const err = await onSave(next);
      if (err) { queued.current = null; setError(err); setOrder(saved.current); break; }
    }
    sending.current = false;
  }

  function move(i: number, delta: -1 | 1) {
    const next = moveItem(order, i, delta);
    setError(null);
    setOrder(next);
    queued.current = next;
    void flush();
  }

  const arrow = 'h-9 w-9 shrink-0 rounded border border-gray-300 bg-white text-base disabled:opacity-30';
  return (
    <div className="pl-1 text-xs text-gray-600">
      {!open ? (
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="break-words">{t.valueOrderLabel[lang]}: {order.join(' · ')}</span>
          <button type="button" onClick={() => setOpen(true)} className="py-1 text-blue-700 underline">
            {t.reorderValues[lang]}
          </button>
        </div>
      ) : (
        <div className="max-w-xs space-y-1">
          <div>{t.valueOrderLabel[lang]}</div>
          <ol className="space-y-1">
            {order.map((value, i) => (
              <li key={value} className="flex items-center gap-2">
                <span className="min-w-0 grow break-words text-sm text-gray-900">{value}</span>
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)}
                  aria-label={t.moveValueUp[lang].replace('{value}', value)} className={arrow}>↑</button>
                <button type="button" disabled={i === order.length - 1} onClick={() => move(i, 1)}
                  aria-label={t.moveValueDown[lang].replace('{value}', value)} className={arrow}>↓</button>
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => setOpen(false)} className="py-1 text-blue-700 underline">
            {t.doneReorder[lang]}
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-red-600">{error}</p>}
    </div>
  );
}
```
(The hooks all run before the early `return null`, as React requires.)
- [ ] **Step 4: `page.tsx`** (owner product page) — `import { usedValuesByPicker } from '@/lib/catalogue/picks';` and pass `valuesByPicker={usedValuesByPicker(ctx.versions, ctx.pickers)}` to `ProductEditor`.
- [ ] **Step 5: `ProductEditor.tsx`** —
  - New prop `valuesByPicker: Record<string, string[]>` (add to `Props` and the destructuring).
  - `import PickerValueOrder from './PickerValueOrder';`
  - Add:
```ts
  async function saveValueOrder(p: PickerDef, order: string[]): Promise<string | null> {
    const r = await send(`/api/products/${productId}/pickers/${p.id}`, 'PATCH', { value_order: order });
    if (!r.ok) return r.error ?? t.saveFailed[lang];
    router.refresh();
    return null;
  }
```
  - In the picker list, change each `<li key={p.id} className="flex items-center gap-3">…</li>` to a block whose first child is the existing row and whose second child is the order control:
```tsx
<li key={p.id} className="space-y-1">
  <div className="flex items-center gap-3">{/* the existing name input + Remove button, unchanged */}</div>
  <PickerValueOrder values={valuesByPicker[p.id] ?? []} onSave={order => saveValueOrder(p, order)} />
</li>
```
- [ ] **Step 6:** `npx tsc --noEmit && npm run lint && npm test`. Commit `feat: reorder picker values with up/down buttons on the product page`; push.

**Acceptance:** all `PickerValueOrder` tests pass; the picker rename/remove/add behaviour is unchanged.

---

### Task 7: In-page name box (replaces `window.prompt`)

**Files:** Create `app/dashboard/NameForm.tsx`, `app/dashboard/NameForm.test.tsx`, `app/dashboard/ModalSheet.tsx`, `app/dashboard/NameDialog.tsx`; Modify `app/dashboard/MoveToDialog.tsx`, `app/dashboard/CatalogueBrowser.tsx`.

- [ ] **Step 1: Failing component test** — `NameForm.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import NameForm from './NameForm';

afterEach(cleanup);
const mount = (p: { initial?: string; onSubmit?: (n: string) => Promise<string | null>; onCancel?: () => void }) =>
  render(
    <LanguageProvider>
      <NameForm label="ชื่อโฟลเดอร์" initial={p.initial} maxLength={60} submitText="สร้าง"
        onSubmit={p.onSubmit ?? vi.fn(async () => null)} onCancel={p.onCancel ?? vi.fn()} />
    </LanguageProvider>,
  );
const box = () => screen.getByLabelText('ชื่อโฟลเดอร์') as HTMLInputElement;
const submitButton = () => screen.getByRole('button', { name: 'สร้าง' }) as HTMLButtonElement;

describe('NameForm', () => {
  it('starts focused with the current name, which is selected for retyping', () => {
    mount({ initial: 'Shirts' });
    expect(document.activeElement).toBe(box());
    expect(box().value).toBe('Shirts');
    expect([box().selectionStart, box().selectionEnd]).toEqual([0, 6]);
  });
  it('cannot submit a blank name', () => {
    const onSubmit = vi.fn(async () => null);
    mount({ onSubmit });
    fireEvent.change(box(), { target: { value: '   ' } });
    expect(submitButton().disabled).toBe(true);
    fireEvent.submit(box().closest('form') as HTMLFormElement);
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('Enter submits the trimmed name', () => {
    const onSubmit = vi.fn(async () => null);
    mount({ onSubmit });
    fireEvent.change(box(), { target: { value: '  Linen ' } });
    fireEvent.submit(box().closest('form') as HTMLFormElement);
    expect(onSubmit).toHaveBeenCalledWith('Linen');
  });
  it('an unchanged name just closes, without a request', () => {
    const onSubmit = vi.fn(async () => null);
    const onCancel = vi.fn();
    mount({ initial: 'Shirts', onSubmit, onCancel });
    fireEvent.submit(box().closest('form') as HTMLFormElement);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });
  it("shows the server's error and stays open with the text", async () => {
    mount({ onSubmit: vi.fn(async () => t.invalidFolderName.th) });
    fireEvent.change(box(), { target: { value: 'x' } });
    fireEvent.submit(box().closest('form') as HTMLFormElement);
    expect((await screen.findByRole('alert')).textContent).toBe(t.invalidFolderName.th);
    expect(box().value).toBe('x');
  });
  it('Escape and Cancel both cancel', () => {
    const onCancel = vi.fn();
    mount({ onCancel });
    fireEvent.keyDown(box(), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: t.cancel.th }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
```
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: `NameForm.tsx`:**
```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';

/**
 * A name box with a submit and a Cancel button, used instead of window.prompt
 * (New folder, Rename folder — inside NameDialog) and inline (tag rename).
 * text-base on the input: iPhones zoom the page into any input under 16px.
 */
export default function NameForm({ label, initial = '', maxLength, submitText, onSubmit, onCancel }: {
  label: string;
  initial?: string;
  maxLength: number;
  submitText: string;
  /** Resolve null on success (the parent closes the form) or the error text to show. */
  onSubmit: (name: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [lang] = useLanguage();
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  const trimmed = draft.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !trimmed) return;
    if (trimmed === initial.trim()) { onCancel(); return; }
    setBusy(true);
    setError(null);
    const err = await onSubmit(trimmed);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label className="block text-sm">
        <span className="text-gray-700">{label}</span>
        <input
          ref={input}
          value={draft}
          maxLength={maxLength}
          readOnly={busy}
          onChange={e => setDraft(e.target.value)}
          // stopPropagation: inside a dialog, Escape cancels this box only, not the whole dialog.
          onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); } }}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-base"
        />
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy || !trimmed}
          className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-60">
          {submitText}
        </button>
        <button type="button" onClick={onCancel} className="px-1 py-2 text-sm text-gray-600 underline">
          {t.cancel[lang]}
        </button>
      </div>
    </form>
  );
}
```
- [ ] **Step 4: `ModalSheet.tsx`** — the shell `MoveToDialog` has today, made shared:
```tsx
'use client';
import { useEffect } from 'react';

/**
 * The dashboard's dialog shell: dark backdrop; Escape or a click outside closes it.
 * On a phone, 'bottom' rises from the bottom edge (lists); 'top' sits near the top
 * so the on-screen keyboard cannot cover a name box. On a computer both are centred.
 */
export default function ModalSheet({ title, onClose, align = 'bottom', children }: {
  title: string; onClose: () => void; align?: 'bottom' | 'top'; children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`fixed inset-0 z-20 flex justify-center bg-black/40 sm:items-center sm:p-0 ${
        align === 'top' ? 'items-start px-4 pt-[12vh]' : 'items-end'}`}
      onClick={onClose}
    >
      <div
        className={`max-h-[80vh] w-full max-w-sm overflow-y-auto bg-white p-4 sm:rounded ${align === 'top' ? 'rounded' : 'rounded-t'}`}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="mb-3 font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
```
- [ ] **Step 5: `MoveToDialog.tsx`** — replace its own backdrop/panel/heading/Escape effect with `<ModalSheet title={\`${t.moveTo[lang]} “${title}”\`} onClose={onClose}>` around the existing `<ul>` and Cancel button. Remove the now-unused `useEffect` import. Behaviour and look unchanged (align stays `'bottom'`).
- [ ] **Step 6: `NameDialog.tsx`:**
```tsx
'use client';
import ModalSheet from './ModalSheet';
import NameForm from './NameForm';

/** NameForm in a dialog: the in-page replacement for window.prompt. */
export default function NameDialog({ title, onCancel, ...form }: {
  title: string; label: string; initial?: string; maxLength: number; submitText: string;
  onSubmit: (name: string) => Promise<string | null>; onCancel: () => void;
}) {
  return (
    <ModalSheet title={title} onClose={onCancel} align="top">
      <NameForm {...form} onCancel={onCancel} />
    </ModalSheet>
  );
}
```
- [ ] **Step 7: `CatalogueBrowser.tsx`** —
  - Add a helper that returns the error text instead of showing it, and build `run` on it:
```ts
  /** One write; resolves null on success or the error text. Always refreshes (a 404 usually means the list is stale). */
  async function request(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<string | null> {
    setBusy(true);
    const r = await sendJson(url, method, body);
    setBusy(false);
    router.refresh();
    return r.ok ? null : r.error ?? t.saveFailed[lang];
  }
  async function run(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<boolean> {
    setMessage(null);
    const err = await request(url, method, body);
    setMessage(err);
    return err === null;
  }
```
  - State: `const [naming, setNaming] = useState<{ kind: 'new' } | { kind: 'rename'; folder: FolderRow } | null>(null);`
  - `newFolder()` becomes `setNaming({ kind: 'new' })`; `renameFolder(f)` becomes `setNaming({ kind: 'rename', folder: f })`. Delete the two `window.prompt` calls. **Keep** `window.confirm` in `deleteFolder`.
  - Render, after the `MoveToDialog` block:
```tsx
      {naming && (
        <NameDialog
          title={naming.kind === 'new' ? t.newFolder[lang] : t.renameFolderTitle[lang]}
          label={t.folderNamePrompt[lang]}
          initial={naming.kind === 'rename' ? naming.folder.name : ''}
          maxLength={60}
          submitText={naming.kind === 'new' ? t.create[lang] : t.save[lang]}
          onCancel={() => setNaming(null)}
          onSubmit={async name => {
            const err = naming.kind === 'new'
              ? await request('/api/folders', 'POST', { name, parent_id: view.folderId })
              : await request(`/api/folders/${naming.folder.id}`, 'PATCH', { name });
            if (err === null) setNaming(null);
            return err;
          }}
        />
      )}
```
- [ ] **Step 8:** `grep -rn "window.prompt" app` → no results. `npx tsc --noEmit && npm run lint && npm test`. Commit `feat: in-page name box for new and renamed folders`; push.

**Acceptance:** all `NameForm` tests pass; no `window.prompt` left; folder delete still asks with `window.confirm`; Move to… looks and works as before.

---

### Task 8: Tag API (rename, delete)

**Files:** Create `app/api/tags/[id]/route.ts`.

- [ ] **Step 1:**
```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { parseTagName } from '@/lib/catalogue/parse';
import { deleteTag, renameTag } from '@/lib/catalogue/tag-ops';
import { t } from '@/lib/i18n/strings';

type Params = { params: Promise<{ id: string }> };
const RenameBody = z.object({ name: z.string() }).strict();
const notFound = () => NextResponse.json({ error: t.itemNotFound.th }, { status: 404 });

/** Rename a tag shop-wide. A name another of the shop's tags has is refused (409), never merged. */
export async function PATCH(req: Request, props: Params) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t.loginRequired.th }, { status: 401 });
  if (!z.uuid().safeParse(params.id).success) return notFound();

  const body = RenameBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: t.requestInvalid.th }, { status: 400 });
  const name = parseTagName(body.data.name);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });

  // renameTag looks the id up among the caller's own tags first (another shop's = 404).
  const r = await renameTag(supabase, user.id, params.id, name.value);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, tag: r.tag });
}

/** Delete a tag; it comes off every product (ON DELETE CASCADE). Products are untouched. The client confirms first. */
export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t.loginRequired.th }, { status: 401 });
  if (!z.uuid().safeParse(params.id).success) return notFound();

  const r = await deleteTag(supabase, user.id, params.id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
```
- [ ] **Step 2:** `npx tsc --noEmit && npm run lint && npm test`. Commit `feat: tag API (rename, delete)`; push.

**Acceptance (review):** auth → id shape → (body) → ownership inside the lib → write; no route accepts a tag id it has not checked against the caller's tags.

---

### Task 9: Manage tags panel

**Files:** Create `app/dashboard/ManageTagsDialog.tsx`, `app/dashboard/ManageTagsDialog.test.tsx`; Modify `app/dashboard/CatalogueToolbar.tsx`, `app/dashboard/CatalogueBrowser.tsx`, `app/dashboard/page.tsx`.

- [ ] **Step 1: Failing component test** — `ManageTagsDialog.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import ManageTagsDialog from './ManageTagsDialog';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const TAGS = [{ id: 'a', name: 'Sale', count: 2 }, { id: 'o', name: 'Old typo', count: 0 }];
const mount = (p: Partial<React.ComponentProps<typeof ManageTagsDialog>> = {}) =>
  render(
    <LanguageProvider>
      <ManageTagsDialog tags={TAGS} onRename={vi.fn(async () => null)} onDelete={vi.fn(async () => null)}
        onClose={vi.fn()} {...p} />
    </LanguageProvider>,
  );

describe('ManageTagsDialog', () => {
  it('lists every tag with how many products use it, unused ones marked', () => {
    mount();
    expect(screen.getByText(t.tagUsedOn.th.replace('{n}', '2'))).toBeTruthy();
    expect(screen.getByText(t.tagUnused.th)).toBeTruthy();
  });
  it('says so when the shop has no tags', () => {
    mount({ tags: [] });
    expect(screen.getByText(t.noTagsYet.th)).toBeTruthy();
  });
  it('Rename opens a name box in the row and sends the new name', async () => {
    const onRename = vi.fn(async () => null);
    mount({ onRename });
    fireEvent.click(screen.getByLabelText(t.renameTagNamed.th.replace('{name}', 'Sale')));
    const box = screen.getByLabelText(t.tagNameLabel.th) as HTMLInputElement;
    expect(box.value).toBe('Sale');
    fireEvent.change(box, { target: { value: 'Big sale' } });
    fireEvent.submit(box.closest('form') as HTMLFormElement);
    await waitFor(() => expect(onRename).toHaveBeenCalledWith(TAGS[0], 'Big sale'));
    await waitFor(() => expect(screen.queryByLabelText(t.tagNameLabel.th)).toBeNull());
  });
  it('a refused rename keeps the box open with the message', async () => {
    mount({ onRename: vi.fn(async () => t.tagNameTaken.th.replace('{name}', 'Old typo')) });
    fireEvent.click(screen.getByLabelText(t.renameTagNamed.th.replace('{name}', 'Sale')));
    const box = screen.getByLabelText(t.tagNameLabel.th);
    fireEvent.change(box, { target: { value: 'old TYPO' } });
    fireEvent.submit(box.closest('form') as HTMLFormElement);
    expect((await screen.findByRole('alert')).textContent).toContain('Old typo');
    expect(screen.getByLabelText(t.tagNameLabel.th)).toBeTruthy();
  });
  it('Delete asks first, naming the tag and its product count; No sends nothing', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onDelete = vi.fn(async () => null);
    mount({ onDelete });
    fireEvent.click(screen.getByLabelText(t.deleteTagNamed.th.replace('{name}', 'Sale')));
    expect(confirm).toHaveBeenCalledWith(t.confirmDeleteTag.th.replace('{name}', 'Sale').replace('{n}', '2'));
    expect(onDelete).not.toHaveBeenCalled();
  });
  it('Delete after Yes calls onDelete', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onDelete = vi.fn(async () => null);
    mount({ onDelete });
    fireEvent.click(screen.getByLabelText(t.deleteTagNamed.th.replace('{name}', 'Old typo')));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(TAGS[1]));
  });
});
```
(The component must call `window.confirm(...)` — the test spies on it.)
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: `ManageTagsDialog.tsx`** (client). Props:
```ts
{
  tags: TagUsage[];
  onRename: (tag: TagUsage, name: string) => Promise<string | null>;
  onDelete: (tag: TagUsage) => Promise<string | null>;
  onClose: () => void;
}
```
  State: `renaming: string | null` (tag id), `error: string | null`, `busy: boolean`. Render `<ModalSheet title={t.manageTags[lang]} onClose={onClose} align="top">` containing:
  - `{error && <p role="alert" className="mb-2 text-sm text-red-600">{error}</p>}`
  - `tags.length === 0` → `<p className="text-sm text-gray-600">{t.noTagsYet[lang]}</p>`; else `<ul className="divide-y">`, one `<li key={tag.id} className="py-2">` per tag:
    - when `renaming === tag.id`: `<NameForm label={t.tagNameLabel[lang]} initial={tag.name} maxLength={30} submitText={t.save[lang]} onSubmit={async name => { const err = await onRename(tag, name); if (err === null) setRenaming(null); return err; }} onCancel={() => setRenaming(null)} />`
    - otherwise `<div className="flex items-center gap-2">` with: `<div className="min-w-0 grow"><div className="break-all text-sm">{tag.name}</div><div className="text-xs text-gray-500">{tag.count > 0 ? t.tagUsedOn[lang].replace('{n}', String(tag.count)) : t.tagUnused[lang]}</div></div>`; a button `aria-label={t.renameTagNamed[lang].replace('{name}', tag.name)}`, text `t.renameTag[lang]`, `className="px-2 py-2 text-sm text-blue-700 underline"`, `disabled={busy}`, onClick `{ setError(null); setRenaming(tag.id); }`; a button `aria-label={t.deleteTagNamed[lang].replace('{name}', tag.name)}`, text `t.delete[lang]`, `className="px-2 py-2 text-sm text-red-600"`, `disabled={busy}`, onClick `remove(tag)`.
  - A bottom `<button type="button" onClick={onClose} className="mt-3 text-sm text-gray-600 underline">{t.close[lang]}</button>`.
  - `remove(tag)`: `if (!window.confirm(t.confirmDeleteTag[lang].replace('{name}', tag.name).replace('{n}', String(tag.count)))) return; setBusy(true); setError(null); const err = await onDelete(tag); setBusy(false); if (err) setError(err);`
  - Only one row is in rename mode at a time (opening another closes the first).
- [ ] **Step 4: `CatalogueToolbar.tsx`** — new optional prop `onManageTags?: () => void`. After the ⚠ toggle (before Clear), when it is given:
```tsx
      {onManageTags && (
        <button type="button" onClick={onManageTags} className={`${control} text-gray-700`}>
          🏷 {t.manageTags[lang]}
        </button>
      )}
```
- [ ] **Step 5: `app/dashboard/page.tsx`** — `import { tagsInUse, tagUsage, … } from '@/lib/catalogue/tags';` and pass `allTags={tagUsage(tags, links)}` to `CatalogueBrowser` (keep `tags={tagsInUse(tags, links)}` for the filter).
- [ ] **Step 6: `CatalogueBrowser.tsx`** — new prop `allTags: TagUsage[]`; state `const [managingTags, setManagingTags] = useState(false);`; pass `onManageTags={allTags.length > 0 ? () => setManagingTags(true) : undefined}` to `CatalogueToolbar`; render:
```tsx
      {managingTags && (
        <ManageTagsDialog
          tags={allTags}
          onClose={() => setManagingTags(false)}
          onRename={(tag, name) => request(`/api/tags/${tag.id}`, 'PATCH', { name })}
          onDelete={async tag => {
            const err = await request(`/api/tags/${tag.id}`, 'DELETE');
            if (err === null && view.tagIds.includes(tag.id)) {
              go({ ...view, tagIds: view.tagIds.filter(id => id !== tag.id) }, 'replace');
            }
            return err;
          }}
        />
      )}
```
  (`allTags` comes from the server; `router.refresh()` inside `request` brings the new names and counts into the open dialog. If the last tag is deleted the dialog stays open showing "ยังไม่มีแท็ก" until closed.)
- [ ] **Step 7:** `npx tsc --noEmit && npm run lint && npm test`. Commit `feat: manage tags panel (rename and delete shop-wide)`; push.

**Acceptance:** all `ManageTagsDialog` tests pass; the tag filter, product-page tags and suggestions are unchanged.

---

### Task 10: Drag-and-drop on a computer

**Files:** Create `lib/hooks/useFinePointer.ts`, `app/dashboard/FolderSidebar.test.tsx`; Modify `app/dashboard/FolderSidebar.tsx`, `app/dashboard/ProductGrid.tsx`, `app/dashboard/CatalogueBrowser.tsx`.

**How it works (read first):**
- **What is being dragged** lives in `CatalogueBrowser` state (`dragging: DragItem | null`) — `dragover` handlers cannot read `dataTransfer` data. `dataTransfer.setData(DRAG_TYPE, id)` is still called in every `dragstart` (Firefox will not start a drag without it). Never put `text/plain` in it (the search box would accept the drop as typed text).
- **Which row the pointer is over** also lives in `CatalogueBrowser` (`hoverId: string | null | undefined`; `undefined` = none, `null` = "All items"). Folder rows report it in their `dragover` and stop propagation; a `dragover` on the browser's outer `div` clears it. **Never use `dragleave`**: browsers fire it just before `dragend` on a refused drop, which would erase the reason we want to show.
- **A row accepts a drop only when `dropVerdict(...) === 'ok'`**: only then does its `dragover` call `preventDefault()` (that is what tells the browser "drop allowed"). For `cycle` it shows red, for `here`/`self` nothing; the browser shows a no-entry cursor either way.
- **Visible refusal:** while the pointer is over a `cycle` row, the row is red and a fixed bar at the bottom of the screen says `t.folderCycle`; if the owner releases there, the same text stays as the page's red message. The server still checks (`checkFolderMove` → 409 `folderCycle`), and `run()` shows that too.
- **State changes in `dragstart` are deferred** with `setTimeout(…, 0)`: changing the DOM (opacity, the bottom bar) synchronously inside `dragstart` makes Chrome cancel the drag.
- **Computer only:** dragging is switched on only when `useFinePointer()` is true (mouse/trackpad) and no write is running. The folder sidebar is already computer-only (`hidden sm:block`); phones keep ⋯ → Move to….

- [ ] **Step 1: `lib/hooks/useFinePointer.ts`:**
```ts
'use client';
import { useEffect, useState } from 'react';

/**
 * True when the main pointer is a mouse or trackpad (drag-and-drop is offered).
 * False during server rendering, on the first paint, and on touch screens
 * (phones and tablets keep Move to…).
 */
export function useFinePointer(): boolean {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(pointer: fine)');
    const update = () => setFine(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return fine;
}
```
- [ ] **Step 2: Failing component test** — `FolderSidebar.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import { DRAG_TYPE, type DragItem, type FolderRow } from '@/lib/catalogue/folders';
import FolderSidebar from './FolderSidebar';

afterEach(cleanup);
const FOLDERS: FolderRow[] = [
  { id: 'shirts', name: 'Shirts', parent_id: null },
  { id: 'linen', name: 'Linen', parent_id: 'shirts' },
  { id: 'trousers', name: 'Trousers', parent_id: null },
];
const dt = () => ({ dropEffect: 'none', effectAllowed: 'all', types: [DRAG_TYPE], setData: vi.fn() });
function mount(dragging: DragItem | null, extra: { hoverId?: string | null } = {}) {
  const spies = { onHoverTarget: vi.fn(), onDropOn: vi.fn(), onDragStartFolder: vi.fn(), onDragEnd: vi.fn() };
  render(
    <LanguageProvider>
      <FolderSidebar folders={FOLDERS} currentId={null} onOpen={vi.fn()} onRename={vi.fn()} onMove={vi.fn()}
        onDelete={vi.fn()} dragging={dragging} hoverId={extra.hoverId} {...spies} />
    </LanguageProvider>,
  );
  return spies;
}
const row = (name: string) => screen.getByText(`📁 ${name}`).closest('[data-drop-row]') as HTMLElement;
const product: DragItem = { kind: 'product', id: 'p', name: 'P', folderId: 'linen' };
const shirts: DragItem = { kind: 'folder', id: 'shirts', name: 'Shirts' };

describe('FolderSidebar drag-and-drop', () => {
  it('a folder row accepts a product (dragover default prevented) and reports the hover', () => {
    const s = mount(product);
    expect(fireEvent.dragOver(row('Trousers'), { dataTransfer: dt() })).toBe(false);
    expect(s.onHoverTarget).toHaveBeenCalledWith('trousers');
  });
  it('dropping a product on a folder moves it there; on All items, to the top level', () => {
    const s = mount(product);
    fireEvent.drop(row('Trousers'), { dataTransfer: dt() });
    fireEvent.drop(row(t.allItems.th), { dataTransfer: dt() });
    expect(s.onDropOn.mock.calls).toEqual([['trousers'], [null]]);
  });
  it("the product's own folder does not accept it", () => {
    const s = mount(product);
    expect(fireEvent.dragOver(row('Linen'), { dataTransfer: dt() })).toBe(true);
    fireEvent.drop(row('Linen'), { dataTransfer: dt() });
    expect(s.onDropOn).not.toHaveBeenCalled();
  });
  it('a folder is refused by its own subfolder, which turns red while hovered', () => {
    const s = mount(shirts, { hoverId: 'linen' });
    expect(fireEvent.dragOver(row('Linen'), { dataTransfer: dt() })).toBe(true);
    expect(row('Linen').className).toContain('ring-red-300');
    fireEvent.drop(row('Linen'), { dataTransfer: dt() });
    expect(s.onDropOn).not.toHaveBeenCalled();
  });
  it('an accepted row turns blue while hovered', () => {
    mount(shirts, { hoverId: 'trousers' });
    expect(row('Trousers').className).toContain('ring-blue-400');
  });
  it('with nothing being dragged, rows ignore drags (e.g. a file from the desktop)', () => {
    const s = mount(null);
    expect(fireEvent.dragOver(row('Trousers'), { dataTransfer: dt() })).toBe(true);
    expect(s.onHoverTarget).not.toHaveBeenCalled();
  });
  it('folder rows can be picked up; All items cannot', () => {
    mount(null);
    expect(row('Shirts').getAttribute('draggable')).toBe('true');
    expect(row(t.allItems.th).getAttribute('draggable')).not.toBe('true');
  });
});
```
- [ ] **Step 3: Run, expect FAIL.**
- [ ] **Step 4: `FolderSidebar.tsx`** — keep `FolderNavProps` unchanged (FolderMobileNav uses it). Add:
```ts
export interface FolderDragProps {
  /** What the owner is dragging now (null: nothing, or a drag from outside the page). */
  dragging?: DragItem | null;
  /** The row the pointer is over: a folder id, null = All items, undefined = none. */
  hoverId?: string | null;
  onHoverTarget?: (id: string | null) => void;
  onDropOn?: (id: string | null) => void;
  /** Absent = folders cannot be picked up (touch screens). */
  onDragStartFolder?: (item: DragItem) => void;
  onDragEnd?: () => void;
}
```
  and accept `FolderNavProps & FolderDragProps`. Implementation details:
  - `const verdict = (id: string | null) => (dragging ? dropVerdict(folders, dragging, id) : null);`
  - Drop handlers for a target id (used on the All items row with `null` and on each folder row with `f.id`):
```ts
  const dropProps = (id: string | null) => ({
    'data-drop-row': '',
    onDragOver: (e: React.DragEvent) => {
      e.stopPropagation(); // the browser's outer div clears the hover only when the pointer is off every row
      const v = verdict(id);
      if (v === null) return;
      if (hoverId !== id) onHoverTarget?.(id);
      if (v === 'ok') { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (verdict(id) === 'ok') onDropOn?.(id);
    },
  });
```
  - Row classes: keep today's `rowClass(active)` and append, **when `hoverId === id` (and `hoverId !== undefined`)**: `' bg-blue-100 ring-2 ring-blue-400'` for `ok`, `' bg-red-50 ring-2 ring-red-300'` for `cycle`, nothing otherwise. The row of the folder being dragged gets `' opacity-50'`.
  - Folder rows (not All items) are pickable when `onDragStartFolder` is given:
```tsx
draggable={onDragStartFolder ? true : undefined}
onDragStart={onDragStartFolder ? e => {
  e.dataTransfer.setData(DRAG_TYPE, f.id);
  e.dataTransfer.effectAllowed = 'move';
  const item: DragItem = { kind: 'folder', id: f.id, name: f.name };
  setTimeout(() => onDragStartFolder(item), 0); // a DOM change inside dragstart cancels the drag in Chrome
} : undefined}
onDragEnd={onDragEnd}
```
  - Put `{...dropProps(null)}` on the All items row `div` and `{...dropProps(f.id)}` on each folder row `div`. Still no `overflow-hidden` on rows (the ⋯ menu).
- [ ] **Step 5: `ProductGrid.tsx`** — new props:
```ts
  /** Cards can be picked up (computer, nothing saving). */
  draggable?: boolean;
  draggingId?: string | null;
  onDragStart?: (item: DragItem) => void;
  onDragEnd?: () => void;
```
  On each `<li>`: `draggable={draggable || undefined}`; when `draggable`, `onDragStart` = set `DRAG_TYPE` data to `p.id`, `effectAllowed = 'move'`, then `setTimeout(() => onDragStart?.({ kind: 'product', id: p.id, name: p.name, folderId: p.folder_id }), 0)`; `onDragEnd={draggable ? onDragEnd : undefined}`; add `opacity-50` to the class when `draggingId === p.id`. Add `draggable={false}` to the card's `<Link>` and its `<img>` so the whole card is what moves (not the link URL or the picture). Clicking a card still opens it.
- [ ] **Step 6: `CatalogueBrowser.tsx`:**
  - Imports: `useRef` (with `useState`), `useFinePointer`, `dropVerdict, type DragItem, type DropVerdict`.
  - State and refs:
```ts
  const finePointer = useFinePointer();
  const [dragging, setDragging] = useState<DragItem | null>(null);
  const [hoverId, setHoverId] = useState<string | null | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const dropped = useRef(false);
  const hoverVerdict: DropVerdict | null =
    dragging && hoverId !== undefined ? dropVerdict(folders, dragging, hoverId) : null;
  const lastVerdict = useRef<DropVerdict | null>(null);
  lastVerdict.current = hoverVerdict;
  const canDrag = finePointer && !busy;
```
  - `run()` also clears the notice: `setNotice(null)` next to `setMessage(null)`.
  - One move function for drag and Move to…:
```ts
  async function relocate(item: DragItem, targetId: string | null) {
    const ok = item.kind === 'folder'
      ? await run(`/api/folders/${item.id}`, 'PATCH', { parent_id: targetId })
      : await run(`/api/products/${item.id}`, 'PATCH', { folder_id: targetId });
    if (!ok) return;
    const target = targetId === null ? t.topLevel[lang] : folders.find(f => f.id === targetId)?.name ?? t.topLevel[lang];
    setNotice(t.movedTo[lang].replace('{name}', item.name).replace('{target}', target));
  }
```
  - `moveTo(targetId)` (the dialog) becomes: close the dialog, then `relocate(m.kind === 'folder' ? { kind: 'folder', id: m.folder.id, name: m.folder.name } : { kind: 'product', id: m.product.id, name: m.product.name, folderId: m.product.folder_id }, targetId)`.
  - Drag lifecycle:
```ts
  function startDrag(item: DragItem) {
    dropped.current = false;
    setMessage(null);
    setNotice(null);
    setDragging(item);
  }
  function endDrag() {
    // Released over a refused row: keep the reason on screen (spec §7: refuse with a plain message).
    if (!dropped.current && lastVerdict.current === 'cycle') setMessage(t.folderCycle[lang]);
    setDragging(null);
    setHoverId(undefined);
  }
  async function dropOn(targetId: string | null) {
    const item = dragging;
    dropped.current = true;
    setDragging(null);
    setHoverId(undefined);
    if (item && dropVerdict(folders, item, targetId) === 'ok') await relocate(item, targetId);
  }
```
  - Outer `div`: add `onDragOver={dragging ? () => setHoverId(undefined) : undefined}`.
  - Pass to `<FolderSidebar {...folderProps} … />` (**not** to `FolderMobileNav`): `dragging={dragging} hoverId={hoverId} onHoverTarget={setHoverId} onDropOn={dropOn} onDragStartFolder={canDrag ? startDrag : undefined} onDragEnd={endDrag}`.
  - Pass to `<ProductGrid … />`: `draggable={canDrag} draggingId={dragging?.kind === 'product' ? dragging.id : null} onDragStart={startDrag} onDragEnd={endDrag}`.
  - Under the existing `message` line: `{notice && <p role="status" className="text-sm text-gray-700">{notice}</p>}`.
  - While dragging, a fixed bar (no layout shift, never intercepts the pointer):
```tsx
      {dragging && (
        <div
          role="status"
          className={`pointer-events-none fixed inset-x-0 bottom-4 z-30 mx-auto w-fit max-w-[90vw] rounded px-3 py-2 text-sm text-white shadow-lg ${
            hoverVerdict === 'cycle' ? 'bg-red-600' : 'bg-gray-900/90'}`}
        >
          {hoverVerdict === 'cycle' ? t.folderCycle[lang] : hoverVerdict === 'here' ? t.dropAlreadyHere[lang] : t.dragHint[lang]}
        </div>
      )}
```
- [ ] **Step 7:** `npx tsc --noEmit && npm run lint && npm test`. Commit `feat: drag products and folders onto the folder list (computer)`; push.

**Acceptance (review):** a drop calls the same routes as Move to…; `preventDefault` in `dragover` only for `ok`; no `dragleave` handler anywhere; no `text/plain` drag data; `FolderMobileNav` gets no drag props; no `overflow-*` added around an `ActionsMenu`; `git diff origin/main -- app/shop` shows only Task 5's two lines.

---

### Task 11: Self-check of the whole branch (no new code)

- [ ] `grep -rn "window.prompt" app` → nothing. `grep -rn "dragleave\|onDragLeave" app` → nothing.
- [ ] `grep -rn "value_order" app lib` → only: `ownership.ts` (select), shopper `page.tsx` (select), the picker route, `picks.ts`, types, tests.
- [ ] Every new `error:` in a route is `t.<key>.th`. Every new string in a component is `t.<key>[lang]`.
- [ ] Every new zod object ends in `.strict()`.
- [ ] `git diff --stat origin/main` — note the line count for the report.

---

### Task 12: Docs

**Files:** Modify `docs/superpowers/resume.md`, `docs/superpowers/decisions-and-lessons.md`.

- [ ] **Step 1: `resume.md`** — snapshot heading to today's date; Tests row = the real `npm test` count; add a What's live row "Catalogue Stage 3 — drag-and-drop, value order, tag rename/delete, name boxes" marked *built, not shipped — PR pending; needs migration 0008 first*; Database migrations row: "**0008** (`product_pickers.value_order`) must be run by the founder **before** the Stage 3 merge"; To do: remove "Catalogue Stage 3" (replace with any leftover the founder raises); file map: add `api/tags/`.
- [ ] **Step 2: `decisions-and-lessons.md`** —
  - §2, a new bullet "**Catalogue Stage 3 (built 2026-10-xx).**": tag rename refuses a taken name, never merges (open question 1 — record the founder's answer); a deleted tag goes from every product by `ON DELETE CASCADE`; Manage tags lists unused tags too; new picker values go after the owner's ordered ones (`orderedValues` is the one rule, used by the owner page, the version form and the shopper page; the server stores its output, so stale entries are pruned on save); drag-and-drop is computer-only (`(pointer: fine)`), native HTML5, no library; a folder dropped on its own row is a cancel, on its own subfolder a visible refusal; New folder / Rename folder / tag rename use `NameForm` (no more `window.prompt`; deletes still use `window.confirm`). Also fix the Stage 2a bullet's "New folder and Rename use `window.prompt`" → "(replaced by an in-page name box in Stage 3)".
  - §3, add: "**Native drag-and-drop traps** (Stage 3): `dragover` cannot read `dataTransfer` data, so keep the dragged item in React state; Firefox needs `setData` in `dragstart`; changing the DOM synchronously in `dragstart` cancels the drag in Chrome (defer with `setTimeout(…, 0)`); browsers fire `dragleave` just before `dragend` on a refused drop, so never use `dragleave` to clear state you still need; never put `text/plain` in the drag data (inputs accept it as a text drop)."
  - §3, add: "**Inputs need `text-base` (16px) or iPhones zoom the page in** when they get focus (NameForm)."
- [ ] **Step 3:** Commit `docs: record catalogue stage 3`; push.

---

### Task 13: Gates, push, report

- [ ] **Step 1:** `git fetch origin && git merge origin/main` (never rebase). Resolve conflicts keeping both sides' intent.
- [ ] **Step 2:** `npm install` if `package-lock.json` changed upstream (then `git checkout -- package-lock.json` if it is only dirtied). No dev server running. `npm test && npm run build` — both green.
- [ ] **Step 3:** Update the test count in `resume.md` if it changed; commit; `git push`.
- [ ] **Step 4: Report to `god`:** head sha, test count (baseline 428 / 44 files), build result, `git diff --stat origin/main` total, the compare link
  `https://github.com/ingkawatlimvipuwat-sys/fit-mvp/compare/main...feature/catalogue-stage-3?expand=1`
  (or open the PR with `"C:\Program Files\GitHub CLI\gh.exe" pr create` — **never merge**), and say plainly:
  1. **Migration 0008 must be run in Supabase BEFORE pressing Merge** (steps below). If the PR is merged first, every product page — the owner's and the shopper's — shows an error until 0008 is run.
  2. **The preview site uses the LIVE database** — anything saved there changes the real shop. Use only things named "TEST ลบได้ …".
  3. The click-through below (computer AND phone), and the open product questions with the answers built.

---

## Migration 0008 — founder SQL steps

**When:** after the pull request exists and **before** pressing **Merge pull request**. It is safe for the live site at any time: the code live today never reads or writes the new column, and every existing picker gets an empty list, which means "the order you first used", exactly what shoppers see today.

1. Open https://supabase.com/dashboard and click the **fit-mvp** project. (If it says **Paused**, press **Restore project** and wait until it is healthy.)
2. In the left menu click **SQL Editor**, then **+ New query** (top left).
3. Open the file `supabase/migrations/0008_picker_value_order.sql` on GitHub (the pull request's **Files changed** tab, or the branch `feature/catalogue-stage-3`), select everything, copy, and paste it into the empty query box. It is short: it starts with `begin;`, has one `alter table … add column if not exists value_order text[] not null default '{}'`, and ends with `commit;`.
4. Press **Run** (bottom right, or Ctrl+Enter). Expected result: **"Success. No rows returned"**. If Supabase shows a warning box about the query, read it — this query only adds a column — and confirm.
5. Check it worked: replace the text in the box with the line below and press **Run**:
   ```sql
   select column_name, data_type, column_default from information_schema.columns
   where table_schema = 'public' and table_name = 'product_pickers' and column_name = 'value_order';
   ```
   Expected: **one row**: `value_order | ARRAY | '{}'::text[]`. No row means the first query did not run — run step 3–4 again (running it twice is harmless).
6. Open the live shop (https://fit-mvp-eight.vercel.app), one shopper product page and your dashboard: they should look exactly as before.
7. Now check the preview (below) and then press **Merge pull request**.

**To undo** (only if something is wrong **and the pull request is not merged**): run `alter table public.product_pickers drop column value_order;`. After the merge, never drop it — the new code needs it.

No backup is needed for this one: it adds an empty column and changes no existing data.

---

## Founder click-through on the preview

Open the Vercel preview link from the pull request (after running 0008). **The preview uses the LIVE database — anything you save is saved in the real shop.** Use only things named **TEST ลบได้ …** and delete them at the end.

### On a computer (Chrome or Edge; Firefox too if you have it)

**Name boxes**
1. Dashboard → **+ สร้าง ▾ → โฟลเดอร์ใหม่**. A box opens **inside the page** (not the browser's small grey popup). With the box empty, **สร้าง** is greyed out. Type `TEST ลบได้ A` → **สร้าง** → the box closes and A appears in the left list.
2. Open A → **+ สร้าง ▾ → โฟลเดอร์ใหม่** → `TEST ลบได้ B` → press **Enter** → B appears indented under A.
3. B's **⋯ → เปลี่ยนชื่อ** → the box shows "TEST ลบได้ B" already selected → type `TEST ลบได้ C` → **บันทึก**. Open the box again and press **Esc** → it closes, nothing changes.

**Drag-and-drop**
4. Click **ทั้งหมด**, then **+ สร้าง ▾ → เพิ่มสินค้า** → `TEST ลบได้ / delete me` → save. Back on the dashboard, press on its card and drag it onto **TEST ลบได้ A** in the left list. While you hover, the row turns **blue** and a dark bar at the bottom says "ลากไปวางบนโฟลเดอร์ทางซ้ายเพื่อย้าย". Release → a grey line says "ย้าย “TEST ลบได้ / delete me” ไปที่ TEST ลบได้ A แล้ว". Click A → the card is there.
5. Drag the card onto **ทั้งหมด** → it moves back to the top level ("…ไปที่ ระดับบนสุด แล้ว").
6. Drag folder **TEST ลบได้ A** onto **TEST ลบได้ C** (its own subfolder): C turns **red**, the bottom bar turns red and says a folder can't go inside itself. Release → the red message stays at the top; nothing moved. Drag A onto its own row and release → nothing happens, no message.
7. Drag **TEST ลบได้ C** onto **ทั้งหมด** → C is now at the top level (no longer indented).
8. Click a card normally (no drag) → it still opens the product page.
9. If you have many products: scroll down, drag a card from the bottom towards the top of the window — the page scrolls up by itself so you can reach the folder list.

**Value order**
10. Open the TEST product. It starts with the pickers ไซส์ and สี. **+ เพิ่มแบบ**: fill the form as usual (photo, measurements), ไซส์ `S`, สี `ดำ` → save. Back on the product page press **ทำซ้ำ** on that row → change ไซส์ to `M` → save. **ทำซ้ำ** again → `L` → save.
11. Under **ไซส์** a line reads "ลำดับที่ลูกค้าเห็น: S · M · L". (สี has only one value, so it shows no order line.) Press **จัดลำดับ** → use ↑ ↓ until it reads **L, M, S** → **เสร็จแล้ว**. Refresh the page → still L · M · S.
12. **คัดลอกลิงก์ลูกค้า**, open it in a new tab → the size buttons read **L M S**.
13. Back on the product page, **แก้ไข** the M version → change ไซส์ to `XL` → save. The order line now reads **L · S · XL** (the new value goes last; M is gone). The shopper tab, refreshed, shows L S XL.

**Tags**
14. On the TEST product type tags `TEST tag1` and `TEST tag2` (Enter after each).
15. Dashboard → **🏷 จัดการแท็ก** (in the toolbar). Both tags are listed with "ใช้กับสินค้า 1 รายการ"; any old tag on no product shows "ยังไม่ได้ใช้กับสินค้าใด".
16. **เปลี่ยนชื่อ** on TEST tag1 → type `test TAG2` → **บันทึก** → refused: "มีแท็กชื่อ “TEST tag2” อยู่แล้ว กรุณาใช้ชื่ออื่น"; the box stays open. Type `TEST tag1 new` → **บันทึก** → renamed; close the panel → the TEST card's chip shows the new name.
17. Filter the dashboard by **TEST tag2** (+ กรองด้วยแท็ก). Open **🏷 จัดการแท็ก** → **ลบ** on TEST tag2 → the browser asks "ลบแท็ก “TEST tag2”? แท็กนี้จะถูกเอาออกจากสินค้า 1 รายการ ตัวสินค้าไม่ถูกลบ" → OK → it disappears from the panel, from the card and from the filter; the TEST product is still there.

**Clean-up**
18. Delete the TEST product (product page → ลบ → OK). In **🏷 จัดการแท็ก** delete `TEST tag1 new`. Delete folders TEST ลบได้ C and TEST ลบได้ A (⋯ → ลบโฟลเดอร์).

### On a phone

1. Dashboard: press and hold a product card — nothing gets dragged (at most the phone's own link menu appears; close it). **⋯ → ย้ายไปที่…** still moves products and folders as before.
2. **+ สร้าง ▾ → โฟลเดอร์ใหม่**: the box sits near the **top** of the screen and the keyboard does not cover it; the page does not zoom in. Create `TEST ลบได้ P`, open it, use the header's **⋯ → เปลี่ยนชื่อ** to rename it.
3. Create a TEST product with two versions (as steps 10–11 above, or use the computer's one before cleaning up) → **จัดลำดับ** → the ↑ ↓ buttons are big enough to tap; reorder; **เสร็จแล้ว**; open the shopper link on the phone → the buttons follow your order.
4. **🏷 จัดการแท็ก** opens as a panel; rename a TEST tag with the keyboard; delete it.
5. Clean up everything named TEST ลบได้ on the phone too.

---

## Risks / open points

- **Merging before running 0008 breaks every product page** (owner and shopper) with "column does not exist" until it is run — the PR #13 incident class (resume.md, 2026-10-05). Mitigation: the report and this plan put "run 0008 first" at the top; the probe in step 5 confirms it.
- **No automated test reaches the database or the routes.** `renameTag`/`deleteTag` are tested against the fake client (call order and `retailer_id` scoping only). That the cascade really removes links, and that PostgREST accepts a JSON array for the `text[]` column, is checked only by click-through steps 11, 13 and 17.
- **Drag-and-drop is tested by pure rules (`dropVerdict`) and the sidebar component in jsdom**, not in a real browser. Browser quirks are covered by the design (see Task 10) and by click-through steps 4–9. Safari on a Mac is the least-tried browser; if the founder has one, try steps 4–6 there.
- **The folder list is not pinned while scrolling.** Pinning it (`sticky`) with many folders would need a scroll box, which clips the ⋯ menus (decisions: no `overflow` around an ActionsMenu). Native auto-scroll while dragging covers it for now; revisit if step 9 feels awkward.
- **Value order and two tabs:** last save wins. A stale page can never lose a value (the server rebuilds the list from the current versions).
- **A value retyped away and back** (M → XL → M before any reorder save) gets its old place back. Harmless; mentioned so nobody files it as a bug.
- **Deleting a tag cannot be undone** (it is removed from every product). The confirm box names the tag and the product count.
- **iPads and touch laptops get no drag-and-drop** (open question 4). Move to… works everywhere.
- **Pre-existing tsc error** in `lib/garment/colour-fabric-regression.test.ts:49` is unrelated and unchanged.

---

## Self-review

- **Founder's four pieces:** drag-and-drop (Tasks 3, 10; refusal visible: red row, red bar, red message; server check unchanged), value order (Tasks 0, 1, 2, 5, 6; one rule `orderedValues` for owner page, version form and shopper page; rename/remove/retype covered in the table), tag rename/delete (Tasks 4, 8, 9; clash blocked with a Thai message; cascade checked in 0005; every route checks the tag belongs to the caller), name boxes (Task 7; `window.confirm` kept for deletes; phone: `align="top"`, `text-base`).
- **Constraints:** strings Thai-first in `strings.ts` (Task 1); routes send `t.<key>.th`; zod `.strict()` (Tasks 5, 8); auth + ownership on every route; logic in pure `lib/` functions with listed test cases; migration additive, idempotent, one transaction, tested (Tasks 0, 1); tasks committed and pushed one at a time.
- **Not in this plan:** reordering picker rows, folders or products; bulk move; touch drag; tag merge; shopper-facing anything beyond value order.
- **Names used across tasks:** `PickerDef.value_order`, `orderedValues`, `moveItem`, `usedValuesByPicker`, `DRAG_TYPE`, `DragItem`, `DropVerdict`, `dropVerdict`, `TagUsage`, `tagUsage`, `tagNameClash`, `TagOpFailure`, `renameTag`, `deleteTag`, `useFinePointer`, `PickerValueOrder`, `NameForm`, `ModalSheet`, `NameDialog`, `ManageTagsDialog`, `FolderDragProps`, `request`, `run`, `relocate`, `startDrag`, `endDrag`, `dropOn`, `hoverId`, `onHoverTarget`, `onDropOn`, `onDragStartFolder`.
