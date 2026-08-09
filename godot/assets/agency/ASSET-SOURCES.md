# Advertising agency visual assets

Generation date: 29 July 2026

These assets were created specifically for the Advertising Market Game. They do
not copy the branded advertisements in the teaching source folders. The selected
images contain no recognisable trademark, commercial logo, real person, or
readable third-party advertising copy — with **one deliberate exception**, the
`crop/preppy-max-lockup.png` parody slogan block, which is described and flagged
in its own section below. That exception is the only asset here that is meant to
be read against a real brand, and it is the one to review before any public
snapshot.

## First-run onboarding screenshots

These three project-owned QA captures come from the verified Godot web export.
The QA source files used JPEG/JFIF bytes despite their `.png` names. On 4 August
2026, their tracked copies were mechanically decoded and stored as real PNGs.
Decoded RGB checksums match before and after transcoding: no pixels were
cropped, resized, recoloured, regenerated or generatively edited. The onboarding
scene uses an `AtlasTexture` to omit the 44-pixel teacher-test strip at the top.
Each label describes only the state visible in its screenshot.

### `onboarding-brief.png`

- Source: `C:\Godot Projects\Advertising Market Game QA\terra-audit-20260804\parent-harness-1280-client-briefing.png`
- Dimensions: 1280 x 800 pixels
- Scene crop: `Rect2(0, 44, 1280, 756)`
- Source capture SHA-256 (JPEG/JFIF bytes): `057444a7842267822c6ef555be95108b3c9fbd20b95ad1468288718bb57f73d5`
- Tracked PNG SHA-256: `fc8031ddc385f1a0408987a4ff11a653ba131923cacc8d979abf0108fc81e586`
- Decoded RGB MD5 before and after transcoding: `fe2065429aecb90cb353e644d3f9cb76`
- Teaching use: labels the first whole-campaign stage, **Brief**

### `onboarding-build.png`

- Source: `C:\Godot Projects\Advertising Market Game QA\run-30822342945\mission-art-studio-1280x800.png`
- Dimensions: 1280 x 800 pixels
- Scene crop: `Rect2(0, 44, 1280, 756)`
- Source capture SHA-256 (JPEG/JFIF bytes): `c286eeae55797ea494c69bcec056ee6de56011509d059ec4d3b967232a3f9671`
- Tracked PNG SHA-256: `a4a9c8aad920f106d62dd37029733f8b91f01fd6c22350f2ed66489713602ada`
- Decoded RGB MD5 before and after transcoding: `cb906a88a55e7ce9c32d034e18541254`
- Teaching use: labels the current art-direction decision as part of **Build**;
  this replaces the obsolete Studio capture containing `Step 5 of 19` and
  `visible canvas change` copy

### `onboarding-approval.png`

- Source: `C:\Godot Projects\Advertising Market Game QA\terra-audit-20260804\parent-harness-1280-mission-complete.png`
- Dimensions: 1280 x 800 pixels
- Scene crop: `Rect2(0, 44, 1280, 756)`
- Source capture SHA-256 (JPEG/JFIF bytes): `a882205068632396a982f9cdb620f326055d4099b32841e554093a14df4c4141`
- Tracked PNG SHA-256: `689a663f12ca20f052a505521da450eb47f51ff2ea0354866b04489857a787a9`
- Decoded RGB MD5 before and after transcoding: `7d95e59d1e373c0c5b6ae09374900574`
- Teaching use: labels only the visible **Brief approved** state; this is not
  represented as a pitch

Pitch screenshot replacement: **OPEN**. A truthful replacement must be a
current web-export capture at 1280 x 800 or 1440 x 900, must show the pair's
advertisement presented in the pitch theatre, and must be captured before any
mission-complete or approval modal obscures that evidence. No such capture was
present in `C:\Godot Projects\Advertising Market Game QA` on 4 August 2026.

## `agency-floor.png`

- Tool: OpenAI built-in image generation
- Selected original:
  `call_yzXFKgzdpuTtD7YvhSngSArk.png`
- Final file: original RGB PNG at its generated size, with three station markers
  added on 2026-08-07 (see below)
- Dimensions: 1672 x 941 pixels (wide 16:9 composition; aspect ratio 1.776833)
- SHA-256:
  `fbb6cdbab2678211b6247827935ec0cb6308d7a5223c953a015cd234ab468bf3`
- Superseded SHA-256 (generated file, before markers were added):
  `d49d9b2d45b1b1ab23d144c82c4807d5f41abbde3117eff7196f8accd285d4ac`
- Edit on 2026-08-07: the generator produced glowing floor markers for only six of
  the nine stations, plus one for the central travel point and one on the entrance
  mat. Markers for client-briefing, media-desk and art-studio were added by
  alpha-compositing a copy of the generated reception marker onto clear floor in
  each station's room. No pixels came from outside this file, so the provenance and
  public-use decision below are unchanged.
- Human selection: selected because the connected rooms, open central route,
  nine glowing work points, palette, scale and pitch theatre are immediately
  readable as a playable advertising agency
- Public-use decision: approved for the public source snapshot because it is an
  original generated environment with no people, logos or recognisable brands

Exact prompt:

> Create the clean in-game background asset derived from this concept: a polished high-resolution top-down 2D pixel-art advertising agency floor for a Year 10 classroom browser game. Exact wide 16:9 composition. IMPORTANT: remove every interface panel, objective bar, character, arrow, badge, sign, word, letter, numeral, logo, poster text and screen text from the reference. No people. No readable writing of any kind. Preserve the attractive modern editorial/Bauhaus interior language and palette of deep navy, warm cream, teal, coral, mustard and cobalt. Clearly separated but connected spaces: welcoming client reception, strategy room with an abstract planning wall, art studio with drawing tables and colour materials, copy room represented by abstract paper/layout props without letters, production studio with large blank abstract monitors, media desk, sound booth with mixer and speakers, and a dramatic pitch theatre with a blank abstract presentation screen. Wide walkable corridors, obvious door openings, uncluttered central routes, rich props around room edges, even lighting, crisp coherent pixel edges, one consistent orthographic top-down perspective and scale. Make nine interaction positions visually readable and preserve generous empty walkable floor around every workstation. This is a single full-bleed game map, not a mockup, screenshot, UI, collage, cutaway with labels, or concept sheet.

Reference supplied to the generator: a locally retained concept rendering of
the same original agency environment. It contains no third-party artwork and is
not required to build, use or license the public game.

## `agency-pair.png`

- Tool: OpenAI built-in image generation, followed by
  `fal-ai/bria/background/remove`
- Selected generated source:
  `call_vNT0oBiBgvUp1BjOjCaHNllv.png`
- Final file: an eight-direction walk-cycle sheet animated from the background-removed
  still sheet on 2026-08-07 (see below)
- Alpha: genuine RGBA transparency, confirmed in the final PNG and by Godot
- Dimensions: 776 x 1104 pixels, a 64-cell 8x8 grid of 97 x 138 cells — eight walk
  frames per row, one row per direction per character
- SHA-256:
  `17b2604917dcf78529dd308579f070aa89e94a1e9629cf020f66e25844e4d832`
- Superseded SHA-256 (still sheet resampled to 432 x 244):
  `d1041230a6d4edc1d871d7bbeba295f401c3d2c7b7fd0df7c3d4e76ecccb2b42`
- Superseded SHA-256 (background-removal result at 1672 x 941):
  `8eec47af4b31b2c3f6866a14c0e840c51d983617decc8b730c29d5e54934d1ba`
- Edit on 2026-08-07, first pass: at 418 x 470 per cell the sheet rendered at
  `scale = 0.13`, so the GPU reduced each figure to 54 x 61 by nearest-neighbour
  sampling and the faces and hands broke up. Each cell was resampled to 108 x 122 —
  twice the rendered size — using premultiplied-alpha Lanczos with a light unsharp
  pass, and the sprites moved to `scale = 0.5`. No pixels came from outside this file.
- Edit on 2026-08-07, second pass — **new third-party tool, read this before any
  public snapshot**: the eight still poses were each animated into a five-second
  walk clip with `fal-ai/kling-video/v2.5-turbo/pro/image-to-video` on fal.ai, at a
  total cost of USD 2.80. Each still was staged on flat magenta (`FF00FF`) and the
  prompt locked the camera, the framing and the facing direction. The clips were
  converted by the `gamelab-to-spritesheet` batch pipeline, which chromakeys the
  magenta to alpha, despills the H.264 halo, detects the logical pixel grid and
  normalises every animation of one character to a shared frame size and foot anchor.
  For each clip the segment that closes on itself was found by minimising the
  difference between its first and last frame over gait periods of 12 to 36 frames,
  then eight poses were sampled evenly across that period. Both characters are padded
  to a common 97 x 138 cell aligned on the foot line, not the frame edge, so the pair
  stands on one floor line.
- Licence note for the second pass: fal.ai lists
  `fal-ai/kling-video/v2.5-turbo/pro/image-to-video` with `license_type: commercial`.
  The model saw only this project's own character art as its input image, so no
  third-party subject or artwork entered the sheet. The public-use decision below is
  unchanged, but this is the first asset here whose final pixels were produced by a
  video model rather than an image model.
- Human selection: selected because it is a clean two-row, four-direction sheet
  with two visibly distinct, consistently scaled partner roles
- Public-use decision: approved because the characters are original generated
  fictional people with no logo, brand or identifying resemblance

Exact generation prompt:

> Using the exact crisp high-resolution pixel-art rendering, palette and character scale implied by this agency environment, create one production-ready transparent PNG sprite sheet for its two-player pair. Transparent background only; no floor, border, frame, grid, labels, text, letters, logos, shadows cut off or decorative objects. Exactly 8 equal cells in a strict 4-column by 2-row grid with generous transparent padding and perfectly consistent registration. TOP ROW: the same teenage Art Director character in all four cells, wearing a teal overshirt with coral details, views in this exact order: front idle, back idle, left idle, right idle. BOTTOM ROW: the same teenage Strategist character in all four cells, wearing a mustard jacket with deep navy details and glasses, views in the exact same order: front idle, back idle, left idle, right idle. Friendly professional agency-intern styling suitable for Year 10 students, distinct silhouettes, inclusive and gender-neutral presentation, identical apparent height and consistent proportions across all eight poses, orthographic top-down three-quarter sprite viewpoint matching the environment. Every cell contains exactly one complete character centred in its cell. This must be an actual clean game sprite sheet, not a concept sheet or character lineup.

The generator returned an RGB file with a painted checkerboard despite the
transparency request. The rejected direct repair prompt was:

> Repair this existing sprite sheet without redesigning or moving any of the eight characters. Keep the exact 4-column by 2-row arrangement, character identities, directional views, pixel-art details, alignment, scale and padding. Remove the painted white-and-light-grey checkerboard completely and replace every background pixel outside the characters with genuine PNG alpha transparency (alpha 0), including enclosed background gaps. Do not render any checkerboard or solid backdrop. Preserve clean anti-aliased/pixel edges with partial alpha only at edge pixels. Output a true RGBA PNG sprite sheet with transparent background, no new objects, text, labels, frame, shadow or floor.

That repair also returned RGB and was not used. Bria then removed only the
background from the selected source and produced the final RGBA PNG.

## `pitch-devices.png`

- Tool: OpenAI built-in image generation, followed by
  `fal-ai/bria/background/remove`
- Selected generated source:
  `call_X15OyDdA8fYg2XBM1OMYwBjb.png`
- Final dimensions: 1774 x 887 pixels
- Alpha: genuine RGBA transparency, confirmed in the final PNG and by Godot
- SHA-256:
  `2e3d5ee620b4dd8dcfdc993beea238165a7121e6dc759b253266f804e2617e0a`
- Human selection: selected because all three silhouettes are complete and
  each device has a large clean socket for runtime campaign art
- Public-use decision: approved because the objects are original, generic
  advertising media with no embedded campaign, publication or device brand

Exact generation prompt:

> Create one production-ready transparent PNG sprite sheet containing exactly three empty advertising presentation devices in the same crisp high-resolution pixel-art style and Bauhaus palette as this agency environment. Transparent background only. One strict horizontal row of three generously separated equal cells, no border around the overall sheet, no text, no letters, no numbers, no logos, no brands, no people and no advertising content. CELL 1: a freestanding landscape roadside billboard frame viewed straight-on, with a completely blank warm-cream display surface. CELL 2: a fully open landscape magazine spread viewed almost straight-on from slightly above, with two completely blank warm-cream pages and a subtle spine. CELL 3: a freestanding vertical digital advertising screen viewed straight-on, with a completely blank deep-navy display surface and a small stable base. Consistent apparent scale, complete uncropped silhouettes, readable inner sockets where runtime campaign art can be composited, clean alpha around every device. This must be a clean game asset sheet, not a mockup, interface, concept board or labelled diagram.

## `interaction-icons.png`

- Tool: OpenAI built-in image generation, followed by
  `fal-ai/bria/background/remove`
- Selected generated source:
  `call_2SVPMOfXqozShsU0GUr7DBiu.png`
- Final dimensions: 2172 x 724 pixels
- Alpha: genuine RGBA transparency, confirmed in the final PNG and by Godot
- SHA-256:
  `28bc5bdb8224e7d22704b2fdb23728b0227d964826817473d051a0f3f66ae7f7`
- Human selection: selected because all seven symbols have distinct,
  small-size-readable silhouettes and match the environment palette
- Public-use decision: approved because the icons are original generic symbols
  with no platform mark, logo or embedded label

Exact generation prompt:

> Create one production-ready transparent PNG sprite sheet with exactly seven distinct game icons in the same crisp high-resolution pixel-art style and deep-navy, warm-cream, teal, coral, mustard and cobalt palette as this advertising agency environment. Transparent background only. Strict single horizontal row of seven perfectly aligned equal square cells, generous transparent separation, no overall border, no text, no letters, no numbers, no logos, no brands and no people. Each icon must be bold, immediately readable at small HUD size and fully contained: 1) current objective: a mustard target with a small shining star in its centre; 2) interact: a teal hand pressing a coral circular button; 3) Art Director role: a coral-tipped paintbrush crossed with a navy layout ruler; 4) Strategist role: a teal compass over an abstract branching planning diagram with no writing; 5) evidence: a warm-cream proof card with a teal checkmark and coral magnifying glass; 6) sound: a navy speaker emitting three mustard sound waves; 7) direct travel: cobalt map pin with a cream motion arrow. Consistent scale, strong silhouette, clean alpha, restrained highlights. This must be a clean game icon sheet, not a UI mockup, concept board, labelled diagram or sticker page.

## Salience demonstration assets — `salience/`

Generated 7 August 2026; the background plate was regenerated 8 August 2026.

These six files supply the arrangement the pair builds in **Control what the
audience notices first**. Five fruit are dragged, resized and recoloured over one
background plate. The measure that decides whether the arrangement works reads the
sprites' own pixels — alpha-weighted area and alpha-weighted mean colour — so each
fruit had to keep the size and colour it was generated with relative to the others.
That is why one uniform scale factor was applied across the whole sheet instead of
fitting each fruit to its own target: a per-sprite rescale would have silently
authored the answer.

### The five fruit sprites

- Tool: `openai/gpt-image-2` on fal.ai at `high` quality, followed by
  `fal-ai/bria/background/remove`
- Generated source: 2880 x 960 pixels, RGB, SHA-256
  `9fa987d44bff89b81b9ec1c68a44126a78f31a2a2d761566b6c4420d6ad40499`
- Background-removal result: 2880 x 960 pixels, RGBA, SHA-256
  `40c5247225bb01b0b574f3a0b6574fd21dd3ab37f583ae4fd4cbc6ddf9836976`
- Alpha: genuine RGBA transparency, confirmed in every final PNG and by Godot
- Slicing: the cleaned sheet was split on runs of opaque columns, each fruit was
  cropped to its own alpha bounds, and every crop was then resampled by the single
  factor `0.71856` — the factor that takes the widest fruit to 360 pixels, twice the
  largest size it is ever drawn at. Resampling used Lanczos on premultiplied alpha,
  so transparent pixels could not bleed colour into the edges.
- Final files:
  - `salience/fruit-bananas.png` — 360 x 326 pixels, SHA-256
    `5e183ba2b9aa93a77180f7e68a83de92ed546606147390f3d255e8953486e2ab`
  - `salience/fruit-orange.png` — 272 x 283 pixels, SHA-256
    `b09eed7c74c6ffd1a32bb8f726e1695423f991682aa8ddc637d87577c1668938`
  - `salience/fruit-apple.png` — 289 x 331 pixels, SHA-256
    `af41e63877bcc3f54578c71bec9cd6a533b5f6a60988e45c0c2a5a8bbbbac159`
  - `salience/fruit-grapes.png` — 279 x 388 pixels, SHA-256
    `38e8e6a65c0f2c771cdc149ce5a0cb218160b1da88ace97441f20d2e0a0b2618`
  - `salience/fruit-pear.png` — 244 x 349 pixels, SHA-256
    `b4578f006eb296bbee0055511dca6c36dfde9960eabdb478208f57426fdf613d`
- Human selection: selected because all five silhouettes are complete and distinct
  at the size they are drawn at, and because the five differ from the cream plate by
  visibly different amounts — the colour-difference lever has something to measure
- Public-use decision: approved because the fruit are original generated objects
  with no brand, packaging, label or recognisable product

Exact generation prompt:

> Create one production-ready transparent PNG sprite sheet with exactly five distinct fruit objects in the same crisp high-resolution pixel-art style and deep-navy, warm-cream, teal, coral, mustard and cobalt palette as a modern editorial Bauhaus advertising-agency game. Transparent background only; no plate, no bowl, no table, no cast shadow, no border, no text, no letters, no numerals, no logos and no people. Strict single horizontal row of five perfectly aligned equal square cells with generous transparent separation and consistent registration. Each cell contains exactly one complete uncropped fruit with a strong silhouette that stays readable at small size: 1) a bunch of mustard-yellow bananas; 2) a single round orange in warm coral-orange; 3) a single apple in deep coral red; 4) a bunch of grapes in cobalt purple; 5) a single pear in pale cream-green. Consistent apparent scale across all five, one consistent light direction, restrained highlights, crisp coherent pixel edges, clean alpha at every edge. This must be a clean game asset sheet, not a still life, mockup, interface, concept board, labelled diagram or sticker page.

The generator returned an RGB file with a painted checkerboard despite the
transparency request — the same result the pair sheet produced. Bria then removed
only the background from that file and produced the RGBA sheet the sprites were cut
from.

### `salience/fruit-table-plate.png`

- Tool: `openai/gpt-image-2` on fal.ai at `high` quality
- Final file: the selected original RGB PNG at its generated size, unedited
- Dimensions: 1760 x 640 pixels (aspect ratio 2.75)
- SHA-256:
  `b815f203ee3f6313dcd9f48577263566916a7856ea4c9fd875ebf7bf46ff322e`
- Superseded SHA-256 (first plate, 1792 x 896):
  `3c8e3d61f31efa2a5fed5a89b5e6ee98db81573c1c5c17b80b9a204874529373`
- Reason for the regeneration on 8 August 2026: the arrangement has to fit inside a
  980-pixel dialog in a window only 800 pixels high, and a 2:1 plate scaled to that
  height filled little more than half the available width. The plate was regenerated
  at 2.75:1 so it fills the dialog at full scale. It was not stretched, cropped or
  resampled to get there.
- Human selection: selected over the second candidate because the bowl is cleaner
  and more centred and the middle of the plate is a larger plain cream field, which
  is where the fruit are arranged
- Public-use decision: approved because the plate is an original generated surface
  with no people, logos, brands or readable text

Exact generation prompt:

> Create one production-ready wide banner background plate for a Year 10 classroom advertising game, in crisp high-resolution pixel-art style with a Bauhaus palette of deep navy, warm cream, teal, coral, mustard and cobalt. One flat straight-on view with a single consistent camera angle and no perspective distortion. The entire surface is a warm-cream advertising ground with a subtle paper grain. Composition: one wide shallow teal ceramic bowl, completely empty, viewed straight-on from slightly above, centred horizontally and resting on the lower third of the image with a soft cream contact shadow beneath it. Nothing is inside, on, behind or in front of the bowl. Flat geometric Bauhaus accents are confined strictly to the far-left sixth and far-right sixth of the image: quarter circles, groups of vertical bars, stepped blocks, small squares and thin arcs in navy, coral, mustard, teal and cobalt. The central two thirds of the image, above and around the bowl, stays plain warm cream with nothing on it. No fruit, no food, no plants, no props and no objects other than that one bowl and the edge shapes. No text, letters, numerals, logos, brands, people, hands, table edges, vignette, border or frame. This is a single full-bleed game background, not a mockup, poster, collage, concept sheet or labelled diagram.

The superseded first plate used this prompt, at 1792 x 896:

> Create one clean full-bleed background plate for a browser game, in crisp high-resolution pixel-art using a deep-navy, warm-cream, teal, coral, mustard and cobalt palette, matching a modern editorial Bauhaus advertising-agency style. The scene is a plain warm-cream table surface seen straight on from slightly above, with a single empty shallow teal ceramic bowl resting on it, centred and low in the frame. Absolutely no fruit, no food, no people, no hands, no text, no letters, no numerals, no logos, no interface panels, no vignette and no border. Even lighting, one consistent perspective, restrained texture, and generous uncluttered surface above and around the bowl so game objects can be placed on top of it later. This is a single flat background image, not a still life, mockup, screenshot, interface, concept sheet or collage.

Licence note: fal.ai lists `openai/gpt-image-2` with `license_type: commercial`.
Every input to both models was this project's own text; no third-party image was
supplied to either.

## Crop demonstration assets — `crop/`

Generated 8 August 2026.

These two files supply the advertisement the pair frames in **Frame the image
around the advertisement meaning**, which serves both `framing` and `crop-lab`.
The picture is shipped deliberately too wide to use — 3:1 — so that cropping is a
real decision rather than a tidy-up, and the slogan is a separate draggable piece
so that leaving the message somewhere readable is also the pair's decision. The
measure reads the picture's own pixels underneath wherever the pair puts the
slogan, so the plain plaster wall on the right and the dense pews, tile and roof
timbers everywhere else are load-bearing, not decoration.

### `crop/preppy-max-church.png`

- Tool: `openai/gpt-image-2` on fal.ai at `high` quality
- Generated source: 2880 x 960 pixels, RGB, SHA-256
  `f5cddba602ffcce25fedb38f85b04c6a0e80e75c937af7055f67780179b3a502`
- Final file: the selected original resampled once to 1920 x 640 with Lanczos —
  twice the width it is ever drawn at — and not cropped, stretched or edited
- Dimensions: 1920 x 640 pixels, RGB (aspect ratio 3.0)
- SHA-256:
  `e03fa488da1e5d35685bb0779e61d36d22ffd0d36654492e30c0d0f5970fc6da`
- Human selection: selected over two other candidates because the party is
  genuinely confined to the bottle outline. In both rejected candidates dancers
  with raised arms appear *outside* the outline, which destroys the idea the
  picture exists to carry. This one also has the cleanest bottle silhouette, the
  floor tile and roof timbers continue unbroken across the outline edge, and the
  robed figure still stands at the pulpit outside while the DJ occupies the same
  axis inside
- Measured geometry, in the shipped file's own pixels: the bottle sits at
  x 1264..1776, y 24..936; the plain plaster wall runs x 2060..2880, y 150..720
  in the generated source. The record's `subjectRegion` trims the outline's tip
  and base to `Rect2(842, 64, 342, 528)` in shipped pixels, which is what leaves
  the frame anywhere to move vertically
- Public-use decision: approved because the scene is an original generated
  interior with fictional figures, no logo, no brand and no readable text — the
  bottle carries no label because it is only an outline
- Note for anyone re-cutting this asset: the measure classifies a cell as plain
  from its luminance variance, so the picture must never be resampled with a
  smoothing filter before it is measured. Lanczos moved 72 of its 1200 cells from
  busy to plain and changed five verdicts; the engine downscales with nearest for
  exactly this reason

Exact generation prompt:

> Wide pixel-art illustration, crisp chunky pixels, flat limited palette of deep navy, warm cream, teal, coral, mustard and cobalt blue, heavy dark outlines, 1990s point-and-click adventure background art. ONE continuous interior of a small parish church, seen straight down the central aisle from the back, a single consistent camera angle and one vanishing point. LEFT THIRD: rows of wooden pews packed with a seated congregation seen from behind — still, upright, dull coats and hats. A tall stained-glass window and a stone pillar. Dense with detail. CENTRE-LEFT FOREGROUND: the back of a teenage boy's head and one shoulder, very large, dark navy silhouette, cropped by the bottom edge — an over-the-shoulder view. CENTRE-RIGHT: his arm is raised and his hand holds up a tall soft-drink bottle shape at eye level. THE BOTTLE IS NOT A REAL OBJECT — it is only a clean bottle-shaped outline, a crisp keyhole cut into the picture. No label, no cap, no glass, no highlights, no reflections, no writing on it. INSIDE THE BOTTLE OUTLINE: the exact same church, same pews, same pillars, same vanishing point, continuing across the outline edge with no break or shift — but transformed. Where the pulpit stands there is instead a DJ in headphones behind a pair of turntables. The front pews are empty and the people are standing in the aisle dancing with their arms up, lit by coloured beams of coral and cobalt, confetti in the air. The architecture lines up perfectly with the calm version outside the outline; only the people and the pulpit change. OUTSIDE THE BOTTLE OUTLINE: the same church, calm and dim, a still robed figure standing at the pulpit. RIGHT QUARTER: a large bare whitewashed plaster wall, completely empty and flat cream, no windows, no plaques, no shadows, no texture. The vaulted ceiling has dark timber beams. The floor is patterned encaustic tile. Both are dense with detail. Absolutely no text, no letters, no numbers, no logos and no signage anywhere in the image.

### `crop/preppy-max-lockup.png` — parody slogan block, review before public release

**This is the one asset in this file that is deliberately readable against a real
brand.** Peter asked on 8 August 2026 for a Pepsi Max parody: the advertisement in
this exercise is "Preppy MAX", and the joke only works if it reads as the thing it
is parodying. The block carries the roundel, the wordmark `PREPPY MAX` and the
strapline `LIVE LIFE TO THE MAX`. The roundel came back close enough to the Pepsi
globe to be recognised as one, and the wordmark is set in a heavy condensed
uppercase face chosen to mirror the same identity.

The words are baked into the art rather than set as text at runtime, so they are
**not** in the student-copy corpus and will not be seen by
`student-copy-corpus.mjs` or the copy scrubbers. Anyone reviewing the game's
student-facing wording has to read this entry to find them. The reason for baking
them is that the project ships no font files at all, so type set at runtime falls
back to Godot's default face and loses the condensed wordmark the parody depends
on. If a condensed face is ever added to the project, the honest move is to set
these two lines as text again and put them back under the copy corpus.

The game is behind a password gate rather than openly published, so this ships as
a classroom teaching parody. It is recorded here so that the decision is
deliberate and reversible rather than discovered later.

- Tool: `openai/gpt-image-2` on fal.ai at `high` quality
- Generated source: 1520 x 608 pixels, RGB, SHA-256
  `5442601488870618cca73e4dfa0ce55f431af7fd53858ae541081838503ee425`
- Final file: the selected original resampled once to 960 x 384 with Lanczos and
  not cropped, stretched or edited. That is 2.5:1, exactly the aspect of the
  record's `sloganSize`, and 4.3x the size it is ever drawn at
- Dimensions: 960 x 384 pixels, RGB (aspect ratio 2.5)
- SHA-256:
  `707d1256d7a294c7125c46869863b01645e43af29b319e72693d76f95913aca0`
- Human selection: selected from three candidates. All three spelled both lines
  correctly; this one has the cleanest circular roundel, the crispest letterforms
  and a strapline letter-spaced to the same width as the wordmark above it
- Superseded: `crop/preppy-max-mark.png`, a 256 x 256 RGBA roundel on its own,
  used while the two lines were still set as Godot Labels. Removed rather than
  left in the tree once the lockup replaced it
- Public-use decision: **NOT approved for public release as it stands.** Approved
  for classroom use behind the existing password gate. To clear it for a public
  snapshot, regenerate the block in the game's own palette — teal and coral on
  cream rather than red and blue — which keeps the "a soft drink brand" reading
  without reproducing a specific one

Exact generation prompt:

> A flat pixel-art advertising slogan lockup on a solid deep navy rectangular block. The navy block fills the entire frame edge to edge, with no margin, border or background outside it. LEFT THIRD: a circular soft-drink roundel logo — a thick cream outer ring, and the disc inside split by one thick cream horizontal wave, coral red in the upper half and cobalt blue in the lower half. No text or letters on the roundel itself. RIGHT OF THE ROUNDEL: two lines of type, left-aligned, set in a very bold, heavy, tightly-condensed uppercase sans-serif, cream white against the navy. Line one, large and dominant, filling most of the width: PREPPY MAX. Line two, directly beneath it, roughly half the height, widely letter-spaced: LIVE LIFE TO THE MAX. Spell them exactly and completely: the first line is P R E P P Y then M A X. The second line is L I V E, L I F E, T O, T H E, M A X. No other words anywhere, no extra or repeated letters, no numbers, no trademark or registered symbols, no tagline, no small print. Crisp flat colour blocks, hard clean edges, very high contrast, no gradients, no drop shadows, no glows, no reflections, no texture, no photographic lighting.

Licence note: fal.ai lists `openai/gpt-image-2` with `license_type: commercial`.
Every input to both generations was this project's own text; no third-party image
was supplied.

## Colour demonstration assets — `colour/`

Generated 9 August 2026. Three generations produced eight shipped files.

These supply the colour wheel and the poster the pair recolours in engine C,
which serves both `contrast` and `colour-clinic`. Kate brings three products,
each with a different feeling its brief asks for, so the same wheel has a
different right answer each time. The four poster elements ship as near-white
neutral shapes because Godot tints them to the pair's chosen colour at runtime;
any hue baked into them would contaminate that tint. The three products keep the
project's Bauhaus palette, because the pair is not recolouring the product.

**Read this before regenerating anything here.** `openai/gpt-image-2` did not
honour "transparent background only" on any of the three sheets. It returned
`mode=RGB` files with no alpha channel at all, having painted a grey and white
checkerboard as literal pixels — a picture of transparency rather than
transparency. It looks correct in any viewer that draws its own checkerboard
behind transparent images, which is every viewer. Check `mode` and the alpha
extrema, never the appearance. The two sprite sheets were fixed with
`fal-ai/bria/background/remove`, which is the same second step the salience
sprites needed; the wheel was cut geometrically instead, because background
removal cannot be trusted to find one circle's edge and the circle's radius is
measurable.

### `colour/colour-wheel.png`

- Tool: `openai/gpt-image-2` on fal.ai at `high` quality
- Generated source: 2048 x 2048 pixels, RGB, SHA-256
  `fe83f4db8fb3b3d4b8c5922d7d3c5e0ebaa4a552a6d669259e7632308ec7e49b`
- Final file: hue and saturation rewritten per cell, background cut at the
  measured circle, then resampled once to 768 x 768 with Lanczos
- Dimensions: 768 x 768 pixels, RGBA
- SHA-256:
  `7c33bd1ce5ad51e75a3887377c2227f8cf0762a916be151042c0945e623b3746`
- **The generated wheel was not usable as generated, and the reason matters.**
  Its geometry was good — twelve wedges of about 29 degrees, three concentric
  rings, crisp cream linework — but its colorimetry was not. Measured off the
  generated file, the twelve hues landed between 6.8 and 91.9 degrees apart
  instead of 30, and on four of the twelve wedges the middle and outer rings
  carried the same saturation to within 0.02. Both are load-bearing here. The
  wheel is a teaching asset, so a student reading "the colour opposite is its
  complement" off a wheel whose opposite wedge is 160 degrees away is being
  taught something false. And the stage reads saturation as the strength of a
  colour, so two rings measuring the same leave the pair unable to make the
  action stronger than the supporting elements whichever ring they click
- What was changed: every pixel inside the wheel had its hue set to its wedge's
  true value and its saturation to its ring's value — 0.35 muted, 0.65 mid, 1.0
  full. Nothing else. Each pixel kept its own brightness, so the shading, the
  paper texture, the cream spokes, the ring arcs and the hub are exactly as
  generated. The wedge and ring boundaries were read off the artwork's own drawn
  spokes and arcs rather than assumed to sit on an ideal grid; assuming the grid
  left a visible sliver of the neighbouring hue down one side of several wedges
- Measured after correction: the twelve hue gaps run 29.5 to 30.5 degrees on
  every ring, and the smallest saturation step between adjacent rings anywhere on
  the wheel is +0.295, against the 0.25 margin the record requires. Opposite
  wedges are 180 degrees apart, so the complementary relationship the wheel is
  there to teach is now true of the artwork
- Public-use decision: approved. An original generated diagram with no text, no
  logo, no brand and no people

### `colour/poster-panel.png`, `poster-headline.png`, `poster-body.png`, `poster-action.png`

- Tool: `openai/gpt-image-2` on fal.ai at `high` quality, then
  `fal-ai/bria/background/remove`
- Generated source: one 2880 x 960 sheet, RGB, SHA-256
  `c94cda6f87d46740f5050af9efbd5d45dfc68ab226a5c7ab15228a964e309083`
- After background removal: 2880 x 960, RGBA, SHA-256
  `89a69b1d81347a601675a8c34ffe2c1c31ac727c73b1d833f7d0706c5500a32a`
- Final files: cut at the transparent gutters between the four shapes — **not**
  into equal quarters, because three of the four sit hard against a quarter
  boundary and cutting there shaves a column off the shape — then trimmed to
  content and resampled once at half scale with Lanczos
- Dimensions and SHA-256:
  - `poster-panel.png`, from x 143-684, 270 x 359, RGBA,
    `ad1aaf0b7b93705a6a4cf9b483ac1ca624d78ba2755606b026163d05d87206cf`
  - `poster-headline.png`, from x 808-1454, 323 x 121, RGBA,
    `e2c2d948fbb32fa000731bc00d71cb27bff2eb3bd806546131737ffa11204bde`
  - `poster-body.png`, from x 1582-2174, 296 x 177, RGBA,
    `d00d10a3db1bb9f79a6b9afb34fa68392295b28f0efa0851af71e45cd45b417a`
  - `poster-action.png`, from x 2332-2736, 202 x 120, RGBA,
    `2f51a04112df0b20fbe50b8f3c020d14ce36f62da936c6a293a503afebb6efcd`
- Alpha below 6 per cent was cleared rather than shipped. At that level it is
  invisible on a white page, but these four shapes are tinted to a saturated hue
  at runtime and a film of strong colour over the whole rectangle would not be
- Public-use decision: approved. Four blank shapes, no text, no logo, no brand

### `colour/product-sleep-tea.png`, `product-skateboard.png`, `product-mug.png`

- Tool: `openai/gpt-image-2` on fal.ai at `high` quality, then
  `fal-ai/bria/background/remove`
- Generated source: one 2880 x 960 sheet, RGB, SHA-256
  `29464f1a8a55704e98aa1dba4bdf4c551b7977dd70cd65ad1f051c59b0212764`
- After background removal: 2880 x 960, RGBA, SHA-256
  `ac549f1f60023baf902a0169666962f0260b899f95b48faa51f7b44c2b10a4eb`
- Final files: cut at the transparent gutters, trimmed to content, resampled once
  at half scale with Lanczos
- Dimensions and SHA-256:
  - `product-sleep-tea.png`, from x 282-784, 251 x 371, RGBA,
    `3af611d05d61a1b06cad0d1da06fc94712dc8d975ba14ce74e96f3913de31d35`
  - `product-skateboard.png`, from x 1312-1564, 126 x 415, RGBA,
    `31f8f30b67a37d3ad4ccfe76343fd53c5915e7149694355b89f01cfc0d319ebe`
  - `product-mug.png`, from x 2034-2691, 328 x 262, RGBA,
    `310ea3ca802de88945763f76bc80910212ac2ef4de3c0e0e27ac1926a85c6f99`
- Every product ships unlabelled, which is what lets the poster's own elements
  carry all the colour decisions
- Public-use decision: approved. Three original generated objects, no text, no
  logo, no brand and no people

### `colour/client-kate-preppy-cola.png`

- Tool: OpenAI built-in image generation, then the imagegen skill's local
  `remove_chroma_key.py` helper
- Style references: project-owned `agency-pair.png`, `crop/preppy-max-lockup.png`
  and `colour/product-mug.png`; used only for pixel-art language and the fictional
  brand palette. The generated portrait contains no copied logo, roundel, slogan,
  lettering or product
- Generated source: 1254 x 1254 pixels, RGB, SHA-256
  `7c85974eb2570d9fde44550e5a49d87b1f3c30c0995ae447a3027a3d9deb5d89`
- Generated source retained at
  `C:\Users\Peter Ellis\.codex\generated_images\019fe56c-bb03-7401-a1ec-90b999b151cf\exec-4a04abe5-5993-4845-a239-eef8436bd9ef.png`
- Background removal: the border-sampled key was `#03f80a`; the local helper ran
  with `--auto-key border --soft-matte --transparent-threshold 12
  --opaque-threshold 96 --despill`
- Final file: 1254 x 1254 pixels, RGBA, 906544 bytes, SHA-256
  `321916e4e35c9acad4b7bb53a5f619da6f6659b49d3d6e01129669fbc5b19201`
- Alpha validation: 789743 fully transparent, 5543 partially transparent and
  777230 fully opaque pixels; no key-green-dominant pixel remains above alpha 32
- Public-use decision: approved under Peter's 9 August instruction to presume
  approval on implementation choices. One original fictional elderly client, no
  real person, text, copied logo, trademark or watermark

Exact generation prompt — Kate:

> Use case: stylized-concept
>
> Asset type: square pixel-art client portrait for a Godot classroom game UI, designed for later transparent-background extraction.
>
> Reference use: match the crisp, polished pixel-art language of the supplied game character sheet and product art. Borrow only the navy, vivid red, warm cream and restrained deep-teal colour family from the supplied fictional Preppy Cola parody lockup. Do not reproduce its logo, lettering, roundel, slogan, or bottle.
>
> Primary request: Create Kate, an 80-year-old grandmother and the confident owner of Preppy Cola. Show a respectful chest-up three-quarter portrait of one elderly woman. She has clearly visible age lines, silver-white hair in a neat short softly waved style, and a warm but decisive expression that reads as an experienced business owner. Give her a tailored deep-navy jacket over a warm cream blouse, with one small red accent such as a scarf or brooch. She may wear simple reading glasses. She should feel energetic and capable, neither frail nor comic.
>
> Composition: one character only, centered, facing slightly toward the viewer, complete head and shoulders, generous clear padding around the silhouette, no cropped hair or shoulders, strong readable silhouette at 96 pixels tall.
>
> Style and rendering: deliberate high-quality 2D pixel art, crisp hard-edged pixel clusters, restrained anti-aliasing, coherent single-pixel detail, clear facial features, no painterly blur, no 3D render, no photorealism. Square canvas.
>
> Background: perfectly uniform flat chroma-key green #00FF00 across every background pixel, edge to edge. No gradient, texture, vignette, floor, shadow, halo, glow, reflected green light, or environmental objects. Do not use green or green-adjacent colours anywhere on Kate.
>
> Constraints: no additional people, no children, no hands holding products, no drink container, no text, no letters, no numbers, no logo, no trademark, no watermark, no border, no speech bubble. Avoid caricature, infantilisation, stereotypical granny props, exaggerated frailty, or distorted anatomy.

Exact generation prompt — the wheel:

> Create one production-ready transparent PNG game asset showing exactly one colour wheel, in the same crisp high-resolution pixel-art style as a modern editorial Bauhaus advertising-agency game. Transparent background only. One perfectly circular wheel centred in the square canvas, viewed straight-on with no perspective, no tilt and no shadow. The wheel is divided into exactly twelve equal wedges of thirty degrees each, running in spectrum order clockwise starting from red at the top: red, orange, amber, yellow, chartreuse, green, spring green, cyan, azure, blue, violet, magenta. The wheel is also divided into exactly three concentric rings of equal width. The innermost ring of every wedge is a heavily muted, low-saturation version of that wedge's hue; the middle ring is a moderately saturated version of the same hue; the outermost ring is the fully saturated pure hue. All three rings of one wedge are unmistakably the same hue and differ only in saturation. Every one of the thirty-six cells is a single flat even colour with no gradient, no texture, no highlight and no shading. Wedge and ring boundaries are crisp thin warm-cream lines of even weight. A small plain warm-cream circle at the exact centre. No text, no letters, no numerals, no labels, no arrows, no pointer, no handle, no marker, no swatches outside the circle, no border, no frame, no drop shadow and no people. This must be a clean game asset, not a mockup, interface, colour-picker screenshot, concept board, labelled diagram or infographic.

Exact generation prompt — the four poster elements:

> Create one production-ready transparent PNG sprite sheet containing exactly four blank advertising poster elements, in the same crisp high-resolution pixel-art style as a modern editorial Bauhaus advertising-agency game. Transparent background only. One strict horizontal row of four generously separated equal cells, perfectly aligned, with no border around the overall sheet. CRITICAL: every element must be rendered in NEAR-WHITE NEUTRAL GREY ONLY. There must be no colour, no hue, no tint and no saturation anywhere in the image, because the game tints these shapes to the player's chosen colour at runtime; any colour baked in here would contaminate that tint. Use only white through light grey, with shading limited to very light neutral greys. CELL 1: a plain rectangular poster background panel with softly rounded corners and a subtle even paper grain. CELL 2: a bold solid headline bar, a wide short rectangle with crisp square ends and a flat even face. CELL 3: a body-copy block, four evenly spaced horizontal bars of equal thickness stacked with even gaps, each bar slightly shorter than the one above it, suggesting lines of text without any actual letters. CELL 4: a call-to-action button, a compact rounded rectangle with a clean thick even outline and a plain empty face. Consistent apparent scale, complete uncropped silhouettes, strong readable shapes at small size, crisp coherent pixel edges, clean alpha at every edge, one consistent light direction, restrained highlights. No text, no letters, no numerals, no logos, no brands, no people and no colour. This must be a clean game asset sheet, not a mockup, interface, wireframe screenshot, concept board or labelled diagram.

Exact generation prompt — Kate's three products:

> Create one production-ready transparent PNG sprite sheet containing exactly three distinct retail products, in the same crisp high-resolution pixel-art style and deep-navy, warm-cream, teal, coral, mustard and cobalt palette as a modern editorial Bauhaus advertising-agency game. Transparent background only; no shelf, no table, no packaging backdrop, no cast shadow, no border, no text, no letters, no numerals, no logos, no brands and no people. Strict single horizontal row of three perfectly aligned equal cells with generous transparent separation and consistent registration. Each cell contains exactly one complete uncropped product with a strong silhouette that stays readable at small size: 1) a rectangular carton of herbal sleep tea viewed straight-on, its front face completely blank and unlabelled; 2) a skateboard seen from directly above with all four wheels visible, the deck completely blank and unlabelled; 3) a handmade ceramic mug with a single handle, viewed straight-on from slightly above, the glaze plain and completely unlabelled. Consistent apparent scale across all three, one consistent light direction, restrained highlights, crisp coherent pixel edges, clean alpha at every edge. This must be a clean game asset sheet, not a still life, mockup, interface, concept board, labelled diagram or sticker page.

Licence note: fal.ai lists `openai/gpt-image-2` with `license_type: commercial`,
and `fal-ai/bria/background/remove` is the same background remover already used
for the salience sprites. Every input to all three generations was this project's
own text; no third-party image was supplied.

## Validation record

- Visual inspection confirmed no cropped silhouettes, unintended text or
  recognisable brand.
- PNG inspection confirmed the floor is RGB and all three sheets are RGBA with
  alpha values from 0 to 255.
- Godot imported all four textures and loaded them in the running project.
- Godot reported alpha mode `0` for the opaque floor and alpha mode `2` for the
  pair, device and icon sheets.
- Godot read the five salience sprites back through the demonstration's own
  measure: each reported an alpha coverage between 0.54 and 0.78 of its bounding
  box, so the transparency survives import rather than being painted on.
- The salience plate is RGB and all five salience sprites are RGBA.
- Godot read the crop picture back through the demonstration's own measure: 423
  of its 1200 cells classify as plain and the rest as busy, so the picture has
  both somewhere to put the slogan and enough clutter to be worth cropping away.
- The crop picture and the parody slogan block are both RGB, and the block's 2.5:1
  aspect matches the box the record gives it, so the wordmark is neither stretched
  nor letterboxed. `test_crop_measure.gd` asserts that match.
- The four checks were verified against the shipped file before any of the engine
  was written, and again after the resample to 1920 x 640: the slogan reads 0.99
  of its area as plain on the wall, 0.77 straddling its edge and 0.01 across the
  bottle, and five structurally different frames pass. `test_crop_measure.gd`
  holds all of that.
- All three colour sheets came back from `openai/gpt-image-2` as `mode=RGB` with
  alpha extrema `(255, 255)` — no alpha channel, and a checkerboard painted in as
  pixels. This was caught by reading the file's mode, not by looking at it, and it
  is the reason the mode check is now written down above rather than left to
  inspection.
- All eight shipped colour files are RGBA with alpha extrema `(0, 255)`, and each
  was composited over flat mid-grey and inspected, which is the only way the
  painted checkerboard and a real cutout look different.
- The corrected wheel measures 29.5 to 30.5 degrees between adjacent hues on all
  three rings, against 30.0 for a true wheel, and its smallest saturation step
  between adjacent rings is +0.295 against the record's 0.25 requirement. Both
  figures come from sampling the shipped file's own pixels.
- The four poster elements carry no hue: they are neutral, which is what keeps a
  runtime tint faithful to the colour the pair actually chose.
