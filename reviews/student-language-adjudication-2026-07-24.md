# Advertising Market Game — student language and playtest adjudication

Date: 2026-07-24
Branch: `agent/admarket-integrated-fixes-20260723`

## Outcome

**CONFIRMED:** The final mapped corpus contains 1,209 student-facing occurrences across 36 source files. It received a fresh unguided Plain Language pass followed by a complete Claude Scrubber MICROCOPY pass. The reviewer inputs contained only stable copy IDs and raw current text in source order. They contained no task framing, preferred register, suspected phrases, playtest findings, examples, rationales or requested verdict.

**CONFIRMED:** The exact landing explanation is:

`First you will invent a product, then you will create an advertisement for it.`

**CONFIRMED:** The Claude playtest report was treated as separate black-box evidence and was not included in either final objective reviewer input.

## Correction to the earlier review evidence

The earlier 1,178-entry Plain Language prompt included Peter's preferred register and the Claude playtest report. It was useful as a guided drafting exercise, but it does not satisfy Peter's later requirement for an objective textual scan. It is therefore not the final objective-review evidence.

The final objective review used the current integrated source after the playtest corrections and account-reset copy had been added:

- raw mapped prompt SHA-256: `92687D7247897B38566AFFECEF7ABA50D84B71015B4C3E5F3DB85171C0F01A47`
- unguided Plain Language response SHA-256: `6BD07767FB0FC399E1B7282F92E69B39854B630D64536CDBB46C7B0F43A02B09`
- complete scrubbed map SHA-256: `B3D3516B431FCFF844AE02FD71800B22B6FE660E7D9D5E546CB6F800174C7A8E`
- accepted final corpus JSON SHA-256: `13C4F9D88A495C76C8BF46957CD549EA9BE279A803EB6C128D0BA49592764C1F`

Ignored review artifacts are retained at:

`C:\tmp\admarket-integrated-fixes-20260723\build\copy-review-20260724-final-objective-001`

They are evidence only and are not copied into a deployable artifact.

## Plain Language result

The frozen `@preset/plain-language-coach` received one user message containing the complete raw mapped corpus and no added instruction. It chose to assess only the opening Level 1–3 orientation block.

Its findings were:

- the three level headings and briefs already meet the register;
- the surrounding orientation should make clear how students receive their audience;
- the game should distinguish a customer need from a want or product benefit;
- Level 2 should make clear that students continue with the product created in Level 1.

The response did not claim whole-corpus coverage and was not steered or rerun to obtain a broader verdict.

## Claude Scrubber result

The complete raw corpus then passed through the standard MICROCOPY system prompt using:

- model: `google/gemini-3.1-flash-lite`
- temperature: `0.2`
- reasoning field: omitted
- maximum output: 4,000 tokens per section
- 11 contiguous source-order sections

The configured gateway tool was unavailable in this session. The retained direct contract runner used the same model, verbatim MICROCOPY system prompt, exact raw user text and required generation parameters. It did not add user-message instructions.

Section 08 returned `finish_reason: length`; its final mapping line was truncated. That output was retained but excluded. Only section 08 was split into two contiguous raw halves and rerun. Both replacements returned `finish_reason: stop`.

The effective 12 outputs passed the MICROCOPY diff guard:

- 1,209/1,209 mapping IDs present;
- 1,209 unique IDs;
- exact source order;
- line count and protected chrome intact;
- no imported-tell warning;
- 11 proposed word-level changes.

## Scrubber adjudication

| Source wording | Scrubber proposal | Decision | Reason |
|---|---|---|---|
| Select the strongest features. | Select the features. | Reject | `strongest` states the required selection criterion. |
| affordability matters most | affordability matters | Reject | `most` states when the lower price position is justified. |
| Treat the range as a rough guide. | Treat the range as a guide. | Reject | `rough` prevents false precision from two current sources. |
| a clear first reading point | a first reading point | Reject | clarity is the intended visual effect. |
| separates important information | separates information | Reject | importance is the basis of hierarchy. |
| deliberately empty area | empty area | Reject | deliberate use distinguishes negative space from accidental gaps. |
| their difference becomes meaningful | their difference is clear | **Accept** | the proposal is more factual and removes the vague claim `meaningful`. |
| contrast can create surprise or clarify | contrast creates surprise or clarifies | Reject | removing `can` overstates an effect that is not guaranteed. |
| deliberately unexpected product feature | unexpected product feature | Reject | intentional contrast is the technique being taught. |
| emphasise an existing key word | emphasise a key word | Reject | `existing` prevents the example from implying that students should add new copy. |
| audience most likely to want it | audience for it | Reject | the proposal removes the audience-likelihood relationship. |

The accepted source change is in `web/src/studio-coach/technique-catalogue.ts`.

## Account-reset copy

The account-reset strings also received an earlier raw-only delta pass before they entered source:

- raw reset copy SHA-256: `3155438D6166A9F76CA9433BD4B61FA6005ADED3B02FE5B6184DCD97E07C0952`
- Plain Language response SHA-256: `1AAC6F1BBDDF4E43496DA5AE4F1671F6686321A336308BE5C11699615451C1FA`
- scrubbed reset copy SHA-256: `24E771A15685757462809CEA81B234A4B81E3FF1ED9A1727DEEE969BD3C442DF`

Plain Language correctly classified the interface copy as outside its academic-copy remit. Claude Scrubber removed `permanently` from the deletion explanation. That change was accepted because the dialogue already names the exact deleted data and the typed `RESET` confirmation supplies the warning. The complete accepted reset copy was subsequently included in the 1,209-entry final objective pass.

## Claude black-box playtest adjudication

Source report:

`C:\Users\Peter Ellis\OneDrive\Teaching\2026\11PHIL S2 - 2026\vce\Ad-Market-Game-Playtest-Report-2026-07-24.docx`

Extracted-report SHA-256: `561D9F110FE1086643BFBC3EAD324E6A143D843644013ADCBC24D86FCB6C24BE`

| Playtest finding | Adjudication and implemented response |
|---|---|
| Market Gate never opens | Confirmed label-contract mismatch. Publication now recognises the visible `Market price` layer and student errors no longer expose raw handler codes. |
| A used device cannot be handed to a new pair | Added authenticated **Reset progress** beside **Log out**. It requires typing `RESET`, deletes only that account's game state, preserves the username and password, coordinates other tabs and retries the same operation safely. |
| QA price fixtures appear in observed prices | Harness-only evidence. The reported deployment used deterministic fake QA endpoints; it is not evidence that production price-guide data contains those fixtures. |
| Raw `HANDLER_ERROR` text is announced | Confirmed. Godot and Creator bridge failures now resolve to typed, student-facing diagnostics without raw internal codes or close errors. |
| Market Gate and canvas screens lack semantic access | Added a semantic DOM mirror, visible keyboard hint, focus state and keyboard-reachable game controls. |
| First AIDA lock rejects a visibly selected product | Not reproduced by the focused regression for current selection state. No speculative source change was made. |
| Price action lacks a done state | Confirmed. The control now reports `Price added to design` and a completed price decision. |
| Two revision counters disagree | Removed the student-facing cloud revision counter; revisions remain internal synchronisation metadata. |
| Full brief overlaps a library control | Confirmed and corrected in the editor layout. |
| Partner instruction names no action | Replaced with a specific one-action instruction. |
| Room-code and connection failures are conflated | Added separate typed messages for an unknown room code and temporary live-market unavailability. |
| Curved-product wording over-promises | Copy now limits the claim to supported products; their words follow a curved path and remain editable. |
| Account check can stall | The report withdrew this suspicion after it could not be reproduced. No change was made for it. |

## Current deterministic verification

- focused technique-catalogue test: 3/3 passed after the accepted scrub change;
- student-copy corpus, professional-register contract and source-coverage tests: 7/7 passed;
- complete Vitest and build-contract evidence is recorded in the final verification record after the post-adjudication rerun.

## Boundaries

- No production deployment occurred during this work.
- No Supabase migration or data mutation occurred.
- The reset SQL and Function changes remain source-only until an explicitly authorised release.
- Native Windows Godot was not launched.
