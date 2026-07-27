# Advertising Market Game: Student, Teacher and Studio Completion Design

**Date:** 27 July 2026
**Status:** Design candidate for Peter's approval
**Implementation baseline:** `21f016f6` (`feat: guide students through the advertising market game`)

## 1. Purpose

This design completes the Advertising Market Game as a classroom service for Year 10 pairs. It combines:

- a direct student entry point;
- a protected teacher area;
- clear account, reset and Image Lab controls;
- a more capable and understandable product editor;
- one linked sequence of student instructions;
- the unresolved findings from Peter's screenshots and Claude's 24 July black-box playtest;
- objective copy-quality gates; and
- a controlled verification and publication path.

The design extends the guided journey already present at `21f016f6`. It does not repeat completed panels, copy checks or tests whose inputs remain unchanged.

The later implementation plan must classify each acceptance criterion as:

- **present and verify** — current behaviour that must be preserved and checked;
- **change** — current behaviour that must be modified; or
- **new** — behaviour that does not yet exist.

Existing guidance, reset, pricing, curved-label, autosave, accessibility and release work must not be reimplemented merely because it also appears in this combined design.

## 2. Evidence used

The design is based on:

1. Peter's current requirements and annotated screenshots.
2. Source inspection of the current student account gate, teacher setup, editor shell, product-kit catalogue, logo panel, Image Lab session flow, role instructions, reset flow and canvas accessibility controls.
3. `Ad-Market-Game-Playtest-Report-2026-07-24.docx`, read in full, including its findings table and screenshot index.
4. Existing retained plans and verification records, especially the guided-student-journey work already committed at `21f016f6`.
5. The current Netlify project record, read without mutation.

The report's DOCX-to-PNG render failed locally with LibreOffice `libpng error: Write Error`. Its complete 138-paragraph body and findings table were nevertheless extracted from the DOCX structure. The source copy's SHA-256 is `702450680E76ED7DD4A721011C6D558DB53062F6DEA10FF68A98A080BB655022`.

## 3. Governing decisions

### 3.1 One deployment, two entry links

- `/student` is the normal classroom link.
- `/teacher` is the teacher link.
- `/` redirects to `/student`.
- `/student` has no site-wide visitor password and presents only pair sign-in.
- `/teacher` requires the teacher password `!Y10English!`.
- The teacher password is verified by a server route and is not embedded in shipped client JavaScript or public source.
- A successful teacher sign-in creates an `HttpOnly`, `Secure`, `SameSite=Strict` session cookie with a bounded lifetime.
- Repeated failed teacher sign-ins are rate-limited without reducing the existing whole-class account-session capacity.

Netlify's current site-wide visitor gate cannot distinguish the two paths. It will be removed only during a controlled release after the replacement `/teacher` protection has passed draft verification. Removing it is not part of an ordinary build or test run.

### 3.2 Student and teacher concerns remain separate

The student route must not expose:

- teacher setup;
- account creation or reset controls;
- the teacher password;
- the Image Lab teacher code;
- Image Lab allocation controls;
- production secrets;
- raw account identifiers; or
- controls that can affect another pair.

The teacher route must not silently enter or alter a student campaign. Teacher playtesting uses a dedicated isolated profile.

### 3.3 Password handling

- A teacher may type a password when creating a pair account.
- The existing password generator remains available as an optional action.
- The form includes password and confirmation fields, reveal/hide controls, and a copy action before submission.
- The accepted contract remains 8 to 128 UTF-8 bytes.
- The server stores a password hash, not recoverable plaintext.
- After account creation, a password cannot be retrieved. The teacher can replace it by entering and confirming a new password.
- The confirmation screen makes the username and newly entered password easy to copy into Peter's credential register before it is dismissed.
- Account aliases must not contain student names or other personal data.

### 3.4 No destructive student action without recovery or confirmation

- Removing an ordinary canvas object is undoable and needs no confirmation.
- Resetting saved campaign progress is not undoable and requires typed confirmation.
- Resetting the isolated teacher playtest requires the exact word `RESET`.
- Resetting a student pair requires the exact pair username.
- Reset actions state what will be removed and what will remain before confirmation.
- A progress reset preserves the account username and password unless the teacher separately replaces the password.

## 4. User journeys

### 4.1 Student journey

1. Open `/student`.
2. Enter the pair username and password supplied by the teacher.
3. Resume the pair's saved campaign or begin at the opening screen when no campaign exists.
4. Read the audience brief.
5. Confirm the two partner roles.
6. Complete the guided Invent, Advertise and Market sequence.
7. Review the final campaign against the five stated criteria.
8. Enter the market and judge other advertisements.
9. Sign out so the next pair can use the device.

The student route must always provide:

- a visible sign-out action;
- an explanation of what sign-out does;
- an always-available `How to use this site` reference;
- an always-available `Role guide`; and
- a visible current step with `Now`, `Why`, `Done` and `Next`.

A signed-out reload must stay signed out. A previously used classroom device must return to pair sign-in rather than silently reopening the previous pair's campaign.

### 4.2 Teacher journey

1. Open `/teacher`.
2. Enter `!Y10English!`.
3. Create, inspect, reset or update pair accounts.
4. Set Image Lab availability and allocations.
5. Open the isolated teacher playtest.
6. Reset the teacher playtest to the opening screen when required.
7. Return to the dashboard without affecting any student account.

The teacher dashboard lists pair aliases and operational status only. It does not require or display student names.

### 4.3 Teacher playtest journey

- `Open teacher playtest` opens the complete student-facing game under a reserved teacher-only profile.
- The profile uses the same game rules and interface as a student pair.
- A persistent teacher-only strip identifies the profile and provides `Return to teacher dashboard`.
- `Factory reset playtest` explains that only the teacher playtest progress and its local/cloud campaign assets will be removed.
- The reset proceeds only after `RESET` is typed.
- After reset, the playtest opens at the first screen with no campaign choices already made.

## 5. Linked instruction argument

The instruction system is authored from the following inductive argument in standard form. Every premise contributes to an intermediate or overall conclusion. Each intermediate conclusion becomes a premise in the next subargument.

### Subargument A: establish a shared audience purpose

1. Signing in opens the campaign and saved work assigned to the pair.
2. Reading the audience brief identifies the audience's situation, need and values.
3. Assigning the Art Director and Strategist roles gives each partner a stated responsibility for the same audience brief.
4. Therefore, completing steps 1 to 3 is likely to give the pair a shared audience purpose. **[Intermediate conclusion A]**

### Subargument B: turn the audience purpose into a product

5. If intermediate conclusion A is established, each product choice can be tested against the audience's situation, need and values.
6. Choosing a starter product provides a workable object that can be changed.
7. Adding, moving, filling or removing product parts allows the pair to adapt that object for the audience.
8. Naming the product gives the advertisement a clear subject.
9. Therefore, completing steps 5 to 8 is likely to produce a named product that suits the shared audience purpose. **[Intermediate conclusion B]**

### Subargument C: turn the product into an advertisement

10. Intermediate conclusion B supplies a named, visible product for the advertisement.
11. The Art Director's visible change supplies evidence of a deliberate visual choice.
12. The Strategist's wording supplies evidence of a deliberate message choice.
13. Attention, Interest, Desire and Action each require one visible choice and one explanation connected to the product and audience.
14. Therefore, completing steps 10 to 13 is likely to produce a coherent advertisement for the product and audience. **[Intermediate conclusion C]**

### Subargument D: turn the advertisement into a credible offer

15. Intermediate conclusion C supplies a coherent advertisement whose offer can be evaluated.
16. An audience-led price explains what the product costs and why that amount is suitable.
17. A market route identifies where the audience is likely to encounter the advertisement.
18. A proof point supports the advertisement's main claim with a fact, feature or demonstration.
19. Therefore, completing steps 15 to 18 is likely to produce a clear and credible offer. **[Intermediate conclusion D]**

### Subargument E: turn the offer into a completed market entry

20. Intermediate conclusion D supplies a clear and credible offer for final review.
21. The final review checks audience fit, product value and price, AIDA, visual technique and claim credibility.
22. A successful publication check proves that the saved campaign contains the evidence required by those five criteria.
23. Entering the market makes the completed campaign available for comparison.
24. Applying the same five criteria to other advertisements supports consistent scores and medal decisions.
25. Therefore, a pair that completes steps 20 to 24 is likely to create and judge an audience-focused, coherent and credible advertising campaign. **[Overall inductive conclusion]**

### 5.1 Visible instruction presentation

The argument is not presented as one wall of text during ordinary work.

- The main route presents one current action at a time.
- `Now` states the immediate action.
- `Why` states which later result the action supports.
- `Done` gives an observable completion condition.
- `Next` names the following action.
- Completed steps remain reviewable.
- `How to use this site` presents all five subarguments as a numbered reference.
- Each visible step maps to one or more numbered premises, so the compact and complete versions cannot contradict one another.
- The full guide uses headings, numbered steps, short paragraphs and sufficient spacing. It must not repeat the dense label-and-sentence block shown in Peter's microphone-test screenshot.
- The guide uses academic and professional English. It does not use slang, conversational filler, slogans, gamified metaphors or unexplained technical language.

## 6. Partner roles

### 6.1 Definitions

**Art Director**

- controls the product's appearance, images, colour, arrangement and layout;
- must make at least one visible canvas change before the pair completes the relevant gate.

**Strategist**

- controls the product name, advertising words, claim, price reasoning and route reasoning;
- must make at least one message or strategy change before the pair completes the relevant gate.

### 6.2 Presentation

- The first studio entry presents both role definitions before work begins.
- The role assignment states which partner starts in each role.
- `Swap roles` explains that the partners exchange responsibilities; it does not delete or transfer authorship history.
- The status `Both roles made a change` is replaced or accompanied by a precise statement of the evidence recorded for each role.
- `Role guide` remains beside `Swap roles` and is keyboard accessible.
- Role explanations are repeated at the point of use only when the responsibility changes.

## 7. Teacher account controls

### 7.1 Create an account

Required fields:

- pair username;
- password;
- confirm password.

Optional actions:

- generate a password;
- reveal or hide the current password;
- copy the current username and password.

Validation appears beside the relevant field. Submission is disabled only when the form also states the unmet condition.

### 7.2 Replace a password

- The teacher selects a pair.
- The teacher enters and confirms the replacement password.
- The confirmation explains that the old password will stop working.
- Successful replacement invalidates existing pair sessions.
- The new password is copyable before the success panel is dismissed.

### 7.3 Reset a pair's progress

- The dialog names the pair.
- It lists saved campaign progress and account-owned campaign assets as the affected data.
- It states that the username and password will remain.
- The teacher types the exact pair username.
- A successful reset invalidates stale local progress for that account and starts the pair at the first screen on next sign-in.
- The operation is idempotent and returns a stable result if retried after a school-wifi interruption.

## 8. Image Lab control and allowance model

### 8.1 Student-facing changes

- Remove the `Teacher code` field and `Wake Image Lab` action from `/student`.
- Students never receive or enter a shared Image Lab code.
- The Image Lab panel states whether the tool is available and shows remaining uses.
- Draft image generation and final image realisation have separate visible counts.
- When no use remains, the panel explains that the teacher can add uses; it does not expose an internal code or provider error.

### 8.2 Teacher-facing controls

The teacher dashboard provides:

- global Image Lab on/off;
- default allocations for newly created pair accounts;
- separate draft and final allowances;
- per-pair set, add and revoke actions;
- a class batch-grant action with a clear preview;
- current remaining and reserved counts; and
- a short audit record of teacher allocation changes.

New pair accounts start with zero paid uses unless the teacher explicitly changes the default.

### 8.3 Server enforcement

Allowances are server-side records. A signed student request cannot choose or increase its own allowance.

The data model contains:

- one allowance record per account, with enabled state, draft remaining, final remaining and a monotonic version;
- one reservation record per account, operation kind and idempotency key;
- reservation status, provider job reference, created time and terminal time; and
- a teacher allocation audit record that contains aliases or internal account IDs, never personal data.

The server flow is:

1. Authenticate the pair session.
2. Validate the requested operation and idempotency key.
3. Atomically reserve one matching allowance.
4. Return the existing reservation when the same request is retried.
5. Submit at most one paid provider job for the reservation.
6. Mark the reservation complete when a deliverable is persisted.
7. Refund once when failure is confirmed and no deliverable exists.
8. Leave an uncertain reservation visible to the teacher rather than creating a duplicate paid request.

Teacher allocation routes require the teacher session. Provider keys and the Supabase service role remain server-only.

### 8.4 Supabase change boundary

The required migration is designed and tested locally before any shared-project mutation. Before application:

- reserve only the named Advertising Market Game objects in project `jftpeajvpqmxabuscoml`;
- confirm no `signal_lost` object is touched;
- review current schema, RLS policies and migration state;
- use idempotent SQL and explicit object names;
- apply once during a short announced window;
- verify access from student and teacher roles; and
- release the shared-project reservation immediately.

## 9. Product starter range

### 9.1 Catalogue

The opening product choice expands from three to twelve reviewed starters across at least six useful categories. No category supplies more than two starters.

- The three current multi-part products may remain after visual repair and validation.
- At least three starters remain certified multi-part kits with socketed parts.
- The remaining starters may be validated single-piece products drawn from generated project assets.
- Every starter has a visible name, starting price, artwork bounds, accessible description and audience-relevant category.
- The initial set must include varied price points, shapes and likely audiences.

The catalogue may not include public-stock or example fixture assets that are not part of the current generated/approved asset set.

### 9.2 Preview and reset behaviour

- Choosing a starter changes only the current campaign.
- The teacher playtest factory reset clears the choice.
- A fresh student account shows all twelve starters and no preselected product unless the guided route explicitly requires selection.
- The preview is large enough to inspect at both required viewports.

## 10. Product-kit socket repair

The existing matrix tests do not prove that real raster contact points meet visually. Socket repair therefore uses both metadata and rendered evidence.

- Each multi-part kit defines named sockets in normalized product coordinates.
- Each attachable part defines its contact point and intended socket.
- Preview and placed-canvas transforms use the same source metadata.
- Automated checks measure the residual distance between each transformed contact point and socket.
- Every certified part-to-socket combination receives a visual reference image generated from the current source raster.
- Visual review checks contact, scale, rotation, z-order and absence of detached handles or floating parts.
- All twelve starters are inspected at ordinary placement size, not only in thumbnail cards.

A socket is not considered fixed because its transform matrix passes alone.

## 11. Editor workspace and split pane

### 11.1 Desktop behaviour

- Remove the floating `Hide library` button.
- Use one labelled separator between the tool/library pane and the live design pane.
- Default ratio is approximately 40% library and 60% design.
- The separator supports pointer drag.
- The library pane is bounded to 25% to 75% of the available editor width.
- The design pane expands and contracts proportionately.
- The chosen ratio persists for the current device and can be reset to the default.
- Canvas display dimensions update after resizing while document coordinates and object geometry remain unchanged.
- Neither pane overlays the other.

### 11.2 Keyboard and accessibility

- The separator uses the `separator` role with horizontal orientation and current/minimum/maximum values.
- Left and Right Arrow adjust by a small increment.
- Shift plus Left or Right Arrow adjusts by a larger increment.
- Home and End move to the bounded extremes.
- A visible focus indicator remains at all times.
- Instructions name the keys when the separator receives focus.

### 11.3 Narrow screens

Below the usable split threshold, the interface presents explicit `Browse tools` and `Edit design` views instead of forcing two unusably narrow panes. Switching views preserves tool state, selection and canvas state.

## 12. Visible and undoable object deletion

- A selected removable object exposes a visible `Delete selected item` action in the canvas controls.
- Delete and Backspace continue to work when focus is on the canvas selection and not inside an editable field.
- The Layers list retains an accessible delete action for each removable object.
- The command enters the same undo/redo history as other editor changes.
- Undo restores the object, order, lock state, visibility, transform and metadata.
- Protected structural product-shell objects explain why deletion is unavailable.
- Product parts added by the pair are removable unless the kit schema marks them as a required base.

## 13. Section Fill

### 13.1 Interaction

- Eligible objects expose `Fill section`.
- The student chooses a colour and then selects a closed visible region on the object.
- The selected connected region changes while dark linework, transparent pixels and other closed regions remain unchanged.
- A preview can be accepted, cancelled or undone.
- Simple single-region objects expose `Fill object` instead.
- The interface states which fill mode is available for the selected object.

### 13.2 Processing boundaries

For eligible generated raster line art:

- use the source body mask;
- identify the clicked connected region within the object bounds;
- treat transparency and reviewed dark linework as boundaries;
- cap pixel processing by source dimensions and time;
- preserve original alpha and linework;
- store the edited result as deterministic account-owned raster data; and
- preserve the original source reference for reset/undo.

If the selected area is open, ambiguous or too large, the operation stops without changing the object and explains that the section is not enclosed. A fill must never leak into the surrounding canvas.

### 13.3 Validation

Tests cover:

- a simple one-region object;
- a multi-region product;
- an open outline;
- transparent holes;
- boundary clicks;
- undo/redo;
- save/reload; and
- export.

Representative outputs receive pixel-level and visual comparison.

## 14. Logo insertion

The current disabled `Add logo` state is treated as an interaction defect until browser reproduction distinguishes missing prerequisites from callback failure.

- Logo words and symbol choice appear in one ordered section.
- The main action never remains mysteriously disabled.
- When a prerequisite is missing, its name is visible beside the action.
- Activating the action while incomplete focuses and scrolls to the first missing field.
- A valid words-and-symbol combination inserts one logo object on the canvas.
- The inserted logo is selected, visible, removable and undoable.
- Repeated activation cannot create accidental duplicates while the first insertion is pending.
- Tests cover validation, scroll/focus, insertion, undo, save/reload and keyboard use.

## 15. Market completion and price state

Claude's first blocker remains an explicit end-to-end acceptance test even where source changes have already attempted to address it.

- `Add price to design` shows pending, complete and needs-attention states.
- The visible price value and stored charged price use one normalized monetary representation.
- Publication readiness identifies the exact unmet condition in student language.
- No raw `HANDLER_ERROR` text reaches visible or assistive output.
- A matching visible protected price, price evidence, route and proof point allow the market card to be built.
- Returning from the final studio check advances to the market exactly once.
- Reloading after completion returns to the completed market state rather than the gate loop.
- A price change after completion invalidates only the dependent readiness state and gives a precise repair action.

## 16. Claude playtest traceability

| Report finding | Design response and release evidence |
| --- | --- |
| Market Gate loops forever | Section 15 end-to-end completion test at both required viewports, plus reload |
| Used device cannot start the next pair | Real `/student` sign-out, signed-out reload, pair login and teacher reset paths |
| QA price fixtures appear to students | Production catalogue scan rejects `QA`, `example.invalid` and fixture-only records |
| Raw `HANDLER_ERROR` is exposed | Typed student messages in visible and accessibility output |
| Market Gate keyboard dead zone | Keyboard traversal of review steps, final action and market entry |
| Canvas screens lack assistive state | Preserve and extend the DOM accessibility mirror; add a visible keyboard-navigation hint |
| First AIDA lock loses apparent selection | Use one selection source for handles, status and lock validation |
| Price action has no done state | Explicit pending/complete/needs-attention presentation |
| Two revision counters disagree | Remove implementation revision numbers from ordinary student presentation |
| Full brief overlaps Hide library | Remove floating control; split pane and modal layout checks |
| Vague `Follow the highlighted tool step` | Replace with the current concrete `Now` action |
| Live-room join error blames two causes | Separate invalid-code, unavailable-room, timeout and connection messages |
| Curved-label wording over-promises | Preserve the current visibly curved editable rendering and state its actual limit |
| Strong AIDA teaching | Preserve technique definitions and student application requirement |
| Ethical move guardrails | Preserve without adding moralising filler |
| Strong role contribution tracking | Preserve while explaining role meanings |
| Reliable autosave and resume | Preserve and re-test only where account/reset changes affect it |
| Large product placement and Undo/Redo | Preserve while adding deletion, fill and split-pane behaviour |

The report's previous 1366x768 black-box run is contextual evidence only. It does not replace current 1280x800 and 1440x900 browser verification.

## 17. Error handling

- All network actions use bounded timeouts.
- A retry must be idempotent before it is automatic.
- Account, reset and Image Lab errors identify the failed action without exposing internal route names, stack text, tokens or database details.
- Offline autosave continues locally and reports cloud delay without claiming data loss.
- A teacher operation that reaches an uncertain state provides a refresh/reconcile action rather than repeating a mutation.
- Rate-limit messages use `Retry-After` where supplied and keep the current whole-class NAT assumptions.
- Error text appears in the same visible region as the affected control and is announced through a polite live region.
- Disabled actions always state the unmet condition.

## 18. Copy workflow

### 18.1 Authoring

Student copy is drafted from the linked argument and factual game rules. It must be:

- factual and direct;
- academic and professional;
- suitable for Year 10;
- free of slang and casual address;
- specific about the required action;
- accurate about saved state, visual effects and technical limits; and
- consistent across visible text, accessibility text and error text.

### 18.2 Objective Plain Language pass

After the complete copy corpus is stable:

1. Generate the complete student-facing UTF-8 corpus through the retained corpus script.
2. Record its SHA-256.
3. Send that exact file as one user message through the frozen Plain Language contract.
4. Add no suspected phrases, preferred verdict, repair instructions, system text or model parameters.
5. Capture the response byte-for-byte to a new file.
6. Adjudicate only meaning-preserving edits against game rules and accessibility semantics.

The existing Plain Language evidence is reused where source strings are unchanged. Changed strings enter the new complete corpus; the paid call occurs once at the stable copy candidate.

### 18.3 Objective Claude Scrubber pass

After accepted Plain Language edits:

1. Read the installed MICROCOPY system prompt verbatim.
2. Send the complete current teaching corpus unchanged to the required non-Codex model with the skill's exact call shape.
3. Add no local guidance to the user message.
4. Return and capture the model output verbatim.
5. Run the deterministic MICROCOPY diff guard.
6. Reject output that changes protected chrome, changes more than the allowed proportion, loses meaning or introduces a flagged tell that cannot be accepted.
7. Do not locally rewrite the scrubber output.

This is the final copy-quality pass. Any later student-copy change invalidates it and must be resolved before release.

## 19. Documentation

Update the private operations guide to state:

- the separate student and teacher links;
- the teacher access password;
- how to create a username and typed password;
- how to copy credentials at creation;
- how to replace a password;
- how to reset a student pair;
- how to reset the isolated teacher playtest;
- how Image Lab allocations work;
- which controls are teacher-only; and
- that passwords are not recoverable after the creation/replacement confirmation is dismissed.

The guide must not contain API keys, Supabase service credentials or Netlify tokens. Existing blank credential rows may remain as Peter's manual classroom register.

## 20. Testing strategy

### 20.1 Focused test-driven work

Each behavioural change begins with a failing test that reproduces the user-visible problem or required contract. Focused groups cover:

- route and teacher-session boundaries;
- typed password creation and replacement;
- student and teacher reset isolation;
- Image Lab atomic allowance operations;
- starter catalogue rules;
- socket geometry and raster references;
- split-pane pointer and keyboard behaviour;
- visible deletion and undo;
- Section Fill boundaries and persistence;
- logo prerequisites and insertion;
- role guide and swap explanation;
- market completion;
- sign-out on a reused device;
- visible and accessible errors; and
- instruction-step linkage.

### 20.2 Integrated deterministic verification

After final integration:

- run TypeScript checking;
- run student-copy coverage and professional-language contracts;
- run build-contract and deployment-layout tests;
- run the full serialized Vitest suite once;
- run `git diff --check`;
- build the exact web artifact;
- run the existing static/export verifier;
- record artifact and release hashes; and
- obtain Godot test/web-export evidence through the supported GitHub workflow.

Native Windows Godot executables remain quarantined.

### 20.3 Browser and visual QA

Use the current browser-control skill and an unprotected non-production QA URL. Verify exactly:

- 1280x800;
- 1440x900; and
- a narrow reflow width for the explicit Browse/Edit fallback.

Student-route checks:

- direct pair login and signed-out reload;
- first-use instructions and permanent refresher;
- role definitions and swap;
- all twelve starters;
- product socket alignment;
- large product placement;
- split-pane drag and keyboard control;
- deletion and undo;
- Section Fill;
- logo insertion;
- Image Lab remaining-use presentation;
- one-small-action AIDA guidance;
- price completion;
- market-route proof point;
- final review, publication and market entry;
- keyboard focus and accessibility mirror; and
- no overflow, overlap, clipping, orphaned text, ambiguous action, unexplained dead space or console error.

Teacher-route checks:

- password gate;
- typed account password;
- password replacement;
- pair reset confirmation;
- isolated playtest;
- factory reset;
- Image Lab allocation controls; and
- absence of teacher controls from `/student`.

Service-worker checks:

- current page is controlled after the expected first reload;
- verified static assets load from cache offline where supported;
- account and teacher mutations do not pretend to succeed offline; and
- route separation is not bypassed by a stale cached shell.

Safari on a current school MacBook and performance on school wifi remain required field checks. Chromium draft QA does not claim to measure those environments.

## 21. Review and release gates

### 21.1 Stable candidate

No model-based review runs during iteration. The candidate is stable only when:

- all planned features are implemented;
- focused tests pass;
- the full applicable suite passes once;
- the exact public-snapshot manifest and diff are fixed;
- copy workflows are complete; and
- the worktree contains no unexplained file.

### 21.2 One fresh Superpowers code review

Before publication, run exactly one fresh, isolated `superpowers:requesting-code-review` pass. Supply neutral complete evidence:

- this approved specification and the implementation plan;
- the pre-change and candidate SHAs;
- the exact public-snapshot manifest and diff;
- test/build/browser evidence; and
- the relevant migration and workflow files.

Ask for plan alignment and release readiness, including required-input removal, residual private/internal material, credentials, licensing and asset provenance, reproducible clean-snapshot builds, and any workflow capable of deployment or secret exposure.

### 21.3 One requested coding consensus panel

Run one independent coding panel on the same stable evidence, using:

- HY3;
- GLM-5.2;
- K3;
- DeepSeek V4 Pro; and
- Claude Opus 5.

Resolve the exact current OpenRouter catalogue identifiers at execution time. Do not substitute K2.7 Code or Claude Opus 4.8. If K3 or Opus 5 is unavailable, stop and report that exact limitation instead of silently changing the roster.

The panel receives no student-identifying data, secrets, prior reviewer output, preferred verdict or author-written suspected-findings list. Each reviewer assesses the candidate independently. Results are aggregated once without a reviewer loop.

### 21.4 Finding resolution

- Resolve genuine Critical or Important findings once.
- Run only the affected focused checks after a fix.
- If a fix changes the integrated candidate, run the final deterministic suite once on that final state.
- Do not buy another panel or create a review loop unless Peter explicitly requests it.

### 21.5 Draft and production

- Deploy an exact non-production draft first.
- Record the draft deploy ID, URL, project ID and artifact hashes.
- Complete browser QA against that draft.
- Update and commit the final verification record.
- Keep production unchanged until Peter has reviewed the verified draft.
- Do not change repository visibility or publish the curated source snapshot before the release-readiness reviews pass.
- Keep operational records, credentials, private reviews and this internal specification outside the history-free public snapshot.
- Do not expose production secrets, real accounts or personal data in a public repository or QA project.

## 22. Acceptance criteria

The work is complete only when:

1. Students have a direct public `/student` link and cannot reach teacher controls.
2. Peter has a protected `/teacher` link using `!Y10English!`.
3. Peter can create pair accounts with typed passwords and replace those passwords.
4. Peter can play the complete game in an isolated teacher profile and reset it with typed confirmation.
5. Peter can reset a selected student pair without changing its username or password.
6. Image Lab use is controlled server-side by teacher-set draft and final allowances.
7. Students never enter a teacher Image Lab code.
8. Twelve varied starter products are available and visually valid.
9. Certified kit sockets align in real rendered artwork.
10. A selected removable object has a visible undoable delete action.
11. The library and design panes resize proportionately by drag and keyboard without overlap.
12. Eligible product sections can be filled independently without colour escaping the selected region.
13. A valid logo can be inserted, and missing prerequisites are explicit.
14. Art Director and Strategist responsibilities are explained before use and remain reviewable.
15. Every student step belongs to the linked instruction argument and has a clear `Now`, `Why`, `Done` and `Next`.
16. The market completion path succeeds and remains complete after reload.
17. A reused device can sign out and accept the next pair's credentials.
18. All actionable Claude playtest findings have a passing test or current browser observation.
19. The objective Plain Language and Claude Scrubber gates pass on the final student corpus.
20. Focused tests, the final full suite, build verification, exact-viewport browser QA and the final one-pass reviews pass.
21. The operations guide matches the released routes and controls.
22. Production, Supabase and repository visibility change only through their named controlled release steps.

## 23. Explicit non-goals

- No native Windows Godot launch.
- No student names or personal records.
- No client-side storage of provider or database secrets.
- No public teacher dashboard.
- No shared teacher code on student devices.
- No deletion of project or review files as part of this feature work.
- No rerun of completed paid panels.
- No repeated Plain Language or Claude Scrubber call during ordinary iteration.
- No claim that Chromium draft QA proves Safari or school-wifi performance.
- No claim that a stub or local surface proves hosted edge, password-gate, rate-limit or production-secret behaviour.
- No production deployment before Peter reviews the verified draft.

## 24. Self-review

- Every requirement Peter reported is represented in an acceptance criterion.
- Claude's two blockers, every high-priority finding and every medium finding are traced in Section 16.
- Previously praised and verified behaviours are explicitly preserved.
- Student, teacher and service responsibilities are separated.
- Destructive reset operations have exact confirmation rules.
- Image Lab debits, retries and refunds have one server-side source of truth.
- The linked argument has no loose premise: each premise feeds its subargument conclusion, and each intermediate conclusion is used by the next subargument.
- The copy workflows are objective relays and cannot be guided by the implementation author.
- Review systems run once at a stable candidate and do not form a loop.
- Production, Supabase, Netlify access settings and public-repository visibility remain controlled release actions rather than incidental implementation effects.
- The design contains no unresolved field, silent substitution or unbounded retry.
