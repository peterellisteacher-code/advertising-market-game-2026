import type {
  ProductKitComponent,
  ProductKitMountFrame,
  ProductKitPoint
} from "./product-kit-catalogue";
import { snapshotPlainData } from "./plain-data";

const MAX_GRID_AXIS = 64;
const MAX_EDGE_TYPES = 32;
const MAX_EDGE_TYPE_LENGTH = 80;
const EDGE_DIRECTIONS = ["north", "east", "south", "west"] as const;

type GridMountFrame = Extract<ProductKitMountFrame, { readonly mountType: "grid" }>;
type GridComponentFrame = Extract<
  ProductKitComponent["componentFrame"],
  { readonly mountType: "grid" }
>;
type GridComponent = ProductKitComponent & {
  readonly componentFrame: GridComponentFrame;
};

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwnDenseIndices(value: readonly unknown[]): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
  }
  return true;
}

function isUnitNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) &&
    !Object.is(value, -0) &&
    value >= 0 && value <= 1;
}

function isGridAxis(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    !Object.is(value, -0) &&
    value >= 1 && value <= MAX_GRID_AXIS;
}

function isGridMountFrame(value: unknown): value is GridMountFrame {
  if (!isRecord(value) || value.mountType !== "grid" ||
    !isRecord(value.origin) || !isRecord(value.cellSize) ||
    !isUnitNumber(value.origin.x) || !isUnitNumber(value.origin.y) ||
    !isUnitNumber(value.cellSize.width) || value.cellSize.width === 0 ||
    !isUnitNumber(value.cellSize.height) || value.cellSize.height === 0 ||
    !isGridAxis(value.columns) || !isGridAxis(value.rows) ||
    (value.plane !== "floor" && value.plane !== "wall")) return false;

  return value.origin.x + value.cellSize.width * value.columns <= 1 &&
    value.origin.y + value.cellSize.height * value.rows <= 1;
}

function isGridComponent(value: unknown): value is GridComponent {
  if (!isRecord(value) || !isRecord(value.componentFrame) ||
    value.componentFrame.mountType !== "grid" ||
    !isRecord(value.componentFrame.footprint)) return false;
  return (value.componentFrame.plane === "floor" ||
      value.componentFrame.plane === "wall") &&
    isGridAxis(value.componentFrame.footprint.columns) &&
    isGridAxis(value.componentFrame.footprint.rows);
}

function isNormalizedPoint(value: unknown): value is ProductKitPoint {
  return isRecord(value) && isUnitNumber(value.x) && isUnitNumber(value.y);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    !Object.is(value, -0) && value >= 0;
}

function snapCoordinateTowardPositiveTie(
  coordinate: number,
  origin: number,
  cellSize: number
): number {
  const lower = Math.floor((coordinate - origin) / cellSize);
  const midpoint = origin + cellSize * (lower + 0.5);
  return coordinate < midpoint ? lower : lower + 1;
}

function hasValidPlacementGeometry(
  value: unknown,
  frame: GridMountFrame
): value is ProductKitGridTile {
  if (!isRecord(value) || typeof value.placementId !== "string" ||
    value.placementId.length === 0 || typeof value.componentId !== "string" ||
    value.componentId.length === 0 || !isNonNegativeSafeInteger(value.column) ||
    !isNonNegativeSafeInteger(value.row) || !isRecord(value.footprint) ||
    !isGridAxis(value.footprint.columns) || !isGridAxis(value.footprint.rows) ||
    !isRecord(value.edgeTypes) || !Object.keys(value.edgeTypes).every((key) =>
      (EDGE_DIRECTIONS as readonly string[]).includes(key)
    )) return false;
  return value.column + value.footprint.columns <= frame.columns &&
    value.row + value.footprint.rows <= frame.rows;
}

function acceptedEdgeTypesAreCanonical(value: unknown): value is readonly string[] {
  if (!Array.isArray(value) || value.length > MAX_EDGE_TYPES ||
    !hasOwnDenseIndices(value)) return false;
  return value.every((edgeType, index) =>
    typeof edgeType === "string" && edgeType.length > 0 &&
    edgeType.length <= MAX_EDGE_TYPE_LENGTH &&
    (index === 0 || value[index - 1] < edgeType)
  );
}

function placementEdgesAreAccepted(
  placement: ProductKitGridTile,
  acceptedEdgeTypes: ReadonlySet<string>
): boolean {
  return EDGE_DIRECTIONS.every((direction) => {
    const edgeType = placement.edgeTypes[direction];
    return edgeType === undefined ||
      (typeof edgeType === "string" && acceptedEdgeTypes.has(edgeType));
  });
}

function intervalsOverlap(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number
): boolean {
  return Math.max(firstStart, secondStart) < Math.min(firstEnd, secondEnd);
}

function touchingEdgesAreCompatible(
  first: ProductKitGridTile,
  second: ProductKitGridTile
): boolean {
  const firstRight = first.column + first.footprint.columns;
  const secondRight = second.column + second.footprint.columns;
  const firstBottom = first.row + first.footprint.rows;
  const secondBottom = second.row + second.footprint.rows;

  if (firstRight === second.column && intervalsOverlap(
    first.row, firstBottom, second.row, secondBottom
  )) return first.edgeTypes.east === second.edgeTypes.west;
  if (secondRight === first.column && intervalsOverlap(
    first.row, firstBottom, second.row, secondBottom
  )) return second.edgeTypes.east === first.edgeTypes.west;
  if (firstBottom === second.row && intervalsOverlap(
    first.column, firstRight, second.column, secondRight
  )) return first.edgeTypes.south === second.edgeTypes.north;
  if (secondBottom === first.row && intervalsOverlap(
    first.column, firstRight, second.column, secondRight
  )) return second.edgeTypes.south === first.edgeTypes.north;
  return true;
}

function detachAndFreezePlacement(
  placement: ProductKitGridTile
): ProductKitGridTile {
  const footprint = Object.freeze({
    columns: placement.footprint.columns,
    rows: placement.footprint.rows
  });
  const edgeTypes = Object.freeze({
    ...(placement.edgeTypes.north === undefined
      ? {}
      : { north: placement.edgeTypes.north }),
    ...(placement.edgeTypes.east === undefined
      ? {}
      : { east: placement.edgeTypes.east }),
    ...(placement.edgeTypes.south === undefined
      ? {}
      : { south: placement.edgeTypes.south }),
    ...(placement.edgeTypes.west === undefined
      ? {}
      : { west: placement.edgeTypes.west })
  });
  return Object.freeze({
    placementId: placement.placementId,
    componentId: placement.componentId,
    column: placement.column,
    row: placement.row,
    footprint,
    edgeTypes
  });
}

export interface ProductKitGridCell {
  readonly column: number;
  readonly row: number;
}

export interface ProductKitGridTile {
  readonly placementId: string;
  readonly componentId: string;
  readonly column: number;
  readonly row: number;
  readonly footprint: {
    readonly columns: number;
    readonly rows: number;
  };
  readonly edgeTypes: {
    readonly north?: string;
    readonly east?: string;
    readonly south?: string;
    readonly west?: string;
  };
}

export interface ProductKitGridOccupancy {
  readonly columns: number;
  readonly rows: number;
  readonly cells: readonly (string | null)[];
  readonly placements: readonly ProductKitGridTile[];
}

function snapProductKitGridCellFromSnapshot(
  frame: ProductKitMountFrame,
  component: ProductKitComponent,
  desiredTopLeft: ProductKitPoint
): ProductKitGridCell | null {
  if (!isGridMountFrame(frame) || !isGridComponent(component) ||
    !isNormalizedPoint(desiredTopLeft) ||
    frame.plane !== component.componentFrame.plane) return null;

  const right = frame.origin.x + frame.cellSize.width * frame.columns;
  const bottom = frame.origin.y + frame.cellSize.height * frame.rows;
  if (desiredTopLeft.x < frame.origin.x || desiredTopLeft.x >= right ||
    desiredTopLeft.y < frame.origin.y || desiredTopLeft.y >= bottom) return null;

  const column = snapCoordinateTowardPositiveTie(
    desiredTopLeft.x,
    frame.origin.x,
    frame.cellSize.width
  );
  const row = snapCoordinateTowardPositiveTie(
    desiredTopLeft.y,
    frame.origin.y,
    frame.cellSize.height
  );
  if (!Number.isSafeInteger(column) || !Number.isSafeInteger(row) ||
    column < 0 || row < 0 ||
    column + component.componentFrame.footprint.columns > frame.columns ||
    row + component.componentFrame.footprint.rows > frame.rows) return null;
  return Object.freeze({ column, row });
}

export function snapProductKitGridCell(
  frame: ProductKitMountFrame,
  component: ProductKitComponent,
  desiredTopLeft: ProductKitPoint
): ProductKitGridCell | null {
  const snapshot = snapshotPlainData(
    [frame, component, desiredTopLeft] as const,
    { maxNodes: 10_000, maxArrayLength: 64 }
  );
  return snapshot === null
    ? null
    : snapProductKitGridCellFromSnapshot(...snapshot);
}

function createProductKitGridOccupancyFromSnapshot(
  frame: ProductKitMountFrame,
  placements: readonly ProductKitGridTile[]
): ProductKitGridOccupancy | null {
  if (!isGridMountFrame(frame) || !Array.isArray(placements) ||
    !hasOwnDenseIndices(placements) ||
    placements.length > frame.columns * frame.rows ||
    !acceptedEdgeTypesAreCanonical(frame.acceptedEdgeTypes)) return null;
  const acceptedEdgeTypes = new Set(frame.acceptedEdgeTypes);
  const placementIds = new Set<string>();
  for (const placement of placements) {
    if (!hasValidPlacementGeometry(placement, frame) ||
      placementIds.has(placement.placementId) ||
      !placementEdgesAreAccepted(placement, acceptedEdgeTypes)) return null;
    placementIds.add(placement.placementId);
  }
  const ordered = placements.map(detachAndFreezePlacement).sort((left, right) =>
    left.row - right.row || left.column - right.column ||
    (left.placementId < right.placementId
      ? -1
      : left.placementId > right.placementId ? 1 : 0)
  );
  const cells = new Array<string | null>(frame.columns * frame.rows).fill(null);
  for (const placement of ordered) {
    for (let row = placement.row;
      row < placement.row + placement.footprint.rows;
      row += 1) {
      for (let column = placement.column;
        column < placement.column + placement.footprint.columns;
        column += 1) {
        const index = row * frame.columns + column;
        if (cells[index] !== null) return null;
        cells[index] = placement.placementId;
      }
    }
  }
  for (let firstIndex = 0; firstIndex < ordered.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1;
      secondIndex < ordered.length;
      secondIndex += 1) {
      if (!touchingEdgesAreCompatible(
        ordered[firstIndex]!,
        ordered[secondIndex]!
      )) return null;
    }
  }
  const frozenCells = Object.freeze(cells);
  const frozenPlacements = Object.freeze(ordered);
  return Object.freeze({
    columns: frame.columns,
    rows: frame.rows,
    cells: frozenCells,
    placements: frozenPlacements
  });
}

export function createProductKitGridOccupancy(
  frame: ProductKitMountFrame,
  placements: readonly ProductKitGridTile[]
): ProductKitGridOccupancy | null {
  const snapshot = snapshotPlainData(
    [frame, placements] as const,
    { maxNodes: 100_000, maxArrayLength: 4096 }
  );
  return snapshot === null
    ? null
    : createProductKitGridOccupancyFromSnapshot(...snapshot);
}
