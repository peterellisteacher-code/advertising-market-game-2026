# Assignment Sandbox, Drawing Upload, and Dual AIDA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a durable assignment sandbox where students can plan Product AIDA and Advertisement AIDA separately, upload and edit a photographed drawing, and use the teacher-controlled Fal.ai workflow to create a recoverable realistic advertisement.

**Architecture:** Extend the existing version-1 campaign document with defaulted sandbox planning fields, keep the existing Fabric canvas/blob persistence path, and add focused UI modules for the assignment planner and local image upload. The Godot lobby opens a distinct account-scoped sandbox document through the existing creator bridge; the Netlify Image Lab keeps its current allowance and reconciliation system while discriminating product and advertisement realisation requests with separate server-owned prompts.

**Tech Stack:** Godot 4/GDScript, TypeScript 7, Zod 4, Fabric 7, Vitest/jsdom, Netlify Functions/Blobs, Fal.ai GPT Image 2 Edit, pnpm 11.

## Global Constraints

- Preserve the guided Agency campaign, its mission locks, product Make It Real workflow, publication checks, and return behaviour.
- Desktop/laptop only; keyboard plus mouse/trackpad; verify at 1280×800 and 1440×900.
- Keep uploaded originals and pre-generation canvas state recoverable; no destructive replacement.
- Fal.ai remains authenticated, teacher-enabled, allowance-limited, idempotent, and server-prompted.
- Do not mutate Supabase unless implementation proves the existing JSON/blob contracts cannot represent the data; reassess before any such mutation.
- Native Godot launches remain quarantined; use every applicable GodotIQ capability and preserve STATIC_PRO_READY.
- Never stage or modify `godot/project.godot`, the six protected salience `.png.import` files, user QA captures, `.claude/`, `.playwright-cli/`, `.playwright-mcp/`, or `release-evidence/`.
- Use focused tests while iterating, then run the final integrated gates once in the mandated order.
- Complete student-facing copy only after behaviour is stable; run the frozen plain-language route exactly once on the full changed corpus, then the repository Claude-scrubber MICROCOPY route exactly once if callable.

---

### Task 1: Backwards-compatible sandbox document model

**Files:**
- Create: `web/src/game/assignment-plan.ts`
- Create: `web/src/game/assignment-plan.test.ts`
- Modify: `web/src/domain/campaign-document.ts`
- Modify: `web/src/domain/campaign-document.test.ts`
- Modify: `web/src/persistence/draft-migrations.test.ts`

**Interfaces:**
- Produces: `WorkspaceMode`, `AssignmentPlanV1`, `AssignmentAidaPlanV1`, `ASSIGNMENT_DESIRE_VALUES`, `AssignmentPlanSchema`, and `createBlankAssignmentPlan()`.
- Produces: `CampaignDocumentV1.workspaceMode` and `CampaignDocumentV1.assignmentPlan` with defaults for older documents.
- Preserves: `CampaignDocumentV1.strategy.aidaPlan` as Advertisement AIDA.

- [ ] **Step 1: Write failing assignment-plan model tests**

Create tests that prove the page-5 value catalogue is exact and immutable, the blank plan has every required field, and Zod rejects unknown value IDs and overlong text.

```ts
expect(ASSIGNMENT_DESIRE_VALUES.map(({ id }) => id)).toEqual([
  "responsibility:environmentalism", "responsibility:sustainability",
  "responsibility:repairability", "responsibility:durability",
  "responsibility:reuse", "responsibility:recycling",
  "responsibility:ethical-production", "responsibility:local-production",
  "practicality:portability", "practicality:convenience",
  "practicality:speed", "practicality:reliability", "practicality:safety",
  "practicality:simplicity", "practicality:comfort", "practicality:affordability",
  "identity:individuality", "identity:belonging", "identity:status",
  "identity:style", "identity:luxury", "identity:tradition",
  "identity:nostalgia", "identity:self-expression",
  "experience:holidays", "experience:celebration", "experience:adventure",
  "experience:creativity", "experience:entertainment", "experience:relaxation",
  "experience:connection", "experience:discovery",
  "performance:power", "performance:precision", "performance:efficiency",
  "performance:innovation", "performance:endurance", "performance:control",
  "performance:achievement", "performance:quality",
  "care:health", "care:wellbeing", "care:accessibility", "care:protection",
  "care:family", "care:education", "care:independence", "care:security"
]);
expect(createBlankAssignmentPlan()).toEqual({
  productFunction: "", targetAudience: "", advertisingLocation: "",
  featureToEmphasise: "", differenceFromAlternatives: "", materials: "",
  estimatedProductionCost: "", salePrice: "", desireValueIds: [],
  primaryDesireValueId: "",
  productAidaPlan: { attention: "", interest: "", desire: "", action: "" }
});
```

- [ ] **Step 2: Run the focused tests and observe RED**

Run:

```powershell
corepack pnpm exec vitest run web/src/game/assignment-plan.test.ts web/src/domain/campaign-document.test.ts web/src/persistence/draft-migrations.test.ts --no-cache --configLoader runner --maxWorkers=1
```

Expected: failure because the assignment model and document fields do not exist.

- [ ] **Step 3: Implement the model and document defaults**

Use strict schemas and shared bounded AIDA fields:

```ts
export const WORKSPACE_MODES = ["guided", "assignment-sandbox"] as const;
export type WorkspaceMode = typeof WORKSPACE_MODES[number];

export const AssignmentAidaPlanSchema = z.object({
  attention: z.string().max(280),
  interest: z.string().max(280),
  desire: z.string().max(280),
  action: z.string().max(280)
}).strict();

export const AssignmentPlanSchema = z.object({
  productFunction: z.string().max(280),
  targetAudience: z.string().max(160),
  advertisingLocation: z.string().max(160),
  featureToEmphasise: z.string().max(280),
  differenceFromAlternatives: z.string().max(280),
  materials: z.string().max(280),
  estimatedProductionCost: z.string().max(80),
  salePrice: z.string().max(80),
  desireValueIds: z.array(z.enum(ASSIGNMENT_DESIRE_VALUE_IDS)).max(12),
  primaryDesireValueId: z.union([z.literal(""), z.enum(ASSIGNMENT_DESIRE_VALUE_IDS)]),
  productAidaPlan: AssignmentAidaPlanSchema
}).strict();
```

Add to `CampaignDocumentSchema`:

```ts
workspaceMode: z.enum(WORKSPACE_MODES).default("guided"),
assignmentPlan: AssignmentPlanSchema.default(createBlankAssignmentPlan()),
```

Ensure `createBlankCampaignDocument()` explicitly sets both fields.

- [ ] **Step 4: Prove old and new documents parse correctly**

Add tests that delete both new fields from a legacy fixture, parse it, and assert guided/blank defaults; then round-trip a populated sandbox plan and assert every field survives unchanged. Confirm guided readiness calculations still use the original product, brief, strategy, and evidence fields.

- [ ] **Step 5: Run focused tests and typecheck**

```powershell
corepack pnpm exec vitest run web/src/game/assignment-plan.test.ts web/src/domain/campaign-document.test.ts web/src/persistence/draft-migrations.test.ts --no-cache --configLoader runner --maxWorkers=1
npx tsc --noEmit
```

Expected: all selected tests pass; TypeScript reports zero errors.

- [ ] **Step 6: Commit Task 1 with an explicit allowlist**

```powershell
git add -- web/src/game/assignment-plan.ts web/src/game/assignment-plan.test.ts web/src/domain/campaign-document.ts web/src/domain/campaign-document.test.ts web/src/persistence/draft-migrations.test.ts
git diff --cached --check
git diff --cached --name-status
git commit -m "feat(studio): add assignment sandbox document model"
```

---

### Task 2: Sandbox access policy and assignment planner

**Files:**
- Create: `web/src/game/assignment-planner-panel.ts`
- Create: `web/src/game/assignment-planner-panel.test.ts`
- Modify: `web/src/game/creator-level-access.ts`
- Modify: `web/src/game/creator-level-access.test.ts`
- Modify: `web/src/game/aida-playbook-panel.ts`
- Modify: `web/src/game/aida-playbook-panel.test.ts`
- Modify: `web/src/ui/editor-shell.ts`
- Modify: `web/src/ui/editor-shell.test.ts`
- Modify: `web/src/main.ts`
- Modify: `web/src/main.test.ts`

**Interfaces:**
- Produces: `AssignmentPlannerPanelState` and `AssignmentPlannerCommitHandler`.
- Changes: `applyCreatorLevelAccess(root, stage, workspaceMode = "guided")` and `creatorStageAllows(stage, feature, workspaceMode = "guided")`.
- Produces in `BrowserCreatorHandler`: `commitAssignmentPlan(productName, plan)`.
- Changes AIDA commit semantics only for `assignment-sandbox`: a selected object is optional; guided mode still requires one.

- [ ] **Step 1: Write RED access-policy tests**

Prove guided access is unchanged and sandbox makes every declared creator feature available:

```ts
applyCreatorLevelAccess(root, "invent", "guided");
expect(aida.dataset.creatorFeatureAvailable).toBe("false");

applyCreatorLevelAccess(root, "invent", "assignment-sandbox");
expect([...root.querySelectorAll("[data-creator-feature]")]
  .every((node) => (node as HTMLElement).dataset.creatorFeatureAvailable === "true"))
  .toBe(true);
expect(root.dataset.workspaceMode).toBe("assignment-sandbox");
```

- [ ] **Step 2: Write RED planner tests**

Render the planner with a populated state, verify all page-5 labels and six value families, change one field, select two Desire values and one primary value, and assert one complete immutable commit payload. Test keyboard/label associations and that a primary value must also be selected.

- [ ] **Step 3: Run focused tests and observe the intended failures**

```powershell
corepack pnpm exec vitest run web/src/game/creator-level-access.test.ts web/src/game/assignment-planner-panel.test.ts web/src/game/aida-playbook-panel.test.ts web/src/ui/editor-shell.test.ts web/src/main.test.ts --no-cache --configLoader runner --maxWorkers=1
```

- [ ] **Step 4: Implement sandbox access without altering guided access**

Use a mode-aware access set:

```ts
const SANDBOX_FEATURES = Object.freeze(["product", "price", "aida", "route", "coach"]);
const access = new Set(workspaceMode === "assignment-sandbox"
  ? SANDBOX_FEATURES
  : FEATURE_ACCESS[stage]);
root.dataset.workspaceMode = workspaceMode;
```

Mark campaign-only shell regions with `data-guided-only` and toggle them via `hidden`/`inert`; expose a compact **ASSIGNMENT SANDBOX** label and planner host with `data-sandbox-only`.

- [ ] **Step 5: Implement the planner as a focused module**

Define a single save payload:

```ts
export interface AssignmentPlannerPanelState {
  readonly productName: string;
  readonly plan: AssignmentPlanV1;
}

export type AssignmentPlannerCommitHandler = (
  productName: string,
  plan: AssignmentPlanV1
) => void | Promise<void>;
```

Render four accessible sections: Define the product, Product AIDA, Values for Desire, and a short handoff to the existing Advertisement AIDA technique deck. Commit on field `change` and selection changes, announce `Saving…` then `Saved`, and restore focus to the changed control after redraw.

- [ ] **Step 6: Wire the handler and sandbox AIDA semantics**

Add `commitAssignmentPlan()` as one history transaction that updates `product.name` and `assignmentPlan`, refreshes the planner/Image Lab context, and schedules autosave. Change `commitAidaPlan()` to:

```ts
const sandbox = current.workspaceMode === "assignment-sandbox";
const selectedObjectId = runtime.adapter.getSelectedObjectId();
if (!sandbox && selectedObjectId === null) {
  throw new Error("Select the item that carries this AIDA choice first.");
}
// Always save strategy.aidaPlan. In sandbox, update evidence only when an item is selected.
```

Set the AIDA panel heading/copy to **Advertisement AIDA** in sandbox and keep the existing guided label and selected-evidence language in guided mode.

- [ ] **Step 7: Run focused tests and typecheck**

```powershell
corepack pnpm exec vitest run web/src/game/creator-level-access.test.ts web/src/game/assignment-planner-panel.test.ts web/src/game/aida-playbook-panel.test.ts web/src/ui/editor-shell.test.ts web/src/main.test.ts --no-cache --configLoader runner --maxWorkers=1
npx tsc --noEmit
```

- [ ] **Step 8: Commit Task 2 explicitly**

```powershell
git add -- web/src/game/assignment-planner-panel.ts web/src/game/assignment-planner-panel.test.ts web/src/game/creator-level-access.ts web/src/game/creator-level-access.test.ts web/src/game/aida-playbook-panel.ts web/src/game/aida-playbook-panel.test.ts web/src/ui/editor-shell.ts web/src/ui/editor-shell.test.ts web/src/main.ts web/src/main.test.ts
git diff --cached --check
git diff --cached --name-status
git commit -m "feat(studio): add assignment planner and sandbox access"
```

---

### Task 3: Safe local drawing upload and recoverable placement

**Files:**
- Create: `web/src/uploads/student-image-upload.ts`
- Create: `web/src/uploads/student-image-upload.test.ts`
- Create: `web/src/uploads/student-image-upload-panel.ts`
- Create: `web/src/uploads/student-image-upload-panel.test.ts`
- Modify: `web/src/catalogue/catalogue-runtime.ts`
- Modify: `web/src/catalogue/catalogue-runtime.test.ts`
- Modify: `web/src/ui/editor-shell.ts`
- Modify: `web/src/ui/editor-shell.test.ts`
- Modify: `web/src/main.ts`
- Modify: `web/src/main.test.ts`
- Modify: `web/src/account/cloud-asset-adapter.test.ts`

**Interfaces:**
- Produces: `prepareStudentImageUpload(file, dependencies?) -> Promise<PreparedStudentImageUpload>`.
- Produces: `StudentImageUploadPanel` with `onPlace(input)` callback.
- Extends: raster placement stage with `student-upload`, preserving `object-forge` and `make-it-real`.
- Produces: explicit `student-upload` asset reference plus the existing `local-blob` reference.

- [ ] **Step 1: Write RED upload-validation tests**

Cover PNG, JPEG and WebP; empty, over-12-MiB, MIME/signature mismatch and decoder failure; 4096-pixel longest-edge downscaling; metadata-free PNG output; and unchanged source aspect ratio.

```ts
const prepared = await prepareStudentImageUpload(
  new File([jpegBytes], "shoe-sketch.jpg", { type: "image/jpeg" }),
  fakeProcessor({ width: 6000, height: 3000 })
);
expect(prepared.title).toBe("Shoe sketch");
expect(prepared.width).toBe(4096);
expect(prepared.height).toBe(2048);
expect(prepared.blob.type).toBe("image/png");
```

- [ ] **Step 2: Write RED panel and placement tests**

Assert the file input has `accept="image/png,image/jpeg,image/webp"`; a successful selection places exactly one raster and clears the input; a failure leaves the canvas callback untouched and exposes an alert. Extend catalogue tests to prove upload references are not labelled AI-generated, reload from local blobs works, Delete removes the image, and Undo/Redo restores/removes it.

- [ ] **Step 3: Run focused tests and confirm RED**

```powershell
corepack pnpm exec vitest run web/src/uploads/student-image-upload.test.ts web/src/uploads/student-image-upload-panel.test.ts web/src/catalogue/catalogue-runtime.test.ts web/src/ui/editor-shell.test.ts web/src/main.test.ts web/src/account/cloud-asset-adapter.test.ts --no-cache --configLoader runner --maxWorkers=1
```

- [ ] **Step 4: Implement bounded local normalisation**

Decode locally, verify the decoded type/dimensions, scale the longest edge to at most 4096 while preserving aspect ratio, draw to an origin-clean canvas, and encode PNG. Dependency-inject decoding and encoding so tests do not depend on browser canvas internals. Always close an `ImageBitmap` in `finally`.

- [ ] **Step 5: Implement the independent upload panel**

Place it above Image Lab so it remains available when Fal.ai is disabled or allowance is zero. Copy structure:

```html
<section aria-labelledby="student-upload-heading">
  <h3 id="student-upload-heading">Upload your drawing or mockup</h3>
  <p>Add a PNG, JPEG or WebP. It stays on this device/account until you explicitly use an AI action.</p>
  <label>Choose an image <input type="file" accept="image/png,image/jpeg,image/webp"></label>
  <p role="status" aria-live="polite"></p>
</section>
```

- [ ] **Step 6: Place through the durable blob path**

Route the prepared PNG through the existing placement queue using stage `student-upload`. Record:

```ts
{ kind: "student-upload", version: 1, objectId, assetId, title }
{ kind: "local-blob", objectId, assetId, blobKey, mimeType: "image/png" }
```

Do not auto-fill or flatten it. The upload starts selected; the existing **Fill ad**, Items, Lock, Hide, Delete, Undo, Redo and autosave systems do the editing work.

- [ ] **Step 7: Run focused tests and typecheck**

```powershell
corepack pnpm exec vitest run web/src/uploads/student-image-upload.test.ts web/src/uploads/student-image-upload-panel.test.ts web/src/catalogue/catalogue-runtime.test.ts web/src/ui/editor-shell.test.ts web/src/main.test.ts web/src/account/cloud-asset-adapter.test.ts --no-cache --configLoader runner --maxWorkers=1
npx tsc --noEmit
```

- [ ] **Step 8: Commit Task 3 explicitly**

```powershell
git add -- web/src/uploads/student-image-upload.ts web/src/uploads/student-image-upload.test.ts web/src/uploads/student-image-upload-panel.ts web/src/uploads/student-image-upload-panel.test.ts web/src/catalogue/catalogue-runtime.ts web/src/catalogue/catalogue-runtime.test.ts web/src/ui/editor-shell.ts web/src/ui/editor-shell.test.ts web/src/main.ts web/src/main.test.ts web/src/account/cloud-asset-adapter.test.ts
git diff --cached --check
git diff --cached --name-status
git commit -m "feat(studio): upload editable student mockups"
```

---

### Task 4: Advertisement-specific Fal.ai realisation

**Files:**
- Modify: `web/src/ai-image/image-lab-client.ts`
- Modify: `web/src/ai-image/image-lab-client.test.ts`
- Modify: `web/src/ai-image/image-lab-panel.ts`
- Modify: `web/src/ai-image/image-lab-panel.test.ts`
- Modify: `web/src/ai-image/image-lab-runtime.ts`
- Modify: `web/src/ai-image/image-lab-runtime.test.ts`
- Modify: `web/src/main.ts`
- Modify: `web/src/main.test.ts`
- Modify: `netlify/functions/lib/fal-image-policy.ts`
- Modify: `netlify/functions/lib/fal-image-policy.test.ts`
- Modify: `netlify/functions/image-lab-jobs.test.ts`
- Modify: `docs/operations/image-lab.md`

**Interfaces:**
- Produces request union: `ProductRealisationJobRequest | AdvertisementRealisationJobRequest`, both with `stage: "realise"` and one shared allowance.
- Produces: `AdvertisementRealisationContext` with bounded product, audience, location and Advertisement AIDA fields.
- Produces: `ImageLabActions.makeAdvertisementReal(pair, signal)`.
- Preserves: current product realisation payload/profile and historical job reconciliation.

- [ ] **Step 1: Write RED client/runtime/panel tests**

Assert product and advertisement requests have disjoint exact fields; the ad action appears only in sandbox mode; both use the remaining Make It Real counter; the ad runtime exports the current canvas, reads the current assignment context once, reuses idempotency/reconcile behaviour, and places a full-canvas result with profile `make-it-real-advertisement-v1`.

```ts
expect(client.created[0]).toEqual({
  stage: "realise",
  mode: "advertisement",
  idempotencyKey: generationId,
  designDataUrl: prepared.dataUrl,
  context: {
    productName: "Trail Light",
    productFunction: "Lights a path without disposable batteries",
    targetAudience: "Teen campers",
    advertisingLocation: "Outdoor magazine",
    attention: "Lead with the emergency beam",
    interest: "Show solar charging",
    desire: "Imagine arriving safely after dark",
    action: "Try it at the camping expo"
  }
});
```

- [ ] **Step 2: Write RED server-policy tests**

Assert exact nested keys, bounded strings, no control characters, no extra fields, existing 1024×576 input and 1280×720 output, server-owned model/profile, literal quoting of prompt-like student text, and a prompt that asks for a realistic advertisement without invented branding, claims, people or text.

- [ ] **Step 3: Run focused tests and observe RED**

```powershell
node scripts/build-netlify-functions.mjs
corepack pnpm exec vitest run web/src/ai-image/image-lab-client.test.ts web/src/ai-image/image-lab-panel.test.ts web/src/ai-image/image-lab-runtime.test.ts web/src/main.test.ts netlify/functions/lib/fal-image-policy.test.ts netlify/functions/image-lab-jobs.test.ts --no-cache --configLoader runner --maxWorkers=1
```

- [ ] **Step 4: Implement the discriminated request contract**

Keep the current product request valid and add:

```ts
export interface AdvertisementRealisationJobRequest {
  readonly stage: "realise";
  readonly mode: "advertisement";
  readonly idempotencyKey: string;
  readonly designDataUrl: string;
  readonly context: AdvertisementRealisationContext;
}
```

Use separate exact-field sets for `mode: "product"` and `mode: "advertisement"`. Historical job tokens remain readable because reconciliation is keyed by the signed server job record, not by reparsing a new browser request.

- [ ] **Step 5: Implement the server-owned advertisement prompt**

Compose each student field with `JSON.stringify` and explicitly label it as data. Preserve composition, product identity, colour plan and intentional marks; request readable existing wording but prohibit new text, brands, unsupported claims, people, watermarks and signatures. Keep `openai/gpt-image-2/edit`, high quality, one PNG and the current concrete dimensions.

- [ ] **Step 6: Wire panel/runtime and non-destructive placement**

In sandbox mode render **Make the product real** and **Make this advertisement realistic** as distinct buttons. Both consume the same `realise` allowance and pending-operation slot. Build the ad context from the current document immediately before submission. Place the result with `stage: "make-it-real"`, profile `make-it-real-advertisement-v1`; the existing placement path fills the canvas as a new top layer and the history transaction makes one Undo restore the prior canvas.

- [ ] **Step 7: Update the operational contract**

Document both modes, exact fields, shared allowance, image dimensions, profile IDs, output behaviour, text-verification warning, and pre-class test procedure in `docs/operations/image-lab.md`.

- [ ] **Step 8: Run focused tests and typecheck**

```powershell
node scripts/build-netlify-functions.mjs
corepack pnpm exec vitest run web/src/ai-image/image-lab-client.test.ts web/src/ai-image/image-lab-panel.test.ts web/src/ai-image/image-lab-runtime.test.ts web/src/main.test.ts netlify/functions/lib/fal-image-policy.test.ts netlify/functions/image-lab-jobs.test.ts --no-cache --configLoader runner --maxWorkers=1
npx tsc --noEmit
```

- [ ] **Step 9: Commit Task 4 explicitly**

```powershell
git add -- web/src/ai-image/image-lab-client.ts web/src/ai-image/image-lab-client.test.ts web/src/ai-image/image-lab-panel.ts web/src/ai-image/image-lab-panel.test.ts web/src/ai-image/image-lab-runtime.ts web/src/ai-image/image-lab-runtime.test.ts web/src/main.ts web/src/main.test.ts netlify/functions/lib/fal-image-policy.ts netlify/functions/lib/fal-image-policy.test.ts netlify/functions/image-lab-jobs.test.ts docs/operations/image-lab.md
git diff --cached --check
git diff --cached --name-status
git commit -m "feat(image-lab): realise student advertisements"
```

---

### Task 5: Godot lobby entry, recovery and safe return

**Files:**
- Create: `godot/src/main/assignment_sandbox_document.gd`
- Create: `godot/tests/test_assignment_sandbox_document.gd`
- Modify: `godot/src/main/Main.tscn`
- Modify: `godot/src/main/main.gd`
- Modify: `godot/tests/test_creator_host.gd`
- Modify: `scripts/godot-bridge-contract.test.mjs`

**Interfaces:**
- Produces: `AdMarketAssignmentSandboxDocument.create(base_document) -> Dictionary` and `matches(document) -> bool`.
- Adds: `%OpenAssignmentSandbox` button.
- Adds main state flags for one pending sandbox draft load and one open sandbox session.
- Reuses: `creator_host.load_latest("assignment-sandbox")`, `latest_draft_received`, `open_creator(document)`, and normal save-before-close.

- [ ] **Step 1: Run applicable GodotIQ impact checks before signatures or scene wiring**

Call `file_context` for `res://src/main/main.gd`, `res://src/main/Main.tscn`, `res://src/creator/creator_host.gd`, and the affected tests. Call `impact_check` for any changed function signature; call `dependency_graph` and scoped `signal_map` for `main.gd`/`creator_host.gd`. Record the affected callers before editing.

- [ ] **Step 2: Write the RED pure-document test**

Prove the helper creates a distinct offline identity, preserves the canvas contract, sets sandbox mode, unlock stage, blank assignment plan, and never mutates its input:

```gdscript
var base := {
    "documentId": "classroom-campaign",
    "sessionId": "local-session",
    "mode": "offline",
    "workspaceMode": "guided",
    "gameplay": {"stage": "invent"}
}
var sandbox: Dictionary = AssignmentSandboxDocument.create(base)
assert(sandbox["documentId"] == "assignment-sandbox")
assert(sandbox["sessionId"] == "assignment-sandbox-session")
assert(sandbox["workspaceMode"] == "assignment-sandbox")
assert(sandbox["gameplay"]["stage"] == "publish-check")
assert(base["documentId"] == "classroom-campaign")
```

- [ ] **Step 3: Run the focused Godot suite and observe RED**

```powershell
$env:ADMARKET_GODOT_TEST_SUITE='res://tests/test_assignment_sandbox_document.gd'
npx pnpm test:godot
Remove-Item Env:ADMARKET_GODOT_TEST_SUITE
```

The `Remove-Item` here removes only the temporary process environment variable, not a file or folder.

- [ ] **Step 4: Implement the sandbox document helper through GodotIQ `script_ops`**

Start from a deep duplicate of `_blank_campaign_document()`, then set only sandbox identity/mode/stage and ensure assignment defaults exist. Keep this logic out of the 1900-line main script.

- [ ] **Step 5: Add the lobby action and state machine**

Using GodotIQ scene/node operations, add the button beside the existing Start action. In `main.gd`:

```gdscript
func _open_assignment_sandbox() -> void:
    if _sandbox_load_pending or bool(creator_host.get("creator_is_open")):
        return
    _sandbox_load_pending = true
    status.text = "Opening your saved assignment sandbox."
    if creator_host.load_latest("assignment-sandbox").is_empty():
        _sandbox_load_pending = false
        status.text = "The assignment sandbox could not be opened. Try again."
```

Route `latest_draft_received` to sandbox handling before live-team hydration. Accept only a matching sandbox document; open a new sandbox when the result is null; reject a mismatched document without overwriting it. Branch `creator_state_received` and `creator_closed` while `_sandbox_open` so Agency progress is untouched and close returns to the lobby.

- [ ] **Step 6: Add bridge/host regression tests**

Prove the load request uses exactly `assignment-sandbox`, null creates a new sandbox, a matching draft reopens, a mismatched draft is rejected, double-click cannot issue duplicate loads, and close still saves before returning. Prove normal live-team hydration and guided close paths remain unchanged.

- [ ] **Step 7: Validate each changed Godot file**

After each script change, run GodotIQ `validate(target=file, detail="brief")` and `check_errors(scope=file)`. After the scene/save, rerun `file_context`; then run project validation, project error check and `signal_map(find="orphans")`. Do not launch Godot directly.

- [ ] **Step 8: Run focused and complete Godot tests**

```powershell
$env:ADMARKET_GODOT_TEST_SUITE='res://tests/test_assignment_sandbox_document.gd'
npx pnpm test:godot
Remove-Item Env:ADMARKET_GODOT_TEST_SUITE
npx pnpm test:godot
```

- [ ] **Step 9: Commit Task 5 with the exact allowlist**

```powershell
git add -- godot/src/main/assignment_sandbox_document.gd godot/tests/test_assignment_sandbox_document.gd godot/src/main/Main.tscn godot/src/main/main.gd godot/tests/test_creator_host.gd scripts/godot-bridge-contract.test.mjs
git diff --cached --check
git diff --cached --name-status
git commit -m "feat(game): open a durable assignment sandbox"
```

---

### Task 6: Stable student copy, desktop layout and accessibility

**Files:**
- Modify: `web/src/game/student-copy.ts`
- Modify: `web/src/game/assignment-planner-panel.ts`
- Modify: `web/src/uploads/student-image-upload-panel.ts`
- Modify: `web/src/ai-image/image-lab-panel.ts`
- Modify: `web/src/ui/editor-shell.ts`
- Modify: `web/src/styles/editor.css`
- Modify: `web/src/game/assignment-planner-panel.test.ts`
- Modify: `web/src/uploads/student-image-upload-panel.test.ts`
- Modify: `web/src/ai-image/image-lab-panel.test.ts`
- Modify: `web/src/ui/editor-shell.test.ts`
- Modify: `scripts/student-copy-corpus.mjs`
- Modify: `scripts/student-copy-source-coverage.test.mjs`
- Modify: `scripts/student-copy-professional-contract.test.mjs`

**Interfaces:**
- Produces: one governed `STUDENT_COPY.assignmentSandbox` corpus used by the lobby label, planner, upload and advertisement-realisation UI.
- Preserves exact advertising terms: AIDA, Attention, Interest, Desire, Action, salience, framing, reading pathway, vector lines, rule of thirds, colour contrast and harmony, pattern, balance and symmetry.

- [ ] **Step 1: Stabilise all functional strings before model-based copy review**

Move assignment-facing labels, prompts, status messages, upload errors and text-verification warning into `STUDENT_COPY.assignmentSandbox`. Register every new student-facing source in `student-copy-corpus.mjs`. Keep the cognitive move explicit: apply AIDA to the product promise, then apply AIDA again to the advertisement's choices.

- [ ] **Step 2: Run content-pedagogy checks on the complete corpus**

Verify the copy distinguishes feature, benefit, value, audience response and visible evidence; uses page-5 terminology accurately; gives a clear first move; and does not turn the planner into hints that answer the task for students.

- [ ] **Step 3: Run the frozen plain-language preset exactly once**

Send the complete changed `STUDENT_COPY.assignmentSandbox` corpus through the `plain-language` skill in one call. Apply only changes that preserve exact advertising terms and assignment meaning. Record the input hash, returned review, adopted changes and rejected changes in `docs/operations/assignment-sandbox-copy-review-2026-08-11.md`.

- [ ] **Step 4: Run the repository Claude-scrubber MICROCOPY route exactly once if callable**

Use the repository's existing MICROCOPY route on the same stable corpus. If the route is not callable in the current environment, record that exact tool-layer fact and rely on deterministic corpus/professional-contract tests; do not substitute another model or repeat the plain-language call.

- [ ] **Step 5: Implement desktop layout and accessibility styling**

Keep planner sections compact and independently scrollable inside the existing drawer. Ensure the bottom toolbar, Items panel and teacher strip remain unobstructed. Add high-contrast/large-text selectors using existing display preference data attributes. Do not add phone breakpoints or touch-only controls.

- [ ] **Step 6: Add static accessibility/layout contracts**

Test unique IDs, label/control associations, fieldset legends, live regions, hidden/inert workspace-mode switching, keyboard-reachable accordion/checkbox controls, and the presence of all copy sources in the corpus gates.

- [ ] **Step 7: Run focused copy and UI tests**

```powershell
corepack pnpm exec vitest run web/src/game/assignment-planner-panel.test.ts web/src/uploads/student-image-upload-panel.test.ts web/src/ai-image/image-lab-panel.test.ts web/src/ui/editor-shell.test.ts --no-cache --configLoader runner --maxWorkers=1
npx pnpm run test:build-web
npx tsc --noEmit
```

- [ ] **Step 8: Commit Task 6 explicitly**

```powershell
git add -- web/src/game/student-copy.ts web/src/game/assignment-planner-panel.ts web/src/uploads/student-image-upload-panel.ts web/src/ai-image/image-lab-panel.ts web/src/ui/editor-shell.ts web/src/styles/editor.css web/src/game/assignment-planner-panel.test.ts web/src/uploads/student-image-upload-panel.test.ts web/src/ai-image/image-lab-panel.test.ts web/src/ui/editor-shell.test.ts scripts/student-copy-corpus.mjs scripts/student-copy-source-coverage.test.mjs scripts/student-copy-professional-contract.test.mjs docs/operations/assignment-sandbox-copy-review-2026-08-11.md
git diff --cached --check
git diff --cached --name-status
git commit -m "feat(studio): polish assignment sandbox guidance"
```

---

### Task 7: Integrated gates, runtime evidence and one stable-RC review

**Files:**
- Create: `docs/operations/assignment-sandbox-release-verification-2026-08-11.md`
- Modify only files required by evidence-backed fixes from the gates/review.

**Interfaces:**
- Consumes: all task commits above.
- Produces: one stable release candidate with local, GodotIQ, exact-artifact and reviewer evidence kept distinct.

- [ ] **Step 1: Run the final local gates once in the mandated order**

```powershell
npx pnpm test:godot
npx tsc --noEmit
npx pnpm run test:build-web
npx pnpm test
npx pnpm run build:web
```

Expected: all five commands exit 0 on the same integrated inputs.

- [ ] **Step 2: Complete applicable GodotIQ release checks**

Run project validation, project error proof, scoped dependency/signal checks, orphan/missing signal audit, and coverage audit. Use live/runtime capabilities only after their readiness gates are established; never substitute a native launch.

- [ ] **Step 3: Test the built artifact at both desktop viewports**

Through the authorised browser route, verify at 1280×800 and 1440×900:

1. Open sandbox from lobby and reopen a saved sandbox.
2. Complete every product field, Product AIDA and Advertisement AIDA.
3. Upload a representative photographed drawing.
4. Move, resize, Fill ad, layer, lock, hide, delete, Undo and Redo it.
5. Confirm disabled Image Lab leaves upload/built-in tools usable.
6. With a designated allowance, submit one advertisement realisation, verify the output fills the canvas as a new layer, verify one Undo restores the exact original, then reconcile allowance/status.
7. Reload and verify plan, upload, generated asset and history baseline recover.
8. Exercise large text, high contrast, full keyboard navigation, Items, teacher controls, guided campaign start and current product Make It Real.

- [ ] **Step 4: Run exactly one fresh isolated release-candidate code review**

Use `superpowers:requesting-code-review` with the immutable spec, implementation plan, full diff and current gate evidence. Keep it fresh, isolated and unguided. Resolve high/medium correctness findings and proportionate low-risk findings, rerunning only checks whose inputs changed.

- [ ] **Step 5: Record evidence and commit RC fixes/verification docs**

Stage only explicit task-owned paths, audit the cached diff, and commit with a message describing the actual correction or `docs: record assignment sandbox release evidence` when only evidence changed.

---

### Task 8: Push, exact CI artifact, draft QA, merge and production

**Files:**
- No source changes unless hosted evidence reveals a release-blocking defect.
- Update: `docs/operations/assignment-sandbox-release-verification-2026-08-11.md` with immutable IDs/hashes/URLs.

**Interfaces:**
- Produces: canonical GitHub merge, exact main artifact, Netlify production deploy, production QA and zero outstanding commits.

- [ ] **Step 1: Verify branch publication preconditions**

```powershell
git status --short --branch
corepack pnpm run verify:repo-sync --expect-local-head
```

The sync check may correctly report that the unpushed feature branch is not yet published; record the exact state and do not claim publication yet.

- [ ] **Step 2: Push the feature branch and wait for Linux CI**

```powershell
git push -u origin codex/assignment-sandbox-20260811
gh run list --workflow build-and-publish.yml --branch codex/assignment-sandbox-20260811 --limit 5 --json databaseId,headSha,status,conclusion,url
```

Select only the run whose `headSha` equals local `git rev-parse HEAD`; wait until it completes successfully.

- [ ] **Step 3: Download and verify the exact CI artifact**

Use the successful run's artifact metadata and digest, download it to a new `release-evidence/` subdirectory, extract without deleting prior evidence, and verify its release manifest/head SHA/core hashes. Do not rebuild for deployment.

- [ ] **Step 4: Deploy the exact artifact as a Netlify draft and run hosted QA**

Deploy through the repository's artifact deploy script, read back the immutable deploy ID/status, authenticate with the supplied site password without logging it, and repeat the Task-7 runtime matrix against the deploy URL. Keep exact-artifact and hosted evidence distinct.

- [ ] **Step 5: Open a ready PR, wait for checks and merge**

Create the PR against `main` with the spec, test evidence and hosted draft URL. Wait for Linux checks and review state. Merge only the reviewed SHA using the repository's normal merge strategy.

- [ ] **Step 6: Obtain the exact main CI artifact and deploy production**

Find the successful main run whose `headSha` equals `origin/main`, download and verify that exact artifact, deploy it with the production artifact script, and record the immutable production deploy ID plus release manifest.

- [ ] **Step 7: Complete production QA**

Repeat the critical sandbox, upload, dual AIDA, Undo recovery, guided regression, account/session and Image Lab allowance checks on the production URL at 1280×800 and 1440×900. Do not infer production success from draft QA.

- [ ] **Step 8: Prove canonical sync and no outstanding project commits**

```powershell
git fetch origin
git rev-list --left-right --count HEAD...origin/main
corepack pnpm run verify:repo-sync --expect-local-head
git status --short --branch
```

Expected: local HEAD equals `origin/main`, ahead/behind is `0 0`, repository sync prints the canonical verification marker, the index contains no staged files, and the only remaining dirty/untracked paths are the previously protected user/import/QA evidence paths.
