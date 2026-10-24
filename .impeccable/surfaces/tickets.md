---
version: 1
slug: "tickets"
primary_target: "web/tickets/index.tsx"
related_targets: ["web/tickets/", "web/main.tsx", "web/styles.css"]
---

# Ticket management

Mode: Operate. Extend the incumbent dashboard using the ticket prototype approved by the user, now connected to the ticket API and Discord lifecycle. Inherit `web.md`, `DESIGN.md` and the existing design sidecar; this surface introduces no new visual world.

## Direction contract

THESIS: Place editable opening panels beside their Discord result, then give managers a clear path from intake questions to the operational queue and private support history.

OWN-WORLD: Existing warm graphite and olive surfaces, soft neutral ink, Manrope, thin seams and restrained orange actions. Native Discord gray, message accents and preview lettering remain confined to the message preview.

STORY: A manager configures team access and ticket rules, creates a classic or V2 panel with topics and questions, saves the draft and reviews publication. Members open private support tickets; authorized staff assign, transfer, annotate, close and reopen them, with access-checked transcripts and audit history.

FIRST VIEWPORT: The existing dashboard shell adds a dedicated Tickets navigation group. Opening panels show editable message previews; the editor places content and topic controls beside the preview, with progressive question settings. Overview, history, settings and permissions have separate destinations. The sidebar scrolls independently while identity and footer remain reachable. Mobile uses the shared native navigation dialog; the editor stacks and tables scroll within their own containers.

FORM: User-approved `branilist-tickets-preview.html`, integrated into the real dashboard. The existing web surface direction seed `4a6ce7e8` remains the visual authority. Ticket King references supplied functional inspiration, not a replacement identity. Compact ticket typography, control sizes and preview-specific values describe this approved surface; they do not replace global design tokens.

SIGNATURE: Draft edits immediately update the Discord preview. Saving the draft and publishing the Discord message are separate actions; a published panel retains its prior content and form until republished. Publication and real opening tests require an explicit review action. Demo mode is visibly identified and simulates Discord effects.

Form controls retain this visual system: a field-type picker adds short/long text, single/multiple selects, radio groups, checkbox groups and confirmation. Type-specific settings disclose help text, placeholders, options and response limits; fields can be reordered. The modal preview uses semantic native controls and scrolls within the viewport on desktop and mobile. Existing published forms remain stable until republished.

## Completion

The integrated surface passed a fresh finish review with a ship verdict and no material visual fixes. Documentation checked `web/tickets/tickets.css`, representative page/editor/preview/dialog components, shared shell navigation and responsive styles, shared ticket contracts and backend persistence/routes against the incumbent system. `DESIGN.md` and `.impeccable/design.json` remain unchanged because this is an ordinary extension.

Review evidence is in `.impeccable/review/tickets/`: `desktop.png`, `editor.png`, `questions.png`, `history.png`, `detail.png`, `settings.png`, `permissions.png`, `mobile.png`, `mobile-navigation.png`, `mobile-settings.png`, `english.png` and `spanish.png`. These twelve captures are development evidence, not shipping raster assets. No new bundled raster asset was introduced; manager-supplied panel images remain external URLs.

Functional validation reported 67 server tests, 18 browser tests, a build and production smoke checks passing. Discord permissions and lifecycle actions were exercised with mocked integrations and demo mode; no live tickets were sent. Functional setup, privacy, retention and recovery details live in `docs/tickets.md`.

Not canonized: detector warnings for native Discord preview lettering and its accent stripe remain confined to that message grammar. Literal palette, type and radius advisories from the approved compact prototype were reviewed without a material drift finding; they are not promoted into global tokens. Pre-existing system drift was outside this documentation pass and was not repaired.
