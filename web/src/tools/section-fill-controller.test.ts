import { fireEvent, getByLabelText, getByRole } from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";
import type {
  CanvasObjectSummary,
  CanvasPoint,
  FillableRasterSnapshot,
  RasterSectionFillRecipe
} from "../fabric/canvas-port";
import { SectionFillController } from "./section-fill-controller";

const HASH = "a".repeat(64);

function summary(
  id: string,
  elementKind: CanvasObjectSummary["elementKind"],
  accessibleName = id === "starter-1" ? "Harbour shoe" : "Canvas item"
): CanvasObjectSummary {
  return {
    id,
    accessibleName,
    elementKind,
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    visible: true,
    locked: false,
    stackIndex: 0
  };
}

function snapshot(
  sectionMode: FillableRasterSnapshot["sectionMode"] = "connected"
): FillableRasterSnapshot {
  return {
    id: "starter-1",
    assetId: "shoe-starter",
    sourceSha256: HASH,
    width: 640,
    height: 480,
    sectionMode
  };
}

function setup(options: {
  readonly selected?: CanvasObjectSummary;
  readonly fillable?: FillableRasterSnapshot | null;
  readonly point?: CanvasPoint;
} = {}) {
  document.body.innerHTML = `
    <section data-fill-host></section>
    <canvas width="1600" height="900"></canvas>
    <button data-mutation>Mutate</button>
  `;
  const host = document.querySelector<HTMLElement>("[data-fill-host]")!;
  const canvas = document.querySelector<HTMLCanvasElement>("canvas")!;
  const selected = options.selected ?? summary("starter-1", "image");
  const fillable = options.fillable === undefined ? snapshot() : options.fillable;
  const events: string[] = [];
  const previewRasterSectionFill = vi.fn(async (
    _id: string,
    _recipe: RasterSectionFillRecipe
  ) => { events.push("preview"); });
  const cancelRasterSectionFillPreview = vi.fn((_id: string) => {
    events.push("cancel");
  });
  const applyRasterSectionFill = vi.fn(async (
    _id: string,
    _recipe: RasterSectionFillRecipe
  ) => { events.push("apply"); });
  const transaction = vi.fn(async (operation: () => Promise<void>) => {
    events.push("transaction:start");
    await operation();
    events.push("transaction:end");
  });
  const announce = vi.fn();
  const port = {
    listObjectSummaries: () => [selected],
    getFillableRaster: vi.fn(async () => fillable),
    rasterSourcePoint: vi.fn(() => options.point ?? { x: 23, y: 41 }),
    previewRasterSectionFill,
    cancelRasterSectionFillPreview,
    applyRasterSectionFill
  };
  const controller = new SectionFillController({
    host,
    canvas,
    port,
    transaction,
    announce,
    mutationControls: [document.querySelector<HTMLButtonElement>("[data-mutation]")!]
  });
  return {
    host,
    canvas,
    port,
    controller,
    transaction,
    announce,
    events,
    previewRasterSectionFill,
    cancelRasterSectionFillPreview,
    applyRasterSectionFill
  };
}

describe("SectionFillController", () => {
  it("offers a bounded section fill only for an admitted raster", async () => {
    const { host, controller } = setup();

    await controller.setSelection("starter-1");

    expect(host.hidden).toBe(false);
    expect(getByRole(host, "heading", { name: "Colour selected item" })).toBeTruthy();
    expect(getByRole(host, "button", { name: "Fill section" })).toBeTruthy();
    expect(getByLabelText<HTMLInputElement>(host, "Fill colour").value).toBe("#e4572e");
  });

  it.each([
    ["text", "Text uses its own colour controls.", undefined],
    ["logo-mark", "Logo colours are edited in Logo Lab.", undefined],
    ["text", "Price styling uses the Price controls.", "Market price M$45"],
    ["drawing", "Drawing colour is fixed when the stroke is created.", undefined],
    ["product-kit", "Product Kit colours use their named product controls.", undefined],
    ["image", "Section fill is unavailable for this image.", undefined]
  ] as const)("explains why %s cannot use section fill", async (
    elementKind,
    message,
    accessibleName
  ) => {
    const { host, controller } = setup({
      selected: summary("other-1", elementKind, accessibleName),
      fillable: null
    });

    await controller.setSelection("other-1");

    expect(host.textContent).toContain(message);
    expect(host.querySelector("input")).toBeNull();
  });

  it("enters crosshair mode, inverse-maps the canvas click and previews only the recipe", async () => {
    const {
      host,
      canvas,
      controller,
      announce,
      previewRasterSectionFill,
      port
    } = setup({ point: { x: 23, y: 41 } });
    await controller.setSelection("starter-1");
    const colour = getByLabelText<HTMLInputElement>(host, "Fill colour");
    fireEvent.input(colour, { target: { value: "#336699" } });

    fireEvent.click(getByRole(host, "button", { name: "Fill section" }));

    expect(canvas.style.cursor).toBe("crosshair");
    expect(announce).toHaveBeenCalledWith(
      "Choose one bounded section of Harbour shoe.",
      "polite"
    );
    expect(getByRole(host, "button", { name: "Cancel fill" })).toBeTruthy();

    fireEvent.click(canvas, { clientX: 100, clientY: 200 });
    await vi.waitFor(() => expect(previewRasterSectionFill).toHaveBeenCalledTimes(1));

    expect(port.rasterSourcePoint).toHaveBeenCalledWith(
      "starter-1",
      { x: 100, y: 200 }
    );
    expect(previewRasterSectionFill).toHaveBeenCalledWith("starter-1", {
      schema: "raster-section-fill",
      version: 1,
      fillProfile: "bounded-linework-v1",
      sourceAssetId: "shoe-starter",
      sourceSha256: HASH,
      seedX: 23,
      seedY: 41,
      colour: "#336699",
      colourDistance: 48
    });
    expect(getByRole(host, "button", { name: "Apply fill" })).toBeTruthy();
  });

  it("restores the exact preview before one transactional apply", async () => {
    const {
      host,
      canvas,
      controller,
      events,
      transaction,
      applyRasterSectionFill
    } = setup();
    await controller.setSelection("starter-1");
    fireEvent.click(getByRole(host, "button", { name: "Fill section" }));
    fireEvent.click(canvas, { clientX: 10, clientY: 20 });
    await vi.waitFor(() =>
      expect(getByRole(host, "button", { name: "Apply fill" })).toBeTruthy()
    );

    fireEvent.click(getByRole(host, "button", { name: "Apply fill" }));
    await vi.waitFor(() => {
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(applyRasterSectionFill).toHaveBeenCalledTimes(1);
      expect(events.at(-1)).toBe("transaction:end");
    });

    expect(events).toEqual([
      "preview",
      "cancel",
      "transaction:start",
      "apply",
      "transaction:end"
    ]);
    expect(applyRasterSectionFill).toHaveBeenCalledTimes(1);
    expect(canvas.style.cursor).toBe("");
  });

  it("cancels without a transaction and restores mutation controls and focus", async () => {
    const {
      host,
      canvas,
      controller,
      transaction,
      cancelRasterSectionFillPreview
    } = setup();
    await controller.setSelection("starter-1");
    const begin = getByRole<HTMLButtonElement>(host, "button", { name: "Fill section" });
    begin.focus();
    fireEvent.click(begin);
    fireEvent.click(canvas, { clientX: 10, clientY: 20 });
    await vi.waitFor(() =>
      expect(getByRole(host, "button", { name: "Cancel fill" })).toBeTruthy()
    );
    const mutation = document.querySelector<HTMLButtonElement>("[data-mutation]")!;
    expect(mutation.disabled).toBe(true);

    fireEvent.keyDown(document, { key: "Escape" });
    await vi.waitFor(() => {
      expect(cancelRasterSectionFillPreview).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(
        getByRole(host, "button", { name: "Fill section" })
      );
    });

    expect(transaction).not.toHaveBeenCalled();
    expect(mutation.disabled).toBe(false);
  });

  it("previews a certified single-region raster without requesting a seed click", async () => {
    const {
      host,
      controller,
      previewRasterSectionFill
    } = setup({ fillable: snapshot("whole-object") });
    await controller.setSelection("starter-1");

    fireEvent.click(getByRole(host, "button", { name: "Fill object" }));
    await vi.waitFor(() => expect(previewRasterSectionFill).toHaveBeenCalledTimes(1));

    expect(previewRasterSectionFill).toHaveBeenCalledWith(
      "starter-1",
      expect.objectContaining({
        fillProfile: "opaque-body-v1",
        seedX: 320,
        seedY: 240
      })
    );
  });

  it("reports a factual preview failure without creating history", async () => {
    const {
      host,
      canvas,
      controller,
      previewRasterSectionFill,
      transaction,
      announce
    } = setup();
    previewRasterSectionFill.mockRejectedValueOnce(
      new Error("That section reaches the image background. Choose a closed section.")
    );
    await controller.setSelection("starter-1");
    fireEvent.click(getByRole(host, "button", { name: "Fill section" }));
    fireEvent.click(canvas, { clientX: 10, clientY: 20 });

    await vi.waitFor(() => expect(announce).toHaveBeenCalledWith(
      "That section reaches the image background. Choose a closed section.",
      "assertive"
    ));
    expect(transaction).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Choose another section");
  });
});
