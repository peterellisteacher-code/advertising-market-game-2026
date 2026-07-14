# Product Artwork Edit Mode Design

**Status:** Approved direction, grounded by the real-browser spike in commit `a4d3d0e`.

**Scope:** Editing artwork already placed inside one named product artwork surface. This design does not alter product-shell geometry, the 6,144-variant product builder, catalogue authority, game rules, networking, or publication requirements.

## Purpose

Students need a Canva-like way to personalise product bodies without dismantling the product itself. They must be able to select, move, resize, rotate, layer and remove their own text, shapes, drawings and images inside the product's print area while the product shell remains visually intact.

The interaction should feel direct: choose **Edit design**, work on the visible artwork inside the product, then click outside it or press Escape to return to the whole product.

Student-facing copy must not use the words `assignment`, `unit` or `task`.

## Evidence and chosen approach

Three approaches were considered:

1. **Native Fabric nested interactivity — chosen.** Keep artwork as children of the existing clipped surface and temporarily enable Fabric's nested targeting path. This preserves the real object tree and makes save, export and catalogue identity coherent.
2. **Temporarily lift a child to the top-level canvas.** This simplifies selection controls, but every entry and exit would require matrix decomposition, clip emulation, z-order restoration and reference-safe reinsertion. A failed exit could corrupt the campaign.
3. **Build independent HTML/SVG handles over the canvas.** This avoids Fabric's nested-selection API, but duplicates hit testing and transform math, separates the controls from keyboard and canvas semantics, and creates a second rendering system.

The committed real-browser diagnostic uses the reviewed `drinkware-classic-can`, its real `ClipPathLayout` surface and real Fabric 7.4 pointer controls. The product is rotated 18 degrees and non-uniformly scaled. From clean reloads, both the outside-click and Escape paths passed all seven checks:

- the nested child, not the product, became active;
- pointer drag changed the child's slot-local position;
- a corner control resized the child;
- the rotation control rotated the child;
- the product transform remained byte-for-byte equivalent within `0.001`;
- 19 of 25 interior differential samples changed when the oversized probe was shown, while 0 of 20 exterior samples changed;
- exit restored whole-product selection;
- the browser console contained no warnings or errors.

This proves the native approach under the transform and clipping conditions that matter. It does not by itself prove persistence, history, deletion reconciliation or keyboard focus safety; those remain explicit production requirements below.

## State model

The controller exposes one immutable state snapshot:

```ts
export type ArtworkEditState =
  | { readonly mode: "idle" }
  | {
      readonly mode: "editing";
      readonly address: ArtworkSurfaceAddress;
      readonly selectedChildId: string | null;
    };
```

Allowed transitions are deliberately small:

| Current | Event | Next | Result |
|---|---|---|---|
| `idle` | enter a valid product/slot | `editing` | product freezes; surface opens; first eligible child may be selected |
| `idle` | enter invalid/missing/locked product | `idle` | fail without changing flags, selection, history or document |
| `editing` | select eligible child | `editing` | `selectedChildId` changes; no history mutation |
| `editing` | valid child transform completes | `editing` | normalise/clamp once; emit one parent mutation if durable state changed |
| `editing` | rejected child transform completes | `editing` | restore last committed transform; emit no mutation |
| `editing` | click outside, Escape, save, load, publish, close or select another top-level object | `idle` | restore every transient flag and select the product when it still exists |
| `editing` | active product/slot disappears | `idle` | restore what remains, clear selection and announce recovery |

Re-entering the same address is a no-op. Entering another address first exits the current session completely. Exit is idempotent.

## Object eligibility

Only direct children of the addressed `artwork-slot` may become editable. An eligible child must have:

- a non-empty `objectId`;
- a non-empty `accessibleName`;
- `productLayer: "student-artwork"`;
- an `elementKind` in `text`, `shape`, `image`, `drawing` or `masked-component`.

Imported shell artwork without an `objectId`, editor guides, material treatments, structural product layers, the product group and the artwork-slot group never become child selections.

The controller rejects duplicate eligible child IDs before changing any live state.

## Transient interaction flags

Entry captures the exact pre-entry values for every property it changes. It then applies this interaction-only projection:

| Object | `selectable` | `evented` | `subTargetCheck` | `interactive` |
|---|---:|---:|---:|---:|
| product group | `false` | `true` | `true` | `true` |
| addressed artwork-slot group | `false` | `true` | `true` | `true` |
| eligible direct child | prior lock/visibility permitting | same as selectable | unchanged | unchanged |
| every other slot child | `false` | `false` | unchanged | unchanged |

The product's transform locks, visibility and durable lock state are respected. A locked, hidden or non-evented product cannot enter edit mode. A locked or hidden child remains unavailable.

The captured record also includes active selection, hover-sensitive flags and control presentation values changed by the controller. Exit restores captured values rather than guessed defaults. This prevents edit mode from silently unlocking an object or changing a campaign saved by a future version.

## Persistent-state projection

Edit mode is transient UI state. It must never leak into campaign JSON, undo snapshots, drafts or published output.

`FabricCanvasAdapter.serialize()` therefore serialises the canvas normally and, when a session is active, projects every captured interaction property back to its pre-entry value in the returned clone. Projection uses the live object-tree path recorded at entry, plus semantic identity checks at every level; it fails closed if the tree no longer matches.

The live canvas is not mutated during projection. This avoids selection flicker and prevents an exception during save from stranding the editor in a half-restored state.

`load()` exits edit mode before calling `loadFromJSON`. Save, publish and `getState()` may remain visually in edit mode because their serialised projection is clean. Close and runtime disposal exit first.

Round-trip acceptance requires all of the following:

- serialising while idle and serialising immediately after entry produce equal durable JSON;
- one child transform changes only that child's durable transform fields inside the product tree;
- loading the projected JSON produces an idle canvas with the original product lock/selection flags;
- entering, saving, exiting and re-entering produces the same eligible child set.

## Slot-local transforms

Fabric 7.4 already converts real pointer motion through rotated and non-uniformly-scaled parent matrices into child-local `left`, `top`, `scaleX`, `scaleY` and `angle`. Production code retains those native values and validates them at transform completion.

Each eligible child has a last committed transform captured at entry and refreshed only after a successful commit. Completion applies these rules in order:

1. All transform numbers must be finite; `scaleX` and `scaleY` must be positive.
2. Local angle is normalised to `[-180, 180)`.
3. Local centre is clamped to the slot rectangle: `left` to `[-surface.width / 2, surface.width / 2]` and `top` to `[-surface.height / 2, surface.height / 2]`. This allows cropping beyond the print edge while keeping the object recoverable.
4. Scaled width and height must each be at least 12 local pixels and no more than six times the larger slot dimension.
5. A non-finite or out-of-budget transform restores the last committed transform. A finite centre overflow is clamped.
6. If normalisation and clamping produce the last committed transform within `0.001`, the action is a no-op.
7. A real change marks the child, surface and product dirty, refreshes coordinates and emits exactly one `{ type: "modified", objectId: productId }` mutation.

The existing canvas-level `object:modified` listener must route an edited nested child to its owning product. It must not emit a second child mutation. This is what makes one gesture equal one undo step.

## History and command boundary

The canvas port gains explicit edit operations rather than exposing Fabric objects:

```ts
enterArtworkEdit(address: ArtworkSurfaceAddress): ArtworkEditState;
exitArtworkEdit(): ArtworkEditState;
getArtworkEditState(): ArtworkEditState;
subscribeArtworkEdit(listener: (state: ArtworkEditState) => void): () => void;
```

`ObjectCommandService` validates addresses and forwards entry/exit. The UI never toggles Fabric flags itself.

Selection changes and entry/exit do not create history. A completed transform creates one parent-owned mutation. Undo/redo loads a clean durable snapshot and returns to idle before travel. Failed travel restores both durable canvas state and idle edit state.

## Layer list and catalogue joins

While editing, the layer list is scoped to the addressed artwork surface and follows its direct-child order. Each row contains the accessible name and kind, and exposes select, move forward/backward, hide/show and remove only when those operations are valid.

New text, shape, drawing or catalogue artwork added to the active surface joins the current session without closing it. The controller validates and captures the new child's durable interaction state before making it selectable. A failed catalogue transaction never adds a row.

Layer reordering is surface-local. Structural product layers can never be crossed.

## Deletion and reference cleanup

Deleting an artwork child is a document transaction, not a bare `Group.remove()` call.

The coordinator captures:

- the current projected Fabric JSON;
- the campaign document and all references whose `objectId` is the child ID;
- any referenced local blob and object URL;
- the active edit address, selected child and surface order.

It then removes the child, builds and validates the next campaign document, removes child-owned catalogue and local-blob references, and commits the document. A blob is released only when no remaining reference uses its `blobKey`. URL revocation happens only after the document and canvas commit succeeds.

On any failure, the coordinator reloads the captured Fabric JSON, restores the document, blob and edit session, and reports the original error. A rollback failure is surfaced as an `AggregateError`; it is never hidden.

Until this coordinator and document-level history are wired, Delete/Backspace and layer-list removal stay disabled in production edit mode. This prevents a visually successful delete from orphaning attribution or blob state.

## Keyboard and focus safety

The input binding handles Escape, Delete/Backspace and arrow nudging only when:

- `event.isComposing` is false;
- the event target is not an input, textarea, select or contenteditable element;
- no Fabric text object is actively editing;
- edit mode is active.

Escape exits and restores the product. Delete/Backspace delegates to the atomic deletion coordinator and remains disabled until that coordinator exists. Arrow keys nudge the selected child by one local pixel, or ten with Shift, then use the same validation and single-commit path as pointer transforms.

The canvas region receives focus after entry. The polite live region announces `Editing <product name> design`, child selection and exit. Errors use the assertive live region. No instruction relies on hover alone.

## UI behavior

When a product with one valid artwork surface is selected, the inspector shows **Edit design**. Entry changes the inspector heading to **Design on <product name>**, shows **Done**, and scopes the layer list to the surface. The canvas visually keeps the product shell and clip; only student artwork gets controls.

Clicking an artwork child selects it. Clicking elsewhere exits after Fabric finishes the current pointer event, then selects the whole product. The one-frame deferral is required: the browser spike showed that restoring and selecting the product inside `mouse:down:before` lets Fabric's remaining selection logic clear it again.

## Error handling

All entry validation completes before any flags change. After mutation begins, setup is wrapped in rollback that restores captured flags and selection on failure.

Projection mismatch, duplicate child IDs, invalid geometry, missing clip ownership and unexpected tree replacement are hard errors. The controller exits to idle rather than continuing against uncertain ownership.

Disposal removes every Fabric, DOM and keyboard listener and restores active transient flags before the canvas is destroyed.

## Verification

Implementation follows RED-GREEN TDD and separate commits for:

1. pure state and transform validation;
2. Fabric entry, targeting, projection and parent-owned mutation routing;
3. UI, layer list and guarded keyboard binding;
4. atomic deletion/reference cleanup;
5. real-browser regression using the committed diagnostic.

Each slice runs focused Vitest, TypeScript, the full Vitest suite and diff checks. The browser regression must repeat both outside-click and Escape exits with zero console errors. Final integration also runs the web build/export verification and the classroom performance budget.

## Explicit non-goals

- no freeform mesh warping or perspective distortion;
- no nested groups deeper than one artwork surface plus direct children in the first production release;
- no simultaneous editing of multiple products or slots;
- no live multiplayer cursor/selection synchronisation;
- no change to product-shell artwork bounds or reviewed visual assets;
- no direct modification of Claude-owned work or unrelated untracked files.
