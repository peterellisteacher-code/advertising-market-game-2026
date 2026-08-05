# Fable game-feel and creative-options implementation plan

> **Approved source:** `docs/superpowers/specs/2026-08-05-fable-game-feel-and-creative-options-design.md`

Implement with red-green-refactor discipline. Do not alter Image Lab/Fal code or the account/Supabase contract. Do not launch Windows Godot. Use `corepack pnpm` for JavaScript tooling.

## Task 1: Agency motion, ambient motion and rival artwork

**Files**

- Modify: `godot/src/agency/player/agency_pair.gd`
- Modify: `godot/src/agency/agency_world.gd`
- Modify: `godot/scenes/agency/AgencyWorld.tscn`
- Create: `godot/src/agency/agency_ambient_motion.gd`
- Create: `godot/scenes/agency/AgencyAmbientMotion.tscn`
- Modify: `godot/src/market/local_market_session.gd`
- Create: `godot/assets/market/rivals/*.png`
- Modify: `godot/tests/test_agency_world.gd`
- Modify: `godot/tests/test_local_market_session.gd`

### Steps

1. Add failing agency tests for idle/walk/direct-travel state, neutral reduced-motion transforms, ambient overlay presence and reduced-motion propagation.
2. Implement sprite-local, delta-based idle/walk animation in `AdMarketAgencyPair`. Preserve the character root, collider and interaction area.
3. Make direct travel explicitly enter and leave the walking state. Propagate reduced motion to both the pair and ambient overlay.
4. Add a noninteractive ambient overlay with subtle status-light motion and a deterministic neutral reduced-motion state.
5. Add failing market tests proving every seeded rival artwork is a decodable 640 by 360 PNG, the four outputs are distinct and each includes meaningful foreground/background variation.
6. Copy the selected project-owned cooler, terrarium, bicycle and lamp masters into `godot/assets/market/rivals/`.
7. Replace rectangle-only artwork generation with offline image compositions. Keep all listing text and market data unchanged.
8. Run the focused Godot script tests using the repository's verified Linux/web-safe test command; never invoke a Windows Godot executable.

## Task 2: Display preferences, bundled fonts and curated backgrounds

**Files**

- Create: `web/src/ui/display-preferences.ts`
- Create: `web/src/ui/display-preferences.test.ts`
- Modify: `web/src/ui/editor-shell.ts`
- Modify: `web/src/ui/editor-shell.test.ts`
- Modify: `web/src/styles/editor.css`
- Modify: `web/src/main.ts`
- Modify: `web/src/logo-lab/logo-mark-model.ts`
- Modify: `web/src/logo-lab/logo-mark-model.test.ts`
- Modify: `web/src/product-kit/curved-label-renderer.ts`
- Modify: `web/src/product-kit/curved-label-renderer.test.ts`
- Modify: `web/src/fabric/logo-mark-factory.ts`
- Create: `web/src/assets/ad-background-presets.ts`
- Create: `web/src/assets/ad-background-presets.test.ts`
- Modify: `web/src/catalogue/catalogue-runtime.ts`
- Modify: `web/src/catalogue/catalogue-runtime.test.ts`
- Create: `web/public/fonts/*`
- Modify: `CREDITS.md`

### Steps

1. Add failing model tests for defaults, validation, resilient storage and separate student/teacher keys.
2. Implement the display-preference model and mount one compact, accessible Display panel in the editor top bar.
3. Apply data attributes and scoped CSS for large text and high contrast. Do not style the authored canvas from those attributes.
4. Add failing allowlist and font-loading tests, then bundle three licensed display typefaces, extend straight/curved text allowlists together and wait for selected faces before canvas object creation where supported.
5. Add failing tests for six stable, text-free background records and their placement classification.
6. Implement the background records as local SVG data assets and expose them as a `Backgrounds` library view through the existing catalogue runtime and placement queue.
7. Confirm background placement is undoable, editable and compatible with selection, ordering, visibility, locking and deletion.
8. Run focused Vitest files and `corepack pnpm run typecheck`.

## Task 3: Integrated verification and release

1. Confirm the worktree contains no unrelated or Image Lab/Fal changes.
2. Run the full relevant test, typecheck, build, Godot export/hash and repository-sync gates once on the stable candidate.
3. Verify the generated web artifact in a real browser at 1280 by 800 and 1440 by 900: movement states, rival artwork, Display preferences, font options, background placement, teacher playtest and student route.
4. Run one fresh isolated final code review. Resolve substantiated release blockers and rerun only invalidated evidence.
5. Commit the bounded source groups, push the feature branch, merge it into the canonical public repository's main branch, and verify remote ancestry.
6. Deploy the exact verified artifact to the linked production Netlify site and record deploy ID, URL and artifact hash.
7. Recheck hosted student and teacher-playtest paths, browser console and network failures. Do not mutate Supabase unless verification exposes a separately authorised schema/configuration defect.
8. Commit and push the final release-verification record, then report remaining Safari/school-wifi uncertainty explicitly.
