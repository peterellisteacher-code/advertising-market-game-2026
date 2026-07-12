import { expect, it } from "vitest";
import { computeVirtualWindow } from "./virtual-grid";

it.each([
  { columns: 1, viewportHeight: 360, scrollTop: 0 },
  { columns: 6, viewportHeight: 900, scrollTop: 36_000 },
  { columns: 12, viewportHeight: 2_160, scrollTop: 120_000 },
  { columns: 80, viewportHeight: 900, scrollTop: 0 }
])("never exposes more than 72 live tiles: %o", (shape) => {
  const window = computeVirtualWindow({
    itemCount: 15_000,
    rowHeight: 180,
    overscanRows: 3,
    ...shape
  });

  expect(window.start).toBeGreaterThanOrEqual(0);
  expect(window.end).toBeLessThanOrEqual(15_000);
  expect(window.end - window.start).toBeLessThanOrEqual(72);
});

it("returns an empty bounded window for an empty catalogue", () => {
  expect(computeVirtualWindow({
    itemCount: 0,
    columns: 0,
    rowHeight: 0,
    viewportHeight: 900,
    scrollTop: 0,
    overscanRows: 3
  })).toEqual({ start: 0, end: 0, top: 0, totalHeight: 0 });
});

it("keeps the final asset reachable when a viewport requests 80 columns", () => {
  const shape = {
    itemCount: 200,
    columns: 80,
    rowHeight: 180,
    viewportHeight: 2_160,
    overscanRows: 3
  };
  const first = computeVirtualWindow({ ...shape, scrollTop: 0 });
  const last = computeVirtualWindow({
    ...shape,
    scrollTop: Math.max(0, first.totalHeight - shape.viewportHeight)
  });

  expect(first.totalHeight).toBeGreaterThan(shape.viewportHeight);
  expect(last.end).toBe(200);
  expect(last.end - last.start).toBeLessThanOrEqual(72);
});
