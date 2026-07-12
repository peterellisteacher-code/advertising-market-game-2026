import { Rect } from "fabric";
import { expect, it } from "vitest";
import "./fabric-custom-properties";

it("serializes application metadata", () => {
  const rect = new Rect({ width: 10, height: 10 });
  rect.objectId = "object-1";
  rect.elementKind = "shape";
  rect.accessibleName = "Red attention block";

  expect(rect.toObject()).toMatchObject({
    objectId: "object-1",
    elementKind: "shape",
    accessibleName: "Red attention block"
  });
});
