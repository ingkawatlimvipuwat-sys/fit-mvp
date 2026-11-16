# UI redesign — design spec

**Date:** 2026-11-16
**Status:** Draft — direction chosen, three decisions open (see §8)
**Why now:** the founder is preparing a demo and wants the app to look finished, not like a prototype.

## 1. Decision so far

The founder chose **direction A, "Quiet"** on 2026-11-16 from two mocked-up directions
(A · Quiet, B · Bold).

Mockups (private to the founder's Claude account):
https://claude.ai/artifact/37sE3cEMcgbnFnMHV2imKE — boards "A · Quiet — enter measurements",
"A · Quiet — fit result", "A · Quiet — owner dashboard". The mockups show the intent; where a
mockup and this spec disagree, this spec wins.

## 2. Goal and non-goals

**Goal:** one consistent look across the shopper pages and the owner dashboard, with the fit
result — the product's whole point — as the clearest thing on the screen.

**Not in this work:**

- No change to fit logic, rules, verdict wording or what is stored. This is presentation.
- No new pages, no navigation changes, no change to links shoppers already have.
- No database migration.
- No real try-on. The stub stays a stub (see §6).
- No English proofreading pass (separate to-do).

## 3. The look

| Thing | Value |
|---|---|
| Page background | `#F5F6F7` |
| Surface (cards, header) | `#FFFFFF`, border `#E3E6EA`, radius 14–16px |
| Text | `#14171F`; secondary `#4A5261` (passes 4.5:1 on both backgrounds) |
| Control border | `#C9CED6`; text-field border `#8A919C` |
| Accent | teal `#0B5C63` (primary button, active tab underline, links); tint `#E4F0F1` |
| Selected choice (size, colour) | ink `#14171F` fill or 2px ink border |
| Font | IBM Plex Sans Thai, weights 400/500/600/700, loaded with `next/font` (today the app uses the system font, which differs between iPhone, Android and Windows) |
| Tap targets | 44px minimum height on anything tappable |
| Buttons | primary: teal fill, 52px on phones; secondary: white with ink border |

**Verdict colours.** Today: red / yellow / green / blue, told apart by hue alone. New set differs in
lightness as well and always carries the word:

| Verdict | Chip background / text |
|---|---|
| คับเกินไป (too tight) | `#F9DDD0` / `#8A2F0A` |
| พอดีตัว (snug) | `#FCEBC5` / `#6B4200` |
| พอดี (good fit) | `#DCEEF0` / `#083F44` |
| หลวม (loose) | `#E6E9ED` / `#2B313C` |
| ไม่ได้ระบุ (not specified) | white with dashed `#8A919C` border / `#4A5261` |

**How it is built.** The colours go into `tailwind.config.ts` as named tokens (`ink`, `surface`,
`accent`, `verdict-tight`, …) and a handful of shared components (`Button`, `Chip`, `Card`,
`Field`, `Tabs`) replace the repeated class strings. Today there are about 460 hand-written
`className` uses across 59 files and no shared components, which is why the screens drifted
apart.

## 4. Shopper pages

### 4.1 Product page — choosing and entering measurements

- White header: back link with the shop name, TH/EN toggle as a pill.
- Photo, product name, then the pickers (Size, Colour, …) as 44px chips. An unavailable
  combination stays visible, dashed and struck through, as today.
- Tabs ความพอดี / สี / เนื้อผ้า under the pickers. Behaviour unchanged (hidden when there is nothing to show;
  the fit form is never unmounted, so typed measurements survive a tab change).
- "ขนาดของคุณ" section:
  - The size helper becomes one card: หญิง/ชาย switch and S M L XL on one row. "Estimate the
    rest" stays, as a text button under the fields.
  - Measurement fields in a two-column grid, each with a "ซม." suffix inside the field and its
    how-to-measure hint underneath. Today they are stacked full-width, so the Check button is
    far below the fold.
  - One line saying blank fields are simply not scored.
  - Full-width teal **ตรวจสอบความพอดี** button.
- The "we filled this in from your last visit — clear" notice keeps its behaviour, restyled.

### 4.2 Fit result

Replaces the small chip + list. Order on the screen:

1. **Summary card.** Label "สรุป · ไซซ์ M" (the picked version's size label when there is one), the
   overall verdict as a 30px heading with its icon and colour, and one sentence built from the
   result: how many scored measurements are good, and which ones are not
   ("พอดี 4 จาก 5 จุด ส่วนไหล่จะแนบตัว"). The sentence is generated from the verdicts — no new judgement.
2. **Per-measurement rows.** Name, verdict chip, the existing difference phrase
   ("ใหญ่กว่าตัว 4.0 ซม."), and — if §8 decision 1 is yes — the ease bar.
3. **แก้ไขขนาดของคุณ** button that scrolls back to the form.
4. **Try-on card** (§6).

After a successful check the page scrolls to the summary card, as it scrolls to the result today.

### 4.3 Ease bar (decision 1)

A thin bar per measurement split into คับ · พอดีตัว · พอดี · หลวม zones, with a dot where this garment
lands for this shopper.

- **Needs one API addition.** `/api/fit/evaluate` returns verdict and difference per measurement
  but not the rule that produced them, and each garment can have its own rule, so the browser
  cannot know where the zones start. The response gains, per scored measurement, the three
  numbers of the rule in force (`tightBelow`, `goodFrom`, `goodTo`). The route already has them
  — it snapshots the rule into the saved fit session.
- The bar is drawn in ease (garment minus body), the same direction the owner sets rules in.
  Zone widths come from the rule, so a stretchy-fabric rule draws a different bar.
- The dot is clamped to the ends of the bar; the chip and the phrase stay the source of truth.
- Boundaries are inclusive-edge (ease exactly at `goodFrom` is snug) — the bar must agree with
  the engine at the edges. Unit-tested in `lib/`.

### 4.4 Other sizes row (decision 2)

"ไซซ์อื่นของสินค้านี้": for the other values of the Size picker, one line each — "ไซซ์ L · พอดีทุกจุด".

- Needs the fit check run for sibling versions too. Either the browser calls the existing
  endpoint once per sibling (each call saves a fit session and counts against the rate limit —
  not acceptable), or a new read-only endpoint evaluates several versions without saving.
  This is the only part of the redesign that is a feature, not a restyle.

### 4.5 Shop browse page, colour and fabric tabs, not-found and error pages

Same tokens and components. No layout change beyond card radius, spacing and the header.

## 5. Owner dashboard

- **Header** becomes white: shop name with the หลังร้าน badge, tabs สินค้า / กฎของร้าน in the header row,
  then คัดลอกลิงก์ร้าน, language, log out. (Today: dark bar, tabs on a second row.)
- **Folder list** in a white card, 44px rows, product count on each row. Drag-and-drop targets
  and the phone back-header behave as today.
- **Toolbar** in one white card: search, tag chips, จัดการแท็ก, sort, ต้องตรวจสอบ. All state stays in
  the address bar as today.
- **Product cards**: photo, name, "n แบบ", tags, ต้องตรวจสอบ in dark orange with an icon, footer
  with ดูหน้าร้าน and the ⋯ menu.
- **Product page, garment form, fit-rules pages, dialogs, login and signup**: restyled with the
  shared components. No field moves; the discard guards and Thai error messages are untouched.

## 6. Try-on for the demo (decision 3)

The stub shows one fixed sample image whatever photo the shopper gives, under the heading
"รูปคุณใส่สินค้านี้ / You in this item". In front of an audience that reads as a claim the product
cannot back.

Proposed: keep the card, mark it **ตัวอย่าง / Sample**, and change the result heading to say it
is a sample image. Alternative: hide the card entirely until Phase 2.

## 7. Build order

Each stage ships on its own pull request and is checked by the founder on the preview.

1. **Foundation** — font, colour tokens, shared components. No screen changes yet except the
   font. Small and safe.
2. **Shopper product page and fit result** (§4.1, §4.2, §6). This is what a demo audience sees.
3. **Ease bar** (§4.3), if kept.
4. **Dashboard** (§5): header, folder list, toolbar, product cards.
5. **Everything else**: shop browse page, forms, fit rules, dialogs, login, signup.
6. **Other sizes row** (§4.4), if kept — after the demo.

Stages 1–2 are the minimum for the demo. If time is short, stop there: the shopper side will be
new and the dashboard will still be the old look, which is acceptable if the demo is led from
the shopper's phone.

## 8. Decisions for the founder

1. **Ease bar — keep?** Recommended: yes. It is the one element that shows *how close* a fit is,
   and it only needs three numbers added to an existing response.
2. **Other sizes row — keep?** Recommended: yes, but after the demo. It needs a new endpoint.
3. **Try-on in the demo — label it "Sample", or hide it?** Recommended: label it. It shows
   where the product is going without pretending it is there.

Also needed from the founder: **the demo date**, to decide how many stages fit before it.

## 9. Testing

- Unit tests in `lib/` for the summary sentence and the ease-bar positions, including the
  inclusive edges (use garment 97 / customer 100 for a good fit, never 96 / 100).
- Component tests for the shared components and the result view.
- No route or database tests exist, so the evaluate response change is checked by hand on the
  preview. **The preview uses the live database** — a fit check there saves a real record.
- Each stage: `npm test && npm run build`, then the founder walks the changed screens on a
  phone and a computer, in Thai and English.

## 10. Risks

- **Restyling 59 files invites accidental behaviour changes.** Stages are kept small, and the
  shared components are introduced first so later stages are mostly swaps.
- **Font loading** adds a web font where there was none. `next/font` self-hosts it; check the
  first paint on a phone on mobile data.
- **Thai line height.** Thai marks above and below the line are clipped by tight line heights;
  keep 1.5 for body text and at least 1.15 for large headings.
