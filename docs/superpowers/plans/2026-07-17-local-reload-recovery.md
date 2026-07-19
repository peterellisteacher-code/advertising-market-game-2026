# Local Hard-Reload Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development`. This shared dirty branch must not be committed, staged, cleaned, reset, or moved into another worktree; every task is verified in place and independently reviewed.

**Goal:** Restore a local-practice pair to the same saved campaign revision, pair state, pitch level, team identity, and level-lock state after a hard browser reload.

**Architecture:** One IndexedDB transaction is the sole recovery authority. It writes an immutable campaign revision, its referenced blobs, and one versioned active-practice checkpoint together. A sibling `window.AdMarketPractice` JSON bridge begins, resumes, checkpoints, and transitions local practice; Godot changes visible phase/lock state only after the browser acknowledges the atomic write. The campaign document owns pair state and `gameplay.stage`; the checkpoint owns only run identity, alias, lock, sequence, idempotent operation ID, and the exact document revision/hash it references.

**Tech Stack:** Godot 4.7 GDScript, TypeScript 7, Zod 4, IndexedDB, Vitest, Godot headless tests.

## Global Constraints

- Preserve all unrelated user and Claude work in the shared dirty worktree.
- Do not delete or move files and do not stage or commit changes.
- No recovery state is stored in `localStorage` or `user://`; campaign, blobs, and checkpoint commit atomically in the same IndexedDB database.
- Recovery is fail-closed: malformed, mismatched, stale-ahead, or impossible progression checkpoints leave the saved draft untouched and return to the lobby.
- Resume only local-practice pitch phases in this milestone: `invent`, `sell`, `irresistible`, and `publish-check`.
- Pair state and stage come only from the exact saved campaign document; the checkpoint may not overwrite either.
- Every new practice run gets unique run, document, session, and team IDs. Reusing `classroom-campaign` is forbidden.
- Only the last browser-acknowledged revision is guaranteed after process termination; the UI must distinguish Saving from Saved.
- Student-facing copy must avoid “assignment”, “unit”, and “task”.

---

### Task 1: Versioned Godot pitch snapshot

**Files:**
- Modify: `godot/src/game/GameRun.gd`
- Modify: `godot/tests/test_game_run.gd`

**Interfaces:**
- Produces: `GameRun.pitch_snapshot() -> Dictionary`
- Produces: `GameRun.restore_pitch_snapshot(value: Variant) -> bool`
- Produces: `GameRun.is_current_level_ready() -> bool`

- [ ] **Step 1: Write failing snapshot tests**

Add coverage that round-trips an alias, session/team IDs, `sell`, and ready stages `invent` + `sell`; rejects duplicates, skipped ready stages, unsafe IDs, unknown phases, and inconsistent ready-stage prefixes; and leaves an existing `GameRun` unchanged when restoration fails.

Expected snapshot shape:

```gdscript
{
    "contract": "pitch-run@1",
    "phase": "sell",
    "teamAlias": "Neon Narwhals",
    "sessionId": "local-session",
    "teamId": "local-team",
    "readyLevels": ["invent", "sell"]
}
```

- [ ] **Step 2: Run the focused Godot suite and confirm red**

Run:

```powershell
& 'C:\Users\Peter Ellis\Godot\godot_current_console.exe' --headless --path 'godot' --script 'res://tests/run_tests.gd'
```

Expected: the new snapshot assertions fail because the three methods do not exist.

- [ ] **Step 3: Implement strict atomic restore**

`restore_pitch_snapshot` must parse into local variables, enforce a prefix-compatible `readyLevels` sequence, allow only the four pitch phases, and assign fields only after all checks pass. `is_current_level_ready` returns the current `_ready_levels` flag. The final practice recovery path derives ready levels from the verified stage/lock checkpoint rather than trusting an independently persisted `readyLevels` value.

- [ ] **Step 4: Run the focused Godot suite and confirm green**

Expected: all existing `GameRun` behavior and the new snapshot cases pass.

---

### Task 2: Harden the creator bridge and deterministic script order

**Files:**
- Modify: `web/src/bridge/contracts.ts`
- Modify: `web/src/bridge/creator-public-api.ts`
- Modify: `web/src/bridge/creator-public-api.test.ts`
- Modify: `web/src/main.ts`
- Modify: `web/src/main.test.ts`
- Modify: `godot/src/creator/CreatorBridge.gd`
- Modify: `godot/src/creator/CreatorHost.gd`
- Modify: `godot/tests/test_creator_bridge.gd`
- Modify: `scripts/build-web.mjs`
- Modify: `scripts/build-web.test.mjs`
- Modify: `scripts/verify-web-export.mjs`

**Interfaces:**
- Produces: creator method `loadLatest` with payload `{ documentId: string }`
- Produces: `CreatorBridgeHandler.loadLatest(documentId: string): CampaignDocumentV1 | null`
- Produces: `CreatorBridge.load_latest(document_id: String) -> String`
- Produces: `CreatorHost.latest_draft_received(document: Variant)` and `load_latest(document_id: String) -> String`
- Guarantees: Studio bridge loads before `index.js`, which loads before `engine.startGame()`

- [ ] **Step 1: Write failing TypeScript and Godot bridge tests**

Assert that `loadLatest` validates a nonblank bounded document ID, returns `null` when absent, returns the latest complete draft when present, rejects a returned document whose ID differs from the requested ID, and rejects malformed non-null documents.

Request shape:

```json
{
  "contract": "creator-bridge@1",
  "requestId": "creator-7",
  "method": "loadLatest",
  "payload": { "documentId": "classroom-campaign" }
}
```

- [ ] **Step 2: Run focused tests and confirm red**

Run:

```powershell
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run 'web\src\bridge\creator-public-api.test.ts' 'web\src\main.test.ts'
& 'C:\Users\Peter Ellis\Godot\godot_current_console.exe' --headless --path 'godot' --script 'res://tests/run_tests.gd'
```

Expected: the new method/interface assertions fail.

- [ ] **Step 3: Implement the additive bridge method**

`BrowserCreatorHandler.loadLatest` calls the existing `DraftStore.load(documentId)` and returns a structured clone of `stored.document` or `null`; it does not create object URLs or open the editor. The GDScript bridge validates non-null responses with `CampaignDocument.validate_bridge_shape` and verifies returned `documentId` against request context before emitting success.

- [ ] **Step 4: Reject mismatched or regressing active state**

Track active document ID and revision in the Godot creator bridge. A `getState` response for another document or an older revision fails before reaching `Main`.

- [ ] **Step 5: Make browser bridge startup deterministic**

Recognise both `index.js` and `./index.js` during assembly. Verify `studio.js < index.js < engine.startGame()` and test the real bare-tag spelling plus a deliberately reversed artifact.

- [ ] **Step 6: Run focused TypeScript, Node, typecheck, and Godot tests**

Expected: bridge tests, `main.test.ts`, `tsc --noEmit`, and the Godot suite pass.

---

### Task 3: Atomic local-practice repository

**Files:**
- Modify: `web/src/persistence/draft-store.ts`
- Modify: `web/src/persistence/draft-store.test.ts`
- Create: `web/src/persistence/local-practice.ts`

**Interfaces:**
- Produces: `LocalPracticeCheckpointV1` and `LocalPracticeRecoveryV1`
- Produces: exact-revision load, begin, resume, editor commit, lock, and stage-transition operations
- Guarantees: compare-and-swap sequence/revision, idempotent `operationId`, atomic checkpoint/document/blob writes

- [ ] **Step 1: Write failing repository tests**

Cover:

1. begin creates unique IDs and one exact revision/checkpoint transaction;
2. resume returns the exact referenced revision and blobs;
3. stale CAS and reused operation ID with different input fail without writes;
4. exact retry returns the prior result once;
5. injected document/blob/checkpoint failure retains the prior recovery state;
6. malformed pointer, identity/hash/stage mismatch, room mode, and missing/wrong-MIME blob fail closed without deletion;
7. database-v1 upgrade preserves existing drafts.

- [ ] **Step 2: Run the Godot suite and confirm red**

Expected: recovery assertions fail because `Main` does not load or save checkpoints.

- [ ] **Step 3: Implement one transactional authority**

Upgrade the draft DB with checkpoint and operation stores. Store immutable blob bodies by document/blob key rather than copying bytes into every revision. Validate checkpoint identity, exact revision/hash, offline mode, stage, and referenced blobs on every resume.

- [ ] **Step 4: Implement atomic transitions and idempotence**

Lock and stage changes allocate the next campaign revision and update its checkpoint in one transaction. Exact operation retries return the original recovery; stale revision/sequence or altered reuse fails without mutation.

- [ ] **Step 5: Run focused persistence verification**

Expected: all old immutable-revision/blob tests plus the new atomic recovery matrix pass.

---

### Task 4: Strict practice bridge across browser and Godot

**Files:**
- Create: `web/src/bridge/practice-contracts.ts`
- Create: `web/src/bridge/practice-public-api.ts`
- Create: `web/src/bridge/practice-public-api.test.ts`
- Modify: `web/src/main.ts`
- Create: `godot/src/game/PracticeBridge.gd`
- Create: `godot/src/game/transport/WebPracticeTransport.gd`
- Create: `godot/tests/test_practice_bridge.gd`

- [ ] Define strict `practice-run@1` methods for begin, resume, checkpoint, lock, and transition.
- [ ] Install `window.AdMarketPractice` synchronously with the creator bridge.
- [ ] Validate every response envelope, identity, revision, sequence, stage, pair state, and lock invariant on both sides.
- [ ] Ignore duplicate/late responses by request ID and startup generation; never retry a state-changing request implicitly.

---

### Task 5: Recovery-gated shell and serialized creator autosave

**Files:**
- Modify: `web/src/main.ts`
- Modify: `web/src/game/pair-game-controller.ts`
- Modify: `web/src/main.test.ts`
- Modify: `web/src/game/pair-game-controller.test.ts`
- Modify: `godot/src/main/Main.gd`
- Modify: `godot/tests/test_game_shell.gd`

- [ ] Keep Practice disabled/pending until resume resolves; never show a blank run first.
- [ ] Restore exact alias, campaign, pair role/counters, stage, and lock with creator closed.
- [ ] Make lock/advance UI transactional: mutate visible state only after browser acknowledgement.
- [ ] Serialize semantic/canvas/pair autosaves and show Saving/Saved revision feedback.
- [ ] Preserve data and return to a usable lobby on invalid recovery; never clear a bad checkpoint automatically.
- [ ] Keep live-room and post-publication market recovery outside this milestone.

---

### Task 6: Production rebuild and hard-reload proof

**Files:**
- Modify only if a regression is discovered by the tests above.

**Interfaces:**
- Consumes the complete recovery path from Tasks 1–5.

- [ ] **Step 1: Run full source verification**

Run TypeScript typecheck, all Vitest tests with one worker, the 51 Node build-contract tests, and the Godot suite.

- [ ] **Step 2: Re-export and assemble non-destructively**

Export Godot, build the Vite studio bundle, assemble all required local catalogues, and run `scripts/verify-web-export.mjs build/web`. Do not invoke `pnpm run build`.

- [ ] **Step 3: Browser-reproduce recovery on a fresh origin**

Start local practice, complete a two-role Level 1 campaign including a local raster, wait for Saved, lock, advance to Level 2, hard reload, and assert the exact acknowledged revision/hash, alias, campaign content/blob, pair counters/active role, Level 2 phase, and unlocked Level 2 state. Repeat with Level 1 locked and assert Next remains enabled after reload.

- [ ] **Step 4: Independent milestone review**

Run one fresh neutral coding Fusion request with the plan requirements, final diff/excerpts, test evidence, and browser evidence. Resolve any required correctness finding once; do not enter an unbounded review loop.

## Self-Review

- Spec coverage: campaign/revision, pair state, level, alias, and lock state share one atomic persistence authority and each has a test.
- Placeholder scan: no TBD/TODO or deferred implementation appears in the four tasks.
- Type consistency: `loadLatest`, `pitch_snapshot`, `restore_pitch_snapshot`, `local-practice-checkpoint@1`, and `practice-run@1` names are used consistently.
- Scope boundary: live-room cookie resume and market/reveal restoration remain separate reliability milestones; this plan does not claim them.
