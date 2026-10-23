---
name: Branilist Bot
description: A calm anime-club workspace for Branilist in Discord.
colors:
  primary: '#ff9955'
  accent-ink: '#2e1a0c'
  primary-hover: '#ffb37e'
  neutral-bg: '#121311'
  surface: '#1a1b18'
  surface-raised: '#22231f'
  border: '#32342d'
  text: '#edeee9'
  muted: '#a9ada0'
  danger: '#ff9c99'
  success: '#a8d8a5'
  field-bg: '#12140f'
  field-border: '#3c4133'
  field-text: '#e5e9dd'
  secondary-bg: '#282a23'
  secondary-border: '#424539'
  secondary-hover: '#34372d'
  settings-bg: '#191b17'
  settings-border: '#33362d'
  nav-active-bg: '#352a20'
  nav-active-text: '#ffc08f'
typography:
  display:
    fontFamily: "'Manrope Variable', Manrope, sans-serif"
    fontSize: 'clamp(2.8rem, 4.3vw, 4.8rem)'
    fontWeight: 800
    lineHeight: 1.09
    letterSpacing: '-0.04em'
  headline:
    fontFamily: "'Manrope Variable', Manrope, sans-serif"
    fontSize: '1.85rem'
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: '-0.035em'
  title:
    fontFamily: "'Manrope Variable', Manrope, sans-serif"
    fontSize: '1.25rem'
    fontWeight: 750
    lineHeight: 1.4
    letterSpacing: '-0.035em'
  body:
    fontFamily: "'Manrope Variable', Manrope, sans-serif"
    fontSize: '0.8rem'
    lineHeight: 1.7
  label:
    fontFamily: "'Manrope Variable', Manrope, sans-serif"
    fontSize: '0.76rem'
    fontWeight: 650
  command:
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace'
    fontSize: '0.9em'
rounded:
  field: '7px'
  nav: '8px'
  control: '9px'
  notice: '10px'
  preview: '12px'
  panel: '14px'
  dialog: '16px'
  scene: '18px'
spacing:
  field-gap: '9px'
  compact: '12px'
  row: '16px'
  group: '22px'
  panel: '24px'
  column: '28px'
  shell: '34px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.accent-ink}'
    rounded: '{rounded.control}'
    padding: '12px 18px'
  button-primary-hover:
    backgroundColor: '{colors.primary-hover}'
  button-secondary:
    backgroundColor: '{colors.secondary-bg}'
    textColor: '{colors.text}'
    rounded: '{rounded.control}'
    padding: '12px 18px'
  button-quiet:
    backgroundColor: 'transparent'
    textColor: '{colors.muted}'
    rounded: '{rounded.control}'
    padding: '12px 18px'
  text-field:
    backgroundColor: '{colors.field-bg}'
    textColor: '{colors.field-text}'
    rounded: '{rounded.field}'
    padding: '10px 12px'
  settings-panel:
    backgroundColor: '{colors.settings-bg}'
    rounded: '{rounded.panel}'
    padding: '24px'
  nav-active:
    backgroundColor: '{colors.nav-active-bg}'
    textColor: '{colors.nav-active-text}'
    rounded: '{rounded.nav}'
    padding: '12px'
---

# Design System: Branilist Bot

## Overview

**Creative North Star: "Anime club at night"**

An anime club at night: warm graphite panels, quiet neutral lettering and restrained orange actions frame real anime cover art. The workspace feels calm and useful; server administration and personal account authorization have separate destinations.

The shipped interface uses thin seams and tonal layers rather than decorative dashboard effects. Cover art supplies visual richness, while labels, state messages and a working Discord response preview explain what controls do.

**Key Characteristics:**

- Warm graphite layers with restrained orange actions.
- Self-hosted Manrope and compact, explicit labels.
- Original-host catalog covers with resilient initial fallbacks.
- Live draft preview and an explicit pending-save state.

Recorded from the shipped web implementation after its finish review. Visual authority is the user-approved anime-club direction in `.impeccable/surfaces/web.md`; implementation values come from `web/styles.css`, `web/components.tsx`, `web/settings.tsx` and `web/main.tsx`.

## Colors

The palette combines warm, slightly olive graphite with soft neutral ink and a warm orange primary.

### Primary

- **Club orange** (`primary`) marks actions, focus rings, switches and command links; **dark orange ink** keeps filled actions legible.
- **Warm orange hover** (`primary-hover`) provides a clear state change without movement.

### Neutral

- **Night graphite** (`neutral-bg`) is the page ground; **panel graphite** and **raised graphite** provide the surface hierarchy.
- **Soft neutral ink** (`text`) carries content; **quiet sage ink** (`muted`) carries supporting descriptions.
- **Graphite seam** (`border`) divides groups. Dedicated field and settings seams retain the same tonal family.
- **Ember selection** (`nav-active-bg`, `nav-active-text`) identifies the current destination.

Danger and success are semantic feedback colors, not competing brand accents. Notices pair their color treatment with icons and explicit text.

**The Action Orange Rule.** Use orange for primary actions, focus, selected switches and command links; keep large workspace surfaces graphite.

## Typography

**Display Font:** Manrope Variable, with Manrope and sans-serif fallback.
**Body Font:** The same self-hosted family.
**Label/Mono Font:** System monospace for command syntax and prefix editing only.

Manrope's compact curves and heavy headings make the interface friendly without making controls playful. Headings balance their wrapping; running paragraphs use comfortable line spacing.

### Hierarchy

- **Display:** frontmatter display role for the public hero, limited to 11.5ch on desktop.
- **Headline:** dashboard page title; mobile sizes step to 1.65rem at 760px and 1.55rem at 420px.
- **Title:** section headings; smaller headings use 1rem at 750 weight and 1.45 line height.
- **Body:** dashboard descriptions use the frontmatter role and up to 75ch; public hero copy uses 1rem with 1.85 line height and 43ch.
- **Label:** field labels use the frontmatter role; button labels use 0.84rem, 750 weight and 1.3 line height. Helper text is typically 0.67–0.72rem.
- **Command:** compact syntax and tabular numerals. Statistics and times also use tabular numerals.

## Layout

The desktop dashboard has a fixed 244px sidebar and a flexible main column. The header is 78px high; main content is capped at 1640px with 36px 34px 100px padding. Settings use a flexible form plus a 285–330px preview column, with 28px between them. The preview sticks 27px below the viewport top. Settings panels use 24px padding; field and panel gaps are 22px.

Public content uses a 1280px shell with 40px side padding. The hero is two equal columns separated by 78px; its presentation panel has a deliberate 1deg rotation. Catalog covers form five equal columns with 24px gaps.

- **1600px and wider:** preview becomes 360px, settings gap becomes 35px, panels use 28px padding, catalog grows to six columns.
- **1200px and narrower:** settings preview is 285px, gap 22px, panels 20px; form fields and command options stack; catalog becomes four columns.
- **1000px and narrower:** fixed sidebar becomes native modal navigation; header becomes 68px, save bar starts at the viewport left. Settings preview becomes 315px with a 24px gap.
- **760px and narrower:** hero and settings stack; preview follows the form and loses sticky positioning. Main uses 29px 22px 110px padding. Field and command groups return to two columns; catalog uses three columns. Hero rotation is removed.
- **420px and narrower:** fields and command options stack again; catalog becomes two columns; hero heading is 2.65rem.

The body supports a 320px minimum width. Grids use minmax(0, 1fr), controls wrap, and activity tables scroll inside their own container. Preserve these behaviors for translated content.

## Elevation & Depth

Tonal panels and 1px seams establish workspace depth. Working panels do not use shadows. The public hero demonstration uses a diffuse shadow (`0 26px 62px #0004`); dialogs use `0 28px 70px #0007`. Modal backdrops dim surrounding content (`#000b`; navigation uses `#000a`).

**The Quiet Panel Rule.** Separate working areas with tonal changes and thin seams; reserve diffuse shadows for the public demonstration and dialogs.

## Shapes

Use gently rounded fields, navigation and actions according to the frontmatter roles. Settings panels have 14px corners, previews 12px, dialogs 16px and the desktop public scene 18px. Covers use 9px corners with a 230:326 ratio and object-fit cover; small embedded art uses 4px corners. Rounded switches and small status dots convey binary state rather than ornament.

## Components

### Buttons

Filled orange actions are confident and compact; secondary actions use a graphite fill and a 1px secondary seam. Quiet actions are transparent and muted, becoming graphite with light text on hover. Standard actions have a 44px minimum height, 9px icon gap and the frontmatter padding. Compact actions use 38px height and 9px 13px padding. Disabled buttons reduce opacity to 0.5 and show a disabled cursor.

### Inputs / Fields

Visible labels sit 9px above full-width inputs. Fields use the frontmatter colors, 1px borders, 42px minimum height and 10px 12px padding. Native select controls retain accessible semantics. Search groups use a 2px orange focus-within outline at 2px offset. All standard interactive controls use a 2px orange focus-visible outline at 4px offset; switches use 5px offset.

### Navigation

Sidebar links are at least 44px tall, with 0.78rem semibold text, 12px padding and 8px corners. Hover adds a graphite fill; the selected route uses ember selection colors. At 1000px, a labelled menu button opens a native dialog, with close action, backdrop dismissal and closure on route changes. The drawer is min(300px, 90vw), full dynamic viewport height.

### Chips

Channel choices are labelled native checkboxes inside 8px rounded, 1px outlined cells, padded 11px 12px. Their labels wrap instead of clipping. Segmented filters use 9px group corners and 6px button corners; aria-pressed identifies selection, with a sage graphite selected fill (`#37412c`) and light ink (`#e4edda`).

### Cards / Containers

Fieldsets carry a legend and concise supporting text inside bordered graphite panels. Media tiles stay open to the page, with the cover above metadata and title. Cover hover increases brightness to 1.08 over 0.15s. Images reserve intrinsic dimensions; unavailable covers reveal a title-initial fallback rather than a broken image.

### Switches and pending save

Labelled native checkbox switches sit beside text and help. The 38px by 22px track contains a 16px thumb, which translates 16px when checked. Focus remains visible around the track. Switching a field updates the response preview immediately, while the server state remains pending.

Only dirty forms show the fixed save bar. Save validates the draft, disables actions while busy and clears pending state only after the authorized response succeeds. Discard restores saved values. Navigation away from dirty settings requests confirmation; errors and success use explicit notices with alert/status semantics.

### Discord response preview

Use the literal Discord message structure: channel, requester, bot identity, media title, optional synopsis and cover, metadata, and Branilist link. The configurable 3px embed stripe belongs to this message grammar only. Prefix, nickname, title language, synopsis, cover and compact layout reflect the draft. The APP tag and external-link icon are functional cues, not a separate brand palette.

### Accessibility, interaction and motion

Maintain the skip link, main focus target, visible field labels, screen-reader names for icon-only controls, semantic fieldsets, native dialogs, role=switch and aria-pressed states. Decorative icons are hidden where supplied. Cover alternatives name the media; avatars are decorative next to user text. Loading uses role=status; errors use role=alert.

Motion is brief: button colors, cover brightness and switch thumb transitions take 0.15s. The save bar enters from 9px below over 0.2s with cubic-bezier(0.16, 1, 0.3, 1). Loading spins at 0.8s linear. Reduced-motion preference reduces animation and transition durations to 0.01ms, limits animation to one iteration and restores automatic scrolling.

### Asset provenance

Catalog cover URLs originate in public Branilist catalog snapshots in `shared/example-media.ts`, retrieved with the published SDK. The actual images remain at their original `media.branilist.com` and `cdn.myanimelist.net` hosts; no cover raster is copied into the repository. They are catalog illustrations rather than claimed original brand artwork.

`web/public/favicon.svg` is the self-authored orange Branilist B mark. Manrope Variable is self-hosted through `@fontsource-variable/manrope`, imported in `web/main.tsx`; its bundled license remains with the dependency. Interface icons are Lucide SVGs, with a dedicated SVG Discord mark. Review screenshots are local verification artifacts, not shipping illustration assets.

## Do's and Don'ts

### Do:

- **Do** keep the pending save bar and preview synchronized with the draft.
- **Do** preserve visible labels, focus outlines, native dialog behavior and reduced-motion support.
- **Do** retain original catalog cover hosts and the image fallback.
- **Do** use actual data or clearly labelled demo examples.

### Don't:

- **Don't** import the inspiration site's mascot, branding or unrelated moderation features.
- **Don't** turn the Discord embed's 3px accent stripe into general card decoration.
- **Don't** replace the calm graphite world with neon, decorative gradients or invented adoption statistics.

Not canonized: no material UI defect remains from the finish review. The detector-only 3px stripe finding was accepted as literal Discord embed grammar; it is not a general decoration rule.
