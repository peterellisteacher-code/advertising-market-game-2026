# Visual consensus raw record — iteration 02

- Evidence: `C:\Users\Peter Ellis\OneDrive\Teaching\2026\10ESH - 2026\Semester 2\Advertising\Codex Advertising Market Game\catalog\reports\product-shell-style-audition-v1\iteration-02\contact-sheet.png`
- Evidence SHA-256: `3ec2da9ed73ecf336cbddcd78b0edd21945f63b30a798d83bde8f5291d022bdb`
- Panel mode: six independent calls; identical prompt and image; no judge
- Settings for every initial call and retry: `max_tokens=32000`, `temperature=0.1`, `seed=20260713`, `stream=true`
- Output policy: no word limit, brevity target, stop condition, or model substitution
- Retry policy: retain successful slots; retry only a failed or truncated slot once with identical settings

## Identical panel prompt

You are one independent member of a fixed visual-consensus panel. Review the attached browser-rendered evidence for a Year 10 classroom advertising game. Do not assume or follow any other panel member's view. Do not act as a judge of other reviewers.

Context:
- Pairs will invent and advertise products, set prices, then enter a classroom market.
- These are deliberately bare, unbranded product shells—not finished advertisements.
- Students must be able to recolour and personalise them in a Canva-like editor.
- Eight shells use direct-surface editing: Aquarium, Food Truck, Garden Watering Can, Headphones, Hoodie, Pet Shop, Smartphone, Trainer.
- Four use separate flat skins: Slim Drink Can, Snack Pouch, Sports Drink Bottle, Takeaway Box. For these, the left image is the mapped product preview and the right image is the editable product skin.
- This is iteration 02 after earlier criticism that some forms were generic, difficult to personalise, or visually misleading.

Evaluate:
1. Immediate recognisability and product-category specificity of every shell.
2. Whether each shell leaves useful, obvious space for student-created branding without already solving the advertising challenge.
3. Whether direct-surface versus flat-skin editing is communicated honestly and understandably.
4. Visual coherence across the catalogue without making all products feel identical.
5. Classroom usability: legibility, visual hierarchy, accessibility, and likely appeal to Year 10 students working in pairs.
6. Any concrete geometry, styling, labelling, or editor-readiness defects visible in this evidence.

Return a complete, self-contained review with:
- Overall verdict exactly PASS or REVISE.
- Findings grouped as Critical, Important, and Minor.
- Product-by-product observations for all twelve cards.
- The minimum changes required before this twelve-shell style can be used as the scaling reference.
- A clear distinction between blocking defects and optional polish.

Use whatever length is needed for a complete answer. Do not impose a word limit, brevity target, stop condition, or output cap of your own.


## Slot 1 — moonshotai/kimi-k2.7-code

[model: moonshotai/kimi-k2.7-code] [id: gen-1783944794-xd6hKlQGjqlwQMtUiE9I] [tokens in=2644 out=7571] [cost: $0.031484]

## Overall verdict: **REVISE**

The catalogue is coherent, the direct‑surface / flat‑skin distinction is honestly labelled, and most shells are now clearly recognisable product forms. However, before this set can be used as the scaling reference for further shells, three blocking problems must be fixed: two products still fail immediate category recognition without relying on their text labels, and one product’s demo selection points students to a surface that is not the obvious branding real‑estate. A handful of mapping and clarity issues should also be resolved. With those changes the style would be ready to scale.

---

## Findings

### Critical (blocking before scaling)

| # | Issue | Why it blocks |
|---|-------|---------------|
| 1 | **Aquarium is visually ambiguous** – the bare rectangular front panel, top frame and small circular detail read as easily as a microwave, oven or TV as a fish tank. | Students cannot confidently select the right product category from the icon alone; this repeats the earlier “visually misleading” criticism. |
| 2 | **Pet Shop is a generic storefront** – it has no pet‑specific visual cue (paw, bone, fish, pet silhouette, etc.). | Without the text label it is indistinguishable from a café, bakery or general shop, so it fails immediate recognisability and category specificity. |
| 3 | **Headphones editor‑selected demo highlights the ear cushions (inner pads), not the outer ear cups.** | The outer cups are the natural, large branding area for headphones. Guiding students to the pads makes the shell feel less useful for advertising and is potentially confusing in the editor. |

### Important (should be fixed for classroom usability)

| # | Issue | Why it matters |
|---|-------|----------------|
| 4 | **Food Truck editable side panel is partially overlapped by the serving‑window bars.** | Students may not realise whether the area behind the window is editable or only the solid side panel. |
| 5 | **Takeaway Box flat skin lacks orientation cues.** | The net maps to the 3D box, but without front/side/top indicators students may misalign artwork when it is wrapped. |
| 6 | **Editor‑selected highlight colour is very low contrast** (pale lavender on off‑white). | Some students, especially those with low vision, may not see which surface is selected. |
| 7 | **Hoodie chest highlight is subtle and competes with the pre‑drawn pocket outline.** | The pocket can look like a pre‑made logo area, slightly undermining the “blank shell” principle. |

### Minor (optional polish)

| # | Issue |
|---|-------|
| 8 | **Trainer selection is busy** – multiple thin stripe areas are highlighted rather than one clean side panel. |
| 9 | **Overall pastel palette is consistent but may feel juvenile to some Year 10 students**; richer accent options could lift appeal without breaking coherence. |
| 10 | **Garden Watering Can spout is slightly stubby** – still recognisable, but a longer spout would remove any ambiguity. |

---

## Product‑by‑product observations

### 1. Aquarium – Direct surface
- **Recognisability:** Borderline. The glass box, top rim and base do suggest a tank, but the blank front rectangle and small circular detail could equally be an appliance screen or knob.
- **Branding space:** The large front glass and the base are good advertising areas – *if* students identify the object as an aquarium.
- **Editing communication:** The editor‑selected image fills the front glass and base with a pale tint, which does show direct‑surface editing, but the tint is so light it is easy to miss.
- **Defects:** Category ambiguity; low‑contrast selection highlight; the small circle is unexplained.

### 2. Food Truck – Direct surface
- **Recognisability:** Clear – wheels, awning and serving window read as a food van.
- **Branding space:** A large side panel is available.
- **Editing communication:** Direct‑surface editing is shown by the highlighted side panel.
- **Defects:** The window bars overlap the editable panel; the boundary of the branding area should be made explicit.

### 3. Garden Watering Can – Direct surface
- **Recognisability:** Clear.
- **Branding space:** The main body is a good, obvious canvas.
- **Editing communication:** Direct surface is obvious.
- **Defects:** Minor only – spout could be a touch longer for instant readability.

### 4. Headphones – Direct surface
- **Recognisability:** Clear.
- **Branding space:** The *outer* ear cups are the natural billboard, but the demo selects the *inner* cushions.
- **Editing communication:** Direct surface is indicated, but the selected surface is the wrong one for typical branding.
- **Defects:** Misdirected selection demo; this is a blocking issue for the scaling reference.

### 5. Hoodie – Direct surface
- **Recognisability:** Clear – hood, drawstrings, pocket and sleeves are all present.
- **Branding space:** Front torso is usable.
- **Editing communication:** Direct surface is shown.
- **Defects:** The chest highlight is subtle; the pocket outline can be mistaken for a pre‑printed logo.

### 6. Pet Shop – Direct surface
- **Recognisability:** Weak. It is a generic shopfront with awning, door and windows.
- **Branding space:** The awning and a possible sign area are good.
- **Editing communication:** Direct surface is shown by the highlighted awning.
- **Defects:** No pet‑category visual cue; relies entirely on the text label.

### 7. Slim Drink Can – Flat skin
- **Recognisability:** Clear.
- **Branding space:** Full wrap label skin.
- **Editing communication:** Honest and clear – mapped 3D can on the left, flat rectangular skin with curved top/bottom on the right.
- **Defects:** None significant.

### 8. Smartphone – Direct surface
- **Recognisability:** Clear.
- **Branding space:** Screen is highlighted; body colour could also be editable.
- **Editing communication:** Direct surface is obvious.
- **Defects:** Minor – could optionally include a small camera notch to strengthen “modern phone” reading.

### 9. Snack Pouch – Flat skin
- **Recognisability:** Clear stand‑up pouch.
- **Branding space:** Front panel skin is generous.
- **Editing communication:** Flat skin is understandable.
- **Defects:** None significant.

### 10. Sports Drink Bottle – Flat skin
- **Recognisability:** Clear.
- **Branding space:** Label skin covers the main body.
- **Editing communication:** Mapped preview and flat skin match well.
- **Defects:** None significant.

### 11. Takeaway Box – Flat skin
- **Recognisability:** Clear folded paper box.
- **Branding space:** Multiple panels offer creative possibilities.
- **Editing communication:** The flat net honestly represents the product skin, but the mapping direction is not obvious.
- **Defects:** Needs orientation labels or subtle numbering on the net.

### 12. Trainer – Direct surface
- **Recognisability:** Clear sneaker.
- **Branding space:** Side panels are usable.
- **Editing communication:** Direct surface is shown.
- **Defects:** The selected stripes are busy; a single clean side‑panel selection would make branding space more obvious.

---

## Minimum changes required before this style becomes the scaling reference

### Blocking changes (must be done)

1. **Fix Aquarium category reading**
   - Add a simple, non‑branded water line and a gravel/sand base texture.
   - Remove or clarify the small circular “knob” detail so it does not read as an appliance dial.

2. **Fix Pet Shop category specificity**
   - Add a small, generic pet cue: a paw print on the awning, a hanging sign silhouette, or a simple bone/fish motif.
   - The cue must be a category marker, not an advertisement.

3. **Fix Headphones selection demo**
   - Retarget the editor‑selected image to the **outer ear cups**.
   - Ensure the editable zones in the editor include the outer cups as the primary branding area.

4. **Clarify Food Truck editable boundary**
   - Define the side panel as the solid area below/behind the window bars, or show the window as an overlay that does not interrupt the selection.

5. **Add orientation cues to Takeaway Box flat skin**
   - Label “Front”, “Side”, “Back”, “Top” or add subtle panel numbers so students can map their design onto the 3D preview.

### Important changes (strongly recommended)

6. Increase the contrast of the editor‑selected highlight (slightly darker tint or a dashed outline) so the editable area is visible to all students.
7. Simplify the Trainer selection to a single main side panel rather than multiple thin stripes.
8. Make the Hoodie chest branding area more explicit and ensure the pocket does not look like a pre‑made logo.

### Optional polish

9. Lengthen the Garden Watering Can spout slightly.
10. Review the colour palette for Year 10 appeal – consider offering one or two slightly richer accent options while keeping the unified line‑art style.
11. Add a subtle camera notch or side buttons to the Smartphone if desired.

---

## Blocking defects vs optional polish

- **Blocking:** Aquarium ambiguity, Pet Shop genericness, Headphones wrong selection surface, Food Truck panel boundary, Takeaway Box mapping orientation.
- **Optional:** Palette appeal, minor proportion tweaks, extra phone details, stripe simplification on Trainer, pocket clarity on Hoodie.

Once the five blocking items are resolved, this twelve‑shell set will provide a clear, consistent and honestly labelled style reference that can be scaled to additional products.

## Slot 2 — stepfun/step-3.7-flash

[model: stepfun/step-3.7-flash] [id: gen-1783944982-m26a6CHcOSyBpnQVceV2] [tokens in=1274 out=5800] [cost: $0.006925]

**Overall Verdict: PASS**

The catalogue demonstrates strong conceptual clarity, honest communication of editing methodologies, and adequate recognisability across all twelve product categories. The distinction between direct-surface and flat-skin workflows is visually explicit and pedagogically sound for Year 10 commerce/design students. No blocking defects prevent classroom use, though three Important refinements and several Minor polish items would elevate the set from functional to exemplary.

---

### Findings

#### Critical
*None. All twelve shells are geometrically sound, immediately recognisable, and provide sufficient editable surface area for student branding.*

#### Important
1. **Repetitive Awning Typology**: The Food Truck and Pet Shop both deploy striped awnings as dominant visual features. In a catalogue view, this creates visual redundancy and reduces perceived variety across the product range. One shell should adopt a different awning treatment (solid, scalloped, or retracted) to strengthen category differentiation.
2. **Hoodie Structural Interference**: The front pocket detail on the Hoodie shell occupies central chest real estate that would otherwise be prime branding territory. If this pocket is a fixed structural element, it actively reduces the available canvas; if editable, it creates ambiguity about what constitutes "branding" versus "product feature" for students.
3. **Trainer Visual Noise Density**: The Trainer (sneaker) shell contains dense linework on the sole tread and upper stitching that competes visually with the side-panel branding zone. At catalogue scale, this detail risks making the editable surface feel "busy" and may discourage confident graphic overlay.

#### Minor
1. **Flat Skin Alignment Cues**: The Slim Drink Can, Snack Pouch, and Sports Drink Bottle flat skins would benefit from faint registration marks or edge guides to help students understand scale and alignment when importing graphics.
2. **Takeaway Box Flat Skin Abstraction**: The Takeaway Box editable skin appears as a complex cross-shaped layout that may momentarily confuse students about which surface corresponds to the 3D preview. A subtle "front panel" indicator would clarify.
3. **Direct Surface Boundary Indication**: While the purple tint in "Editor-Selected" views communicates editability, adding a subtle dashed boundary or drop shadow to the editable zones on direct-surface items would make the editable geography even more explicit for novice users.

---

### Product-by-Product Observations

**1. Aquarium (Direct Surface)**
- **Recognisability**: Excellent. Classic rectangular tank with water line, gravel substrate, and air bubbles is unambiguous.
- **Branding Space**: The front glass plane provides a large, uninterrupted rectangular canvas. The gravel base is appropriately fixed.
- **Editing Communication**: Clear. The purple tint accurately indicates the glass surface.
- **Defects**: None. The water line and bubble details are subtle enough not to interfere with overlay.

**2. Food Truck (Direct Surface)**
- **Recognisability**: Strong. The canted serving window and wheel configuration clearly signal mobile food service.
- **Branding Space**: The side panel and awning offer extensive area. The serving window frame is appropriately fixed.
- **Editing Communication**: Clear.
- **Defects**: The awning stripe pattern (see Important #1) creates visual similarity with the Pet Shop. The rear wheel appears slightly detached from the body in the clean preview, though this is minor.

**3. Garden Watering Can (Direct Surface)**
- **Recognisability**: Immediate. The spout, handle, and body proportions are classic.
- **Branding Space**: The cylindrical body provides a clean, large-format branding zone. The handle and spout are fixed.
- **Editing Communication**: Clear.
- **Defects**: None. The rose (sprinkler end) detail is appropriately minimal.

**4. Headphones (Direct Surface)**
- **Recognisability**: Clear over-ear form factor. The ear cup size and headband arch are correct.
- **Branding Space**: The outer shell of each ear cup provides good branding real estate. The ear cushion is fixed.
- **Editing Communication**: Clear.
- **Defects**: The internal detail visible through the "Editor-Selected" tint suggests the ear cup interior is also editable, which may be unintended. Clarify if the inner driver housing is editable or fixed.

**5. Hoodie (Direct Surface)**
- **Recognisability**: Strong. The hood, drawstrings, and sleeve shape are clear.
- **Branding Space**: The chest area is the primary zone, but the front pocket detail (see Important #2) intrudes on this space.
- **Editing Communication**: Clear, though the pocket ambiguity is noted.
- **Defects**: The drawstrings may be visually "noisy" if students attempt to brand over them; consider making them slightly more subtle or clearly fixed.

**6. Pet Shop (Direct Surface)**
- **Recognisability**: Clear storefront withawning. The door and window frames read as retail.
- **Branding Space**: The wall area above the door and the awning surface are available. The door and window frames are fixed.
- **Editing Communication**: Clear.
- **Defects**: The awning stripe pattern (see Important #1) matches the Food Truck too closely. The door handle is a small detail that is appropriately fixed.

**7. Slim Drink Can (Flat Skin)**
- **Recognisability**: Immediate. Tall cylindrical can with rim.
- **Branding Space**: The flat skin provides the full label area. The top and bottom rims are fixed.
- **Editing Communication**: Excellent. The "Mapped Product Preview" to "Editable Product Skin" transition is honest and clear.
- **Defects**: The flat skin rectangle could use subtle width indicators to show how it maps to the cylinder circumference.

**8. Smartphone (Direct Surface)**
- **Recognisability**: Clear. The aspect ratio and screen-to-body ratio read as modern smartphone.
- **Branding Space**: The screen area is the primary branding zone. The bezel and camera bump are fixed.
- **Editing Communication**: Clear.
- **Defects**: The side button detail is appropriately minimal. No defects.

**9. Snack Pouch (Flat Skin)**
- **Recognisability**: Good. The stand-up pouch shape with gusseted bottom is recognizable.
- **Branding Space**: The front panel in the flat skin is clear and large.
- **Editing Communication**: Clear.
- **Defects**: The flat skin shows the pouch outline, which is helpful, but alignment guides would improve precision (see Minor #1).

**10. Sports Drink Bottle (Flat Skin)**
- **Recognisability**: Strong. The wide cap and bottle shape suggest sports hydration.
- **Branding Space**: The label area in the flat skin is clearly delineated.
- **Editing Communication**: Clear.
- **Defects**: None. The cap texture is appropriately fixed.

**11. Takeaway Box (Flat Skin)**
- **Recognisability**: Good. The hexagonal/closed box shape is recognizable as takeaway packaging.
- **Branding Space**: The front panel in the flat skin is available.
- **Editing Communication**: The flat skin is slightly abstract (see Minor #2), showing what appears to be a cross-shaped layout or complex panel arrangement that may require student interpretation.
- **Defects**: The 3D preview shows the box with a lid, but the flat skin doesn't explicitly mark which panel is the "front" for branding purposes.

**12. Trainer (Direct Surface)**
- **Recognisability**: Clear sneaker/shoe silhouette.
- **Branding Space**: The side panel is the primary branding zone.
- **Editing Communication**: Clear.
- **Defects**: The sole tread pattern and upper stitching lines (see Important #3) create visual density that may interfere with student graphic placement. The laces are appropriately fixed but add to the visual noise.

---

### Minimum Changes Required Before Scaling

1. **Differentiate Awnings**: Alter the stripe pattern, color, or configuration of either the Food Truck or Pet Shop awning to ensure visual distinction between these two shells.
2. **Resolve Hoodie Pocket Ambiguity**: Either remove the front pocket detail to maximise branding space, or explicitly mark it as a non-editable structural element with a distinct visual treatment (e.g., darker fill or stitched outline) so students understand the editable boundary.
3. **Simplify Trainer Detail**: Reduce the density of linework on the Trainer sole and upper stitching to create a cleaner, more "ad-ready" surface that doesn't compete with student branding.
4. **Add Editing Boundaries**: Implement subtle visual cues (dashed lines, 10% opacity overlays, or corner brackets) on direct-surface items to explicitly demarcate the editable zone from fixed structural elements (zippers, buttons, treads, etc.).

---

### Blocking Defects vs. Optional Polish

**Blocking Defects (Must Fix)**
*None. The set is functionally complete and pedagogically sound. All products are recognisable, the editing methodology is honestly communicated, and there is adequate space for student work.*

**Optional Polish (Nice-to-Have)**
- **Visual Variety Enhancement**: The awning repetition between Food Truck and Pet Shop is a polish issue that affects catalogue aesthetics but not functionality.
- **Detail Density Reduction**: The Trainer and Hoodie detail levels are polish issues that affect user confidence but do not prevent use.
- **Alignment Aids**: The flat skin registration marks are polish items that improve precision but are not blocking.
- **Boundary Indication**: The direct-surface editing zones are currently communicated via color tint only; adding geometric boundaries is polish that improves clarity.

**Scaling Readiness**: The set is ready for pilot classroom testing. The Important and Minor items should be addressed in the next iteration (03) before mass production, but they do not constitute blockers for initial deployment.

## Slot 3 — google/gemini-3.1-pro-preview

[model: google/gemini-3.1-pro-preview] [id: gen-1783945032-JnbMv23JEe3imu5S2DrW] [tokens in=1547 out=7841] [cost: $0.097186]

**OVERALL VERDICT: REVISE**

This is a highly successful iteration that clearly distinguishes between the two editing modes and provides an excellent, unified aesthetic. The muted, pastel "blank canvas" styling perfectly communicates to Year 10 students that these are templates waiting for their designs. The UI labelling (Clean Preview vs. Mapped Product Preview) is pedagogically sound and easy to understand.

However, there is one blocking geometric defect regarding how 2D bounding boxes interact with 3D perspective illustrations in the "Direct surface" category, which requires a revision before this can be used as a scaling reference.

Here is the detailed evaluation.

### 1. Critical Findings (Blocking Defects)
*   **Headphones Perspective Conflict:** The "Direct surface" editing paradigm relies on students dropping 2D graphics (text, logos) into a flat bounding box on the screen. For this to look correct, the underlying illustration must be drawn flat-on (orthographic projection), like the Hoodie, Food Truck, or Trainer.
    *   The Headphones are drawn in a 3/4 perspective, meaning the ear cup is angled away from the viewer.
    *   The bounding box shown in the "EDITOR-SELECTED" view is a flat, upright 2D rectangle.
    *   If a student types horizontal text into that bounding box, it will not align with the angled ear cup. It will look like it is floating in front of the image rather than printed on it, breaking the illusion and frustrating the student.

### 2. Important Findings (Usability & Pedagogy)
*   **"Pet Shop" Naming Constraint:** The brief states that pairs will "invent and advertise products." While the illustration of the building is wonderfully generic and highly customizable, labelling it specifically as "Pet Shop" pre-solves the invention step and restricts student imagination. If a pair wants to invent a futuristic tech repair shop or a vintage clothing boutique, the hardcoded "Pet Shop" label works against them. Renaming this to "Storefront", "Shop", or "Retail Unit" would better serve the learning objective.
*   **Inconsistent 3D Previews in Flat Skins:** The purpose of the "Flat skin" category is to show how a 2D net wraps around a 3D object. The Slim Drink Can, Snack Pouch, and Takeaway Box all use a 3/4 perspective for their "MAPPED PRODUCT PREVIEW" to clearly show volume and depth. The Sports Drink Bottle, however, is drawn completely flat-on (orthographic). While understandable, it makes it look slightly out of place compared to the other three flat-skin items.

### 3. Minor Findings (Optional Polish)
*   **Trainer Laces:** The dark grey, thick bars used for the laces on the Trainer feel a bit heavy and clunky compared to the elegant, fine linework used across the rest of the catalogue.
*   **Takeaway Box Perspective:** The isometric perspective on the 3D Takeaway Box is slightly skewed (the vanishing points of the top flaps don't perfectly align with the base). It is entirely readable for a Year 10 student and does not impact usability, but it is a minor illustration quirk.
*   **Flat Skin Overlap Tabs:** The inclusion of the pink overlap/glue tab on the Slim Drink Can's 2D skin is a brilliant touch for teaching real-world packaging design.

---

### Product-by-Product Observations

**Direct Surface Shells**
1.  **Aquarium:** Excellent. The flat-on perspective works perfectly with a rectangular bounding box. The distinction between the glass tank and the base/waterline is clear.
2.  **Food Truck:** Excellent. The side-profile view provides a massive, obvious billboard space for student branding.
3.  **Garden Watering Can:** Great. The shape is instantly recognizable, and the side profile allows for easy sticker/logo placement.
4.  **Headphones:** **Defective.** (See Critical Findings). The 3/4 perspective of the ear cup conflicts with the flat 2D bounding box required for direct-surface editing.
5.  **Hoodie:** Excellent. The flat front view is standard for apparel mockups. The bounding box correctly targets the chest "drop zone" rather than the whole garment.
6.  **Pet Shop:** Visually excellent, pedagogically restrictive. The flat-on facade is perfect for direct editing (signage, window displays). The name should ideally be generalized to "Storefront".
7.  **Smartphone:** Excellent. The flat-on view is perfect for UI/screen design.
8.  **Trainer:** Good. The side profile works well. The bounding box targets the mid-foot panel (the standard logo zone for shoes).

**Flat Skin Shells**
9.  **Slim Drink Can:** Excellent. The visual mapping between the flat rectangular label (with glue tab) and the 3D cylinder is very clear.
10. **Snack Pouch:** Excellent. The 2D skin accurately represents a bottom-gusset pouch, and the 3D preview shows exactly how it stands up.
11. **Sports Drink Bottle:** Good. The mapping of the rectangular label to the recessed area of the bottle is obvious, though the 3D preview lacks the perspective depth of the other items in this category.
12. **Takeaway Box:** Excellent. This is the standout educational piece. Providing a standard cross-net for the 2D skin and showing it folded in 3D is a fantastic way to introduce packaging design to Year 10s.

---

### Minimum Required Changes (To achieve a PASS)

To use this twelve-shell style as the scaling reference for the rest of the game, the following blocking defect must be resolved:

1.  **Redraw the Headphones:** Change the illustration from a 3/4 perspective to a flat, orthographic side-profile (similar to the Trainer or Food Truck). This ensures that when a student drops a 2D logo or text into the bounding box, it sits naturally on the flat plane of the ear cup without requiring complex 3D distortion tools in the editor.

*(Highly Recommended but not strictly blocking: Change the text label "Pet Shop" to "Storefront" to better align with the "invent a product" brief).*

## Slot 4 — xiaomi/mimo-v2.5

### Initial call

tool call error: tool call failed for `openrouter/openrouter_gateway`

Caused by:
    timed out awaiting tools/call after 300s

### One permitted retry

[model: xiaomi/mimo-v2.5] [id: gen-1783945547-Nve0wura2vgRkECatnEA] [tokens in=2075 out=6723] [cost: $0.002171] [cached: 22]

**Overall Verdict: REVISE**

---

### Findings

#### Critical (Blocking Defects)
1.  **Editor-Selected State Visibility:** The visual feedback for the "Editor-Selected" state (the right-hand image for direct-surface items) is extremely subtle. The faint blue bounding lines or slight color shifts are barely visible in the provided evidence. In a classroom setting, especially on a projector or for students with visual impairments, this will make it difficult to understand which parts of the product are editable. This is a usability blocker.
2.  **Aquarium Recognisability:** The "Aquarium" shell is visually ambiguous. Without the label, it could easily be mistaken for a window, a display case, a TV, or a generic box. It lacks the immediate, iconic silhouette of the other products (like the Food Truck or Hoodie). It fails the "immediate recognisability" criterion.

#### Important (Significant Issues)
1.  **Pet Shop Category Confusion:** The "Pet Shop" shell is a building facade, not a portable consumer product like the others (hoodie, can, phone). The prompt specifies students will "invent and advertise products." A shop front is a business, not a product. This semantic mismatch could confuse students about the game's premise unless the instructions explicitly allow for business advertising.
2.  **Takeaway Box Skin Complexity:** The "Editable Product Skin" for the Takeaway Box is shown as an unfolded net (cross shape). While educationally interesting for spatial reasoning, this might be confusing for students using a simple "Canva-like" editor who expect a simple rectangular canvas. The mental mapping between the flat skin and the 3D preview is not intuitive.
3.  **Low Contrast / Accessibility:** The color palette is very muted (pastel blues, greys, peach). The line art is thin. This low contrast may cause visibility issues on projectors or for visually impaired students. The "Editor-Selected" state is particularly affected by this.
4.  **Year 10 Appeal:** The visual style is very "safe," "corporate vector," or "clip-art." While neutral, it may feel a bit dry or "babyish" for 14-15 year olds. It lacks a bit of "edge" or modern aesthetic that might engage this age group more effectively.

#### Minor (Polish)
1.  **Text-Only Mode Distinction:** The distinction between "Direct surface" and "Flat skin" is communicated only via text labels. Adding a small icon or color-coding (e.g., a paintbrush icon for direct surface, a flat sheet icon for skin) would improve quick scanning.
2.  **Aquarium Detail:** Even if the shape is kept, adding a subtle water line or a fish silhouette in the "Clean Preview" would instantly clarify the product category without cluttering the editable space.
3.  **Consistency of "Editor-Selected" vs "Editable Product Skin":** The terminology is slightly inconsistent. "Editor-Selected" implies a state, while "Editable Product Skin" implies a component. Standardizing the terminology (e.g., "Editable Zone" vs "Editable Skin") would improve clarity.

---

### Product-by-Product Observations

1.  **Aquarium (Direct surface):**
    *   **Recognisability:** Weak. Looks like a generic box or window.
    *   **Branding Space:** Good. Large front glass area.
    *   **Defect:** Needs a visual cue (water, fish) to be instantly identifiable.

2.  **Food Truck (Direct surface):**
    *   **Recognisability:** Strong. Wheels, awning, window are clear.
    *   **Branding Space:** Excellent. Large side panel.
    *   **Defect:** None.

3.  **Garden Watering Can (Direct surface):**
    *   **Recognisability:** Strong. Spout and handle are clear.
    *   **Branding Space:** Good. Large body area.
    *   **Defect:** None.

4.  **Headphones (Direct surface):**
    *   **Recognisability:** Strong. Ear cups and headband are clear.
    *   **Branding Space:** Good. Ear cup is a clear circular zone.
    *   **Defect:** None.

5.  **Hoodie (Direct surface):**
    *   **Recognisability:** Strong. Hood, sleeves, pocket are clear.
    *   **Branding Space:** Good. Chest area is open.
    *   **Defect:** None.

6.  **Pet Shop (Direct surface):**
    *   **Recognisability:** Strong as a building, but category confusion (building vs product).
    *   **Branding Space:** Excellent. Large sign board.
    *   **Defect:** Semantic mismatch with "product" advertising.

7.  **Slim Drink Can (Flat skin):**
    *   **Recognisability:** Strong. Cylindrical shape is clear.
    *   **Branding Space:** Good. Skin is a simple rectangle.
    *   **Defect:** None.

8.  **Smartphone (Direct surface):**
    *   **Recognisability:** Strong. Rectangular slab, screen area.
    *   **Branding Space:** Good. Screen is the main area.
    *   **Defect:** None.

9.  **Snack Pouch (Flat skin):**
    *   **Recognisability:** Strong. Pouch shape, crimped bottom.
    *   **Branding Space:** Good. Skin is a simple rectangle.
    *   **Defect:** None.

10. **Sports Drink Bottle (Flat skin):**
    *   **Recognisability:** Strong. Bottle shape, cap.
    *   **Branding Space:** Good. Skin is a simple rectangle.
    *   **Defect:** None.

11. **Takeaway Box (Flat skin):**
    *   **Recognisability:** Strong. Box shape, lid.
    *   **Branding Space:** Good, but skin is complex (unfolded net).
    *   **Defect:** Spatial mapping might be confusing for students.

12. **Trainer (Direct surface):**
    *   **Recognisability:** Strong. Shoe shape, laces, sole.
    *   **Branding Space:** Good. Side panel is open.
    *   **Defect:** None.

---

### Minimum Changes Required Before Scaling

1.  **Enhance "Editor-Selected" Visibility:** Make the editable zones significantly more obvious. Use a thicker outline, a distinct color overlay (e.g., a semi-transparent blue or yellow highlight), or a "glow" effect. This is the most critical usability fix.
2.  **Clarify "Aquarium" Silhouette:** Add a subtle water line or fish silhouette to the "Clean Preview" to ensure instant recognition. Alternatively, change the shape to be more distinctively "aquarium-like" (e.g., curved front, stand).
3.  **Address "Pet Shop" Category:** Either rename it to "Pet Shop Front" or ensure the game instructions clarify that "products" can include business fronts. Or replace it with a more product-like item if the game is strictly about consumer goods.
4.  **Simplify "Takeaway Box" Skin:** Ensure the mapping is intuitive. Maybe show a simplified version of the skin or a guide.
5.  **Boost Contrast:** Increase the contrast of the line art and the fill colors slightly for better visibility.

---

### Blocking Defects vs Optional Polish

*   **Blocking Defects (Must Fix):**
    *   **Editor-Selected Visibility:** Students cannot effectively use the editor if they cannot see what is editable.
    *   **Aquarium Recognisability:** Fails the core criterion of immediate recognisability.

*   **Optional Polish (Can Fix Later):**
    *   **Pet Shop Category:** Can be addressed via instructions or renaming, but is not a technical blocker.
    *   **Takeaway Box Skin Complexity:** Can be addressed via editor guidance or simplified skin, but is not a technical blocker.
    *   **Low Contrast / Accessibility:** Should be improved for best practice, but is not a technical blocker.
    *   **Year 10 Appeal:** Subjective and can be addressed via style updates, but is not a technical blocker.
    *   **Text-Only Mode Distinction:** Can be improved with icons, but is not a technical blocker.

## Slot 5 — minimax/minimax-m3

[model: minimax/minimax-m3] [id: gen-1783945410-Q53tpPiEy3z5bBfFsVTs] [tokens in=2801 out=6684] [cost: $0.008834] [cached: 114]


# Independent Visual-Consensus Review — Iteration 02

## Overall Verdict: **REVISE**

The catalogue has a coherent visual language and a defensible two-track editing framework (direct surface vs. flat skin). However, in its current state it cannot serve as the scaling reference: the "editor-selected" affordance is too weak to teach students what to edit, three products fail at category specificity at the very moment a student opens the editor, the flat-skin mapping is inconsistent across the four products that share that workflow, and the Trainer's laces read as a scribble rather than a graphic element. None of these are fatal design problems, but together they block the catalogue from being the model the rest of the work is built on.

---

## Findings

### Critical (must fix before this becomes the reference)

1. **Editor-selected state is not editorially legible.** The "CLEAN PREVIEW" and "EDITOR-SELECTED" panels are visually near-identical on every direct-surface card. I can see faint corner brackets on some cards (Headphones, Food Truck, Takeaway Box, Trainer) but they are inconsistent in placement, weight, and which corners they sit in. A Year 10 student will not reliably understand that the right-hand image is the editable target, or which region of it is editable. For a "scaling reference" this is the single most important affordance in the system.

2. **The flat-skin mapping is inconsistently communicated across the four products that share the workflow.** The Sports Drink Bottle's flat skin is a recognisable trapezoid and the Takeaway Box's flat skin shows panel divisions. The Slim Drink Can and Snack Pouch flat skins are bare rectangles that do not visually relate to the curved, crimped, three-dimensional product on the left. Two of the four flat-skin products fail the "I can see how this wraps" test, which undermines the whole second track.

3. **Pet Shop has no pet indicator.** The card depicts a generic two-window storefront with a peach awning. There are no paws, animals, leads, bowls, cages, fish tanks, or any category-specific signage. This will be misread as a bakery, boutique, or general store. The product is named "Pet Shop" but the illustration does not enforce that category, so the personalisation task starts with a misidentification problem.

4. **Trainer laces are rendered as a scribble.** The crisscross laces on the side of the trainer are drawn as an irregular, wobbly cluster of strokes that reads as a defect, a scuff, or a marker scribble rather than as a graphic feature. This is the most prominent detail on the card and it actively undermines the credibility of the illustration set.

### Important (should fix in the same pass)

5. **Garden Watering Can is borderline kettle.** The spout is a thin diagonal with no visible rose (the perforated end that water sprinkles from). Without that detail, the form sits between watering can, kettle, and small teapot. The body shape and handle are fine, but the category-defining feature is missing.

6. **Headphones ear cups are rounded squares, not circles.** Most consumer headphones have circular or oval cups. The rounded-square form will read as a stylised choice to some viewers and as VR goggles, a mask, or a face-hugging speaker to others. The shape is the entire product signal here, so it needs to be unambiguous.

7. **Smartphone is too generic.** The card shows a rounded-rectangle slab with a small screen and a peach band. There is no camera bump, no notch, no home indicator, no side buttons, and the screen-to-body ratio is unusually low. It could be read as an e-reader, a small tablet, or a generic slab device. It needs one or two specific phone features to lock the category.

8. **Aquarium is too subtle on the "aqua" part.** The current form has a water line and a thin gravel strip, but no fish, plants, bubbles, filter, or hood light. A student could read it as a display case, a terrarium, or a small diorama. A single category-defining cue (a fish silhouette, a plant frond, or an air-stone bubble stream) would solve this.

9. **The "EDITABLE PRODUCT SKIN" header on flat-skin cards is not paired with a "select to edit" cue.** The header promises a skin to edit, but the rectangle in the panel doesn't visually tell the student *this is the surface you paint on, and the preview on the left is the result*. A small icon, a "wrap guide," or numbered panels would close that loop.

### Minor (polish, non-blocking)

10. **Cohesion is strong but at the cost of individuality.** The peach accent appears on almost every card in a similar proportion, which gives the catalogue a unified look but makes the products feel slightly interchangeable. A small amount of variation (one product with a stronger accent, one with a cooler palette moment) would help students distinguish cards at a glance.

11. **Food Truck wheels are slightly oversized** for the body and could be tuned down a touch for a more commercial-vehicle proportion.

12. **Hoodie chest detail** — the small rectangle above the kangaroo pocket reads ambiguously as either a small pocket or a brand-tag area. If it is intended as a logo placement, a faint dashed line or a "your logo" tag would make the intent explicit; if it is decorative, it can be removed for clarity.

13. **Takeaway Box 3D preview is at an unusual angle** that makes the box read more as a deep open tray than as a clamshell/foldable container. Tilting it to a 3/4 view that shows the lid hinge would make the container function obvious.

14. **Subtitle text "Direct surface" / "Flat skin" is low-contrast** on the cream background and may strain students on small screens.

---

## Product-by-Product Observations

**Aquarium (direct surface)**
Recognisable as a tank, but the "aquarium" reading depends on a thin water line and a thin gravel strip. Add one category cue (fish, plant, bubbles) to lock the category. The lid and base read clearly. The rectangle is large and useful for a brand name or a large background colour change. Editor brackets should mark the central glass area.

**Food Truck (direct surface)**
The strongest direct-surface card for category specificity. Wheels, serving counter, awning, and side panel all read correctly. Awning is the natural branding surface. Editor brackets should sit over the side panel, which is the largest flat zone. Minor: wheel proportion.

**Garden Watering Can (direct surface)**
Handle and body are fine; spout is the weakness. Add a perforated rose at the spout end and a touch more volume to the spout itself. The body is a good blank canvas for a logo. Editor brackets should highlight the body's front face.

**Headphones (direct surface)**
Form is unusual. The rounded-square cups will cause misreadings (VR, mask, generic audio device). Either commit to circles or, if the squared look is intentional, add a clear cable entry, a headband slider, or an "L/R" cue to lock it as headphones. The ear-cup exterior is the obvious branding surface and currently has plenty of space.

**Hoodie (direct surface)**
Strong card. Hood, drawstrings, kangaroo pocket, side panels, cuffs, and hem all read correctly. Side panels are nicely highlighted in peach, which doubles as a visual hint for where to brand. The chest rectangle is ambiguous and should be resolved (see Minor #12). Editor brackets should mark the chest and side-panel zones.

**Pet Shop (direct surface)**
Currently fails category specificity. The awning, windows, door, and signage space are all clear, but there is no "pet" signal. Add a paw print in the awning, an animal silhouette in a window, or a small lead/bowl/collar motif next to the door. The upper awning panel is the natural branding zone.

**Slim Drink Can (flat skin)**
3D can is fine — tall, slim, energy-drink proportion. The flat skin is the issue: it is a bare rectangle that does not communicate which edges meet, where the seam is, or which way the can wraps. A vertical seam line, a "wrap" indicator arrow, or a faintly drawn cylinder icon would help. The flat skin surface itself is a clean canvas for branding.

**Smartphone (direct surface)**
Form is too generic. Add a small camera bump on the back silhouette (visible even in side view) or a notch / dynamic island on the front, and consider increasing the screen-to-body ratio. The screen is the natural branding zone but is currently small and off-centred. Editor brackets should mark the screen area.

**Snack Pouch (flat skin)**
Crimped top and bottom are good category cues. The flat skin, like the can's, is a bare rectangle and does not show where it wraps the pouch. A subtle top/bottom crimp indicator, a seam line, or a small "this side up" arrow would close the loop. The flat skin is a usable canvas.

**Sports Drink Bottle (flat skin)**
The strongest flat-skin card for mapping clarity. The trapezoidal flat skin shape visually mirrors the bottle's silhouette well. The pull-spout cap is a good category cue. Add a faint vertical seam to confirm the wrap direction.

**Takeaway Box (flat skin)**
The multi-panel flat skin is the clearest "this is how it wraps" demonstration in the set, which is good. The 3D preview, however, doesn't read as a clamshell container — it looks more like an open tray at an odd angle. Reposition the 3D preview to show the lid and hinge, and this card will carry the most weight in the catalogue as the "how flat-skin mapping works" exemplar.

**Trainer (direct surface)**
The silhouette is correct, but the laces are the problem — they read as a scribble. Redraw as a proper crisscross pattern with consistent spacing. The toe box, side panel, and heel are good branding surfaces. Editor brackets should mark the side panel, which is the largest flat area.

---

## Minimum Changes Required Before This Can Be the Scaling Reference

1. **Make the editor-selected state actually selected.** On every direct-surface card, the right-hand panel should show a clearly visible, consistently positioned bounding box (or colour overlay) on the region the student is meant to paint. On every flat-skin card, the right-hand panel should show the same kind of selection state, plus a visual hint of how the skin wraps (seam line, wrap arrow, or panel numbers). This is the single highest-value fix in the set.

2. **Fix the four flat-skin mappings so they all communicate "wrap."** Sports Drink Bottle and Takeaway Box are the model; Slim Drink Can and Snack Pouch need the same kind of wrap cue (seam line, edge markers, or a cylinder icon).

3. **Resolve the four category-specificity failures.** Add a pet indicator to Pet Shop, a fish or plant to Aquarium, a rose to the Watering Can's spout, and a phone-specific feature to the Smartphone.

4. **Redraw the Trainer's laces** as a clean crisscross pattern.

5. **Commit to circular ear cups on the Headphones** or add a clear audio-device cue so they stop reading as VR goggles.

6. **Decide the purpose of the Hoodie chest rectangle** — if it's a logo zone, mark it as such; if it's decorative, remove it.

These six changes are the floor. With them done, the catalogue is a usable scaling reference. Without them, every future shell will inherit the same ambiguities.

---

## Blocking Defects vs. Optional Polish

**Blocking (must be fixed before sign-off):**
- Weak editor-selected affordance across all twelve cards.
- Inconsistent flat-skin mapping (Slim Drink Can, Snack Pouch).
- Pet Shop with no pet indicator.
- Trainer laces that read as a scribble.

**Strongly recommended in the same pass (Important):**
- Garden Watering Can spout without a rose.
- Headphones' rounded-square ear cups.
- Smartphone's generic slab form.
- Aquarium's missing category cue.
- Flat-skin panels lacking a "select to edit" cue.

**Optional polish (Minor, can be deferred):**
- Peach-accent overuse reducing individuality.
- Food Truck wheel proportion.
- Hoodie chest detail clarification.
- Takeaway Box 3D angle.
- Subtitle text contrast on cream background.

If the six blocking items plus the five Important items are addressed, the catalogue earns a PASS and becomes a solid foundation for scaling the rest of the work.

## Slot 6 — x-ai/grok-4.5

[model: x-ai/grok-4.5] [id: gen-1783945496-8mlfHlqIfpGIcJLhh87B] [tokens in=2347 out=3987] [cost: $0.028424] [cached: 128]

**REVISE**

This is an independent review of the twelve product shells shown in the provided browser-rendered evidence (iteration 02). The shells are evaluated strictly against the stated classroom advertising-game requirements: bare unbranded forms that Year 10 pairs can recolour and personalise in a Canva-like editor; eight direct-surface shells and four flat-skin shells; immediate recognisability and category specificity; useful branding space that does not pre-solve the advertising task; honest communication of editing mode; catalogue coherence without sameness; classroom usability (legibility, hierarchy, accessibility, Year-10 appeal); and any visible geometry, styling, labelling or editor-readiness defects. No other panel views are assumed or referenced.

### Critical findings
- **Pet Shop lacks product-category specificity.** The form is a generic two-window storefront with awning and door. Nothing signals “pet” (no animal silhouette, paw motif, kennel cue, or other non-branded indicator). It reads equally as café, bakery or any retail unit. This directly continues the earlier criticism of generic forms and will force students either to invent a pet identity from scratch or to treat it as a generic shop, undermining the intended product category.
- **Sports Drink Bottle is visually misleading for its category.** The mapped preview is a short, wide cylindrical jar with a simple screw lid. It more closely resembles a mason jar, milk bottle or generic beverage jar than a sports drink (which typically has a taller, contoured plastic body, grip zones or a sports cap). The editable flat skin is a near-square panel with a top flap that does not clearly communicate a wrap or label mapping for a sports bottle. Students will struggle to recognise the intended product and may produce branding that fights the form.
- These two defects are blocking for a scaling reference set: the catalogue must deliver reliable, category-true shells so that pairs can invent and advertise without first decoding or correcting the base geometry.

### Important findings
- **Trainer carries pre-existing linear detail** that borders on solving part of the design challenge. The upper shows dark parallel lines that read as either laces or a pre-applied stripe graphic. While the form is otherwise good, these lines reduce the “blank canvas” quality and may be interpreted by students as fixed branding elements rather than editable geometry.
- **Flat-skin mapping honesty is uneven.** Slim Drink Can, Snack Pouch and Takeaway Box communicate the relationship reasonably (left = mapped 3-D preview, right = editable skin, with selection handles). Sports Drink Bottle’s skin is the weakest link: its proportions and flap do not obviously unwrap onto the jar-like body, risking confusion in the editor about what surface is being painted.
- **Pre-applied soft colour accents** (peach/pink on Headphones ear cushions, Hoodie sleeves/hood, Watering Can spout, Takeaway Box panels, etc.) are light enough to recolour but still establish a default palette. In a classroom setting this can subtly steer student choices or create the impression that certain areas are “already designed.”
- **Aquarium glass face** is large and inviting, yet the heavy grey frame and base make the editable surface feel secondary; students may default to framing rather than treating the tank face as the primary branding plane.
- Visual hierarchy and labelling are generally clear (product name + “Direct surface” / “Flat skin”, dual CLEAN PREVIEW / EDITOR-SELECTED or MAPPED / EDITABLE views), but the Pet Shop and Sports Drink Bottle naming-plus-form mismatch creates a cognitive load that reduces accessibility for mixed-ability pairs.

### Minor findings
- Consistent pastel line-art style, soft fills and rounded corners give good catalogue coherence without making every shell feel identical; silhouettes remain distinct.
- Selection handles (purple rectangles) appear on editor-selected views and correctly indicate intended editable regions for most direct-surface shells; this is helpful editor-readiness signalling.
- Headphones, Hoodie, Smartphone and Food Truck are strong, immediately legible and leave generous blank areas.
- Takeaway Box’s unfolded net is an excellent, honest flat-skin presentation.
- Overall appeal is age-appropriate for Year 10 (clean, modern, not childish or overly corporate). Contrast is adequate for most classroom projectors/screens, though the very pale fills could be slightly strengthened for low-vision accessibility.
- No catastrophic geometry collapses or missing labels are visible; the set is already more usable than a fully generic collection.

### Product-by-product observations
1. **Aquarium (Direct surface)**
   Immediately recognisable as a rectangular tank. Large glass face offers obvious branding space; frame and base provide secondary zones. Clean vs editor-selected views are almost identical except for subtle selection cues. Leaves the advertising challenge open. Minor: heavy frame can dominate the glass plane.

2. **Food Truck (Direct surface)**
   Excellent category specificity (awning, service window, wheels, boxy body). Generous side and awning surfaces for logos/menus without pre-solving design. Dual views clear. Strong classroom asset.

3. **Garden Watering Can (Direct surface)**
   Classic, instantly readable form. Body is a large, obvious canvas; spout and handle remain structural. Selection handles correctly highlight the body. Ideal bare shell.

4. **Headphones (Direct surface)**
   Clear over-ear silhouette. Ear-cup faces are natural branding zones. Soft peach cushions are recolourable but set a default. Editor view shows selection on the cup. Good.

5. **Hoodie (Direct surface)**
   Front (clean) and back (editor-selected) views are helpful. Large torso panels leave ample space; drawstrings and hood are structural. Slight peach on sleeves/hood is minor. Strong.

6. **Pet Shop (Direct surface)**
   Form is a generic shopfront. No pet-specific cues. Awning and façade offer branding space, but the shell itself does not communicate the product category. Critical specificity failure. Editor view simply recolours the awning.

7. **Slim Drink Can (Flat skin)**
   Mapped preview is a clear slim can. Editable skin is a rounded rectangle that students can understand as a wrap. Honest labelling. Good blank area. Proportions are acceptable for a tall can.

8. **Smartphone (Direct surface)**
   Immediately readable phone with large screen and thin bezel. Screen and rear are obvious branding planes. Clean dual views. Excellent bare shell.

9. **Snack Pouch (Flat skin)**
   Mapped pouch (stand-up bag with seal) is category-true. Editable skin is a clear flat front with top seal area. Selection handles present. Honest and usable.

10. **Sports Drink Bottle (Flat skin)**
    Mapped form is jar-like rather than sports-drink-like. Editable skin proportions and flap do not transparently map. Critical recognisability and mapping issues. Branding space exists but fights the wrong silhouette.

11. **Takeaway Box (Flat skin)**
    Mapped 3-D box is recognisable. Editable net (unfolded panels with selection) is pedagogically excellent and honest. Panels give clear zones. Minor pre-colour differences between panels are easily overridden. Strong.

12. **Trainer (Direct surface)**
    Clear sneaker silhouette, good side and tongue real-estate. Dark linear details on the upper risk looking like pre-applied graphics. Selection handles appear on the upper. Otherwise solid; the lines are the main concern.

### Minimum changes required before this twelve-shell style can be used as the scaling reference
1. **Pet Shop** — Add one or two subtle, non-branded category cues (e.g., a simple paw-print silhouette in a window, a small bone or fish outline as architectural detail, or a kennel-like roofline) while keeping the shell completely unbranded and recolourable. Alternatively, if the intent is a generic retail unit, rename it; but the current name + form mismatch must be resolved.
2. **Sports Drink Bottle** — Replace the jar geometry with a taller, more contoured sports-bottle silhouette (subtle grip ring or tapered body, sports-cap suggestion). Redesign the editable flat skin so its proportions and any flaps clearly correspond to a wrap-around label or full-body skin. Re-test mapping in the editor.
3. **Trainer** — Remove or convert the dark parallel lines into pure structural edges (or make them obviously part of the editable mesh) so no pre-solved graphic remains.
4. **Global consistency pass** — Ensure every flat-skin pair has an immediately understandable unwrap relationship; standardise the weight of selection handles; slightly increase fill contrast on the palest shells for accessibility; confirm that all soft accent colours are fully recolourable and do not imply fixed brand zones.
5. **Quick classroom smoke-test** — Have two Year-10 pairs attempt to brand the revised Pet Shop and Sports Drink Bottle in the actual editor; confirm recognition time < 3 seconds and that branding space feels obvious.

These five items are the minimum. Once implemented, the set can serve as the scaling reference.

### Blocking defects vs optional polish
**Blocking (must fix for PASS / scaling reference):**
- Pet Shop category specificity.
- Sports Drink Bottle recognisability + flat-skin mapping honesty.
- Trainer pre-existing linear graphic detail.

**Optional polish (nice-to-have, not required for first classroom use of the style):**
- Soften or unify residual peach/pink accents.
- Slightly enlarge Aquarium glass relative to frame.
- Add one more subtle structural cue to Headphones or Hoodie if desired.
- Micro-adjustments to line weight or corner radii for even tighter catalogue harmony.
- Accessibility contrast boost on the lightest fills.
- Extra editor-selected states showing multi-region selection if the tool supports it.

The overall illustration language, dual-view presentation, labelling system, and most individual shells are already close to classroom-ready and show clear improvement over generic predecessors. The three blocking items above, however, prevent an unqualified PASS. After those targeted revisions the twelve-shell set will be a coherent, honest, editable reference that supports the advertising-game pedagogy without pre-solving student work.
