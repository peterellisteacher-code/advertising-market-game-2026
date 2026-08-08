# Advertising agency visual assets

Generation date: 29 July 2026

These assets were created specifically for the Advertising Market Game. They do
not copy the branded advertisements in the teaching source folders. The selected
images contain no recognisable trademark, commercial logo, real person, or
readable third-party advertising copy — with **one deliberate exception**, the
`crop/preppy-max-mark.png` parody roundel, which is described and flagged in its
own section below. That exception is the only asset here that is meant to be
read against a real brand, and it is the one to review before any public
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

### `crop/preppy-max-mark.png` — parody mark, review before public release

**This is the one asset in this file that is deliberately readable against a real
brand.** Peter asked on 8 August 2026 for a Pepsi Max parody: the advertisement
in this exercise is "Preppy MAX", and the joke only works if the mark reads as
the thing it is parodying. It was generated from a description of a red-over-blue
wave roundel and came back close enough to the Pepsi globe to be recognised as
one. The wordmark beside it is not part of this file — "PREPPY MAX" and "LIVE
LIFE TO THE MAX" are set as text by the stage, so no third-party wordmark was
reproduced.

The game is behind a password gate rather than openly published, so this ships as
a classroom teaching parody. It is recorded here so that the decision is
deliberate and reversible rather than discovered later.

- Tool: `openai/gpt-image-2` on fal.ai at `high` quality
- Generated source: 832 x 832 pixels, RGB on white, SHA-256
  `a55bc414a655cd15dee4e8b153441917e96020cfacfc14ed6dc9b141183acf9e`
- Final file: the disc cropped to its own bounds and given an antialiased circular
  alpha mask computed geometrically at 4x supersampling, then resampled once to
  256 x 256. No background-removal model was used: the mark is a circle, so a
  geometric mask is exact where a keying model would have guessed at the boundary
  between the cream ring and the near-white ground
- Dimensions: 256 x 256 pixels, RGBA
- Alpha: 51,244 of 65,536 pixels opaque, which is pi/4 of the square to within a
  rounding error — the mask is the circle it claims to be
- SHA-256:
  `aa01a50621dfefe5efaeb370e142dbfecd854b57b2e3d744123c6ff2614a8b5a`
- Public-use decision: **NOT approved for public release as it stands.** Approved
  for classroom use behind the existing password gate. To clear it for a public
  snapshot, regenerate the roundel in the game's own palette — teal and coral on
  cream rather than red and blue — which keeps the "a soft drink brand" reading
  without reproducing a specific one

Exact generation prompt:

> A single circular soft-drink brand roundel logo icon, flat pixel-art vector style, centred on a plain pure white background with generous margin. A bold circle with a thick cream outer ring. The disc inside is divided by one thick cream horizontal wave that curves across the middle: coral red in the upper half, cobalt blue in the lower half. Absolutely no text, no letters, no numbers, no words anywhere on or near the logo. Crisp flat colour blocks, hard edges, no gradients, no shadows, no reflections, no highlights, no drop shadow.

Licence note: fal.ai lists `openai/gpt-image-2` with `license_type: commercial`.
Every input to both generations was this project's own text; no third-party image
was supplied.

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
- The crop picture is RGB and the parody mark is RGBA.
- The four checks were verified against the shipped file before any of the engine
  was written, and again after the resample to 1920 x 640: the slogan reads 0.99
  of its area as plain on the wall, 0.77 straddling its edge and 0.01 across the
  bottle, and five structurally different frames pass. `test_crop_measure.gd`
  holds all of that.
