import { fireEvent } from "@testing-library/dom";
import { afterEach, expect, it, vi } from "vitest";
import { CataloguePanel, validatedAssetUrl } from "./catalogue-panel";
import type { CatalogAssetV1 } from "./catalogue-types";

const UUID = "123e4567-e89b-42d3-a456-426614174000";

const asset = (
  id: string,
  title: string,
  category: string,
  tags: string[],
  thumbnail = `/catalog/${id}-192.webp`
): CatalogAssetV1 => ({
  schema: "catalog-asset@1",
  delivery: "offline",
  id,
  version: 1,
  kind: "component",
  title,
  category,
  tags,
  files: {
    thumbnail,
    preview: `/catalog/generated/offline-core-v1/assets/${id}/preview-640.webp`,
    master: `/catalog/generated/offline-core-v1/assets/${id}/master.png`,
    masks: { body: `/catalog/generated/offline-core-v1/assets/${id}/masks/body.png` }
  },
  masterSha256: "a".repeat(64),
  dimensions: { width: 320, height: 640 },
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
  vi.unstubAllGlobals();
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
  const items = host.querySelectorAll('[role="listitem"]');
  expect(buttons.length).toBe(72);
  expect(host.querySelector('[role="list"]')).not.toBeNull();
  expect(items.length).toBe(72);
  expect(items[0]?.getAttribute("aria-posinset")).toBe("1");
  expect(items[0]?.getAttribute("aria-setsize")).toBe("200");
  expect(host.querySelector("script")).toBeNull();
  expect(buttons[0]?.querySelector("[data-catalogue-title]")?.textContent)
    .toBe("<script>alert(1)</script>");
  const image = buttons[0]?.querySelector("img");
  expect(image?.getAttribute("src")).toBe("/catalog/system/missing-thumbnail.svg");
  expect(image?.getAttribute("alt")).toBe("");
  expect(image?.getAttribute("loading")).toBe("lazy");

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

it("restores the focused asset tile when the visible window repaints", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const panel = new CataloguePanel(host, vi.fn());
  const records = [
    asset("a", "Bottle", "drinkware", ["bottle"]),
    asset("b", "Cup", "drinkware", ["cup"])
  ];

  panel.render(records);
  const originalButton = host.querySelector<HTMLButtonElement>('[data-asset-id="b"]')!;
  originalButton.focus();

  panel.render(records);

  const replacementButton = host.querySelector<HTMLButtonElement>('[data-asset-id="b"]')!;
  expect(replacementButton).not.toBe(originalButton);
  expect(document.activeElement).toBe(replacementButton);
  panel.destroy();
});

it("removes its listener and disconnects its observer on destroy", () => {
  const observe = vi.fn();
  const disconnect = vi.fn();
  class ResizeObserverMock {
    observe = observe;
    disconnect = disconnect;
    unobserve = vi.fn();

    constructor(_callback: ResizeObserverCallback) {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  const host = document.createElement("div");
  const addEventListener = vi.spyOn(host, "addEventListener");
  const removeEventListener = vi.spyOn(host, "removeEventListener");
  const panel = new CataloguePanel(host, vi.fn());
  const scrollRegistration = addEventListener.mock.calls.find(([type]) => type === "scroll");

  panel.destroy();

  expect(observe).toHaveBeenCalledWith(host);
  expect(disconnect).toHaveBeenCalledOnce();
  expect(removeEventListener).toHaveBeenCalledWith("scroll", scrollRegistration?.[1]);
});

it.each([
  ["/catalog/item.png", true],
  [`/api/openverse-image/${UUID}`, true],
  [`/api/openverse-image/${UUID}?variant=thumbnail`, true],
  [`/api/openverse-image/${UUID}?variant=full`, true],
  ["/api/openverse-image/item", false],
  [`/api/openverse-image/${UUID.toUpperCase()}`, false],
  [`/api/openverse-image/${UUID}/`, false],
  [`/api/openverse-image/${UUID}?extra=1`, false],
  [`/api/openverse-image/${UUID}?variant=thumbnail&variant=full`, false],
  [`/api/openverse-image/${UUID}#fragment`, false],
  ["https://unsafe.example/item.png", false],
  ["/catalogue/item.png", false],
  ["/api/openverse-image-evil/item", false],
  ["http://[::1", false]
])("guards thumbnail URL %s", (value, allowed) => {
  const result = validatedAssetUrl(value);
  if (allowed) {
    expect(result).toBe(new URL(value, window.location.origin).href);
  } else {
    expect(result).toBe("/catalog/system/missing-thumbnail.svg");
  }
});

it("shows concise, text-only attribution on photo tiles", () => {
  const host = document.createElement("div");
  const photo: CatalogAssetV1 = {
    ...asset(UUID, "Morning market", "photos", ["photo"],
      `/api/openverse-image/${UUID}?variant=thumbnail`),
    kind: "photo",
    files: {
      thumbnail: `/api/openverse-image/${UUID}?variant=thumbnail`,
      preview: `/api/openverse-image/${UUID}`,
      master: `/api/openverse-image/${UUID}`
    },
    classroomReviewed: false,
    brandFree: false,
    attribution: {
      creator: "<b>A. Photographer</b>",
      sourceUrl: "https://example.test/work/123",
      license: "CC BY 4.0"
    }
  };
  const panel = new CataloguePanel(host, vi.fn());

  panel.render([photo]);

  const attribution = host.querySelector("[data-catalogue-attribution]");
  expect(attribution?.textContent).toBe("<b>A. Photographer</b> · CC BY 4.0");
  expect(attribution?.querySelector("b")).toBeNull();
  panel.destroy();
});

it("makes placement the visible card action and marks recolourable templates secondarily", () => {
  const host = document.createElement("div");
  const panel = new CataloguePanel(host, vi.fn());
  const colourable = asset("colourable", "Blank sofa", "sofas", ["sofa"]);
  const plain = {
    ...asset("plain", "Plain texture", "textures", ["texture"]),
    files: {
      thumbnail: "/catalog/plain-192.webp",
      preview: "/catalog/generated/offline-core-v1/assets/plain/preview-640.webp",
      master: "/catalog/generated/offline-core-v1/assets/plain/master.png"
    },
    recolourZones: [] as const,
    materialProfiles: [] as const
  } satisfies CatalogAssetV1;

  panel.render([colourable, plain]);

  expect(host.querySelector('[data-asset-id="colourable"] [data-colourable]')?.textContent)
    .toBe("Add with chosen colour");
  expect(host.querySelector('[data-asset-id="plain"] [data-colourable]')).toBeNull();
  expect([...host.querySelectorAll('[data-catalogue-action]')].map((node) => node.textContent))
    .toEqual(["Add with chosen colour", "Add to ad"]);
  panel.destroy();
});

it("does not pretend that a catalogue object has a real-world price", () => {
  const host = document.createElement("div");
  const panel = new CataloguePanel(host, vi.fn());
  const bottle = asset("priced-bottle", "Reviewed bottle", "drinkware", ["base", "bottle"]);

  panel.render([bottle]);

  expect(host.querySelector('[data-asset-id="priced-bottle"] [data-catalogue-price]'))
    .toBeNull();
  expect(host.querySelector('[data-asset-id="priced-bottle"]')?.textContent)
    .not.toContain("$");
  panel.destroy();
});
