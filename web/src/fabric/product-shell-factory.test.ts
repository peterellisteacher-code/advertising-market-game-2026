import { FabricObject, Group } from "fabric";
import { describe, expect, it } from "vitest";
import {
  FabricProductShellFactory,
  recolourProductShellRegion
} from "./product-shell-factory";

const SHELL_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  <g data-region="body" fill="#E8E2D8">
    <rect x="200" y="160" width="600" height="680" rx="80" />
  </g>
  <g data-region="accent" fill="#B85165">
    <rect x="250" y="700" width="500" height="80" />
  </g>
  <rect data-print-area="front" x="300" y="300" width="400" height="360"
    fill="none" stroke="#2E6AE6" />
  <rect data-safe-area="front" x="330" y="330" width="340" height="300"
    fill="none" stroke="#20A464" />
</svg>`;

function descendants(root: FabricObject): FabricObject[] {
  if (!(root instanceof Group)) return [root];
  return [root, ...root.getObjects().flatMap(descendants)];
}

describe("FabricProductShellFactory", () => {
  it("loads one editable shell group with named regions and export-hidden guides", async () => {
    const shell = await new FabricProductShellFactory().create({
      id: "shell-object-1",
      shellId: "fashion-street-tee",
      svg: SHELL_SVG,
      accessibleName: "Streetwear T-shirt"
    });

    expect(shell).toBeInstanceOf(Group);
    expect(shell).toMatchObject({
      objectId: "shell-object-1",
      elementKind: "product-shell",
      shellId: "fashion-street-tee",
      accessibleName: "Streetwear T-shirt",
      left: 800,
      top: 450,
      originX: "center",
      originY: "center"
    });
    const objects = descendants(shell);
    expect(objects.some((object) => object.shellRegion === "body")).toBe(true);
    expect(objects.some((object) => object.shellRegion === "accent")).toBe(true);
    expect(objects.filter((object) => object.editorGuide)).toHaveLength(2);

    expect(recolourProductShellRegion(shell, "accent", "#157A6E")).toBeGreaterThan(0);
    const accent = objects.filter((object) => object.shellRegion === "accent");
    expect(accent.some((object) => object.fill === "#157A6E")).toBe(true);
    expect(() => recolourProductShellRegion(shell, "missing", "#FFFFFF"))
      .toThrow("missing region");
  });

  it("preserves shell, region, and guide metadata through Fabric serialization", async () => {
    const original = await new FabricProductShellFactory().create({
      id: "shell-object-round-trip",
      shellId: "drinks-classic-can",
      svg: SHELL_SVG,
      accessibleName: "Classic Soft Drink Can"
    });

    const restored = await Group.fromObject(original.toObject());
    const objects = descendants(restored);

    expect(restored).toMatchObject({
      objectId: "shell-object-round-trip",
      elementKind: "product-shell",
      shellId: "drinks-classic-can",
      accessibleName: "Classic Soft Drink Can"
    });
    expect(objects.some((object) => object.shellRegion === "body")).toBe(true);
    expect(objects.some((object) => object.shellRegion === "accent")).toBe(true);
    expect(objects.filter((object) => object.editorGuide)).toHaveLength(2);
  });
});
