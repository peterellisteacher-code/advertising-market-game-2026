# Advertising Market Game: Creator Foundation Design

**Date:** 10 July 2026

**Status:** Approved direction; written specification awaiting Peter's review

**Implementation target:** Creator Foundation, the first subproject of the larger Advertising Market Game

## 1. Purpose

This is a fun-first orientation game for ACARA Year 10 v9 English. Its purpose is to build enthusiasm for advertising and allow students to encounter audience, AIDA, visual techniques and language techniques through play. It is not an assessment simulator and must not use student-facing language such as *assignment*, *unit* or *task*.

The game does not use definition quizzes, worksheet questions or a miniature business-management simulation as its main play. Advertising knowledge appears through invention, design choices, audience reactions and buying decisions.

The fun diagnostic is central: inventing strange products, producing attractive campaigns and spending money in a competitive class market should remain enjoyable even for a player who has not yet studied advertising.

Students play in pairs on one computer. A normal run lasts 50–60 minutes and ends in a live whole-class market. The creator is therefore not a side activity; student-made campaigns become the game world's principal visual content.

## 2. Original Game Invariants

The technical implementation must preserve the original game rather than turn it into a separate design application.

### Level 1: Invent It

Pairs read fictional audience signals, choose a target audience and invent a product for that audience. They assemble a realistic product image from bodies, components, materials, colours and original drawing. They choose a product name and begin forming its identity.

### Level 2: Sell It

The same product and the same continuous campaign document move through four visible tabs:

- Attention;
- Interest;
- Desire;
- Action.

Each tab opens relevant assets and controls, but it does not prescribe a fixed solution. Students can nominate any text, placed asset or original drawing as their evidence for that part of AIDA.

### Level 3: Make It Irresistible

Pairs refine the campaign with visual and language techniques, composition, typography, colour, framing and proof. They set a visible price and prepare one final market card.

### Live Market

Each pair receives a shopper persona and a fixed wallet. Pairs browse campaigns made by other teams and spend their money on products other than their own. Revenue determines the headline winner. Supporting awards can recognise units sold, value, audience fit, visual impact, memorable copy and unexpected niche success.

Shopper personas contain meaningful preferences and constraints, so buyers are not simply voting for friends or selecting the lowest price. Purchases record audience fit alongside revenue. The simulated-market fallback also considers audience fit, campaign clarity and price rather than allowing price alone to determine demand.

No live ranking appears while shopping is open. Market ordering is shuffled, team identities can be anonymous and buyers must spend most of their wallet across more than one seller. The reveal celebrates winners and side awards without displaying a public last-place board.

## 3. Why the Project Is Decomposed

The complete game contains four substantial systems:

1. the visual creator and asset catalogue;
2. the three-level game progression;
3. the networked market and teacher controls;
4. the production-scale asset pipeline.

Building all four before validating the creator would place the whole project on its riskiest untested component. The first implementation subproject is therefore the **Creator Foundation**. It must prove that students can make attractive, genuinely different work quickly on an ordinary classroom computer. Later subprojects will wrap the approved creator in the three levels and the live market.

This decomposition does not change the game. It determines the safest construction order.

## 4. Creator Experience

The creator opens full-screen inside the game and feels like one continuous Godot experience. It begins with a blank campaign canvas, not a supplied advertising campaign.

### Permanent interface regions

- **Top bar:** product name, undo, redo, save state and return to game.
- **Left library:** searchable assets, category filters, Openverse Photo Library and drawing tools.
- **Centre canvas:** direct manipulation of the campaign.
- **Right inspector:** properties of the selected object, including colour, material, opacity, crop and layer controls.
- **AIDA strip:** Price, Attention, Interest, Desire and Action tabs with visible completion states.
- **Pair handoff control:** swaps the active Art Director and Strategist roles.

The interface must support:

- add, select, move, resize, rotate, flip and delete;
- duplicate, group, ungroup, lock, hide and reorder;
- editable text, font choice, weight, alignment, spacing and effects;
- non-destructive crop and focal-point adjustment;
- colour, material, pattern, opacity, shadow and simple filters;
- shapes, lines, frames, arrows, badges and masks;
- pencil, marker, simple shape drawing and eraser;
- pan, zoom, alignment guides and snapping;
- keyboard operation for all essential commands;
- one history spanning text, transforms, crop, drawing and deletion;
- versioned save, reload and flattened market export.

The campaign canvas is freeform within fixed publication dimensions. The game can offer smart guides and strong defaults, but it must not force a predesigned advertisement.

## 5. Asset-First Product Principle

The quality, range and usability of assets are the first-order success criterion. Students should be able to make work they regard as polished, not merely acceptable for a classroom exercise.

### Asset families

The launch catalogue architecture supports:

- realistic product bodies and blank containers;
- components such as handles, straps, screens, wheels, caps, pumps, clips, buttons, speakers and solar cells;
- people, hands, poses and expressions;
- rooms, outdoor settings, product-use scenes and abstract backgrounds;
- materials, textures and patterns;
- frames, bursts, arrows, vectors, badges and decorative shapes;
- proof, review, testimonial and social-response graphics;
- icons and calls to action;
- student-created drawing;
- temporary Openverse photographs;
- later category-specific basic shells.

### Realistic recolouring

Photoreal assets intended for colour changes use authored recolour zones rather than a whole-image tint. A master can contain:

- a neutral transparent beauty image;
- Body, Trim, Accent and Label masks;
- preserved seams, printed controls, reflections and highlights;
- an optional separate shadow;
- compatible attachment anchors.

Each zone accepts a colour, pattern or material preset. Material presets preserve the impression of matte plastic, gloss plastic, rubber, cardboard, fabric, glass, brushed metal or wood.

The catalogue exposes virtual variants without storing duplicate files. Three hundred masters with 24 colours and 12 materials already provide 86,400 possible appearances before components are combined.

### Asset catalogue scale

The target delivery model is:

- a 300–500 element reviewed core pack that can complete the activity without live search;
- a streamed catalogue capable of 10,000–15,000 source elements;
- virtual colour, material and pattern variants generated at runtime;
- Openverse search for a much larger contextual-photo pool;
- a synthetic 15,000-record performance index used during testing.

Only visible thumbnails are instantiated. Full-resolution assets load when selected or placed. The extended catalogue is not embedded in the Godot package.

### Existing assets before generation

Pre-existing open collections supply product references, everyday objects, materials, icons, shapes, fonts and interface sounds. Existing assets are normalised into the game's visual and technical format before use.

Reusable product assets are fictionalised before publication. Real-world labels, trademarks and recognisable packaging copy are removed so the class market remains a contest between student inventions rather than familiar brands.

Image generation fills specific gaps rather than producing complete student campaigns. It creates matched families of realistic, unbranded bodies and compatible components on large chroma-key sheets. Generated assets are split, cleaned, masked, tagged and visually checked before entering the catalogue.

## 6. Openverse Photo Library

Openverse is a first-class in-game source for people, settings, objects, textures and contextual photography.

### Student flow

1. A student opens **Photos** and enters a short search.
2. The editor shows a virtualised thumbnail grid.
3. Selecting a result loads a larger preview.
4. Placing the result creates a temporary controlled copy for reliable crop and export.
5. The source link and licence metadata are retained invisibly in the session record.
6. The teacher sees the composed campaign during the publish check, not a separate list of source records.

The library uses Openverse's mature-content exclusion and classroom search controls. A teacher can disable live search and rely on the offline core pack. Search failures never erase a student's canvas.

### Temporary handling

Selected media is proxied through a controlled same-origin service so browser security does not block canvas export. Copies and search records belong to the active room, are not added permanently to the reusable catalogue and expire after the classroom activity closes.

No arbitrary web scraping or unrestricted URL import is available to students in the first version.

## 7. Deferred Basic Shells

Peter has proposed hundreds of category-specific, very basic shells. They may later help students reach a polished result without supplying price tags, AIDA answers or a prewritten campaign.

Their detailed form is deliberately deferred. The catalogue schema nevertheless reserves a `shell` asset type with:

- category and audience tags;
- editable zones;
- compatible asset families;
- neutral preview art;
- no embedded persuasive content.

The first Creator Foundation does not author or ship the hundreds of shells. That later design decision can distinguish product-construction shells from composition shells without changing the document format.

## 8. Technical Architecture

### One visible application

The application is delivered as one Netlify-hosted browser experience:

- **Godot 4.7, GDScript and Compatibility renderer** own game flow, teams, levels, phase changes, market movement, results and audio.
- **A same-page Fabric.js studio** owns creator interactions while the studio is open.
- **Godot JavaScriptBridge** exchanges versioned JSON, events and flattened image bytes through one narrow interface.

Fabric.js is invisible implementation plumbing. Students do not enter a separate application, iframe or Canva session. The editor appears as a full-screen layer in the same visual system; Godot pauses ordinary input until the editor closes.

### Service responsibilities

- **Netlify static delivery:** Godot Web export, editor bundle, immutable catalogue manifests, thumbnails and approved source assets.
- **Netlify Functions:** Openverse requests, temporary media proxying and any protected server operation.
- **Supabase Postgres:** rooms, teams, campaign revisions, prices, wallets, purchases and standings.
- **Supabase Realtime:** teacher-controlled phase changes, market publication and result updates.
- **Supabase Storage:** transient student drawings, flattened campaigns and temporary session media.

Pairs share one computer, so the canvas does not need multi-device live co-editing. Realtime is used for the class market, not for every drag gesture.

## 9. State and Data Boundaries

### Godot game state

- room and team identity;
- current level and phase timer;
- target audience and shopper persona;
- wallet, purchases and revenue;
- role-swap state;
- teacher phase controls.

### Campaign document

- schema and editor version;
- stable document, team and room IDs;
- canvas dimensions and revision number;
- Fabric visual state;
- stable asset IDs and source hashes;
- student text and drawing data;
- product name, target audience and price;
- AIDA evidence mappings;
- flattened preview reference.

### Server-authoritative rules

The server validates that:

- a team publishes only its own campaign;
- the campaign revision is current;
- the teacher has opened the relevant phase;
- price is within the allowed game range;
- a buyer cannot purchase its own product;
- wallet balances cannot go below zero;
- purchases cannot be submitted twice;
- standings remain hidden until market close.

## 10. Pair Play and Onboarding

The pair has two complementary roles:

- **Art Director:** controls product assembly, composition, typography, colour and image treatment.
- **Strategist:** interprets audience clues, tracks AIDA, chooses copy, monitors price and examines the shopper persona.

Roles swap at least once before publication. The interface supports a rapid handoff rather than relying on one student to remain a passive adviser.

There is no long front-loaded tutorial. Level 1 acts as **Round 0** at approximately 30–40% of the full creator complexity. The game introduces one new mechanic cluster per level and uses short contextual prompts only when a control first appears. If cold playtesting satisfies the **Andersen 2-minute test**, even those prompts are reduced further.

## 11. Timing Target

- Room entry and cold start: 3–4 minutes;
- Level 1 audience and product invention: 9–10 minutes;
- Level 2 AIDA construction: 10–12 minutes;
- Level 3 techniques, price and polish: 11–13 minutes;
- teacher publish check and market loading: 2–3 minutes;
- live market: 10–12 minutes;
- reveal and awards: 5–6 minutes;
- network and transition buffer: 4–5 minutes.

The game must also support a shortened run by reducing audience probes, polish time and market rounds without removing product creation or shopping.

## 12. Moderation and Classroom Controls

The game permits free drawing because Peter will supervise the classroom. Publication still includes a fast teacher check:

- submitted campaigns appear as large visual cards;
- the teacher can approve, return or hide a campaign;
- returned campaigns remain editable;
- the market opens only when the teacher starts it;
- a hidden campaign can be replaced by a neutral local fallback card if necessary.

Students use team aliases rather than personal accounts. The first version does not include public profiles, direct messaging, arbitrary file uploads or persistent galleries.

## 13. Failure and Recovery Behaviour

- Local IndexedDB stores the current draft during the room.
- Remote autosave uses revision numbers and never overwrites a newer draft silently.
- A failed Openverse request leaves the canvas and search query intact and offers the offline pack.
- A failed image import shows a retry action and does not add a broken object.
- A lost network connection permits local creator work to continue and resynchronises when possible.
- If live market networking fails, the teacher can launch simulated buyers against the published local campaigns.
- Export failure preserves the editable document and reports which asset failed.
- Room closure expires transient server media and session records; it does not delete anything from Peter's OneDrive project.

## 14. Accessibility and Presentation Quality

The creator uses semantic browser controls around the visual canvas. Buttons, tabs, fields, search results and the layer list are keyboard reachable. The layer list can select, rename, reorder, hide, duplicate and delete objects without precise pointer use.

The interface provides:

- visible keyboard focus;
- text contrast of at least 4.5:1;
- non-colour labels and icons for all AIDA states;
- reduced-motion handling for transitions and celebrations;
- a mute control for all audio;
- undo and redo through buttons and standard shortcuts;
- autosave and explicit saved-state feedback;
- no essential instruction encoded only on the canvas.

The final aesthetic target is not the previously rejected illustrated or sticker direction. A new visual target must demonstrate realistic imagery, professional student output, legible thumbnails and a lively market without making campaigns look predesigned.

## 15. Creator Foundation Acceptance Tests

The first subproject is accepted only when a vertical slice proves all of the following in a Godot 4.7 Web export:

1. Godot opens and closes the same-page Fabric.js studio without a visible application switch.
2. A blank document can add realistic raster assets, recolourable SVGs, editable text and simple shapes.
3. Objects can be selected, moved, resized, rotated, cropped, reordered, duplicated and deleted.
4. Drawing and erasing work, and a drawing can be mapped to an AIDA tab.
5. One masked realistic component supports independent Body, Trim, Accent and Label changes while preserving its lighting.
6. At least 1,000 catalogue records can be searched and displayed smoothly through a virtualised grid.
7. Openverse search can place a temporary image and still permit a clean PNG export.
8. Ten or more mixed actions can be undone and redone in correct order.
9. The campaign can save, reload and reproduce the same editable composition.
10. Godot receives the published metadata and flattened image bytes.
11. The creator remains usable with the network disabled through its offline core sample.
12. The slice runs responsively on an ordinary classroom Windows laptop in a current Chromium browser.
13. The review pack contains at least 100 realistic or realistically rendered product bodies and components across at least ten broad product categories.
14. Those masters expose enough colour and material variants to produce thousands of distinct appearances without duplicate source files.
15. A visual trial can produce at least six recognisably different, polished campaigns without relying on arbitrary student uploads.

The performance test uses a 15,000-record synthetic catalogue, a 1,600×900 or 1,920×1,080 publication canvas, bounded texture caches and no mass instantiation of Godot UI nodes.

## 16. Subsequent Subprojects

After the Creator Foundation passes, the remaining work proceeds as separate reviewed specifications and plans:

1. production catalogue ingestion and image-generation pipeline;
2. the three content levels and pair-role progression;
3. Supabase room, teacher console and live market;
4. realistic visual target, full polish and classroom verification;
5. later category-specific basic shells;
6. optional Canva handoff or constrained AI features only if they add value after the core game works.

YouTube scraping, live one-shot campaign generation, student Canva accounts, multi-device canvas collaboration and a permanent public gallery are outside the first version.

## 17. Project and Provenance Boundary

All new work belongs inside the clearly Codex-owned `Codex Advertising Market Game` folder in the Advertising workspace.

- `C:\Users\Peter Ellis\Games Workshop` remains permanently read-only.
- `C:\Users\Peter Ellis\Godot` remains read-only except for launching the installed executable.
- Claude-created files, repositories and harnesses must never be edited, moved, deleted or replaced.
- The eventual Workshop handoff is prepared as a separate package for Peter to move manually.

## 18. Deliverables Across the Full Game

The complete project ultimately delivers:

- the Godot Web game and integrated creator;
- the asset catalogue and documented ingestion pipeline;
- a teacher guide covering setup, timing, differentiation, moderation and troubleshooting;
- short student-facing instructions;
- a debrief moving from market observations to advertising analysis and transfer;
- a local simulated-market fallback;
- verification evidence for boot, accessibility, performance, networking and visual quality.

The immediate implementation plan following approval of this specification will cover only the **Creator Foundation vertical slice** in Section 15.
