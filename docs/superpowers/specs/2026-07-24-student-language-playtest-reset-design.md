# Advertising Market Game Student Language, Playtest and Reset Design

## Status

Approved by Peter Ellis through the instruction to continue after confirming that the Plain Language and Claude Scrubber passes must remain independent, objective textual scans.

## Goal

Make every student-facing sentence professional, factual and direct; correct the substantiated defects in the 24 July 2026 playtest; and let Peter restore an existing account to its original empty game state without changing its username or password.

## Non-negotiable constraints

- The landing explanation is exactly: `First you will invent a product, then you will create an advertisement for it.`
- Student copy uses clear, professional second-person language where it names a student action. It does not replace precise advertising, design or market vocabulary with vaguer wording.
- Plain Language runs before Claude Scrubber. Each receives only unannotated corpus text in source order and its standard instructions. Neither receives suspected phrases, preferred outcomes, playtest findings, annotations, rationales or verdicts from the other review.
- Model output is evidence, not an automatic patch. A proposed edit is accepted only when it preserves the game's factual, pedagogical, technical and accessibility meaning.
- Godot 4 remains the game engine. Native Windows Godot execution remains quarantined.
- Production, production visitor-access controls and live Supabase data remain unchanged.
- The reset operation preserves the account username, password and authentication identity. It removes only that account's game progress, drafts, designs and uploaded game assets.
- Reset tests use injected repositories and fake account data. They do not delete real Supabase rows or Netlify Blobs.
- The release target remains a recent school-managed MacBook on school wifi. Safari-specific and school-network behaviour remains unverified until tested there.

## Copy workflow and adjudication

The existing whole-corpus extractor is the completeness boundary. Its source list includes the canvas accessibility controller, and its tests fail if a student-facing source is omitted. The current corpus contains 1,178 ordered entries across 34 source files.

The approved source mapping is produced in three stages:

1. Run the complete source corpus through Plain Language without annotations or issue prompts.
2. Run the resulting text through Claude Scrubber in raw contiguous sections, again without annotations or issue prompts.
3. Compare both outputs with the source and accept only meaning-preserving changes.

Direct second-person wording such as “your product” remains when it makes responsibility clearer. Terms such as `audience`, `AIDA`, `visual technique`, `deliberate`, `realistic`, `strongest`, `close-up` and the named partner roles remain when they carry subject meaning. The workflow may correct grammar, remove performative enthusiasm, replace conversational metaphors and make instructions more factual, but it must not weaken requirements or invent capabilities.

New copy required by the reset dialog, error mapping, keyboard guidance, completion states and curved-text explanation is added to the same corpus and receives a fresh unguided Plain Language then Claude Scrubber pass before source acceptance.

## Substantiated playtest corrections

### Market publication gate

`main.ts` currently names the price object `Selling price …`, while the campaign exporter requires `Market price …`. Both object creation and later price updates will use the canonical `Market price ${label}` accessible name. A regression test must prove that a product with a valid market price can pass publication validation.

The Creator bridge must not expose internal `HANDLER_ERROR` codes or raw exception messages in visible or announced student status. Known publication requirements map to specific, application-owned student messages. Unknown failures produce one neutral retry message while internal diagnostics retain the structured error for developers.

### Product price completion

The price panel gains a stable completed state after a valid student price is committed. It continues to explain that the audience and product evidence guide the decision; AI guidance remains optional and does not choose the price.

### Partner progress and document revisions

The account cloud status no longer displays its internal numeric revision. Document revision data remains available to synchronisation logic. When both partners have contributed, the next instruction names the active partner's current action rather than saying only `Follow the highlighted tool step.`

### Brief and editor layout

Opening the full brief suppresses or repositions the library-collapse control so the controls cannot overlap at 1280x800 or 1440x900. Closing the brief restores the prior control and focus state.

### Curved product words

The game states only what it does: words added to supported products follow a curved path in the editor and remain editable. It does not promise physically accurate wrapping around the final product or claim the final exported advertisement contains a different rendering model.

### Keyboard and focus

Real interactive Godot controls receive a clearly visible keyboard-focus style. The `01`, `02` and `03` stage labels remain non-interactive labels, not false tabs. A concise visible hint explains that Tab moves between controls and Enter or Space activates a selected control.

The web editor retains its operable DOM layer controls for canvas objects. A semantic status and instruction region mirrors the current editor state for assistive technology. This is not described as a complete alternate DOM editor; the residual screen-reader limitation is reported honestly.

### Live-room and AIDA findings

Live-room join errors distinguish an invalid room code from a temporary network/service failure when the existing typed error contract makes that distinction available.

The reported AIDA selected-state failure remains a reproduce-first item. The falsifier is: if a focused regression reproducing the reported selection sequence preserves the selected state and enables the next action, the hypothesis of a production AIDA state defect is dead and no behaviour change is made.

Fixture-only example prices, `example.invalid` links and automatic relogin behaviour are not production defects and will not be patched.

## Account reset

### Student interaction

A `Reset progress` button appears beside `Log out`. It opens an accessible modal dialog that:

- explains that the username and password will remain;
- names the data that will be removed;
- requires the exact uppercase word `RESET`;
- keeps the destructive confirmation disabled until the input matches exactly;
- supports Cancel and Escape;
- returns focus to `Reset progress` after cancellation;
- announces progress and retryable failure without dismissing the dialog.

### Client sequencing

Before the reset request, the account runtime enters `reset-pending`:

- autosave and cloud synchronisation stop accepting new work;
- the pending marker and operation UUID are stored in account-scoped local state;
- other tabs for the same account receive a `BroadcastChannel` reset-pending message and stop editing.

The client sends an authenticated same-origin `POST /api/account/reset` body with exactly the reset schema, version, operation ID and `confirmation: "RESET"`. The operation ID is reused after a lost response or partial failure.

Only after confirmed server completion does the client:

- close and delete the current account's draft IndexedDB database;
- close and delete the current account's cloud-outbox IndexedDB database;
- remove current-account cloud revision metadata;
- remove current-account Image Lab pending-idempotency entries;
- clear current-account Studio Coach session state;
- broadcast reset-complete; and
- reload into the authenticated empty game.

The login binding, username, password and authentication cookies remain. Failure is fail-closed: local progress is not cleared merely because a request was sent, and editing stays paused while a partially completed server reset is retried.

### Server sequencing

The same-origin Netlify endpoint authenticates the existing account session and checks the account-identity header before doing any work. It validates exact keys, schema/version, UUID and confirmation, and retains the existing classroom-NAT-safe rate-limit floor.

The operation is a replay-safe bounded saga across two storage systems:

1. Read and validate the authenticated account's bounded asset index.
2. Delete all progress rows for that authenticated user in one private Supabase RPC transaction.
3. Delete only the exact asset object keys listed by the validated index.
4. Delete the exact account index key.
5. Return `reset` only after both stores are empty.

Progress deletion is implemented by extending the existing private, service-role-only account RPC. Its security-definer function uses an empty search path, fully qualified objects, no PUBLIC/anon/authenticated execution grant and an explicit service-role grant. The repository migration is changed and tested, but not applied to live Supabase in this task.

The Netlify Blob repository gains bounded `delete` operations for validated account keys. It never uses `deleteAll`, prefix-wide deletion or an unbounded list. Missing rows and missing blobs count as success, so replay is safe. If asset cleanup fails after progress deletion, the endpoint reports an incomplete retryable result; repeating the same operation finishes cleanup without restoring progress.

## Verification

Each behaviour change is test-first. Focused tests cover exact copy, corpus completeness, the market-price contract, safe error mapping, completed price state, focus/layout behaviour, reset confirmation, reset quiescence, account-local cleanup, cross-tab notification, RPC security, bounded Blob deletion and replay after partial failure.

After the final integrated change:

- run TypeScript checking;
- run the full Vitest suite once;
- run the complete build-contract suite;
- assemble and verify a fresh web artifact without launching native Godot;
- deploy only to the dedicated unprotected `codex-browser-qa-harness` Netlify project;
- test the unique draft at exactly 1280x800 and 1440x900;
- capture screenshots and a neutral transcript for onboarding, product scale, editable curved words, price guidance, AIDA guidance, keyboard operation and visible focus, reset confirmation using fake QA state, local autosave, stubbed cloud-state presentation, service-worker control/offline reload, reflow and console errors.

The QA draft proves rendered UI, navigation, service-worker behaviour and deterministic stub integration only. It does not prove Safari behaviour, school-wifi reliability, live Supabase deletion, production Functions, visitor protection, edge rate limiting or production headers. Production and Supabase remain unchanged.
