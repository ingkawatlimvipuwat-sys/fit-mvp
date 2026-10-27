# Thai errors in the remaining routes + remove a fabric photo — plan (2026-10-27)

Branch `feature/thai-errors-fabric-remove`, from `origin/main` at `3ba5df8`. Closes to-do items
#6 (a fabric photo can only be replaced, not removed) and #8 (English error texts in other API
routes) in `docs/superpowers/resume.md`.

## Why

- The dashboard shows a route's `error` string to the retailer as-is (`lib/catalogue/send-json.ts`,
  `NewProductForm`, `ProductEditor`, `FitRulesManager`). Several routes still send English codes
  (`'not found'`, `'invalid body'`, `'unauthorized'`, `'invalid product name'`, `'invalid picker
  name'`, `'invalid values'`) or a raw Postgres `error.message`. The garment routes were fixed on
  2026-10-26 (PR #18) by sending `t.<key>.th`; do the same here.
- A retailer who uploaded a fabric close-up cannot take it off the garment.

## Part A — Thai errors

Pattern to copy: `app/api/garments/[id]/route.ts` (`t.loginRequired.th`, `t.requestInvalid.th`,
`t.itemNotFound.th`, `t.saveFailed.th`). Server sends Thai only, like the garment routes.

1. `lib/i18n/strings.ts`: add, next to `invalidFolderName` / `invalidTagName` and phrased like them:
   - `invalidProductName`: th `ชื่อสินค้าต้องยาว 1–120 ตัวอักษร`, en `Product names must be 1–120 characters`
   - `invalidPickerName`: th `ชื่อตัวเลือกต้องยาว 1–30 ตัวอักษร`, en `Option names must be 1–30 characters`
   - `invalidPickerValues`: th `ค่าตัวเลือกไม่ถูกต้อง (ยาวได้ไม่เกิน 60 ตัวอักษร)`, en `Invalid option values (up to 60 characters each)`
   - `loadFailed` only if no suitable existing key: th `โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่`, en `Could not load. Please try again.`
   Check first that none of these already exists under another name; reuse if so.
2. `lib/catalogue/parse.ts`: `parseProductName` → `t.invalidProductName.th`, `parsePickerName` →
   `t.invalidPickerName.th`.
3. `lib/catalogue/picker-ops.ts`: both `'invalid values'` → `t.invalidPickerValues.th`.
4. `lib/catalogue/ownership.ts` `fail404` and `lib/catalogue/folder-ops.ts` (both `'not found'`) →
   `t.itemNotFound.th`.
5. Routes — `app/api/products/**`, `app/api/folders/**`, `app/api/fit-rulesets/**` (incl.
   `products/[id]/pickers/**`, `products/[id]/tags/**`):
   - `'unauthorized'` → `t.loginRequired.th`
   - `'invalid body'` → `t.requestInvalid.th`
   - `'not found'` → `t.itemNotFound.th`
   - `error.message` on a 500 (fit-rulesets GET, POST, `[id]` PATCH and DELETE): `console.error(...)`
     the real error, respond with `t.saveFailed.th` for writes and `t.loadFailed.th` (or the reused
     key) for the GET. Never send `error.message` to the client.
   - Keep every status code exactly as it is.
6. `app/api/fit/evaluate/route.ts` line ~53 `'garment not found'` → `t.itemNotFound.th`. Leave the
   zod `flatten()` 400 responses in evaluate and signup alone (objects, never shown as text).
7. Client filters that existed only to hide the English codes:
   - `app/dashboard/CatalogueBrowser.tsx` ~line 50 (`r.error !== 'not found' && r.error !== 'invalid body'`)
   - `app/dashboard/product/[id]/ProductTags.tsx` `RAW_CODES`
   Simplify to `r.error ?? t.saveFailed[lang]` and delete `RAW_CODES`.
8. Finish with `grep -rn "error: '" app/api lib --include=*.ts` (excluding tests and
   `fake-supabase.ts`): no English string may remain in an `error` field sent to the client.
9. Tests: update existing assertions on the old strings; add a test that `parseProductName('')`,
   `parsePickerName('')` and the picker-ops invalid case return the Thai strings, and that
   `ownership` / `folder-ops` 404s return `t.itemNotFound.th`.

## Part B — remove a fabric photo

Duplicates copy photo files (`copyStoredObject`), never share them, so deleting a garment's own
fabric object cannot break another garment.

1. Strings: `removeFabricPhoto` th `ลบรูปผ้านี้`, en `Remove this photo`.
2. `app/dashboard/garment/FabricSection.tsx`: when `currentPhotoUrl` is set, show a checkbox
   `removeFabricPhoto` under the thumbnail. Controlled from the parent: new props
   `removePhoto: boolean` and `onRemovePhotoChange: (v: boolean) => void`. While ticked, dim the
   thumbnail (e.g. `opacity-40`). Picking a new file wins over the tick (see 3).
3. `app/dashboard/garment/GarmentForm.tsx`: state `removeFabricPhoto` (default false). On submit,
   when it is true AND no new `fabric_photo` file was picked, `form.set('fabric_photo_remove', '1')`.
   Include it in the dirty-state snapshot if the form has one (line ~135), so ticking it counts as
   an unsaved change.
4. `app/api/garments/[id]/route.ts` (PUT):
   - `const removeFabricPhoto = form.get('fabric_photo_remove') === '1' && !fabricPic;`
   - Only acts inside `if (fabricParse.present)`. There:
     `photoUrl = fabricPic ? fabricPic.url : removeFabricPhoto ? null : existingFabric?.fabric_photo_url ?? null`.
   - Empty fabric and no photo → the existing delete branch. Otherwise in the update branch add
     `fabric_photo_url: null` when `removeFabricPhoto` (keep the current spread for `fabricPic`).
   - Track whether the fabric write (delete or update) succeeded. Only after it succeeded,
     `await removeStoredPhoto(existingFabric.fabric_photo_url, user.id)` for the removed photo.
     If the write failed, leave the stored object alone (the row still points at it).
   - Do not disturb the existing `fabricPic` cleanup rules below it.
5. `app/api/garments/route.ts` (POST, duplicate): if `fabric_photo_remove === '1'` and no new file,
   skip `copyStoredObject` for the fabric photo, so a duplicate can be saved without it.
6. Tests: extract the fabric photo decision into a small pure function in
   `lib/garment/colour-fabric.ts` (or a new `lib/garment/fabric-photo.ts`), e.g.
   `fabricPhotoPlan({ newUpload, removeRequested, existingUrl })` →
   `{ nextUrl, deleteExisting }`, and unit-test it: keep, replace, remove, remove+new file (new
   wins), remove with no existing photo (no-op). Use it from the route. A jsdom test for
   FabricSection: checkbox appears only with a current photo and calls `onRemovePhotoChange`.

## Gates

`npm test && npm run build` both green (`next lint` runs in build — no unused imports). No DB, no
SQL, no form submits against the dev server. No migration needed (`fabric_photo_url` is already
nullable — it starts null on insert).
