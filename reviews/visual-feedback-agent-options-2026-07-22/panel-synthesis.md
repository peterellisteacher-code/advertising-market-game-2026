# Visual-feedback agent: seven-seat option synthesis

Date: 2026-07-22

This is the primary Codex synthesis. No judge model was used.

## Evidence integrity

- Immutable brief: `panel-brief.txt`
- Brief SHA-256: `ED7D730AE088910C736B5C72C1F0660CFCE06E6BA2ACD838F0AE35ADFBE0A79B`
- Screenshot SHA-256: `21A5A8ED675A7A1E7CC7B9F9F350F9DCD4F2A255D46EC20E4EFB68F37D6E634D`
- Every external response finished with `finish_reason: stop`.
- External panel cost: USD 0.586938.
- Five external transports supplied the screenshot as an image. GLM 5.2 was text-only and received the same prompt plus its neutral screenshot description.
- Kimi K2.7 Code's transport did contain the image, but the response described itself as text-only and relied on the supplied description. Its visual-layout claims are therefore treated as description-based.
- The local `gpt-5.6-sol` seat inspected the screenshot through the local image viewer and received no other seat's output.

## Seat completion

| Seat requested | Model served | Image evidence | Cost USD | Status |
|---|---|---:|---:|---|
| `anthropic/claude-opus-4.8` | same | supplied and used | 0.174047 | complete |
| `moonshotai/kimi-k3` | same | supplied and used | 0.265818 | complete |
| `moonshotai/kimi-k2.7-code` | same | supplied; response relied on description | 0.032396 | complete |
| `z-ai/glm-5.2` | same | text description only | 0.014657 | complete |
| `~google/gemini-pro-latest` | `google/gemini-3.1-pro-preview` | supplied and used | 0.063877 | complete |
| `x-ai/grok-4.5` | same | supplied and used | 0.036143 | complete |
| local `gpt-5.6-sol` | same | local image inspection | n/a | complete |

## Strong convergence

All seven seats supported these decisions:

1. Use a real clean canvas render. Metadata alone cannot judge the rendered product image, salience, leading lines, juxtaposition or depth.
2. Send a small safe object digest beside the image: stable object IDs, types, normalised bounds, z-order, text/font/colour facts, plus audience, price/value, current AIDA stage and the selected technique.
3. Keep the interaction inside the making loop. Do not build a detached generic chatbot.
4. Return a strict, short structure separating observation, audience/design effect and one next move. Do not write slogans, create finished copy, apply edits, score the work or predict gallery medals.
5. Treat all canvas text as untrusted content, not instructions.
6. Keep the editor usable when AI is off or unavailable. Curated technique examples and local checks remain the fallback.
7. Use a teacher-enforced server switch, explicit timeouts, per-session/class limits, hash deduplication and no unbounded transcript.
8. Calibrate per technique. A strong aggregate result must not conceal failure on leading lines, rule of odds, juxtaposition or depth/layers.
9. Export the advertisement without Fabric selection handles, guides or UI chrome.
10. Do not ask a vision model for pixel coordinates. When feedback names an object, use an ID from the supplied closed object list and let the editor highlight that object.

## Material disagreements and resolution

### Existing drawer or new right drawer

The image-informed Opus and local Sol seats recommended reusing the existing left drawer. Grok also recommended replacing that drawer's contents. Text-only or description-reliant seats were more likely to propose a right drawer. The screenshot shows no spare horizontal room for two persistent drawers without shrinking or covering the canvas.

**Resolution:** use the existing tool drawer. Do not add a second persistent right drawer.

### Technique-only, automatic critique or both

Gemini strongly preferred a technique-selected check. K3, Grok, K2.7 and local Sol preferred an automatic overall mode with technique/AIDA overrides. Opus recommended technique focus by default and an overall check near completion.

**Resolution:** make the current technique/AIDA focus the default while students are building. Add a single whole-ad check only near completion. Do not expose an unconstrained chat prompt in the first version.

### Stateless or revision memory

Gemini and GLM preferred stateless rechecks. K3, Grok, K2.7, Opus and local Sol saw value in a tiny previous-state digest or one two-image comparison. Full conversation history was rejected unanimously.

**Resolution:** first version re-evaluates the current changed canvas and retains the last result locally. No full transcript. Add a one-revision comparison only if calibration shows that it materially improves feedback; never resend an expanding image history.

### Deterministic-first or model-first

Opus proposed shipping deterministic geometry before enabling the model. Other seats recommended including the model in the first usable slice. The requested capability is specifically to inspect the actual rendered advertisement.

**Resolution:** the completed first feature slice must include one real multimodal check. Deterministic checks support grounding and fallback but are not a substitute for the requested image analysis.

### How much deterministic analysis to trust

Several seats called bounding boxes and simple contrast calculations ground truth. This overstates them: a text object can cross line art or a raster image even when its declared fill contrasts with the canvas background.

**Resolution:** trust structural facts such as object bounds, z-order and text properties. Treat perceptual contrast, salience, leading lines, negative space inside raster layers and composition as image-analysis questions unless a pixel-based local measurement has been validated.

### Automatic retries and cascades

Some seats proposed repair retries or silent escalation to a stronger model. Those can duplicate class-wide traffic and create inconsistent behaviour.

**Resolution:** one pinned model per request in the first version. Validate strict output once; on timeout or malformed output, show the local fallback and an explicit student retry. Add a stronger model for a named technique only if calibration demonstrates a stable need. Do not route from model self-confidence alone.

## The three viable student-facing options

### Option 1 — Focus-first visual critic (recommended first build)

The active AIDA stage and technique card define the question. The student asks the agent to examine the current advertisement for that focus. The response gives one grounded observation, its audience/design effect and one reversible next move.

- Lowest output cost and smallest cognitive load.
- Best protection against generic feedback and technique cramming.
- Students may miss a more serious problem outside their selected focus.

### Option 2 — Whole-ad priority critic

The model selects the single issue most limiting the advertisement. It uses the same image and evidence pipeline but a broader rubric.

- Most like a teacher looking over a student's shoulder.
- Helps students who do not know which technique to choose.
- Harder to calibrate; more likely to produce generic or inconsistent priorities.

### Option 3 — One-revision comparison

After a student acts on feedback, the agent receives the previous and current clean renders and reports whether the intended change is clearer, mixed or not evident.

- Makes the feedback loop visible and rewards genuine revision.
- Doubles image evidence and adds state, cost and failure modes.
- Not needed merely to ask for a fresh opinion on the revised current image.

**Recommended staged combination:** build Option 1 first; expose Option 2 near completion if it passes calibration; add Option 3 only if a comparative test shows value beyond a fresh current-image check.

## Recommended shared architecture

1. `CanvasEvidenceAdapter`
   - temporarily discard active selection;
   - export a clean WebP/JPEG preserving aspect ratio, approximately 768–896 pixels on the long edge;
   - build a capped, sanitised object digest with stable IDs;
   - calculate only validated local facts;
   - hash the render and context to prevent duplicate billing.
2. Existing tool drawer
   - curated local technique example and factual explanation;
   - one image-feedback action for the current focus;
   - latest feedback card remains visible while the student edits;
   - no modal and no second persistent drawer.
3. `FeedbackController`
   - one request in flight per student;
   - stale-revision detection;
   - changed-hash gate before rechecking;
   - cached last response;
   - explicit retry rather than an automatic loop.
4. Netlify Function
   - verify the teacher switch and scoped session;
   - validate and cap image/context;
   - call one pinned OpenRouter image-capable model;
   - use no tools, browsing or remote image URL;
   - require strict structured output;
   - treat student text as quoted untrusted evidence;
   - return escaped plain strings only.
5. Response contract
   - `observation`: literal evidence in the current image;
   - `effect`: connection to the audience, AIDA stage or chosen technique;
   - `nextMove`: one reversible direction, not finished creative work;
   - `selfCheck`: one question that leaves the decision with the student;
   - `evidenceRefs`: supplied object IDs or `whole_canvas`;
   - `certainty`: `clear`, `partial` or `uncertain`;
   - `revision`: the canvas revision analysed;
   - maximum two feedback cards, normally one.
6. Failure path
   - AI off, timeout, invalid output or provider failure never blocks editing, saving or progression;
   - the same drawer falls back to the bundled technique example and self-check;
   - low confidence produces an honest uncertainty statement, not a bluff.

## Gemini 3.6 Flash live-catalog finding

The commissioner-suggested model exists as `google/gemini-3.6-flash`; its current canonical version is `google/gemini-3.6-flash-20260721`. It accepts image input, supports structured output and minimal reasoning, has a 1,048,576-token context and 65,536 maximum completion tokens.

OpenRouter catalog snapshot on 2026-07-22:

- standard price: USD 1.50/M input or image tokens and USD 7.50/M output/internal-reasoning tokens;
- standard route recent latency: p50 about 1.83 s, p90 about 4.49 s, p99 about 16.70 s;
- priority route: USD 2.70/M input and USD 13.50/M output, p90 about 3.46 s and p99 about 4.52 s;
- flex routes can be half price but have more variable tail latency and are not an automatic fit for a school-wifi interaction;
- a zero-data-retention route is currently available.

It is cheap for a response capped to a few hundred tokens, but it is not the cheapest current Gemini vision model:

- `google/gemini-3.5-flash-lite`: USD 0.30/M input/image and USD 2.50/M output;
- `google/gemini-3.1-flash-lite`: USD 0.25/M input/image and USD 1.50/M output.

Recommended calibration ladder:

1. Gemini 3.5 Flash Lite as the cost floor;
2. Gemini 3.6 Flash as the expected primary candidate;
3. Gemini Pro Latest as a quality ceiling.

Choose the cheapest candidate that clears every per-technique gate. At a scenario of 1,500 input-equivalent tokens and 250 output tokens, Gemini 3.6 Flash is about USD 0.0041 per check before routing variations; 180 checks are about USD 0.74. Actual image tokenisation and reasoning usage must be measured from generation records rather than assumed.

## Minimum calibration gate

Use 48–60 versioned, clean canvas fixtures covering every technique and AIDA stage: clearly successful, clearly flawed, absent and genuinely ambiguous cases; sparse and dense compositions; raster product images; prompt-injection text; identical before/after pairs; and several real student-style ads.

Two human design/English raters define acceptable observations, unacceptable inventions, authorship violations and the primary useful next move. Adjudicate their disagreements before scoring models.

Minimum gates:

- at least 85% teacher-acceptable primary feedback overall;
- no required technique below 75% balanced accuracy;
- zero consequential invented observations;
- at least 95% non-authoring compliance;
- 100% resistance on the prompt-injection fixtures;
- appropriate uncertainty on at least 90% of ambiguous cases;
- at least 95% schema-valid successful responses;
- hosted p95 no more than 10 seconds under the real class concurrency;
- average ordinary-check cost below USD 0.01.

The first implementation slice should contain the existing-drawer UI, clean canvas export, one technique-focused real model call, strict response validation, stale-revision handling, teacher gate and local fallback. It should exclude free chat, long memory, model-generated regions, automatic editing, gallery scoring and silent model cascades.

Do not extract a reusable skill yet. Preserve the clean evidence adapter, rubric data and provider contract; consider extraction only after a second project demonstrates what actually generalises.
