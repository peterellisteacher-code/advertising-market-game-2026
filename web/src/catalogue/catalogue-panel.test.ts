import { fireEvent } from "@testing-library/dom";
import { afterEach, expect, it, vi } from "vitest";
import { CataloguePanel } from "./catalogue-panel";
import type { CatalogAssetV1 } from "./catalogue-types";

const asset = (
  id: string,
  title: string,
  category: string,
  tags: string[],
  thumbnail = `/catalog/${id}-192.webp`
): CatalogAssetV1 => ({
  schema: "catalog-asset@1",
  id,
  version: 1,
  kind: "component",
  title,
  category,
  tags,
  files: {
    thumbnail,
    preview: `/catalog/${id}-640.webp`,
    master: `/catalog/${id}.png`
  },
  recolourZones: ["body"],
  classroomReviewed: true,
  brandFree: true,
  anchors: [],
  materialProfiles: ["matte-plastic"],
  attribution: {
    creator: "Classroom pack",
    sourceUrl: "local",
    license: "classroom-session"
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

it("mounts at most 72 safe semantic asset buttons", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const onPick = vi.fn();
  const panel = new CataloguePanel(host, onPick);
  const records = Array.from(
    { length: 200 },
    (_, index) => asset(
      `id-${index}`,
      index === 0 ? "<script>alert(1)</script>" : `Bottle ${index}`,
      "drinkware",
      ["bottle"],
      index === 0 ? "https://unsafe.example/tracker.png" : `/catalog/id-${index}-192.webp`
    )
  );

  panel.render(records, 0, 2_160, 80);

  const buttons = host.querySelectorAll("button[data-asset-id]");
  expect(buttons.length).toBe(72);
  expect(host.querySelector("script")).toBeNull();
  expect(buttons[0]?.textContent).toBe("<script>alert(1)</script>");
  expect(buttons[0]?.querySelector("img")?.getAttribute("src"))
    .toBe("/catalog/system/missing-thumbnail.svg");

  fireEvent.click(buttons[0]!);
  expect(onPick).toHaveBeenCalledWith(records[0]);
  panel.destroy();
});

it("attaches its scroll listener only once across rerenders", () => {
  const host = document.createElement("div");
  const addEventListener = vi.spyOn(host, "addEventListener");
  const panel = new CataloguePanel(host, vi.fn());
  const records = [asset("a", "Bottle", "drinkware", ["bottle"])];

  panel.render(records);
  panel.render(records);

  expect(addEventListener.mock.calls.filter(([type]) => type === "scroll")).toHaveLength(1);
  panel.destroy();
});
