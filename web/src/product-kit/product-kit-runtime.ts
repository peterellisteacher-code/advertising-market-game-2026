import { certificationFingerprintMatches } from "./certification-fingerprint";
import {
  resolveGripTransform,
  resolveSocketTransform,
  type ResolvedMountTransform
} from "./connector-transform";
import {
  createProductKitGridOccupancy,
  type ProductKitGridTile
} from "./grid-placement";
import {
  createProductKitLayerPlan,
  type ProductKitLayerPlan,
  type ProductKitResolvedPlacement
} from "./layer-plan";
import { snapshotPlainData } from "./plain-data";
import {
  isParsedProductKitCatalogue,
  type ProductKitCatalogue,
  type ProductKitComponent,
  type ProductKitKit,
  type ProductKitMountFrame
} from "./product-kit-catalogue";

const PORTABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/;

export interface ProductKitPairRequest {
  readonly kind: "socket" | "grip" | "grid";
  readonly kitId: string;
  readonly mountFrameId: string;
  readonly componentId: string;
}

export type ProductKitCertifiedPair =
  | {
    readonly kind: "socket" | "grip";
    readonly kitId: string;
    readonly mountFrameId: string;
    readonly componentId: string;
    readonly transform: ResolvedMountTransform;
  }
  | {
    readonly kind: "grid";
    readonly kitId: string;
    readonly mountFrameId: string;
    readonly componentId: string;
    readonly plane: "floor" | "wall";
    readonly footprint: { readonly columns: number; readonly rows: number };
    readonly edgeTypes: {
      readonly north?: string;
      readonly east?: string;
      readonly south?: string;
      readonly west?: string;
    };
  };

export type ProductKitCompositionPlacementRequest =
  | {
    readonly kind: "socket" | "grip";
    readonly placementId: string;
    readonly mountFrameId: string;
    readonly componentId: string;
  }
  | {
    readonly kind: "grid";
    readonly placementId: string;
    readonly mountFrameId: string;
    readonly componentId: string;
    readonly column: number;
    readonly row: number;
  };

export interface ProductKitCompositionRequest {
  readonly kitId: string;
  readonly placements: readonly ProductKitCompositionPlacementRequest[];
}

export interface ProductKitRuntime {
  readonly resolvePair: (request: ProductKitPairRequest) =>
    ProductKitCertifiedPair | null;
  readonly planComposition: (request: ProductKitCompositionRequest) =>
    ProductKitLayerPlan | null;
}

interface IndexedCertifiedPair {
  readonly kit: ProductKitKit;
  readonly frame: ProductKitMountFrame;
  readonly component: ProductKitComponent;
}

interface IndexedFrame {
  readonly kit: ProductKitKit;
  readonly frame: ProductKitMountFrame;
}

interface GridPlacementGroup {
  readonly frame: Extract<ProductKitMountFrame, { readonly mountType: "grid" }>;
  readonly tiles: ProductKitGridTile[];
  readonly components: Map<string, ProductKitComponent>;
}

function pairKey(kitId: string, frameId: string, componentId: string): string {
  return `${kitId}\0${frameId}\0${componentId}`;
}

function frameKey(kitId: string, frameId: string): string {
  return `${kitId}\0${frameId}`;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[]
): boolean {
  const keys = Reflect.ownKeys(value);
  return keys.length === expected.length && keys.every((key) =>
    typeof key === "string" && expected.includes(key)
  );
}

function hasOwnDenseIndices(value: readonly unknown[]): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
  }
  return true;
}

function isPortableId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 80 && PORTABLE_ID.test(value);
}

function isPairRequest(value: unknown): value is ProductKitPairRequest {
  return isRecord(value) && hasExactKeys(value, [
    "kind", "kitId", "mountFrameId", "componentId"
  ]) &&
    (value.kind === "socket" || value.kind === "grip" || value.kind === "grid") &&
    isPortableId(value.kitId) && isPortableId(value.mountFrameId) &&
    isPortableId(value.componentId);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    !Object.is(value, -0) && value >= 0;
}

function isCompositionPlacementRequest(
  value: unknown
): value is ProductKitCompositionPlacementRequest {
  if (!isRecord(value) || !isPortableId(value.placementId) ||
    !isPortableId(value.mountFrameId) || !isPortableId(value.componentId)) return false;
  if (value.kind === "socket" || value.kind === "grip") return hasExactKeys(value, [
    "kind", "placementId", "mountFrameId", "componentId"
  ]);
  return value.kind === "grid" && hasExactKeys(value, [
    "kind", "placementId", "mountFrameId", "componentId", "column", "row"
  ]) && isNonNegativeSafeInteger(value.column) &&
    isNonNegativeSafeInteger(value.row);
}

function isCompositionRequest(value: unknown): value is ProductKitCompositionRequest {
  return isRecord(value) && hasExactKeys(value, ["kitId", "placements"]) &&
    isPortableId(value.kitId) &&
    Array.isArray(value.placements) && value.placements.length <= 131_072 &&
    hasOwnDenseIndices(value.placements) &&
    value.placements.every(isCompositionPlacementRequest);
}

function cloneGridEdgeTypes(
  value: Extract<
    ProductKitComponent["componentFrame"],
    { readonly mountType: "grid" }
  >["edgeTypes"]
): Extract<ProductKitCertifiedPair, { readonly kind: "grid" }>["edgeTypes"] {
  return {
    ...(value.north === undefined ? {} : { north: value.north }),
    ...(value.east === undefined ? {} : { east: value.east }),
    ...(value.south === undefined ? {} : { south: value.south }),
    ...(value.west === undefined ? {} : { west: value.west })
  };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

function createProductKitRuntimeFromSnapshot(
  catalogue: ProductKitCatalogue
): ProductKitRuntime {
  const certificationContext = snapshotPlainData({
    packId: catalogue.packId,
    connectorFormulaVersion: catalogue.connectorFormulaVersion
  }, { maxNodes: 16 });
  if (!certificationContext) {
    throw new Error("trusted product-kit catalogue produced an invalid context");
  }
  const kits = new Map(catalogue.kits.map((kit) => [kit.id, kit]));
  const components = new Map(
    catalogue.components.map((component) => [component.id, component])
  );
  const frames = new Map<string, IndexedFrame>();
  for (const kit of catalogue.kits) {
    for (const frame of kit.mountFrames) {
      frames.set(frameKey(kit.id, frame.id), { kit, frame });
    }
  }
  const certifiedPairs = new Map<string, IndexedCertifiedPair>();
  for (const certification of catalogue.certifications) {
    const kit = kits.get(certification.kitId);
    const component = components.get(certification.componentId);
    const indexedFrame = frames.get(frameKey(
      certification.kitId,
      certification.mountFrameId
    ));
    const frame = indexedFrame?.frame;
    if (!kit || !component || !frame || !certificationFingerprintMatches(
      certificationContext,
      kit,
      frame,
      component,
      certification.fingerprint
    )) continue;
    certifiedPairs.set(
      pairKey(kit.id, frame.id, component.id),
      { kit, frame, component }
    );
  }

  const resolvePairFromSnapshot = (
    request: ProductKitPairRequest
  ): ProductKitCertifiedPair | null => {
    if (!isPairRequest(request)) return null;
    const pair = certifiedPairs.get(pairKey(
      request.kitId,
      request.mountFrameId,
      request.componentId
    ));
    if (!pair || request.kind !== pair.kit.mode ||
      request.kind !== pair.frame.mountType ||
      request.kind !== pair.component.componentFrame.mountType) return null;
    if (request.kind === "grid") {
      if (pair.frame.mountType !== "grid" ||
        pair.component.componentFrame.mountType !== "grid" ||
        pair.frame.plane !== pair.component.componentFrame.plane ||
        !Number.isSafeInteger(pair.component.componentFrame.footprint.columns) ||
        !Number.isSafeInteger(pair.component.componentFrame.footprint.rows) ||
        pair.component.componentFrame.footprint.columns < 1 ||
        pair.component.componentFrame.footprint.rows < 1 ||
        pair.component.componentFrame.footprint.columns > pair.frame.columns ||
        pair.component.componentFrame.footprint.rows > pair.frame.rows) return null;
      return deepFreeze({
        kind: "grid" as const,
        kitId: pair.kit.id,
        mountFrameId: pair.frame.id,
        componentId: pair.component.id,
        plane: pair.frame.plane,
        footprint: { ...pair.component.componentFrame.footprint },
        edgeTypes: cloneGridEdgeTypes(pair.component.componentFrame.edgeTypes)
      });
    }
    let transform: ResolvedMountTransform | null;
    if (request.kind === "socket") {
      if (pair.frame.mountType !== "socket" ||
        pair.component.componentFrame.mountType !== "socket") return null;
      transform = resolveSocketTransform(
        pair.component.componentFrame,
        pair.frame,
        pair.frame.constraints
      );
    } else if (request.kind === "grip") {
      if (pair.frame.mountType !== "grip" ||
        pair.component.componentFrame.mountType !== "grip") return null;
      transform = resolveGripTransform(
        pair.component.componentFrame,
        pair.frame,
        pair.frame.constraints
      );
    } else {
      return null;
    }
    if (!transform) return null;
    return deepFreeze({
      kind: request.kind,
      kitId: pair.kit.id,
      mountFrameId: pair.frame.id,
      componentId: pair.component.id,
      transform
    });
  };

  const resolvePair = (request: ProductKitPairRequest): ProductKitCertifiedPair | null => {
    const snapshot = snapshotPlainData(request, { maxNodes: 64, maxArrayLength: 8 });
    return snapshot === null ? null : resolvePairFromSnapshot(snapshot);
  };

  const planCompositionFromSnapshot = (
    request: ProductKitCompositionRequest
  ): ProductKitLayerPlan | null => {
    if (!isCompositionRequest(request)) return null;
    const kit = kits.get(request.kitId);
    if (!kit) return null;
    const placements: ProductKitResolvedPlacement[] = [];
    const gridGroups = new Map<string, GridPlacementGroup>();
    const occupiedFixedFrames = new Set<string>();
    for (const placement of request.placements) {
      if (placement.kind === "grid") {
        const pair = resolvePairFromSnapshot({
          kind: "grid",
          kitId: kit.id,
          mountFrameId: placement.mountFrameId,
          componentId: placement.componentId
        });
        const indexed = certifiedPairs.get(pairKey(
          kit.id,
          placement.mountFrameId,
          placement.componentId
        ));
        if (!pair || pair.kind !== "grid" || !indexed ||
          indexed.frame.mountType !== "grid" ||
          indexed.component.componentFrame.mountType !== "grid") return null;
        let group = gridGroups.get(indexed.frame.id);
        if (!group) {
          group = {
            frame: indexed.frame,
            tiles: [],
            components: new Map()
          };
          gridGroups.set(indexed.frame.id, group);
        }
        group.tiles.push({
          placementId: placement.placementId,
          componentId: indexed.component.id,
          column: placement.column,
          row: placement.row,
          footprint: { ...pair.footprint },
          edgeTypes: { ...pair.edgeTypes }
        });
        group.components.set(placement.placementId, indexed.component);
        continue;
      }
      if (occupiedFixedFrames.has(placement.mountFrameId)) return null;
      occupiedFixedFrames.add(placement.mountFrameId);
      const pair = resolvePairFromSnapshot({
        kind: placement.kind,
        kitId: kit.id,
        mountFrameId: placement.mountFrameId,
        componentId: placement.componentId
      });
      const indexed = certifiedPairs.get(pairKey(
        kit.id,
        placement.mountFrameId,
        placement.componentId
      ));
      if (!pair || pair.kind === "grid" || !indexed) return null;
      placements.push({
        kind: "affine",
        placementId: placement.placementId,
        mountFrameId: placement.mountFrameId,
        component: indexed.component,
        transform: pair.transform
      });
    }
    for (const group of gridGroups.values()) {
      const occupancy = createProductKitGridOccupancy(group.frame, group.tiles);
      if (!occupancy) return null;
      for (const tile of occupancy.placements) {
        const component = group.components.get(tile.placementId);
        if (!component) return null;
        placements.push({
          kind: "grid",
          placementId: tile.placementId,
          mountFrameId: group.frame.id,
          component,
          column: tile.column,
          row: tile.row,
          normalizedBounds: {
            x: group.frame.origin.x + tile.column * group.frame.cellSize.width,
            y: group.frame.origin.y + tile.row * group.frame.cellSize.height,
            width: tile.footprint.columns * group.frame.cellSize.width,
            height: tile.footprint.rows * group.frame.cellSize.height
          }
        });
      }
    }
    return createProductKitLayerPlan(kit, placements);
  };

  const planComposition = (
    request: ProductKitCompositionRequest
  ): ProductKitLayerPlan | null => {
    const snapshot = snapshotPlainData(request, {
      maxNodes: 2_000_000,
      maxArrayLength: 131_072
    });
    return snapshot === null ? null : planCompositionFromSnapshot(snapshot);
  };

  return Object.freeze({
    resolvePair,
    planComposition
  });
}

const NULL_PRODUCT_KIT_RUNTIME: ProductKitRuntime = Object.freeze({
  resolvePair: (_request: ProductKitPairRequest) => null,
  planComposition: (_request: ProductKitCompositionRequest) => null
});

export function createProductKitRuntime(
  catalogue: ProductKitCatalogue
): ProductKitRuntime;
export function createProductKitRuntime(
  catalogue: unknown
): ProductKitRuntime | null;
export function createProductKitRuntime(
  catalogue: unknown
): ProductKitRuntime | null {
  const plainSnapshot = snapshotPlainData(catalogue, {
    maxNodes: 4_000_000,
    maxArrayLength: 20_000
  });
  if (!plainSnapshot) return null;
  if (!isParsedProductKitCatalogue(catalogue)) return NULL_PRODUCT_KIT_RUNTIME;
  try {
    return createProductKitRuntimeFromSnapshot(plainSnapshot as ProductKitCatalogue);
  } catch {
    return NULL_PRODUCT_KIT_RUNTIME;
  }
}
