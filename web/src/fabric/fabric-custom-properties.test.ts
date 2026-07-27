import { FabricImage, Rect } from "fabric";
import { expect, it } from "vitest";
import "./fabric-custom-properties";

it("serializes application metadata", () => {
  const rect = new Rect({ width: 10, height: 10 });
  rect.objectId = "object-1";
  rect.elementKind = "shape";
  rect.accessibleName = "Red attention block";
  rect.editorGuide = true;

  expect(rect.toObject()).toMatchObject({
    objectId: "object-1",
    elementKind: "shape",
    accessibleName: "Red attention block",
    editorGuide: true
  });
});

it("serializes immutable raster section-fill provenance and recipes", () => {
  const image = new FabricImage(document.createElement("canvas"));
  image.objectId = "starter-1";
  image.elementKind = "image";
  image.assetId = "shoe-starter";
  image.sourceHash = "a".repeat(64);
  image.rasterSectionFillSourceUrl = "/catalog/generated/offline-core-v1/assets/shoe-starter/master.png";
  image.rasterSectionFillMode = "connected-sections";
  image.rasterSectionFillProfile = "bounded-linework-v1";
  image.rasterSectionFillRecipes = [{
    schema: "raster-section-fill",
    version: 1,
    fillProfile: "bounded-linework-v1",
    sourceAssetId: "shoe-starter",
    sourceSha256: "a".repeat(64),
    seedX: 31,
    seedY: 47,
    colour: "#E4572E",
    colourDistance: 48
  }];

  expect(image.toObject()).toMatchObject({
    sourceHash: "a".repeat(64),
    rasterSectionFillSourceUrl:
      "/catalog/generated/offline-core-v1/assets/shoe-starter/master.png",
    rasterSectionFillMode: "connected-sections",
    rasterSectionFillProfile: "bounded-linework-v1",
    rasterSectionFillRecipes: [{
      schema: "raster-section-fill",
      version: 1,
      sourceAssetId: "shoe-starter",
      colour: "#E4572E"
    }]
  });
});
