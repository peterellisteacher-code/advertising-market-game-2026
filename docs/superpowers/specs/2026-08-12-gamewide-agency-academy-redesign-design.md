# Gamewide Agency Academy Redesign

Date: 12 August 2026
Status: Proposed design for Peter's written review
Project: Advertising Market Game 2026

## Decision summary

Redesign the complete player-facing game around one coherent, polished desktop game shell. Required campaign work runs directly from one task to the next. The pixel-art agency remains available as an optional atmospheric hub, but students never have to walk through it or read narrative filler to continue the campaign.

The redesign keeps the current advertising pedagogy, editable student work, pair roles, teacher controls, persistence, assignment sandbox and seven mission engines. It changes navigation, hierarchy, feedback, layout and visual presentation rather than replacing the proven task logic.

`Agency Academy` is an in-world crest and presentation motif. The public product and browser title remain `Advertising Market Game` unless Peter separately approves a rename.

## Why this change is needed

Playtesting exposed a connected set of structural problems rather than one isolated styling defect:

- modal and teacher overlays have sometimes intercepted clicks or covered controls;
- low-contrast button text has made available actions appear disabled;
- cards and expanded menus have exceeded the viewport;
- large instruction panels have hidden the work they describe;
- room travel and explanatory interludes have slowed progression between required tasks;
- each surface has used a different hierarchy, making the overall experience feel like several tools rather than one game;
- recoverable creator actions such as item deletion have been difficult to discover.

The redesign must therefore improve interaction architecture and gameplay flow as well as colour and decoration.

## Experience goal

The core loop is:

1. See one clear advertising decision.
2. Make or test that decision in a visible work area.
3. Receive immediate, specific feedback.
4. Understand why the result affects an audience.
5. Continue directly to the next required task.

The interface should feel like a finished strategy-and-creative game for secondary students: confident, readable, responsive and purposeful. It must not add competitive pressure, arbitrary scoring or decorative complexity that distracts from the advertising decisions.

## Approved structural approach

### Hybrid campaign and optional hub

The campaign is the default route. The agency floor becomes an optional place students can visit to orient themselves, revisit completed work or choose optional practice.

```text
Lobby
  |-- Continue campaign -----------------------------|
  |                                                  v
  |   Campaign setup -> Required tasks 1-7 -> Final pitch -> Market
  |                         |       |
  |                         |       `-- Next task (direct)
  |                         `---------- Agency hub (optional)
  |
  `-- Assignment sandbox (independent durable draft)
```

Campaign setup is productive work, not a counted mastery task. It includes the brief entry and, when no campaign product exists, product creation. It does not insert walking or dialogue between the seven required tasks.

### Truthful required-task sequence

The shared header shows the real seven-task sequence and exact approved terms:

1. Audience brief
2. Salience and AIDA Attention
3. Reading path
4. Colour contrast and harmony
5. Framing and cropping
6. AIDA sequence
7. Claims and evidence

Completion advances immediately to the next required record. A secondary `Back to agency` action remains available, but the hub is never the only continuation route. After task seven, the primary action opens the final-pitch preparation surface.

Optional practice remains separate from required mastery and is clearly labelled `Optional practice`. It does not change the seven-task count.

## Shared game shell

Every player-facing surface uses the same shell and design tokens:

- compact top header;
- page or mission identity;
- truthful progress or current state;
- one primary action;
- compact teacher/settings access;
- a main work surface that remains dominant;
- one feedback region that explains the current result;
- consistent modal, focus and keyboard behaviour.

The shell is a presentation and navigation layer. Existing mission measures and demonstration scenes remain independent units. Each mission supplies its record, work scene, feedback and completion state to the shell rather than recreating global navigation.

### Header

The header contains only information needed during the current action:

- Agency Academy crest motif;
- current surface or mission title;
- `Task N of 7` for required missions;
- the exact advertising term;
- mastery dots showing completed, current and remaining required tasks;
- compact `Brief & roles` where relevant;
- `Teacher controls` and settings.

There is no points score, timer, streak, leaderboard or fake mission count. Progress represents demonstrated completion only.

### Main work card

The warm, high-contrast work card contains:

- one concise action heading;
- one sentence describing the goal;
- the active interactive stage;
- an optional point-of-use tip;
- feedback that says what is working, what needs attention and why;
- `Try again` and one clear primary action.

Long background explanations move to `Brief & roles`, optional help, or post-action feedback. The current task remains visible while the student works.

### Overlay ownership

Only one modal layer may own pointer and keyboard focus at a time. Hidden or minimised overlays cannot intercept input. Teacher controls live inside the shell layer rather than floating above every other dialog. When a modal opens, teacher access either becomes part of that modal header or remains outside the modal's active bounds without overlap.

Closing with the visible control and `Esc` follows the same route, restores focus to the opener and never leaves an invisible click shield.

## Surface designs

### Lobby and recovery

The lobby presents three unambiguous routes:

- `Continue campaign` or `Start campaign`;
- `Open assignment sandbox`;
- compact teacher access.

Account, pair, cloud-recovery and startup states use the same visual shell. Recovery copy explains whether the device or cloud copy is active and never blocks ordinary local work unnecessarily. A startup failure uses branded, readable UI with a functional retry action rather than an unstyled document fallback.

### Optional agency hub

The pixel-art office remains visually dominant. Room hotspots use restrained, consistent markers and concise accessible labels. The current destination is visible without requiring the student to hunt.

The old large room-details card becomes a short bottom strip. Its buttons explain available actions and are only as wide as their content and hit area require. The strip cannot cover the player, required path or room markers. Optional practice and `Back to campaign` are always distinguished from the current required destination.

Walking remains available for atmosphere, but `Enter current task` and `Back to campaign` provide direct navigation. Collision boundaries must match visible walls and furniture; decorative markers do not affect collision.

### Required and optional mission tasks

All seven demonstration families retain their actual interaction model. The redesign supplies consistent framing around them rather than flattening them into identical quizzes.

- matching and sorting surfaces use clear source cards and destination zones;
- salience exposes selection, movement, resize and colour controls with live status;
- reading-path and AIDA sequence expose order and progression clearly;
- colour tasks keep the wheel and comparison evidence visible;
- framing keeps crop and slogan move/resize instructions at the point of use;
- claims tasks keep evidence and audience effect visible together.

Every drag interaction retains a click/select plus keyboard alternative. Correctness is never communicated by colour alone. Success feedback names the advertising effect; unsuccessful feedback identifies one next repair rather than repeating the entire brief.

### Production studio and guided creator

The advertisement canvas remains the dominant surface. The shared header shows the current campaign task and term. The left tool rail uses stable icon-plus-word categories. The compact command dock remains a bottom strip inside the viewport.

The dock keeps:

- Undo and Redo;
- zoom out, percentage and zoom in;
- Items;
- context-sensitive `Delete selected`.

The Items panel opens upward, is height-bounded and scrolls internally. It never extends beyond the viewport or sits behind teacher controls. Students can select, move, resize, layer, lock, hide and delete placed objects. Delete, Undo and Redo remain available for uploaded drawings and AI-generated layers as well as ordinary creator objects.

No large persistent instruction box covers the canvas. Concise guidance appears near the relevant tool, with extended explanations available on demand.

### Assignment sandbox

The approved assignment-sandbox design remains authoritative. The reskin must preserve:

- a separate durable sandbox draft;
- Product AIDA and Advertisement AIDA as distinct planners;
- the page-5 Desire value families;
- local PNG, JPEG and WebP drawing/mockup upload;
- move, resize, crop/fill, layer, lock, hide, delete, Undo and Redo;
- the existing teacher-controlled product and advertisement realisation actions;
- non-destructive generated layers and exact recovery of the original mockup.

The planner uses the shared shell and collapsible, labelled sections. It must not reduce the canvas to a narrow remainder or obscure the compact dock.

Codex-created design previews and project art use Codex's native image generator only. This does not remove the separately approved, student-initiated in-game Fal.ai realisation workflow; that product feature remains bounded by its existing teacher allowance and server-side controls.

### Final pitch

After seven required tasks, the campaign opens a focused final-pitch surface without forcing a return trip through the agency.

The finished advertisement is visually dominant. The explanation area helps students point to evidence for Attention, Interest, Desire and Action without inventing a second unrelated task. A presentation checklist checks readiness, not aesthetic conformity. The primary action is `Present campaign`.

Completion is expressed as `7 of 7 complete` and evidence readiness, not points. The student's actual product, advertisement and saved explanations populate the surface; content visible in the preview image is illustrative only.

### Market and completed campaign

Market cards use the same typography, card depth, action hierarchy and state colours. The published advertisement, campaign explanation and authentic audience response remain the focus. Completed campaigns retain a clear route to revisit the ad, pitch, optional practice or lobby.

### Teacher controls

Teacher controls become a compact shell-owned disclosure. Closed controls do not cover or intercept the game. Open controls remain fully inside the viewport, scroll internally when necessary and expose their own close action. Teacher playtest status is visible but does not form a floating strip over student controls.

## Visual language

### Palette and materials

The game uses a restrained system:

- deep navy and aubergine for framing and navigation;
- warm cream for active work surfaces;
- dark ink for body text;
- restrained gold for current progress and primary emphasis;
- green for demonstrated success;
- amber for coaching or incomplete evidence;
- teal for focus and selection.

Panels use subtle depth and soft borders. The pixel-art agency remains crisp and is not filtered into a photorealistic style. Generated preview imagery is never shipped as a screenshot-based interface; all production text and controls remain live Godot or web UI.

### Typography and density

The hierarchy is title, concise goal, active work, feedback and action. Labels use sentence case except for short structural headings. Paragraphs are avoided inside active task surfaces. Exact advertising terms are preserved even when surrounding instructions are simplified.

There is no blanket conversion of every control to 48 pixels. Primary actions remain comfortably targetable; compact creator controls retain appropriate density, spacing, visible focus and keyboard equivalents.

### Motion and audio

Motion confirms state changes rather than delaying them. A completion check, progress movement and card transition may animate briefly. Reduced-motion mode removes translation and pulse effects while preserving state changes. No animation gates input or forces a wait before the next task.

## Pedagogy and pair play

The redesigned loop targets analysis: students connect an advertising choice to its effect on a defined audience. It explicitly avoids technique spotting without explaining effect.

Each required task presents:

- the exact advertising term;
- one observable decision;
- the audience effect to judge;
- a reasoned feedback statement;
- the existing Art Director or Strategist lead role;
- one concise holding action for the partner.

The two roles retain equal permissions. Role language supports discussion but never blocks an individual student from operating the interface during teacher playtest or recovery.

## Accessibility and desktop fit

The supported experience is keyboard plus mouse or trackpad on desktop and laptop. Phone layouts and phone-specific controls remain out of scope.

Acceptance viewports are 1280x800 and 1440x900, with representative inspection at 1920x1080. At every target:

- the active card and primary action remain inside the viewport;
- expanded panels open inward and use bounded internal scrolling;
- no horizontal document overflow appears;
- text and controls meet the project's contrast gate, including translucent states composited over their actual backgrounds;
- focus order follows visual order;
- focus is visible and restored after dialogs;
- all pointer actions have keyboard routes;
- status is not conveyed by colour alone;
- large text does not hide the current action or canvas;
- teacher controls never overlap the current task.

## State, data and compatibility

The redesign reuses existing campaign records, mission evidence, creator documents, account recovery and sandbox persistence. Completed mission IDs remain stable. Existing guided and sandbox documents must reopen without migration loss.

Presentation state such as current shell view, optional-hub return target or disclosure state may be added as backwards-compatible defaults. No Supabase object or schema change is expected. If implementation evidence contradicts that assumption, Supabase work stops for a separate scoped decision and reservation process.

## Error handling

- A task-stage error keeps the shell usable and offers a bounded retry or return route.
- A creator bridge error preserves the current document and explains whether retry is safe.
- Storage disagreement identifies the active copy and never silently replaces student work.
- Missing optional imagery degrades to a live UI placeholder, not an invisible action.
- If a modal cannot initialise, its input shield is removed before an error is shown.
- AI realisation failure leaves upload, manual editing and the original advertisement available.

## Visual targets

The user-supplied mission mockup establishes the primary direction. It is a reference, not a literal specification: its fake five-mission count, points score and example content must not enter production.

Three selected previews were generated with Codex's native image generator and are committed only as directional evidence:

- `visual-targets/2026-08-12/agency-hub-native-preview.png`
- `visual-targets/2026-08-12/production-studio-native-preview.png`
- `visual-targets/2026-08-12/final-pitch-native-preview.png`

They establish hierarchy, palette, density and component relationships. They do not approve generated copy, icons, example products or exact geometry. Production implementation must use real records, real state and accessible live controls.

## Implementation boundaries

The implementation should introduce shared presentation primitives and route existing task engines through them. It should not rewrite proven mission measures solely for visual uniformity. The Godot agency surfaces and DOM creator may use different rendering technologies, but they must consume one documented token and component contract.

The work should proceed in reviewable slices:

1. shared tokens, shell and overlay/input ownership;
2. direct campaign routing and optional hub;
3. required and optional mission framing;
4. studio and sandbox reskin;
5. pitch, market, teacher and recovery surfaces;
6. integrated copy, accessibility, runtime and release verification.

The implementation plan will name exact files, tests and dependency checks after this design is approved.

## Verification and acceptance

### Automated behaviour

- The catalogue still contains exactly seven required missions with exact terms and demonstrations.
- Completing a required task opens the next required task directly.
- `Back to agency` remains optional and returns to the correct campaign state.
- Hidden/minimised overlays cannot receive pointer or keyboard input.
- Dialog close restores focus to the opener.
- All seven task families retain their current measures and keyboard alternatives.
- Item deletion, Undo/Redo and upload behaviour remain green in guided and sandbox modes.
- Product AIDA and Advertisement AIDA remain distinct and persistent.
- Existing documents and mission completion state parse and save compatibly.

### Runtime and visual proof

- Start or continue a campaign without entering the hub.
- Complete tasks 1 through 7 consecutively and reach the final pitch.
- Visit and leave the optional hub without changing required progress.
- Exercise every mission family with pointer and keyboard.
- Open every expandable panel at 1280x800 and 1440x900; verify no clipping, overlap or dead controls.
- Place and delete ordinary objects and an uploaded drawing; Undo and Redo both operations.
- Verify the compact and expanded item dock, teacher controls, guide, recovery, sandbox planner, final pitch and market.
- Inspect contrast, focus, large text, reduced motion, console errors and critical failed requests.
- Compare representative live renders with the visual targets for hierarchy and feel, not pixel identity.

### Release proof

- Focused checks pass while each slice is developed.
- One final integrated local suite passes on unchanged release-candidate inputs.
- Applicable GodotIQ project, parser, signal, orphan and coverage checks pass.
- The exact web artifact passes desktop runtime and visual QA.
- One fresh release-candidate code review is resolved proportionately.
- Canonical repository sync is proved; branch CI, draft-hosted QA, PR merge, main artifact, production deploy and production QA remain distinct gates.
- No task-owned commit remains outstanding at completion.

## Explicit non-goals

- No phone support or phone-specific responsive design.
- No arbitrary score, timer, streak, leaderboard or competitive rank.
- No mandatory walking between required tasks.
- No narrative filler between required tasks.
- No replacement of the agency pixel-art environment.
- No automatic grading of student explanations.
- No destructive replacement of uploaded or student-created work.
- No screenshot-based production UI or baked generated text.
- No new public repository, Supabase schema or unrestricted AI endpoint.
