# Product-shell style audition: raw visual consensus

- Date: 2026-07-13
- Evidence: `contact-sheet.png` from iteration 01
- Action: OpenRouter `consensus`
- Temperature: 0.1
- Seed: 20260713
- Requested maximum output per model: 32,000 tokens
- Models, in fixed order: `moonshotai/kimi-k2.7-code`, `stepfun/step-3.7-flash`, `google/gemini-3.1-pro-preview`, `xiaomi/mimo-v2.5`, `minimax/minimax-m3`, `x-ai/grok-4.5`
- First exact gateway call: transport timeout before any labelled slot was returned
- Unchanged whole-panel retry: all six labelled responses returned; no substitutions; no judge model

[consensus: 6 independent panel responses below — no judge model has run. Synthesise these yourself: note where the models agree, where they conflict, and any unique points.]

--- panel model: moonshotai/kimi-k2.7-code ---
**Overall verdict: REVISE**

The set is close to a cohesive, Canva-like family, but it has one item that is not readable as its category, several direct-surface editor states with no visible selection feedback, and a flat-skin item whose authoring-to-preview relationship is unclear. These are fixable, but they would block classroom use as-is.

---

## Item-by-item review

| # | Prototype | Verdict | Recognisability | Custom surface & guides | Concrete issues |
|---|-----------|---------|-------------------|--------------------------|-----------------|
| 1 | **Aquarium** | Pass | Clear as a tank | Large front-glass direct surface; editor state looks identical to clean preview | Fixed water line bisects the design area; editor-selected corner guides are imperceptible in the supplied image |
| 2 | **Food Truck** | Pass | Clear as a truck/van | Large side-panel direct surface; editor state looks identical to clean preview | No visible selection guide; awning, window and wheels are fixed, which is acceptable but the editable side panel needs a subtle boundary cue |
| 3 | **Garden Tool** | **Blocker** | Reads as a thermos, spray can or inhaler — not a garden tool | Cylindrical body could be a label area, but no visible editor guide | Silhouette lacks tool cues (handle, blade, tines, spout shape); needs a full redesign to a recognisable garden implement |
| 4 | **Headphones** | Pass | Clear as over-ear headphones | Ear-cup face is the obvious direct surface; guide is very faint | Guide should be slightly more visible; headband shading is a little flat compared with the cup |
| 5 | **Hoodie** | Pass | Clear as a hoodie | Torso front is a large direct surface; guide is faint | Pocket and drawstrings are fixed details that students must design around; selection guide needs more presence |
| 6 | **Pet Shop** | Revise | Reads as a generic shopfront, not specifically a pet shop | Awning/sign area is the likely direct surface; guide is faint | Needs a neutral pet-shop category cue (e.g., small paw/bone icon or hanging sign bracket) without branding it for students |
| 7 | **Slim Drink Can** | Pass | Clear as a slim can | Flat-skin label rectangle maps cleanly to the cylindrical preview | Top/bottom rims are fixed; relationship between skin and 3D preview is immediately understandable |
| 8 | **Smartphone** | Pass | Clear as a smartphone | Screen is the obvious direct surface; guide is faint | Notch and side buttons are fixed; selection boundary around the screen should be more visible |
| 9 | **Snack Pouch** | Pass | Clear as a stand-up pouch | Flat-skin rectangle maps well to the front panel | Top seal and bottom gusset are fixed; authoring-to-preview relationship is clear |
| 10 | **Sports Drink Bottle** | Pass | Clear as a sports bottle | Flat-skin rectangle maps well to the label area | Cap/shoulder and base are fixed; relationship is clear |
| 11 | **Takeaway Box** | Revise | Clear as a folded takeaway box | Flat-skin rectangle does not obviously map to one face | 3D preview shows multiple angled planes; the skin needs a front-panel outline or ghost net so students know where their art lands |
| 12 | **Trainer** | Revise | Clear as a sneaker | Side-panel direct surface is small | Customisable area should be enlarged (e.g., full side upper) or a second panel added; sole is slightly chunky; guide is faint |

---

## System-wide strengths

- **Cohesive visual language:** uniform muted palette (cream, blue-grey, peach), consistent line weight, rounded corners and restrained shading give a playful-but-professional Canva-like feel.
- **Age-appropriate tone:** the style is clean and modern for 14–16-year-olds without being childish or overly corporate.
- **Unbranded and open-ended:** no logos, slogans or pre-solved advertising content; students are clearly left to invent the brand.
- **Flat-skin workflow succeeds for cylinders:** Slim Drink Can, Snack Pouch and Sports Drink Bottle all communicate the “label wraps around” idea cleanly.
- **Thumbnail legibility:** most silhouettes read quickly at small size.
- **Good category spread:** apparel, electronics, packaging, venue and FMCG items give pairs a wide range of creative starting points.

---

## System-wide weaknesses

- **Direct-surface editor guides are imperceptible:** in the supplied sheet, the editor-selected states for Aquarium, Food Truck, Garden Tool, Headphones, Hoodie, Pet Shop, Smartphone and Trainer are almost identical to the clean previews. Selection feedback is therefore missing or useless.
- **Weak category cues:** Garden Tool is unrecognisable without its title; Pet Shop reads as a generic store.
- **Inconsistent customisable real estate:** the Trainer panel is too small, while the Food Truck side panel and Hoodie torso are generous.
- **Flat-skin mapping breaks on non-cylinders:** the Takeaway Box skin rectangle does not obviously correspond to the folded 3D form.
- **Lighting direction is not fully consistent:** some planes are shaded on the left, some on the bottom, and a few items read flatter than others.
- **Subtle tonal boundaries:** the peach/cream distinction that often marks the editable zone is low-contrast and may be hard for some students to see before they enter the editor.

---

## Highest-priority changes (actionable visual directions)

1. **Redesign the Garden Tool.** Move away from the ambiguous cylinder. Use a silhouette that is instantly readable as a garden tool — a hand trowel, watering can, rake or secateurs — with one large, flat direct surface and visible-but-subtle editor guides.
2. **Make editor guides visible but delicate across all direct-surface items.** Add slightly darker or thicker corner brackets/crosshairs in the editor-selected state only; they must vanish completely from the clean market output.
3. **Fix the Takeaway Box authoring-preview relationship.** In the flat-skin editor view, outline the front panel and add a faint ghost of the folded box (or a simple net fold line) so students understand how the 2D skin wraps onto the 3D form.
4. **Add a neutral pet-shop cue to Pet Shop.** A small fixed paw print, bone or hanging sign bracket on the storefront is enough to signal “pet” without solving the advertising challenge.
5. **Enlarge the Trainer custom surface.** Turn the small side logo diamond into a larger side-panel area, or offer two panels (side + heel tab), so students have usable branding space.
6. **Standardise lighting.** Pick one direction (e.g., top-left) and apply it consistently to every plane, rim and shadow so the family feels like one kit.

---

## Essential blockers vs. optional polish

- **Essential blockers (must be fixed before use):**
  - Garden Tool is not recognisable as a garden tool without the title.
  - Editor guides on direct-surface states are missing or imperceptible in the supplied image, making selection feedback fail.
  - Takeaway Box flat-skin mapping is ambiguous.

- **Major but not system-blocking:**
  - Pet Shop lacks a pet-specific category cue.
  - Trainer customisable area is too small.
  - Several other direct-surface items have overly faint guides.

- **Optional polish:**
  - Tighten lighting direction across the whole set.
  - Increase contrast between editable and fixed areas for accessibility.
  - Fine-tune fixed details (Aquarium water line, Hoodie pocket, Headphones headband shading) so they frame rather than fight student artwork.

--- panel model: stepfun/step-3.7-flash ---
**Overall Verdict: PASS**
*(with mandatory revision to one prototype and recommended refinement to a second)*

The system demonstrates a cohesive, Canva-appropriate aesthetic that balances professionalism with creative openness. The visual language is consistent, the preview/editor relationship is clear, and the customisable areas are generally obvious. However, one prototype fails the basic recognisability test required for a classroom advertising exercise, necessitating revision before deployment.

---

### Item-by-Item Evaluation

| Prototype | Recognisability | Visual Desirability (14–16) | Contour & Dimensionality | Customisable Area | Editor Guides & Authoring Clarity | Specific Issues |
|-----------|----------------|----------------------------|--------------------------|-------------------|-----------------------------------|-----------------|
| **Aquarium** | Strong | Strong | Fine, product-like; 2–3 tonal planes (glass, water, base) | Large, obvious (water volume) | Subtle corner guides; direct surface clear | None significant; water wave is distinct from artwork area |
| **Food Truck** | Strong | Strong | Fine, vehicle-like; restrained shading | Large side panel/serving window | Guides subtle; flat-skin mapping clear | None |
| **Garden Tool** | **Weak** | Moderate | Fine contours, but silhouette is ambiguous | Clear area indicated | Guides present | **BLOCKER:** Resembles leaf blower, sprayer, or generic equipment; pink base is confusing and non-standard for category. Students cannot identify the product to advertise it. |
| **Headphones** | Strong | Strong | Modern, fine, product-like; 2–3 planes (ear cup, band, cushion) | Clear ear cup surface | Guides subtle; direct surface intuitive | None |
| **Hoodie** | Strong | Strong | Apparel-accurate; soft shading suggests fabric | Clear chest print area | Guides subtle; direct surface clear | None |
| **Pet Shop** | Moderate | Strong | Fine, building-like; 2–3 planes (awning, facade, door) | Clear awning/window zones | Guides subtle | **Concern:** Generic retail architecture resembles café or boutique; lacks pet-specific category cues (paw prints, animal silhouettes) to distinguish from other shops. |
| **Slim Drink Can** | Strong | Strong | Cylindrical, product-like; subtle top/bottom shading | Full-wrap layout visible in editor | Corner guides clear; flat-skin mapping obvious | None |
| **Smartphone** | Strong | Strong | Modern device silhouette; screen area distinct | Clear screen surface | Guides subtle; direct surface clear | None |
| **Snack Pouch** | Strong | Strong | Packaging-accurate; stand-up pouch form | Clear front panel in flat-skin view | Guides clear; mapping intuitive | None |
| **Sports Drink Bottle** | Strong | Strong | Bottle proportions accurate; cap detail clear | Label area distinct | Guides clear; flat-skin mapping obvious | None |
| **Takeaway Box** | Strong | Strong | Container form clear; interlocking flaps suggested | Top/front panel clear in flat-skin | Guides clear | None |
| **Trainer** | Strong | Strong | Sneaker silhouette accurate; side panel distinct | Clear side panel area | Guides subtle; flat-skin mapping clear | None |

---

### System-Wide Strengths

1. **Cohesive Canva-like Aesthetic**: The muted, cool palette (slate blues, soft greys, gentle warm accents) feels professional and contemporary, avoiding the "childish" trap while remaining approachable for 14–16 year olds.
2. **Exceptional Consistency**: Uniform line weight, consistent top-left lighting, and identical shadow/highlight logic across all 12 items create a unified family that reads as a deliberate system.
3. **Clear Authoring Paradigm**: The distinction between Clean Preview (3D context) and Editor-Selected (2D flat-skin or selection guides) is immediately understandable. The four flat-skin items (Can, Pouch, Bottle, Box) demonstrate correct unwrapping logic with corner guides that do not dominate.
4. **Appropriate Customisation Visibility**: Customisable areas are indicated through value contrast (lighter tonal planes) without pre-populating them with "sample" artwork, preserving the blank-canvas requirement.
5. **Unbranded Openness**: No logos, no specific brand colors, and no solved advertising compositions. The products are neutral vessels for student creativity.
6. **Thumbnail Legibility**: At contact-sheet scale, 11 of 12 items are immediately identifiable by silhouette alone.

---

### System-Wide Weaknesses

1. **Garden Tool Ambiguity**: The silhouette conflates multiple tool types (leaf blower, sprayer, cultivator). The pink base component lacks functional clarity, breaking the recognisability criterion.
2. **Pet Shop Genericness**: The architecture is retail-neutral. Without pet-specific affordances, students may misinterpret the category, undermining the advertising brief.
3. **Aquarium Waterline Interpretation Risk**: The stylised wave pattern, while likely structural, could be misread as fixed artwork rather than water, slightly muddying the "blank product body" concept.
4. **Direct-Surface Guide Consistency**: While the purple corner guides are appropriately subtle, their application varies slightly between direct-surface items (some show corner brackets, others show edge highlights), which could confuse the mapping logic for some students.

---

### Highest-Priority Changes (Actionable Visual Directions)

1. **Redesign Garden Tool (Essential Blocker)**
   Replace the current ambiguous form with an unmistakable silhouette. Options:
   - A **hand trowel** with a distinct blade and ergonomic handle (green or orange accents acceptable).
   - A **rake** with visible tines.
   - If retaining the powered-tool concept, redesign as a clearly identifiable **leaf blower** with a distinct handle/blower housing separation and functional colour coding (e.g., grey body, orange accents).
   *Remove the unexplained pink base or integrate it as a functional component (fuel tank, motor housing).*

2. **Add Pet-Specific Cues to Pet Shop (Recommended)**
   Introduce subtle, open-ended architectural details that signal "pet" without branding:
   - Paw-print silhouettes in the window glass.
   - A bone-shaped door handle or knocker.
   - A hanging sign bracket shaped like a cat or dog (blank, for student design).
   *Maintain the neutral colour palette; these should be structural silhouettes only.*

3. **Clarify Aquarium Waterline (Optional Polish)**
   Simplify the water surface to a straight horizon line or ensure the wave pattern is clearly part of the tank's structural glass/water feature, not a pre-designed graphic. Consider adding a very subtle "water level" indicator line to distinguish structure from customisable space.

---

### Essential Blockers vs. Optional Polish

**Essential Blockers (Must fix before classroom use):**
- **Garden Tool recognisability**: The product category must be immediately obvious from silhouette alone. Year 10 students cannot be expected to advertise an ambiguous tool. This requires a silhouette redesign.
- **Flat-skin mapping integrity**: Ensure the four flat-skin items maintain their 2D-to-3D relationship logic in the final implementation (currently met in prototype).

**Optional Polish (Post-launch refinements):**
- **Pet Shop category cues**: While currently passable, adding pet-specific architectural silhouettes would reduce student confusion.
- **Aquarium waterline clarification**: Minor adjustment to ensure the water feature is not mistaken for student-designable artwork.
- **Material texture hints**: Adding extremely subtle fabric weave suggestions to the Hoodie and Trainer (via 5% opacity texture) could enhance product recognition without visual noise.
- **Editor guide standardisation**: Ensure all direct-surface items use identical corner-bracket guide styling in the editor state for maximum consistency.

The system is fundamentally sound and ready for piloting with the exception of the Garden Tool, which requires immediate visual revision.

--- panel model: google/gemini-3.1-pro-preview ---
Here is the independent visual-design review for the 12-prototype classroom advertising game audition.

### OVERALL VERDICT: REVISE

While the visual style successfully establishes a cohesive, professional, and age-appropriate aesthetic, there is a fundamental mechanical flaw in how the "flat-skin" authoring views are represented. Furthermore, a few specific prototypes fail the recognisability test or offer insufficient canvas space for a Year 10 advertising project. These issues must be addressed before classroom deployment.

---

### ITEM-BY-ITEM EVALUATION

| Prototype | Recognisability | Customisable Area | Specific Issues & Ratings |
| :--- | :--- | :--- | :--- |
| **Aquarium** | Good | Ambiguous | **Revise.** The pink wavy shape inside reads as water/sand rather than a clear advertising canvas. If students are meant to design the glass or a backdrop, the canvas area needs to be much more obvious and rectangular to support standard graphic design. |
| **Food Truck** | Excellent | Excellent | **Pass.** Strong silhouette. The awning and side panel offer great, logical spaces for student branding. Corner guides in the editor view are subtle and effective. |
| **Garden Tool** | Poor | Poor | **Revise (Redesign).** This does not read as a garden tool; it looks like a downspout, a vacuum attachment, or a syringe. Furthermore, the pink customisable area at the bottom is far too small for a student to apply a meaningful brand or logo. Needs to be a recognizable item (e.g., a watering can, a trowel, or a seed packet) with a large flat surface. |
| **Headphones** | Good | Good | **Pass with minor polish.** The customisable ear cup is a great canvas. However, the perspective is slightly conflicting (the ear cup is drawn perfectly flat/orthographic, while the headband implies a 3/4 angle). |
| **Hoodie** | Excellent | Poor | **Revise.** The hoodie itself is perfectly drawn, but the pink customisable area is restricted entirely to the front pouch pocket. For an apparel advertising task, students will want to design the main chest area. The canvas must be expanded to the upper torso. |
| **Pet Shop** | Good | Good | **Pass.** A clean, generic storefront that serves as an excellent blank canvas. The awning and window spaces provide logical, flexible areas for signage and branding. |
| **Slim Drink Can** | Good | Broken (Editor) | **Revise.** The 3D preview is great. However, the flat-skin editor view on the right is a generic, wide rectangle. A slim can requires a tall, portrait-oriented UV map/die-line. If a student designs on that wide rectangle, their artwork will be severely squashed horizontally when mapped to the can. |
| **Smartphone** | Excellent | Excellent | **Pass.** Flawless execution for the intended purpose. The screen is the obvious canvas, the guides are subtle, and the geometry is perfect. |
| **Snack Pouch** | Good | Broken (Editor) | **Revise.** The 3D pouch tapers at the top and has a specific aspect ratio. The flat-skin editor view is the exact same generic rectangle used for the drink can. Applying a rectangular design to a tapered 3D object without a proper die-line template will result in warped, frustrating results for students. |
| **Sports Drink Bottle** | Good | Broken (Editor) | **Revise.** Similar to the can and pouch, the flat-skin editor view is a generic rectangle that does not match the aspect ratio or wrap-around dimensions of the bottle's label area. |
| **Takeaway Box** | Good | Broken (Editor) | **Revise.** This is the most severe flat-skin failure. The takeaway box is a complex geometric shape with angled, trapezoidal sides. Providing a flat, standard rectangle as the authoring view is a massive UX failure. Students need a folded die-line (showing the front, sides, and top flaps) to design for this object successfully. |
| **Trainer** | Poor | Poor | **Revise (Redesign).** The silhouette reads more like a slip-on sandal, a cast, or a shoe-cover than a desirable "trainer" (sneaker) for a 14–16-year-old. The pink customisable area is a small, awkwardly placed grid patch on the bridge of the foot. Needs to be redesigned as a classic sneaker profile with a large side-panel canvas. |

---

### SYSTEM-WIDE STRENGTHS

*   **Aesthetic Coherence:** The line weight, muted pastel/grey palette, and lighting are highly consistent across the board. They look like they belong to the same software ecosystem.
*   **Appropriate Tonal Planes:** The artist has successfully used 2–3 restrained tonal planes (base, shadow, highlight). It creates enough volume to look professional without becoming photorealistic, busy, or resembling cheap clip-art.
*   **Unbranded Nature:** The items successfully avoid solving the design problem for the student. They are excellent "blank slates."
*   **Direct Surface Guides:** On the items where direct surface authoring works (Food Truck, Smartphone), the faint corner brackets in the editor-selected state are perfectly executed—subtle, useful, and non-intrusive.

### SYSTEM-WIDE WEAKNESSES

*   **The Flat-Skin Authoring Paradigm is Broken:** The artist has used a single, generic rectangular asset with a crosshair for *all* flat-skin editor views (Can, Pouch, Bottle, Box), regardless of the 3D object's actual geometry, aspect ratio, or taper. This shows a misunderstanding of how texture mapping/die-lines work. If implemented this way, students' designs will stretch, squash, and warp, leading to immense classroom frustration.
*   **Canvas Size Misjudgments:** In a few instances (Hoodie, Garden Tool, Trainer), the designated customisable area (indicated by the pink/peach tone) is far too small to support a student's advertising design, logo, and typography.

---

### HIGHEST-PRIORITY CHANGES (Actionable Visual Directions)

1.  **Generate Accurate Die-lines for Flat-Skin Items:** The right-hand "Editor-Selected" views for the Slim Drink Can, Snack Pouch, Sports Drink Bottle, and Takeaway Box must be redrawn to match the exact unwrapped geometry (UV map) of the 3D object.
    *   *Can/Bottle:* Needs an aspect-ratio-accurate rectangle representing the wrap-around label.
    *   *Pouch:* Needs a template that shows the top taper.
    *   *Takeaway Box:* Needs a flattened, multi-panel die-line showing the trapezoidal front and sides.
2.  **Redesign the "Garden Tool" and "Trainer":** Discard the current geometries. Draw a recognizable garden item (e.g., a wide watering can) and a recognizable laced sneaker (side profile). Ensure both have large, flat, obvious areas for student artwork.
3.  **Expand the Hoodie Canvas:** Move the pink customisable zone from the small front pocket to encompass the entire upper chest/torso area.

---

### ESSENTIAL BLOCKERS VS. OPTIONAL POLISH

**Essential Blockers (Must fix before launch):**
*   Fixing the generic flat-skin editor rectangles to be accurate, shape-specific die-lines/UV templates. (If this is not fixed, the game is mechanically broken for those items).
*   Redesigning the Garden Tool and Trainer for recognisability.
*   Expanding the customisable area on the Hoodie.

**Optional Polish (Nice to have, but not critical):**
*   Adjusting the perspective on the Headphones so the ear cup angle matches the headband angle.
*   Clarifying the Aquarium canvas (making the pink area a distinct rectangular backdrop or glass cling rather than a wavy organic shape).

--- panel model: xiaomi/mimo-v2.5 ---
**Overall Verdict: REVISE**

The system demonstrates a strong, consistent visual language and a clear UI logic for the editor/preview states. However, the overall palette is too washed out for a game about advertising, and several prototypes (Garden Tool, Hoodie) have critical flaws in recognisability and customisation area size that would hinder the core gameplay loop. The style is professional but lacks the "playful" energy requested.

---

### Item-by-Item Prototype Review

| Prototype | Rating | Key Issues & Observations |
| :--- | :--- | :--- |
| **Aquarium** | **PASS** | **Recognisability:** High. Clear fish-tank silhouette.<br>**Custom Area:** Large, obvious front glass area.<br>**Issues:** None significant. Clean and functional. |
| **Food Truck** | **PASS** | **Recognisability:** High. Clear side-profile truck.<br>**Custom Area:** Side panel/awning is a good billboard space.<br>**Issues:** Wheels are simple but acceptable. Perspective is flat but works for the style. |
| **Garden Tool** | **REVISE** | **Recognisability:** Low. Ambiguous shape (hoe? scraper?). Hard to identify at thumbnail size.<br>**Custom Area:** Very small (blade/head only).<br>**Issues:** **Blocker.** Shape is too thin and tall. Custom area is insufficient for a marketing game. Needs redesign to a more recognizable tool (e.g., trowel, rake) with a larger custom surface. |
| **Headphones** | **PASS** | **Recognisability:** High. Clear over-ear shape.<br>**Custom Area:** Ear cup is a good circular/oval canvas.<br>**Issues:** Shape is slightly rounded/blobby but acceptable. |
| **Hoodie** | **REVISE** | **Recognisability:** High. Clear hoodie silhouette.<br>**Custom Area:** **Blocker.** The custom area is restricted to the small front pocket. This is too small for a main logo or design. Needs to be the entire front chest or back.<br>**Issues:** Shape is a bit stiff/flat. |
| **Pet Shop** | **PASS** | **Recognisability:** High. Clear storefront/building.<br>**Custom Area:** Large sign/awning area is excellent.<br>**Issues:** None significant. Good "business" category cue. |
| **Slim Drink Can** | **PASS** | **Recognisability:** High. Clear cylinder.<br>**Custom Area:** Flat skin (right) is a functional rectangle.<br>**Issues:** Flat skin view is a bit dry (looks like a grid/window), but functional. Mapping is understandable. |
| **Smartphone** | **PASS** | **Recognisability:** High. Clear phone shape.<br>**Custom Area:** Screen is a large, obvious rectangle.<br>**Issues:** None significant. |
| **Snack Pouch** | **PASS** | **Recognisability:** High. Clear pouch/bag shape.<br>**Custom Area:** Flat skin is functional.<br>**Issues:** Shape is a bit generic, but acceptable. |
| **Sports Drink Bottle** | **PASS** | **Recognisability:** High. Clear bottle shape.<br>**Custom Area:** Flat skin is functional.<br>**Issues:** Bottle shape is slightly blocky, but acceptable. |
| **Takeaway Box** | **REVISE** | **Recognisability:** Moderate. Looks like a clamshell or carton.<br>**Custom Area:** Flat skin is functional.<br>**Issues:** **Polish.** Perspective on the preview (left) is wonky/low-poly. Looks slightly distorted. Needs refinement to look more like a product and less like a wireframe. |
| **Trainer** | **REVISE** | **Recognisability:** Moderate. Looks like a shoe/slipper.<br>**Custom Area:** Side panel is a good canvas.<br>**Issues:** **Polish.** Shape is "blobby" or "chunky". Needs refinement to look more sleek and product-like. |

---

### System-Wide Strengths

1.  **Visual Consistency:** The family is extremely cohesive. Line weight, palette, shading style, and proportions are uniform across all 12 items. This is a major strength for UI/UX.
2.  **Cleanliness & Professionalism:** The designs are uncluttered and minimal. They avoid the "clip-art" look and feel like a professional design tool (Canva-like).
3.  **Custom Area Indicators:** The use of the peach/pink tone to indicate editable areas is a smart, consistent UI pattern. It makes it immediately clear where the student should focus.
4.  **Editor vs. Preview Logic:** The distinction between "Clean Preview" and "Editor-Selected" is clear. The editor state adds subtle corner guides without being overwhelming.
5.  **Flat Skin Mapping:** The 2D/3D relationship for flat-skin items is understandable and functional.

---

### System-Wide Weaknesses

1.  **Low Contrast & Visibility:** The palette is very muted (light grey/blue on light beige). This creates a "washed out" look that may cause items to disappear at small thumbnail sizes. It lacks the "pop" needed for a game about advertising.
2.  **Lack of "Playfulness":** The style is too clinical/sterile. It feels like a blueprint or wireframe rather than a playful game. It needs more energy or warmth to inspire creativity.
3.  **Ambiguous/Small Custom Areas:** Some items (Garden Tool, Hoodie) have poor customisation potential due to small or oddly shaped editable areas.
4.  **Shape Quality:** Some items feel "chunky" or "blobby" (Trainer, Takeaway Box) rather than sleek and product-like.

---

### Highest-Priority Changes (Actionable Directions)

1.  **Boost Contrast & Saturation:** Increase the saturation of the palette slightly or darken the outlines to improve legibility at thumbnail sizes. The current palette is too safe and washed out.
2.  **Redesign Garden Tool:** Change the shape to a more recognizable tool (e.g., a trowel, rake, or shovel) with a larger, more obvious custom area (e.g., the handle or a large blade surface).
3.  **Expand Hoodie Custom Area:** Make the entire front chest (or back) the custom area, not just the small pocket. This is critical for a marketing game.
4.  **Refine Trainer & Takeaway Box:** Improve the geometry to be less "blobby" or "wonky". Make them look more like sleek, modern products.
5.  **Add "Playfulness":** Consider adding subtle textures, slightly more vibrant accent colors, or slightly thicker lines to make the style feel less like a wireframe and more like a game.

---

### Essential Blockers vs. Optional Polish

**Essential Blockers (Must Fix):**
*   **Garden Tool:** Ambiguous shape and tiny custom area make it unusable for the core gameplay loop.
*   **Hoodie:** Custom area (pocket) is too small for effective marketing design.
*   **Low Contrast/Visibility:** The washed-out palette will cause legibility issues at small sizes and fail to inspire creativity.

**Optional Polish (Nice to Have):**
*   **Takeaway Box Perspective:** The wonky perspective is distracting but not a dealbreaker.
*   **Trainer Shape:** The blobby shape is not ideal but acceptable.
*   **Flat Skin Visuals:** The 2D rectangles are functional but could be more visually engaging.
*   **"Playfulness":** Adding more energy is subjective but would improve the overall feel.

--- panel model: minimax/minimax-m3 ---

# Visual-Design Review: 12-Prototype Product Family

## Overall Verdict: **REVISE**

The set demonstrates a confident, Canva-adjacent aesthetic with consistent line weight, restrained palette, and clear "design surface" affordances, but two prototypes — **Garden Tool** and **Takeaway Box** — have problems serious enough to fail recognition or coherence, and a few others carry meaningful polish issues. The family is close, but cannot ship in its current state.

---

## Item-by-Item Evaluation

| # | Prototype | Type | Recognisability | Desirability | Contour Quality | Tonal Planes | Custom Surface | Editor Guides | Preview↔Authoring | Thumbnail Legibility | Verdict |
|---|-----------|------|-----------------|--------------|-----------------|--------------|----------------|---------------|--------------------|----------------------|---------|
| 1 | **Aquarium** | Direct | Strong — clearly a glass tank with rim/base | High; the watery hint reads as a "design opportunity" | Clean, product-like; not sticker | 2 planes (water/shadow) | Large front glass panel, clearly marked | Subtle brackets, OK | N/A | Good | **Keep, minor polish** |
| 2 | **Food Truck** | Direct | Good — side view, service window, wheels | Fun and on-brand for Year 10 | Slightly blocky; window frame is solid | 3 planes (body, window, awning) | Side panel + awning both available | OK | N/A | Good | **Keep** |
| 3 | **Garden Tool** | Direct | **Weak** — reads as a tall post, paper bag, or broom without a head | Low — feels like the least playful | Contour ambiguous; the lower section has no clear spade/trowel/rake | Flat, single-plane | None obvious | OK | N/A | Poor — silhouette collapses at thumbnail | **REVISE** |
| 4 | **Headphones** | Direct | Strong — D-form earcup, headband, cushioned rim | Strong aspirational object for the age group | Soft, premium, not chunky | 3 planes (cup face, rim, band) | Round earcup panel is large and obvious | OK | N/A | Excellent | **Keep** |
| 5 | **Hoodie** | Direct | Strong — drawstrings, kangaroo pocket, hood | Strong — wardrobe item is a perennial favourite | Garment-like, not stiff | 2–3 planes (body/pocket/hood) | Pocket is the natural artwork zone; whole front is flexible | OK | N/A | Excellent | **Keep** |
| 6 | **Pet Shop** | Direct | Good — façade with awning, central door, two windows | Moderate — least "product-y" of the set, more a setting | Slightly generic small-shop | 2 planes (awning, façade) | Awning band reads as the design surface | OK | N/A | Good but visually heaviest | **Keep, optional polish** |
| 7 | **Slim Drink Can** | Flat skin | Strong — classic tall can silhouette | Strong | Crisp, product-like | 2–3 planes (rim, body, base) | Full wrap label is obvious | OK | Relationship is clear (3D + rectangle side by side) | Excellent | **Keep** |
| 8 | **Smartphone** | Direct | Strong — recognisable from a single line profile | Good | Clean, modern | 2 planes (screen, bezel) | Entire screen is the artwork area | OK | N/A | Excellent | **Keep** |
| 9 | **Snack Pouch** | Flat skin | Moderate — reads as "tall pouch" but ambiguous between crisp packet, coffee bag, and stand-up pouch | Moderate | Acceptable | 2 planes (front panel, gusset) | Large front panel is clear | OK | 3D + flat shown; relationship is clear | Good | **Keep, minor polish** |
| 10 | **Sports Drink Bottle** | Flat skin | Strong — squeeze-bottle silhouette with screw cap | Strong | Product-like | 2–3 planes (cap, body, base) | Full wrap is the design surface | OK | Clear mapping shown | Excellent | **Keep** |
| 11 | **Takeaway Box** | Flat skin | **Weak** — the 3D preview is in a perspective/3-quarter view that breaks the family's flat, orthographic convention; flat skin is a clean rectangle, but the relationship is the least intuitive of the four flat-skin items | Low — the angled box is harder to read at thumbnail | The perspective view introduces a second, inconsistent rendering style | Mixed — 3D view has more planes than any other item, verging on busy | Front and side panels are not clearly distinguished | OK | **Confusing** — student must infer how the flat rectangle maps to a 3D folded carton | Poor at thumbnail | **REVISE** |
| 12 | **Trainer** | Direct | Strong — clear sneaker profile, sole, tongue, heel | Strong — fashion/sport appeal is real | Crisp, not childish | 2–3 planes (upper, sole, tongue) | Side panel between sole and laces is the artwork zone; tongue is also usable | OK | N/A | Good | **Keep** |

---

## System-Wide Strengths

1. **Coherent visual language.** The single blue-grey line weight, soft cream background, and warm peach "design surface" tone read as a deliberate family system, not 12 separate illustrations.
2. **Age-appropriate aspiration.** Headphones, Hoodie, Smartphone, and Trainer all sit in the desirable objects zone for 14–16-year-olds without veering into adult luxury.
3. **Restrained dimensionality.** Across the set, two- to three-plane shading gives products a tangible, illustrated feel without drifting toward photorealism or busy gradients.
4. **Unbranded, open-ended bodies.** No product carries a fake logo, tagline, or solved advertising problem — the system correctly defers the creative work to the students.
5. **Predictable dual-state UI.** "Clean Preview" vs "Editor-Selected" is the same paradigm for every card; students don't have to relearn affordances per item.
6. **Subtle, well-behaved editor guides.** The corner brackets are light and not dominant — they help without competing with the artwork area.
7. **Clear "artwork zone" affordance.** The peach/rose wash makes the designable area obvious in every card.
8. **Direct-surface items read well at thumbnail size**, which matters when 12 of them sit on a class projector.

---

## System-Wide Weaknesses

1. **Inconsistent orthographic convention.** Eleven items are drawn in flat, near-orthographic projection; **Takeaway Box** breaks this with a 3/4 perspective. The break hurts family coherence and the "preview = final" mental model.
2. **The Garden Tool silhouette is the weakest in the set** — the lower portion has no clear "tool head" geometry (no spade, no fork, no trowel blade).
3. **Flat-skin items do not all explain the unwrap as clearly as they could.** Slim Drink Can and Sports Drink Bottle show a tall thin rectangle beside a tall thin form — intuitive. Snack Pouch and especially Takeaway Box show a wide flat rectangle next to a 3D form that doesn't obviously derive from it.
4. **Pet Shop is conceptually borderline.** It is a venue/setting, not a product; the design surface is the awning, not a product body. This may not match the lesson's "invent and market a product" framing as cleanly as the others.
5. **Snack Pouch reads as ambiguous packaging** — could be a coffee bag, sugar bag, or refill pouch, not obviously a single-serve snack.
6. **Customisable areas are sometimes small relative to the product frame.** Aquarium's glass panel, Food Truck's side strip, and especially the Trainer's side panel are usable but not generous; hoodie and headphone earcup are generous.
7. **The peach "design zone" overlays are slightly different opacities and shapes across items**, which is a small consistency miss.
8. **No accessibility contrast signal.** The peach-on-cream tone is low-contrast and may not be distinguishable for some colour-vision-deficient students; consider a light dashed outline that doesn't depend on hue.

---

## Highest-Priority Changes (Actionable Visual Directions)

### Essential blockers (must fix before pass)

1. **Garden Tool — rebuild the silhouette.**
   - Pick a single, unambiguous tool: a hand trowel with a clearly pointed/bladed head and a T- or D-grip handle, OR a secateurs/pruner with visible pivot and curved blades, OR a small watering can.
   - Add a clear ground/contact shadow that anchors the tool.
   - Make the handle and head occupy distinct tonal planes so the object reads even at thumbnail.
   - Do not ship with a "generic stick with a base" shape.

2. **Takeaway Box — reconcile the preview with the family's flat convention.**
   - Replace the 3/4 perspective with the same front-elevation, orthographic treatment used by the other 11 items.
   - Show the closed box as a simple rectangle (or rectangle + thin side band) so the flat-skin is, in effect, the *same* rectangle — making the mapping trivially obvious to a Year 10 student.
   - Consider a small "front" and "lid" hint via two horizontal tonal planes, but keep it strictly 2D.

### High-priority polish (should fix in same pass)

3. **Snack Pouch — sharpen category cues.**
   - Add a horizontal heat-sealed crimp at the top and a clearer gusset at the base so it reads as a flexible stand-up pouch, not a paper bag.
   - Or swap to a crisps-style pillow pouch with a clear side seal.
   - Reinforce the gusset with a thin tonal plane.

4. **Pet Shop — confirm pedagogical fit.**
   - If "shopfront" is intended (e.g., students brand a real-world outlet), keep but add stronger signage cues (a small fascia sign band) so the design surface is unambiguous.
   - If a single product is intended (e.g., pet toy, kibble bag), consider replacing the prototype so every card represents an actual product.

5. **Customisable area consistency.**
   - Standardise the peach overlay opacity, corner radius, and inset across all 12 items.
   - Add a 1-px dashed cream outline around the artwork zone that is colour-blind friendly.

6. **Flat-skin "mapping explainer".**
   - For all four flat-skin items, ensure the unwrapped rectangle is the same colour/line treatment as the corresponding product panel it wraps — this makes the relationship click in one second.

### Optional polish (nice to have)

7. **Artwork-area generosity on Aquarium, Food Truck, and Trainer.** A 10–15% expansion of the peach zone would not hurt the product silhouette.
8. **A faint drop shadow under each preview** would unify the family and separate product from card; currently it varies (some have shadows, some don't).
9. **Headphone earcup could rotate slightly** to show it's a curved surface, not a flat disc — but this is genuinely optional and the current form is honest and clear.

---

## Essential Blockers vs Optional Polish — Summary

- **Essential blockers (must address):**
  - Garden Tool recognition failure.
  - Takeaway Box perspective break and unclear flat-skin mapping.
- **Strongly recommended (effectively part of the pass condition):**
  - Snack Pouch category clarification.
  - Pet Shop pedagogical role confirmation.
  - Peach-zone and shadow consistency pass.
  - Colour-blind-friendly outline on artwork zones.
- **Optional polish (do not block on these):**
  - Expanding artwork area on smaller-surface items.
  - Rotating the headphone earcup.
  - Subtle branding of card chrome.

The system is one solid design revision away from a clear pass: fix Garden Tool and Takeaway Box, tighten the flat-skin mapping story, and the family will read as a confident, age-appropriate, classroom-ready product set.

--- panel model: x-ai/grok-4.5 ---
**REVISE**

### Item-by-item evaluation

| Prototype | Recognisability (no title) | Desirability / coherence (14–16) | Contours (fine/product-like) | Tonal planes / dimension | Customisable area | Editor guides | Auth↔Preview clarity | Key concrete issues |
|-----------|----------------------------|----------------------------------|------------------------------|---------------------------|-------------------|---------------|----------------------|---------------------|
| Aquarium | Strong (tank + waterline + base) | Good; clean display object | Fine, glass-like | 2–3 soft planes (glass, water, base) | Large front face | Subtle corners | Direct: clear | Water/sand fill is usable but slightly constrains free art; base feet read a bit heavy in thumbnail |
| Food Truck | Strong (awning, window, wheels, body) | High; playful commercial | Fine, vehicle-like | Soft body + awning + undercarriage | Large side panel + awning | Subtle | Direct: clear | Awning stripes slightly busy; wheels a touch generic but acceptable |
| Garden Tool | Weak / ambiguous | Low; unclear object | Acceptable line weight but wrong silhouette | Minimal planes | Small / unclear (beige tip?) | Subtle | Direct: clear | **Major**: silhouette reads as inhaler/vape/remote/mic rather than garden tool; category cue fails; custom zone tiny and non-obvious |
| Headphones | Strong (over-ear cups + band) | High; teen-relevant | Fine, product-like | Soft cup + pad + band planes | Large ear-cup faces | Subtle L-corners | Direct: clear | Slightly chunky outer cup ring; otherwise strong |
| Hoodie | Strong (hood, pocket, cuffs) | High; apparel classic | Fine garment contours | Soft body + hood + pocket | Very large torso + sleeves | Subtle corners | Direct: clear | Excellent; pocket could be slightly more flexible but fine |
| Pet Shop | Strong (awning, windows, door, façade) | High; shopfront advertising | Fine architectural | Soft roof/awning + walls + glazing | Large façade + awning | Subtle | Direct: clear | Strong; windows slightly grid-heavy but still open |
| Slim Drink Can | Strong (cylinder + rim) | High; clean CPG | Fine can contours | Soft body + rim highlight | Full unwrapped skin (large) | Grid + frame subtle | Flat-skin: clear side-by-side | Good; flat rectangle is generic but mapping is immediately readable |
| Smartphone | Strong (bezel + screen) | High; ubiquitous | Fine device edges | Soft body + screen plane | Large screen | Subtle | Direct: clear | Bezel a little thick; screen is excellent custom zone |
| Snack Pouch | Strong (stand-up pouch silhouette) | Good; snack packaging | Fine, flexible-pack feel | Soft body + top seal | Full flat skin (large) | Grid + frame subtle | Flat-skin: clear | Good; bottom “feet” help product read; flat is abstract but paired well |
| Sports Drink Bottle | Moderate (reads more as jar/bottle) | Good | Fine | Soft body + cap | Full flat skin (large) | Grid + frame subtle | Flat-skin: clear | Silhouette lacks sports-bottle cues (no grip, spout, or taper); still usable but weaker category signal |
| Takeaway Box | Strong (isometric clamshell/box) | High; food packaging | Fine folded edges | Soft top + side + face planes | Full flat skin (large) | Grid + frame subtle | Flat-skin: clear | Strong; isometric preview sells the product well |
| Trainer | Strong (sneaker side profile) | High; teen footwear | Fine sole + upper | Soft upper + sole + tongue planes | Large upper panel | Subtle corners | Direct: clear | Good; sole slightly heavy; upper custom zone clear and flexible |

### System-wide strengths
- Cohesive soft, restrained palette (cream, cool grey-blue outlines, muted peach/pink custom zones) that feels modern, Canva-adjacent, and professional-playful without looking childish or clip-art heavy.
- Consistent line weight and lighting language across the set; most items sit comfortably at thumbnail scale.
- Clear separation of CLEAN PREVIEW vs EDITOR-SELECTED; faint corner guides appear only when selected and do not dominate.
- Direct-surface items generally offer large, obvious blank zones (hoodie torso, phone screen, headphone cups, shop façade, truck side, trainer upper).
- Flat-skin items (can, pouch, bottle, box) correctly show a clean product preview beside a simple rectangular authoring skin with light grid; the relationship is immediately understandable as “unwrap → map.”
- All items remain unbranded and open-ended; none solve the advertising challenge for students.
- Overall family feels like a coherent product set rather than a random sticker pack.

### System-wide weaknesses
- One critical recognisability failure (Garden Tool) breaks the “no title needed” rule and weakens the whole set’s professionalism.
- A few silhouettes are only moderately product-like or category-cued (Garden Tool severe; Sports Drink Bottle mild; Aquarium water treatment slightly limits free art).
- Flat-skin authoring views are all nearly identical rectangles; while the side-by-side pairing works, there is no subtle visual cue (edge notches, faint fold marks, or aspect-ratio hint) that would make the mapping even more self-evident for less design-literate students.
- Custom zones are mostly good but not uniformly maximised or equally obvious (Garden Tool fails; some bezels/feet/soles eat space that could be art).
- Minor inconsistency in how “product-like” vs “illustration-like” the items feel; a couple of edges still read slightly sticker-adjacent under close inspection.
- Thumbnail legibility is generally solid, but Garden Tool and (to a lesser extent) the more abstract flat skins lose identity fastest when small.

### Highest-priority changes (actionable visual directions)
1. **Redesign Garden Tool completely** for instant recognisability: replace the current ambiguous tall cylinder + angled tip with a clear, fine-contoured garden product silhouette (preferred options: classic trowel with D-handle, watering can, or hand cultivator/rake). Keep 2–3 soft tonal planes, enlarge the customisable face/blade/body dramatically, and ensure the clean preview reads as a desirable product at thumbnail size. This is non-negotiable.
2. **Strengthen Sports Drink Bottle silhouette** slightly: add a subtle sports-bottle cue (gentle grip indent, sport cap, or slight taper) while preserving the large flat-skin area and clean preview. Do not make it busy.
3. **Maximise and standardise custom zones**: ensure every direct-surface item has one dominant, obvious, flexible art plane that occupies the majority of the visible product face (already true for hoodie, phone, headphones, pet shop, truck, trainer; bring Aquarium front glass and any remaining items to the same standard). Keep peach/pink fills as the clear “paint here” signal.
4. **Slightly differentiate flat-skin authoring views** without adding clutter: give each flat skin a product-specific aspect ratio or very faint edge treatment (e.g., can taller, pouch with rounded top hint, box with fold ticks) so the unwrap relationship is even more self-explanatory while remaining a clean authoring surface. Keep grids and corner guides faint.
5. **Tighten family consistency pass**: unify any remaining line-weight or sole/foot/bezel thickness outliers; confirm all clean previews stay free of guides; verify every item still looks blank/open-ended after art is imagined on it.

### Essential blockers vs optional polish
**Essential blockers (must fix for PASS):**
- Garden Tool recognisability and usable custom area (fails criteria 1, 2, 5, 10).
- Any remaining cases where the primary custom zone is small, non-obvious, or fights the product silhouette.
- Ensuring flat-skin ↔ preview relationship stays immediately clear for all four flat items (currently acceptable but fragile if students are rushed).

**Optional polish (nice-to-have, not blocking):**
- Minor silhouette refinements (Sports Drink Bottle sports cues, Aquarium water treatment, headphone cup ring, trainer sole weight).
- Tiny aspect-ratio or edge hints on flat skins.
- Micro-adjustments to tonal planes, bezel thickness, or thumbnail contrast for perfect family uniformity.
- Further maximising already-good custom zones (hoodie, phone, etc.).

The set is already close: the visual language, blank-product philosophy, guide subtlety, and most individual items are strong and classroom-appropriate. Fixing the Garden Tool failure and the small number of silhouette/custom-area gaps will bring the whole family to a clean PASS.
