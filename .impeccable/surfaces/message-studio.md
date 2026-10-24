---
version: 1
slug: "message-studio"
primary_target: "web/message-studio.tsx"
related_targets: ["web/message-studio-editor.jsx", "web/message-studio.css"]
---

# Message creator

Mode: Operate. Extend the incumbent dashboard using the functional prototype the user approved in this conversation. No new visual world or seed: inherit web.md, DESIGN.md and the approved preview.

## Direction contract

THESIS: Compose the Discord message beside its live result, then review delivery as a separate intentional action.

OWN-WORLD: Existing warm graphite/olive surfaces, Manrope, thin seams and restrained orange actions. Discord's message grammar is confined to the preview.

STORY: A manager chooses classic or V2, edits content and variables, imports/exports JSON, saves an account/server draft, chooses channel and bot/webhook identity, and confirms delivery.

FIRST VIEWPORT: Existing 244px dashboard navigation, heading/import/export, draft name, format/editor controls left and Discord preview right. Delivery sits beneath the preview, persistent save/review actions at the bottom. Mobile switches between editor and preview.

FORM: User-approved standalone HTML prototype branilist-embed-studio-preview.html, extended into the real dashboard shell. The existing web surface direction seed 4a6ce7e8 remains the only visual-world authority; no new roll applies.

SIGNATURE: Fields, format, variables and webhook identity immediately update the Discord preview. Variables resolve again from authenticated Discord data on send. Demo remains explicitly non-sending.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Proof: tests/browser/message-studio.spec.ts, tests/message-studio*.test.ts, work/embed-studio/integrated-review/. No locally shipped raster assets were introduced; preview sample art uses original MAL/Branilist media URLs.

## Completion

The integrated surface passed finish review with a ship verdict and no material visual fixes. Documentation checked the connected page, editor and scoped stylesheet against the incumbent system, plus classic, V2, mobile, webhook, review-dialog and English captures in `work/embed-studio/integrated-review/`. `DESIGN.md` and `.impeccable/design.json` remain unchanged: this is an ordinary extension of the approved identity. Captures are development evidence, not shipping raster assets; sample art retains its original MAL/Branilist URLs.
