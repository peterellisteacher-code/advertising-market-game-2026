# Compact canvas command dock design

Date: 2026-08-11. Owner: Codex under Peter's approved UI direction. Applies to the web Studio in student and teacher-playtest routes.

## Problem

The advertisement toolbar is currently a five-row floating card. Visible save,
zoom-selection and deletion-help sentences make the card substantially taller
than its actions. When the Item list opens, its fixed bottom clearance is smaller
than the card, so the two surfaces overlap and part of the Item list becomes
unreachable or obscured at classroom laptop heights.

## Approved outcome

Replace the card with one compact command dock along the bottom of the
advertisement workspace. The buttons explain the available actions and size to
their labels, with only normal control padding:

`Undo` · `Redo` · `−` · `Fill ad` · `+` · `Items` / `Close items` ·
`Delete selected item`

The dock remains part of the canvas action area. It is not a global browser
footer and it does not cover unrelated page chrome. At the supported desktop
viewports it stays on one centred row rather than becoming a multi-row card.

## Information and accessibility

- Remove the three standing explanatory rows from visual layout: save state,
  selected zoom target and deletion reason.
- Keep those states available to assistive technology through the existing
  status regions. They may be visually hidden but must continue announcing
  changes.
- Keep precise `aria-label`, `aria-description`, `title`, disabled state and
  keyboard shortcuts. `−` and `+` retain their full accessible names.
- `Delete selected item` remains visibly labelled and disabled until the
  selected object is removable. Its explanation remains available through its
  accessible description.
- Do not reduce contrast or the existing keyboard focus indicator.

## Item-list coexistence

- The Item list sits above the command dock with a shared CSS clearance token,
  so the two surfaces cannot overlap.
- The Item list receives a viewport/workspace-bounded maximum height and scrolls
  internally when its content is taller.
- Opening or closing the Item list continues to change the button label and
  accessible expanded state. Focus behaviour and item actions are unchanged.

## Boundaries

- Preserve all editor commands and document behaviour; this is layout and
  visible-copy simplification, not a command redesign.
- Preserve the separate teacher-playtest control strip.
- Desktop/laptop only. Do not add phone layouts, touch-specific behaviour or
  phone breakpoints.
- No Godot scene or script change, no Supabase change and no Netlify function
  change are expected.

## Implementation surfaces

- `web/src/ui/editor-shell.ts`: identify the three status nodes as non-visual
  announcements while retaining their DOM/API hooks.
- `web/src/styles/editor.css`: convert `.creator__canvas-size` to a one-row,
  content-width dock and make `.creator__layers` reserve its exact height.
- Existing shell and canvas-accessibility tests: retain semantic assertions and
  add the compact-dock/non-overlap contract where it can be tested statically.

## Acceptance evidence

1. Focused unit tests prove all seven commands remain present, correctly named,
   enabled/disabled and connected to their status semantics.
2. Static style tests prove the dock is a single row with content-width buttons
   and that the Item list uses the same bottom-clearance token.
3. Browser QA at 1280×800 and 1440×900 proves:
   - the dock is a short bottom strip;
   - buttons are only modestly wider than their labels;
   - the advertisement remains unobscured;
   - the complete Item list is reachable with no overlap;
   - teacher-playtest controls do not block editor commands.
4. Full repository test, type-check, web-build and repository-sync gates pass
   before release.
