# Primary panel synthesis

Only two of four intended seats completed, so this is not represented as four-seat consensus. The primary task compared both completed outputs against authored source, tests, the flow transcript, and the available visual facts.

## Substantiated and applied

1. **The waiting partner’s job was hidden.** Both completed seats identified this. The studio now persistently shows the named “Now” and “Partner” roles with one concise action each; the full brief carries audience depth rather than the partner’s basic job.
2. **Several completion clues competed instead of naming one next gap.** The run screen now derives one precise next unmet requirement, then explicitly identifies ready and locked states. The studio separates role action from the exact visible-change count.
3. **Teacher host controls competed with the student start.** Host fields are hidden behind Teacher setup. The lobby now states that the pair shares one MacBook and the initial status supplies the immediate student action.
4. **The Level 2 buzzer was unsupported by the game.** The reference was removed; AIDA meanings and the four required links remain unchanged.
5. **Long role prose increased MacBook-height risk.** Role and partner actions were shortened and the pair strip was reorganised into compact active, partner, and progress rows. This is a source-supported mitigation, not proof of viewport fit.
6. **“Campaign checklist” implied a competing assignment list.** Its navigation label is now “AIDA steps”; future controls remain gated by level.

## Investigated and not applied

1. **Alleged broken templates and developer residue.** Strings such as “Choose no more than in this step”, “Continue with ;…”, “Build a product. Then choose”, and `CardContent` were corpus-extraction fragments around interpolations, nested HTML, or an internal Godot node name. The actual source templates and rendered HTML assembly retain their missing values and complete phrases.
2. **Canvas suffocation as an established defect.** Both reviewers had text-only evidence and explicitly inferred the risk. The source was compressed, but no overflow, clipping, or canvas-height failure is claimed without a current viewport capture.
3. **Lock Level as an accidental one-way trap.** Source and tests show an intentional level-completion gate: ready → Lock Level → Next level. Reopening incomplete work remains available before lock; no contradictory game rule supported an unlock state.
4. **Automatically bypassing the run screen.** The existing architecture now presents a single concrete Open Studio action and uses the run screen for save/restore, readiness, lock, and level transition. Auto-opening would remove that state boundary without evidence that it is defective.
5. **Renaming teacher/account terms into advertising lore.** Student host fields are hidden, while account and classroom-code wording remains technically unambiguous. No factual requirement supported disguising those meanings.

## Post-panel browser findings applied by the primary task

These changes came from the current artifact and browser replay, not from extra paid review:

1. The Strategist prompt no longer claims a product-name edit counts as the required visible message action; the counter accepts canvas-word changes.
2. Each AIDA lock names the next move, and Action explicitly states completion and the return path.
3. Price placement tells the pair to return to the game for the next step.
4. Market-route requirements state their minimum selections and reveal one fieldset at a time; submission ends with the route report and return path.
5. Level 3 consistently names Final check rather than a nonexistent next level.
6. The first browser replay exposed a real publication failure: Fabric serialization omitted `editable: false` from the protected price object. A red-green serialization regression fixed it, and the rebuilt candidate then published the market card and completed the shop flow.

## Remaining uncertainty

- Two intended model families returned no review, so cross-family convergence is limited to Gemini and Grok.
- Neither completed seat received images. Their visual findings are not pixel evidence.
- The final browser replay resolved the earlier viewport uncertainty for Chromium at 1366×768 and 1440×900. Safari on an actual school MacBook and school-wifi behavior remain unmeasured; localhost cannot prove those hosted-environment facts.
