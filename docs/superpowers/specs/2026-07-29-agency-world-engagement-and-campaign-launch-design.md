# Advertising Market Game: Agency World and Campaign Launch Design

**Date:** 29 July 2026

**Status:** Approved for autonomous implementation by Peter's instruction to take creative liberties and continue through release

**Authoritative worktree:** `C:\tmp\admarket-integrated-fixes-20260723`

**Reference viewports:** 1280 × 800 and 1440 × 900
**Primary environment:** recent student MacBook on school wifi, usually Safari

## 1. Purpose

The current game contains a capable advertisement creator, persistence system,
pair-role tracking and classroom market. Its surrounding Godot experience is
still a sequence of large interface panels. A first-time player can read what
the game contains without immediately understanding:

- what the pair is trying to achieve;
- what to do now;
- why the current action matters;
- what each partner controls;
- how progress produces a satisfying outcome; or
- why moving through the stages should feel like playing a game.

This design adds a top-down advertising agency around the proven creator and
market. Students move through departments, complete short advertising
technique missions, apply the techniques to their own campaign and present the
finished advertisement in a visible campaign launch.

The new game must be understandable after ten seconds away from the screen.
The overall goal, current objective, controls and role responsibilities remain
available from a permanent tucked or untucked guide.

## 2. Design authority and retained systems

Peter authorised an ambitious redesign, graphics, varied gameplay, music,
sound effects and advertisement-presentation animation. This instruction also
authorises the implementation to continue without pausing for a separate
approval after each design gate.

The redesign retains:

- `/student`, `/teacher` and `/teacher/playtest`;
- account, cloud-save and teacher-playtest isolation;
- the existing Fabric advertisement creator;
- the campaign-document schema unless a demonstrated need requires migration;
- Art Director and Strategist contribution tracking;
- Invent, Advertise, Finalise and Market learning requirements;
- AIDA evidence;
- audience brief, price, route, proof point and final five-part review;
- live and practice markets;
- keyboard and accessibility contracts;
- student and teacher reset behavior; and
- the existing publication and market bridge contracts wherever possible.

It must not replace a verified classroom system merely to simplify the new
gameplay code.

## 3. Selected approach

### 3.1 Options considered

1. **Top-down Agency Day — selected.** Students freely move through a compact
   advertising agency. Departments contain short missions and open the existing
   creator or market at the relevant moment.
2. **Illustrated floor-plan menu.** Students click departments without moving
   an avatar. This is cheaper and mechanically accessible, but it preserves the
   feeling of navigating a website.
3. **Multi-lesson city RPG.** Students leave the agency, find clients and
   complete a longer campaign. This offers more exploration but weakens the
   one-lesson advertising task and increases save, content and asset scope.

The selected approach provides physical navigation and visible progress
without replacing the current advertisement production system. Direct
department travel from the guide preserves access for students who do not want
or cannot comfortably use free movement.

### 3.2 Session shape

The core campaign is designed for 50–60 minutes. Optional technique contracts
support early finishers and a longer session. Saved progress allows a class to
continue later, but the main arc does not require several lessons.

## 4. Learning and engagement brief

**Primary purpose:** direct learning gain with a deliberately hedonic game
frame.

**Learning intention:** a pair constructs an advertisement whose product,
message, visual composition, claim, price and market route respond to one
audience brief.

**Primary cognitive move:** Construct.

**Supporting moves:** Apply advertising techniques and analyse their effects.

**Named stumbling block:** `technique-spotting-without-effect`. Students often
name salience, contrast, framing, reading path or AIDA without making a choice
that changes what the audience sees, thinks or does.

**Representation:** an explorable agency plus focused technique missions. Each
successful mission ends by requiring the pair to apply or record the technique
in its own advertisement.

**Paired visual:** the agency map makes the production sequence spatial:
audience brief → research → concept → advertisement → credible offer → pitch.

**Social structure:** two students cooperate on one MacBook with individual
accountability. Each role owns different decisions and the pair must hand over
control.

**Target experience:** energetic, creative and competent. Students should feel
that they are operating an agency, not completing a disguised worksheet.

**Tension sources:**

- productive failure: an early design receives specific audience feedback and
  can be revised;
- resource choice: the pair cannot foreground every message or technique;
- shared responsibility: the final campaign requires evidence from both roles;
- public comparison: the market applies the same five criteria to campaigns.

**Motivators:**

- control through product, composition, copy and route choices;
- competence through immediate, specific technique feedback;
- curiosity through new departments and campaign formats; and
- relatedness through role interdependence and the class market.

## 5. Core game loop

The repeated loop is:

1. Follow the current objective to a department.
2. Inspect one advertising problem.
3. Make a technique or strategy choice.
4. See the audience effect immediately.
5. Apply or record that choice in the pair's campaign.
6. Receive a campaign-strength update and the next destination.

Walking is connective play, not the learning task. Progress is earned only by
advertising decisions and visible campaign evidence.

## 6. First two minutes

The game applies the Andersen 2-minute test. It does not open with a slideshow
or multi-page tutorial.

Round 0 contains only:

- the overall goal: win the client pitch by producing a complete campaign;
- the current objective: meet the client;
- movement: WASD or arrow keys;
- interaction: E or Enter;
- guide toggle: G or the visible Guide tab; and
- the two role badges.

A pulsing floor route leads to the client desk. The first interaction teaches
one additional rule: the active role owns the current station. Later mechanics
are introduced only when first needed.

## 7. Agency world

The agency is one compact, visually continuous floor. It must fit in memory and
load reliably on school wifi. Rooms are visually distinct without requiring a
separate scene load for ordinary travel.

### 7.1 Reception and Client Briefing

Purpose:

- name the campaign goal;
- choose or receive the audience brief;
- explain the literal difference between partner roles; and
- assign who begins as Art Director and Strategist.

The client presents one short factual card at a time: context, need, values and
intended audience response. The pair identifies the most important audience
insight before leaving.

### 7.2 Strategy Room

Primary owner: Strategist.

The pair tests product ideas against the audience brief. A strong choice must
link a product feature to a named audience need or value. The Strategist
records the product name and message direction. The Art Director's holding
action is to sketch or select a visual symbol that could make the need visible.

### 7.3 Art Studio

Primary owner: Art Director.

The room teaches and rehearses visual composition through short interactive
missions. The Art Director controls placement, size, crop, colour, contrast and
reading path. The Strategist's holding action is to state which audience
response the visual choice should produce.

### 7.4 Copy Room

Primary owner: Strategist.

The room separates the four AIDA moves and connects each one to actual campaign
copy. The Strategist controls product name, claim, supporting words, call to
action and proof point. The Art Director's holding action is to identify the
visual object that supplies evidence for each AIDA move.

### 7.5 Production Studio

Shared workstation.

This department opens the existing Fabric creator. The surrounding world
pauses safely while the creator overlay is open. Tool groups are role-aware:

- Art Director controls product appearance, imagery, colour, arrangement,
  crop, layer order and presentation style.
- Strategist controls product name, advertising words, claim, price reasoning,
  market-route reasoning and proof point.
- shared actions require an explicit handoff or joint confirmation.

The UI cannot identify which human is touching the same MacBook. It therefore
enforces role ownership through the active-role state, visible control groups
and handover prompts rather than pretending to authenticate each person.

### 7.6 Media Desk

Primary owner: Strategist, with Art Director confirmation.

The pair sets the price, chooses where the audience will encounter the
advertisement and supports the main claim. A route is valid only when its
medium and location fit the selected audience. The Art Director confirms that
the final layout makes the offer and claim visible.

### 7.7 Sound Booth

Optional department.

The pair previews three campaign-safe presentation sound cues and up to three
short atmospheric presentation loops. These sounds accompany the final pitch;
they are not embedded into the exported advertisement image.

The booth never blocks completion. Audio has text labels and visible feedback.

### 7.8 Pitch Theatre

The final review and publication occur here. The pair's exact published PNG is
decoded from the existing `pngBase64` publication payload and placed into the
theatre displays.

The final presentation shows the advertisement in:

- a wide billboard;
- a magazine spread; and
- a vertical digital screen.

The class market remains the comparison and judgement phase. The theatre is
the pair's payoff before or after market interaction, not a replacement for
peer judgement.

## 8. Partner roles and controls

### 8.1 Literal role distinction

**Art Director**

- decides what the audience sees first;
- controls imagery, colour, composition, crop, scale and arrangement;
- chooses the campaign-presentation animation; and
- must record at least one visible canvas change.

**Strategist**

- decides what the advertisement says and why it should persuade;
- controls product name, AIDA wording, claim, price reasoning, route reasoning
  and proof point; and
- must record at least one visible message or strategy change.

Both roles work for the same audience brief. Swapping roles exchanges current
responsibilities; it does not delete authorship history.

### 8.2 Pair turn structure

Every role-owned station states:

1. who takes the keyboard or trackpad;
2. what that role must decide;
3. the other role's holding action; and
4. when control changes.

The active agency avatar wears the active role's colour. The partner avatar
follows. When roles swap, the avatars exchange lead position and the guide
updates immediately.

### 8.3 Core controls

- Move: WASD or arrow keys.
- Interact: E or Enter.
- Guide: G or the permanent Guide tab.
- Pause/back: Escape.
- Creator and menu controls: Tab, Shift+Tab, Enter and Space, with ordinary
  pointer support.

No required action depends on precise timing, simultaneous two-hand input or
colour alone.

## 9. Permanent goal and guidance system

The guide is a `CanvasLayer` above the world and remains callable from all
gameplay states except the browser's secure account gate.

### 9.1 Tucked state

The compact state shows:

- overall goal;
- current objective;
- active role;
- next destination arrow;
- campaign progress; and
- a labelled Guide button.

It must not cover the avatar or current interaction target at either reference
viewport.

### 9.2 Untucked state

The expanded guide contains:

- **Goal:** the final product and win condition.
- **Current objective:** one action only.
- **Why this matters:** its link to audience response or campaign evidence.
- **Done when:** an observable stop-condition.
- **Controls:** only controls available in the current state.
- **Roles:** complete Art Director and Strategist definitions.
- **Progress:** completed and remaining departments.
- **Go to objective:** direct travel for accessibility or recovery.
- **Complete guide:** the existing numbered reference, rewritten to match the
  spatial journey without losing its argument structure.

Closing the guide returns focus to the prior control or gameplay state.

### 9.3 Re-entry rule

After a student looks away, reloads or returns from the creator, the first
visible sentence must still name the current objective. No state resumes into
an unexplained room or modal.

## 10. Technique missions

Technique missions use original fictional examples. The source PowerPoints
inform technique coverage but their branded advertisements are not copied into
the public repository.

### 10.1 Salience Lab

The player adjusts size, contrast and surrounding visual noise to make the
intended subject the first focal point. Feedback identifies what currently
draws the eye and why. The mission succeeds through a defensible focal
hierarchy, not one hidden pixel-perfect answer.

### 10.2 Reading Path

The player positions three elements so the viewer encounters hook, product and
action in an intended order. Animated gaze markers preview the resulting path.
The player then identifies the corresponding path in the pair's own
advertisement.

### 10.3 Contrast and Colour

The player selects foreground and background treatments for a specific
audience effect. Feedback covers differentiation, harmony and legibility.
Success cannot rely on colour alone.

### 10.4 Framing and Crop

The player moves a crop window and foreground frame to change what the image
includes, excludes and emphasises. The comparison explicitly shows how framing
changes meaning.

### 10.5 Arrangement

The player tests central composition, rule of thirds, balance, symmetry and
pattern against the communication purpose. No technique is presented as
universally superior.

### 10.6 AIDA Board

The player assigns and revises campaign elements across Attention, Interest,
Desire and Action. A correct label is insufficient: the player must state what
the element does to the viewer.

### 10.7 Claim and Proof

The player pairs claims with facts, product features or demonstrations and
rejects unsupported or misleading evidence. This prepares the final proof
point.

## 11. Optional sidequests and early-finisher depth

Optional contracts appear on the agency noticeboard:

- repair an advertisement with weak salience;
- redirect a broken reading path;
- choose the strongest contrast among original fictional examples;
- crop one image for two different audience effects;
- identify and explain techniques in a mystery campaign; and
- revise an unsupported claim.

Sidequests vary examples and increase analytical depth. They do not merely
repeat the same item faster. Completing them unlocks additional campaign
presentation choices, not essential creator tools.

## 12. Feedback, rewards and payoff

The game does not use coins, loot boxes or arbitrary experience points.

Campaign progress is communicated through five evidence-based criteria:

- audience fit;
- clear value;
- AIDA;
- visual focus; and
- credible claim.

Each criterion changes only when the corresponding campaign evidence changes.
Feedback names the evidence found and the next useful revision.

The final payoff is:

1. the pair sees its exact advertisement animate onto three campaign formats;
2. the client gives rule-based feedback tied to the five criteria;
3. the chosen music and sound cues accompany the pitch when enabled;
4. the pair enters the existing market; and
5. the reveal retains current peer medals or purchasing outcomes.

Optional mission completion unlocks additional presentation treatments:

- Billboard Reveal;
- Magazine Spread;
- Vertical Screen;
- Smooth Pan;
- Pop Assembly; and
- Static Presentation.

Static Presentation is always available and is automatically selected when
reduced motion is requested.

## 13. Audio design

### 13.1 Audio types

- one low-intensity office ambience loop;
- up to three short pitch music loops;
- movement and interaction cues;
- department completion stingers;
- three labelled pitch sound buttons, such as camera shutter, clean swoosh and
  applause; and
- error cues paired with text and icon feedback.

### 13.2 Rules

- Audio starts only after a user gesture, preserving Safari autoplay behavior.
- A visible mute button is present from the first audible moment.
- Music and ambience duck or stop while the student reads a brief, guide or
  feedback paragraph.
- No success condition depends on hearing.
- Volume and mute settings persist on the device but do not enter the campaign
  document.
- All shipped audio must be original or redistributable under a verified
  licence recorded in `CREDITS.md`.
- The production build must remain practical on school wifi. Audio is compressed
  and included in the release manifest.

## 14. Visual identity and assets

### 14.1 Visual target

The target is polished, high-resolution 2D top-down pixel art with modern
editorial and Bauhaus influence:

- deep navy;
- warm cream;
- teal;
- coral;
- mustard yellow; and
- cobalt accents.

Rooms are richly furnished and immediately recognisable. Visuals must carry
gameplay information: light paths indicate destinations, props identify
departments, and campaign displays show progress. Decorative detail must not
obscure interaction targets.

### 14.2 Asset decision

The local catalogue contains fantasy, farm and tavern top-down furniture, plus
side-view city characters. Representative sheets were visually inspected.
They do not form a coherent modern agency and must not be mixed merely to avoid
creating a suitable visual family.

A bespoke agency family is justified for:

- two partner avatars with four-direction walk and idle animation;
- modern office floor, walls, doors and windows;
- desks, computers, light tables, drawing boards, printers and speakers;
- department signs and interaction markers;
- campaign-display frames;
- technique-mission objects; and
- restrained particles and lighting accents.

Generated or sourced assets must have exact licence and provenance records.
Branded advertisements from teaching PowerPoints are design references only.

### 14.3 Visual-target files

The implementation plan binds two approved mockups:

- primary agency gameplay:
  `docs/superpowers/specs/assets/2026-07-29-agency-world-primary.png`;
- final campaign pitch:
  `docs/superpowers/specs/assets/2026-07-29-agency-world-pitch.png`.

The mockups define composition, hierarchy, density and palette. Production
assets may simplify individual props for performance while preserving the
overall target.

## 15. Architecture

### 15.1 Principle

The existing `main.gd` is 1,514 lines and currently coordinates account
recovery, game stages, creator, market, progress, guidance and view state. The
redesign must not add the agency world to that file.

New responsibilities use isolated scripts and scenes with narrow APIs.

### 15.2 Proposed Godot structure

```text
godot/src/
  agency/
    AgencyWorld.tscn
    agency_world.gd
    agency_campaign_controller.gd
    agency_progress.gd
    agency_objective.gd
    agency_mission_catalog.gd
    player/
      AgencyPair.tscn
      agency_pair.gd
    stations/
      AgencyStation.tscn
      agency_station.gd
    ui/
      AgencyHud.tscn
      agency_hud.gd
      GuideDrawer.tscn
      guide_drawer.gd
      RoleHandoff.tscn
      role_handoff.gd
    missions/
      SalienceMission.tscn
      ReadingPathMission.tscn
      ContrastMission.tscn
      FramingMission.tscn
      AidaMission.tscn
      ClaimProofMission.tscn
  audio/
    audio_manager.gd
  presentation/
    PitchTheatre.tscn
    pitch_theatre.gd
    campaign_image_decoder.gd
```

Names may be adjusted to existing repository conventions, but the boundaries
remain:

- world movement;
- objective and progress state;
- role handoff;
- mission logic;
- audio;
- creator/market orchestration; and
- final presentation.

### 15.3 Scene composition

`Main.tscn` remains the route and bridge host. It contains or instantiates:

- the agency world;
- a world camera;
- the pair avatar;
- station interaction areas;
- a `CanvasLayer` HUD and guide;
- mission overlays; and
- the existing market screen and creator hosts.

The DOM creator remains the real editor. Opening it pauses world input but not
the browser account/session machinery. Closing it restores the previous world
and guide focus.

### 15.4 GodotIQ workflow

GodotIQ is the structured control plane:

- inspect file context and impact before cross-file changes;
- create and edit scripts with `godotiq_script_ops`;
- build and modify scenes with `godotiq_build_scene` and
  `godotiq_node_ops`;
- save through the live editor;
- check compilation separately from convention validation;
- run the game and simulate mapped inputs;
- inspect runtime state and UI maps;
- capture visual evidence; and
- keep the reported project root bound to the authoritative worktree.

The unrelated Pilot Season editor must remain untouched.

## 16. Progress and migration

### 16.1 Stored state

Agency progress stores:

- current objective;
- avatar location or last department;
- completed mandatory missions;
- completed optional contracts;
- active role;
- handoff count;
- presentation style;
- selected pitch music and sound cues; and
- whether the core campaign launch has been viewed.

Audio volume and mute are device preferences, not campaign progress.

### 16.2 Contract strategy

The existing outer `live-run-progress@1` envelope remains unless tests prove it
cannot carry the new state. The nested pitch snapshot advances to a new
version. Restore supports:

- the new snapshot exactly; and
- `pitch-run@1`, migrated to the correct default agency location and objective
  for its current Invent/Sell/Finalise phase.

Restoration is atomic. Invalid new fields do not partially mutate the current
session. Existing saved campaigns remain usable.

### 16.3 Campaign document

Agency navigation, optional missions and presentation selection do not belong
inside the campaign document. The document remains the source of truth for the
advertisement and its evidence. This prevents the world redesign from
invalidating Fabric drafts or server-side campaign validation.

## 17. Web, creator and market integration

- `window.AdMarketCreator` remains the creator contract.
- The game continues to receive `published-campaign@1` with `pngBase64`.
- The pitch theatre decodes the PNG locally into a Godot texture.
- No browser receives a teacher password, teacher playtest password or
  Supabase user ID.
- Student account and teacher playtest storage namespaces remain isolated.
- Publication still performs the existing price, evidence and pair
  participation validation.
- Market publication and room errors remain bounded and recoverable.
- A theatre or animation failure must not corrupt or discard the published
  campaign.

## 18. Accessibility and classroom resilience

- Keyboard, pointer and direct department travel support every required action.
- The guide and mission dialogs restore focus on close.
- The DOM accessibility mirror exposes overall goal, current objective,
  controls, role, station prompt, mission result and market state.
- Interaction targets meet the existing size and focus standards.
- Information is not communicated by colour or audio alone.
- Reduced motion disables camera pan, confetti, screen shake, parallax and
  large presentation tweens.
- Pause stops avatar and mission input without stopping account recovery.
- Movement has no precision hazards or countdown requirement.
- Student text is concise, factual and professionally written.
- The persistent guide is skip-resilient and never assumes the student read an
  earlier panel.
- Hosted QA covers exactly 1280 × 800 and 1440 × 900.
- Safari and school-wifi behavior remain explicit field uncertainties until
  exercised in that environment.

## 19. Error behavior

- If an agency asset fails to load, the game shows a labelled fallback and
  keeps the core route usable.
- If the creator cannot open, the pair remains at the Production Studio with
  its current objective and saved work intact.
- If campaign image decoding fails, the theatre uses a static labelled
  fallback while preserving market entry.
- If audio cannot start, the game continues silently and leaves mute/volume
  controls in a coherent state.
- If a remote save fails, the existing cloud status distinguishes local save
  from remote failure.
- Reload resumes to a named objective, never an unexplained modal.

## 20. Testing and verification

### 20.1 Test-driven implementation

New logic receives focused tests before implementation:

- agency progress contract and `pitch-run@1` migration;
- objective progression and invalid-transition rejection;
- role-owned stations and handoff behavior;
- guide tucked/untucked state and re-entry;
- mission scoring and non-colour-only feedback;
- presentation selection and reduced-motion override;
- PNG decode failure behavior;
- audio user-gesture, mute and ducking state; and
- creator/market integration.

Existing game, creator, market, account, teacher and build contracts remain
green.

### 20.2 GodotIQ evidence

For the final candidate:

- project root and live bridge match the authoritative worktree;
- affected files have before/after file context;
- convention validation reports its full coverage;
- project compile/error check is clean;
- project startup verification passes;
- movement and role swap are exercised through mapped input;
- every mandatory department can be entered;
- the guide is opened from tucked state during play;
- the creator opens and returns to the world;
- the pitch theatre displays the pair's publication;
- runtime/debug console is clean; and
- current screenshots are compared with both visual targets.

### 20.3 Browser and release evidence

- TypeScript typecheck;
- focused Vitest suites during implementation;
- complete relevant Vitest and Node contract suite once on the final stable
  corpus;
- Godot seam tests;
- Godot web export;
- complete production build and export/hash verification;
- accessibility audit and keyboard walk;
- current in-harness Playwright browser QA;
- hosted student, teacher and teacher-playtest smoke paths;
- exact viewport screenshots;
- service-worker update and reload behavior; and
- production deployment identity and URL.

## 21. Release and repository requirements

The final verified candidate is:

1. committed in intentional source groups;
2. merged into the canonical release branch;
3. pushed to the single canonical public GitHub repository;
4. checked for repository-sync, secrets and public-source exclusions;
5. built into the exact production artifact;
6. deployed to the linked Netlify production site;
7. verified through hosted student and teacher routes; and
8. reported with commit, build, deploy and screenshot evidence.

Supabase changes are made only if the implementation genuinely requires a
schema or policy change. A gameplay-only release must not mutate Supabase for
ceremonial completeness.

## 22. Acceptance criteria

1. A first-time student sees the overall goal, current objective and basic
   controls without opening a guide.
2. Goal, controls, current objective, roles and progress are callable at any
   time from the tucked/untucked guide.
3. Students can move through a visually rich top-down advertising agency.
4. Direct travel provides an equivalent path to every mandatory department.
5. Art Director and Strategist have literally different responsibilities and
   role-aware controls.
6. Every role-owned station names a holding action for the other partner.
7. At least six varied technique or strategy missions connect decisions to
   audience effects.
8. At least five optional contracts provide useful early-finisher depth.
9. The existing full advertisement creator opens from and returns to the
   agency safely.
10. Existing campaign, AIDA, price, route, proof, role and publication
    requirements still govern market entry.
11. The pair's exact published advertisement appears in the pitch theatre.
12. The final campaign is shown in billboard, magazine and vertical-screen
    formats.
13. Presentation animation has a static reduced-motion equivalent.
14. Music, ambience and sound effects are muteable, nonessential and correctly
    credited.
15. Audio stops or ducks during substantial reading.
16. Campaign feedback is evidence-based rather than an arbitrary score.
17. Existing `pitch-run@1` saves restore into a correct agency objective.
18. Student, teacher and teacher-playtest storage and authorization remain
    isolated.
19. The game remains usable with audio disabled, reduced motion, keyboard only
    and direct travel.
20. The production build passes the full relevant suite and hosted browser QA
    at both reference viewports.
21. The canonical repository is pushed and the linked Netlify production site
    serves the verified release.
