# Advertising agency visual assets

Generation date: 29 July 2026

These assets were created specifically for the Advertising Market Game. They do
not copy the branded advertisements in the teaching source folders. The selected
images contain no recognisable trademark, commercial logo, real person, or
readable third-party advertising copy.

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
- Final file: commercially licensed Bria background-removal result; character
  pixels and registration were retained, and the sheet was resampled on
  2026-08-07 to the size it is actually drawn at (see below)
- Alpha: genuine RGBA transparency, confirmed in the final PNG and by Godot
- Dimensions: 432 x 244 pixels, an eight-cell 4x2 grid of 108 x 122 cells
- SHA-256:
  `d1041230a6d4edc1d871d7bbeba295f401c3d2c7b7fd0df7c3d4e76ecccb2b42`
- Superseded SHA-256 (background-removal result at 1672 x 941):
  `8eec47af4b31b2c3f6866a14c0e840c51d983617decc8b730c29d5e54934d1ba`
- Edit on 2026-08-07: at 418 x 470 per cell the sheet rendered at `scale = 0.13`,
  so the GPU reduced each figure to 54 x 61 by nearest-neighbour sampling and the
  faces and hands broke up. Each cell was resampled to 108 x 122 — twice the
  rendered size — using premultiplied-alpha Lanczos with a light unsharp pass, and
  the sprites now use `scale = 0.5`. The rendered footprint is unchanged. No pixels
  came from outside this file, so the provenance and public-use decision below are
  unchanged.
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

## Validation record

- Visual inspection confirmed no cropped silhouettes, unintended text or
  recognisable brand.
- PNG inspection confirmed the floor is RGB and all three sheets are RGBA with
  alpha values from 0 to 255.
- Godot imported all four textures and loaded them in the running project.
- Godot reported alpha mode `0` for the opaque floor and alpha mode `2` for the
  pair, device and icon sheets.
