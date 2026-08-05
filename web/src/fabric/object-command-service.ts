import type {
  ArtworkSurfaceAddress,
  CanvasObjectSummary,
  CanvasPort,
  LogoMarkSource,
  NewRasterInput,
  NewProductKitInput,
  NewProductVariantInput,
  NewProductShellInput,
  ObjectTransform,
  ShapeKind,
  StackDirection
} from "./canvas-port";
import type { CurvedLabelFontFamily } from "../product-kit/curved-label-renderer";

export interface AddShapeCommand {
  kind: ShapeKind;
  fill: string;
  accessibleName?: string;
}

export type AddRasterCommand = Omit<NewRasterInput, "id">;

export type AddProductShellCommand = Omit<NewProductShellInput, "id">;
export type AddProductVariantCommand = Omit<NewProductVariantInput, "id">;
export type AddProductKitCommand = Omit<NewProductKitInput, "id">;
export type AddLogoMarkCommand = LogoMarkSource;

type IdFactory = () => string;

const defaultIdFactory: IdFactory = () => globalThis.crypto.randomUUID();

export interface CanvasRemovalState {
  readonly selectedId: string | null;
  readonly removable: boolean;
  readonly reason: string;
}

export function canvasRemovalState(
  selectedId: string | null,
  summaries: readonly CanvasObjectSummary[]
): CanvasRemovalState {
  if (selectedId === null) {
    return {
      selectedId,
      removable: false,
      reason: "Select an item to delete"
    };
  }
  const summary = summaries.find(({ id }) => id === selectedId);
  if (summary === undefined) {
    return {
      selectedId,
      removable: false,
      reason: "The selected item is no longer available."
    };
  }
  if (summary.elementKind === "product-shell") {
    return {
      selectedId,
      removable: false,
      reason: "This product shell is required and cannot be deleted."
    };
  }
  return {
    selectedId,
    removable: true,
    reason: `Delete ${summary.accessibleName} from the ad.`
  };
}

export class ObjectCommandService {
  constructor(
    private readonly port: CanvasPort,
    private readonly createId: IdFactory = defaultIdFactory
  ) {}

  async addText(value: string, accessibleName = value, editable = true): Promise<string> {
    const text = value.trim();
    if (!text) throw new Error("Text must not be empty");
    const id = this.#nextId();
    await this.port.addText({
      id,
      value,
      accessibleName: this.#required(accessibleName, "accessible name"),
      editable
    });
    this.port.setSelected(id);
    return id;
  }

  async addShape(input: AddShapeCommand): Promise<string> {
    const kinds: ShapeKind[] = ["rect", "ellipse", "triangle", "line"];
    if (!kinds.includes(input.kind)) throw new Error("Unsupported shape kind");
    const id = this.#nextId();
    await this.port.addShape({
      id,
      kind: input.kind,
      fill: this.#required(input.fill, "fill"),
      accessibleName: this.#required(input.accessibleName ?? `${input.kind} shape`, "accessible name")
    });
    this.port.setSelected(id);
    return id;
  }

  async addRaster(input: AddRasterCommand): Promise<string> {
    const id = this.#nextId();
    await this.port.addRaster({
      id,
      assetId: this.#required(input.assetId, "asset id"),
      sameOriginUrl: this.#required(input.sameOriginUrl, "raster URL"),
      accessibleName: this.#required(input.accessibleName, "accessible name"),
      ...(input.sectionFill === undefined
        ? {}
        : { sectionFill: structuredClone(input.sectionFill) })
    });
    this.port.setSelected(id);
    return id;
  }

  async addLogoMark(input: AddLogoMarkCommand): Promise<string> {
    const id = this.#nextId();
    await this.port.addLogoMark({ id, ...input });
    this.port.setSelected(id);
    return id;
  }

  async replaceLogoMark(id: string, input: AddLogoMarkCommand): Promise<void> {
    const objectId = this.#required(id, "logo object id");
    await this.port.replaceLogoMark(objectId, input);
    this.port.setSelected(objectId);
  }

  async addArtworkText(
    address: ArtworkSurfaceAddress,
    value: string,
    accessibleName = value,
    fontFamily?: CurvedLabelFontFamily
  ): Promise<string> {
    const target = this.#artworkAddress(address);
    const text = value.trim();
    if (!text) throw new Error("Text must not be empty");
    const id = this.#nextId();
    await this.port.addArtworkText(target, {
      id,
      value: text,
      accessibleName: this.#required(accessibleName, "accessible name"),
      ...(fontFamily === undefined ? {} : { fontFamily })
    });
    this.port.setSelected(target.productId);
    return id;
  }

  async addArtworkShape(
    address: ArtworkSurfaceAddress,
    input: AddShapeCommand
  ): Promise<string> {
    const target = this.#artworkAddress(address);
    const kinds: ShapeKind[] = ["rect", "ellipse", "triangle", "line"];
    if (!kinds.includes(input.kind)) throw new Error("Unsupported shape kind");
    const id = this.#nextId();
    await this.port.addArtworkShape(target, {
      id,
      kind: input.kind,
      fill: this.#required(input.fill, "fill"),
      accessibleName: this.#required(
        input.accessibleName ?? `${input.kind} shape`,
        "accessible name"
      )
    });
    this.port.setSelected(target.productId);
    return id;
  }

  async addArtworkRaster(
    address: ArtworkSurfaceAddress,
    input: AddRasterCommand
  ): Promise<string> {
    const target = this.#artworkAddress(address);
    const id = this.#nextId();
    await this.port.addArtworkRaster(target, {
      id,
      assetId: this.#required(input.assetId, "asset id"),
      sameOriginUrl: this.#required(input.sameOriginUrl, "raster URL"),
      accessibleName: this.#required(input.accessibleName, "accessible name")
    });
    this.port.setSelected(target.productId);
    return id;
  }

  async setArtworkText(
    address: ArtworkSurfaceAddress,
    id: string,
    value: string,
    fontFamily?: CurvedLabelFontFamily
  ): Promise<void> {
    await this.port.setArtworkText(
      this.#artworkAddress(address),
      this.#required(id, "artwork object id"),
      this.#required(value, "text"),
      fontFamily
    );
  }

  removeArtwork(address: ArtworkSurfaceAddress, childId: string): void {
    const target = this.#artworkAddress(address);
    this.port.removeArtwork(
      target,
      this.#required(childId, "artwork object id")
    );
    this.port.setSelected(target.productId);
  }

  async addProductShell(input: AddProductShellCommand): Promise<string> {
    const id = this.#nextId();
    await this.port.addProductShell({
      id,
      shellId: this.#required(input.shellId, "shell id"),
      svg: this.#required(input.svg, "shell SVG"),
      accessibleName: this.#required(input.accessibleName, "accessible name")
    });
    this.port.setSelected(id);
    return id;
  }

  async addProductVariant(input: AddProductVariantCommand): Promise<string> {
    const id = this.#nextId();
    await this.port.addProductVariant({ id, ...input });
    this.port.setSelected(id);
    return id;
  }

  async addProductKit(input: AddProductKitCommand): Promise<string> {
    const id = this.#nextId();
    await this.port.addProductKit({ id, ...input });
    this.port.setSelected(id);
    return id;
  }

  setProductShellRegion(id: string, region: string, colour: string): void {
    this.port.setProductShellRegion(
      this.#required(id, "object id"),
      this.#required(region, "shell region"),
      this.#required(colour, "shell colour")
    );
  }

  transform(id: string, patch: Partial<ObjectTransform>): void {
    for (const [property, value] of Object.entries(patch)) {
      if (typeof value === "number" && !Number.isFinite(value)) {
        throw new Error(`${property} must be finite`);
      }
    }
    if ((patch.scaleX !== undefined && patch.scaleX <= 0) ||
      (patch.scaleY !== undefined && patch.scaleY <= 0)) {
      throw new Error("Scale must be greater than zero");
    }
    this.port.transform(this.#required(id, "object id"), patch);
  }

  async duplicate(id: string): Promise<string> {
    const sourceId = this.#required(id, "object id");
    this.port.assertCanDuplicate(sourceId);
    const newId = this.#nextId();
    await this.port.duplicate(sourceId, newId);
    return newId;
  }

  remove(id: string): void {
    const objectId = this.#required(id, "object id");
    const state = canvasRemovalState(objectId, this.port.listObjectSummaries());
    if (!state.removable) throw new Error(state.reason);
    this.port.remove(objectId);
  }
  moveToFront(id: string): void { this.#move(id, "front"); }
  moveForward(id: string): void { this.#move(id, "forward"); }
  moveBackward(id: string): void { this.#move(id, "backward"); }
  moveToBack(id: string): void { this.#move(id, "back"); }
  setLocked(id: string, locked: boolean): void { this.port.setLocked(this.#required(id, "object id"), locked); }
  setHidden(id: string, hidden: boolean): void { this.port.setVisible(this.#required(id, "object id"), !hidden); }
  select(id: string | null): void { this.port.setSelected(id === null ? null : this.#required(id, "object id")); }
  serialize(): Record<string, unknown> { return this.port.serialize(); }
  async load(value: Record<string, unknown>): Promise<void> { await this.port.load(value); }

  #move(id: string, direction: StackDirection): void {
    this.port.move(this.#required(id, "object id"), direction);
  }

  #artworkAddress(address: ArtworkSurfaceAddress): ArtworkSurfaceAddress {
    return {
      productId: this.#required(address.productId, "product id"),
      slotId: this.#required(address.slotId, "artwork slot")
    };
  }

  #nextId(): string { return this.#required(this.createId(), "generated object id"); }

  #required(value: string, label: string): string {
    if (!value.trim()) throw new Error(`${label} must not be empty`);
    return value;
  }
}
