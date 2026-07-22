# Multimodal onboarding panel — status and primary synthesis

Date: 2026-07-22

## Immutable evidence and seat completion

Every seat received the same 81,408-byte prompt, SHA-256 `2155ac77232385c3f134acf4f74105755c300a7d50188f37e81ad67552584f27`, plus the same five JPEG contact sheets as actual image inputs. Seats were isolated; no seat saw another response or a primary-agent diagnosis. The primary task performed the synthesis without a judge model.

| Requested seat | Served model | Images | Record | Status |
|---|---|---:|---|---|
| `~google/gemini-pro-latest` | `google/gemini-3.1-pro-preview` | 5 | `gemini-pro-latest.json` | Complete, HTTP 200 |
| `x-ai/grok-4.5` | `x-ai/grok-4.5` | 5 | `grok-4.5.json` | Complete, HTTP 200 |
| `moonshotai/kimi-k3` | `moonshotai/kimi-k3` | 5 | `kimi-k3.json` | Complete, HTTP 200 |
| `anthropic/claude-opus-4.8` | `anthropic/claude-opus-4.8` | 5 | `opus-4.8.json` | Complete, HTTP 200 |

All four terminal verdicts were `REVISE`.

## Findings accepted and implemented

1. **Practice was visually secondary and briefly disabled.** The local-practice button now uses the primary treatment, remains enabled during startup recovery checks, and the alias label states that it serves practice or live rooms.
2. **Role guidance became stale after the first handoff.** Both role jobs now change with Invent, Sell, Finalise and Final Look. Once both roles have contributed, the active instruction becomes `Follow the highlighted tool step.` and pair progress records that both roles contributed.
3. **The price label collided with the slogan.** A newly added price now starts in a reserved bottom-right position instead of the canvas centre. It remains movable.
4. **The route report could be ungrammatical.** Singular and plural trait subjects now receive the correct verb, and the audience need is a separate sentence.
5. **The cost receipt could repeat `Product body · Product body`.** Identical group and choice labels now render once.
6. **Price appeared before its level.** The Price tool is hidden until Level 3; product cost remains visible in the product builder from Level 1 because price is still evidence of product value.
7. **The first product-placing action was below the fold.** The build total, current missing choice and `Place product on ad` action now form the first sticky card under the product preview.
8. **Student-facing identity was fragmented.** The outer shell now uses `AD MARKET // GAME`, the studio remains `AD MARKET Studio`, and the market uses `AD MARKET // MEDAL GALLERY` with the cross-phase line `Invent it. Advertise it. Judge the market.`
9. **Cloud status used two phrases for one state.** The unavailable state now reuses `Saved on this device · cloud copy paused`.
10. **Purchase-era completion guidance remained visible.** The final footer and market-state copy now describe the gallery and Gold/Silver/Bronze awards.

## Findings superseded by later authorised design changes

- The panel reviewed the former `$100` shopping flow. Peter subsequently replaced that mechanic with one Gold, one Silver and one Bronze awarded to different ads using five explicit checks and a stated tie-break. Findings about the `$80` spending threshold, remaining wallet and seller count no longer describe the candidate.
- The panel's small-product evidence predates the close-up controls. Students can now enlarge the selected product or image, fill the ad and drag to choose the crop.
- The reviewed artifact predates Studio Coach. Sell and Finalise now include the factual technique guide and the two-turn image-aware Coach: one piece of advice, then one comparison against the student's revision. It cannot write slogans.

## Findings narrowed or not adopted

- **Hide the full AIDA and route reference content.** Not adopted wholesale. Essential teaching content remains available inside the relevant tool, while the run screen exposes one unmet requirement and the route form reveals strengths, priced choices, zone and media in sequence. Removing the reference content would violate the requirement not to collapse teaching content.
- **Route feedback is a dead end.** Narrowed. Students can change any route selection after feedback; that change clears the report and re-enables submission. The genuine grammar defect was fixed.
- **Automatically wrap ordinary canvas text around every object.** Not claimed. Students control text placement; the image-aware Coach can evaluate the current rendered ad. `Make It Real` explicitly tells students that existing words and marks are fitted to the product surface during the realistic-product render.
- **Remove the Build/Place/Design path.** Not adopted. It describes the real product workflow, but the actionable summary is now above the choices so the path is supporting context rather than the only progression cue.

## Remaining uncertainty

- The four seats reviewed the earlier contact sheets, not the post-panel medal market and Studio Coach additions. Those additions were separately covered by source panels, deterministic tests and the later browser replay.
- The exact post-synthesis source still requires a fresh non-Windows Godot web export and browser replay. The quarantined Windows Godot executable cannot provide that artifact.
- Hosted password-gate, edge-routing and school-network behaviour are not inferred from the local static replay. Production and Supabase remain unchanged.
