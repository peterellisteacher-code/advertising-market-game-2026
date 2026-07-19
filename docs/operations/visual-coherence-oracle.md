# Visual coherence oracle

Use this once when an assembled game scene, screenshot, or composed visual layout clearly feels wrong but ordinary review has not identified an actionable root cause. Do not use it for defects that are already concrete, such as clipped text, oversized controls, empty columns, wrong currency labels, or broken responsive rules.

## One-pass diagnostic

1. Preserve the untouched broken render.
2. Send that render to the fal.ai `openai/gpt-image-2/edit` route at the render's target width and height, with high quality.
3. Make exactly one request. The prompt must ask for one coherent scene from one consistent camera angle and must include:
   - **Preserve:** the named art style, palette, and every object that must remain.
   - **Fix:** projection, ground/surface contact, relative scale, occlusion, lighting, object placement on surfaces, enclosure, and density.
4. Keep the original and edited render side by side. Do not accept “the edit looks nicer” as the diagnosis.
5. Write an explicit difference table covering every axis below.

| Axis | Original | Oracle edit | Pipeline rule exposed |
|---|---|---|---|
| Projection | One camera or mixed projections? | What camera rule did the edit enforce? | |
| Enclosure | Bounded place or an uncontained plane? | How were walls, edges, and depth enclosed? | |
| Contact | Grounded with bases/shadows or hovering? | What contact cues were added? | |
| Occlusion | Meaningful front/behind relationships? | What overlaps establish depth? | |
| Scale coherence | Can characters plausibly use the objects? | Which relative sizes changed? | |
| Light | Flat illumination or pools with falloff? | Where did light, shade, and warmth move? | |
| Surface logic | Props on usable surfaces or scattered? | Which objects were placed on tables, shelves, walls, or ground? | |
| Density | Coherent clusters or empty planes? | How did grouping and negative space change? | |

The final column is the defect list for the real pipeline. Prefer fixing that pipeline over repeatedly rescaling individual assets.

## Two valid outcomes

- **Diagnostic only:** correct the composition/projection pipeline and rebuild the live scene.
- **Ship the edited background:** request a character-free and UI-free variant, then overlay all moving, interactive, and animated elements. Align animated effects precisely over their baked counterparts.

## Interactivity remains a separate gate

The edit proves visual coherence, not interaction correctness. For every interactive scene:

1. Render translucent hotspot rectangles over the scene and visually check their geometry.
2. Crop every hotspot without its label and identify the depicted object from the crop alone.
3. Check geometry first, meaning second, and aesthetics third.

