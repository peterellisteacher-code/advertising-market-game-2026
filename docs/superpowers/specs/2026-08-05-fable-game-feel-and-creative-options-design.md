# Fable game-feel and creative-options design

**Status:** Approved for implementation by Peter Ellis on 5 August 2026.

## Purpose

Improve the parts of Ad Market that still feel static or visually limited without changing its classroom sequence, assessment logic, account system, Image Lab, or teacher controls. The release must remain usable on school MacBooks with keyboard and mouse or trackpad.

## 1. Agency movement

The two role characters retain their current sprites, collision body, room bounds, role highlighting and interaction range. Movement gains lightweight, time-based visual motion:

- idle characters breathe or settle subtly;
- walking characters bob and lean in the direction of travel;
- direct travel uses the same walking state until arrival;
- stopping, opening a modal, or disabling input returns the characters to idle;
- reduced-motion mode immediately restores neutral transforms and suppresses all looping motion.

The animation changes only sprite-local transforms. It must not move collision shapes, interaction areas or the character root, so pathing and station reachability remain unchanged.

## 2. Rival advertisements

The four seeded rival listings keep their existing names, prices, taglines, campaign data and market mechanics. Their coloured rectangles are replaced with four distinct advertising compositions using project-owned product artwork:

- cooler;
- terrarium;
- bicycle;
- lamp.

Each 640 by 360 image uses a recognisable product, a deliberate background, framing and accent shapes. Listing text remains accessible HTML/Godot UI text rather than rasterised into the image. Images remain generated locally at session start, require no network request and must decode as valid PNGs.

## 3. Display preferences

The studio top bar gains one compact **Display** control. Its panel offers:

- standard or large interface text;
- standard or high-contrast interface colours.

Preferences are persisted defensively in separate student and teacher-playtest storage namespaces. Invalid or unavailable storage falls back to standard settings. The preference affects editor chrome, dialogs and controls only; it must not change the authored advertisement, its canvas dimensions, exported artwork or scoring.

The panel is keyboard and pointer operable, closes predictably, and exposes its state through native controls and ARIA relationships. Large text must reflow without clipping at 1280 by 800 and 1440 by 900.

## 4. Typography and backgrounds

The existing safe typeface allowlists expand in lockstep for straight and curved logo text. Three legible display families are bundled locally under compatible licences; no classroom session depends on a font CDN. Canvas creation waits for the selected face when the browser Font Loading API is available and otherwise degrades safely.

The Assets library adds a small, clearly named **Backgrounds** view containing six text-free, locally bundled designs. Choosing one places an editable, undoable full-ad background on the canvas through the existing asset-placement command path. Backgrounds are ordinary canvas objects: they can be selected, reordered, hidden, locked or deleted. Existing product material presets remain unchanged because the editor already provides eight distinct finishes.

## 5. Ambient office motion

The agency receives a restrained decorative overlay: small monitor/status-light pulses that do not compete with task markers or characters. It has no collision, interaction or game-state effect. Reduced-motion mode freezes it immediately.

## Non-goals

- no Image Lab, Fal, quota or prompt changes;
- no account, Supabase schema, password or approval-flow changes;
- no new lesson steps, scoring rules, terminology or mobile interface;
- no native Windows Godot launch;
- no replacement of current characters with a mismatched asset-pack style;
- no change to the current eight product material identifiers.

## Release evidence

The final candidate requires focused unit tests, the full relevant web and Godot test suites, TypeScript typecheck, production build/export and repository-sync gates, visual desktop QA at 1280 by 800 and 1440 by 900, one fresh final code review, production deployment, and hosted verification of the student and teacher-playtest routes. Safari and school-wifi behaviour remain field uncertainties unless tested on that reference hardware and network.
