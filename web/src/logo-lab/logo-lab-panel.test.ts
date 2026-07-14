import {
  fireEvent,
  getAllByRole,
  getByLabelText,
  getByRole,
  waitFor
} from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LogoMarkSnapshot } from "../fabric/canvas-port";
import type { LogoIconCatalogue, LogoIconRecord } from "./logo-icon-catalogue";
import { createLogoMarkDesign, type LogoMarkDesign } from "./logo-mark-model";
import { LogoLabPanel } from "./logo-lab-panel";

function catalogue(count = 45): LogoIconCatalogue {
  return Object.freeze({
    schema: "logo-icon-catalog@1",
    packId: "tabler-logo-icons-v1",
    version: 1,
    source: Object.freeze({
      name: "Tabler Icons",
      package: "@tabler/icons",
      packageVersion: "1.2.35",
      sourceVersion: "3.44.0",
      licence: "MIT",
      url: "https://tabler.io/icons"
    }),
    icons: Object.freeze(Array.from({ length: count }, (_, index) => Object.freeze({
      id: `icon-${String(index).padStart(3, "0")}`,
      title: `Symbol ${String(index).padStart(3, "0")}`,
      body: `<path fill="none" stroke="currentColor" d="M2 ${index % 20}h20"/>`,
      width: 24,
      height: 24,
      categories: Object.freeze([index % 2 === 0 ? "pets-animals" : "tech-gadgets"])
    })))
  });
}

function setup(options: {
  onAdd?: ConstructorParameters<typeof LogoLabPanel>[1];
  onReplace?: ConstructorParameters<typeof LogoLabPanel>[2];
  announce?: ConstructorParameters<typeof LogoLabPanel>[3];
} = {}) {
  const host = document.createElement("div");
  document.body.replaceChildren(host);
  const onAdd = options.onAdd ?? vi.fn(async (
    _design: LogoMarkDesign,
    _icon: LogoIconRecord
  ) => "logo-1");
  const onReplace = options.onReplace ?? vi.fn(async (
    _id: string,
    _design: LogoMarkDesign,
    _icon: LogoIconRecord
  ) => undefined);
  const announce = options.announce ?? vi.fn();
  const panel = new LogoLabPanel(host, onAdd, onReplace, announce);
  panel.render(catalogue());
  return { host, panel, onAdd, onReplace, announce };
}

function chooseReadyDraft(host: HTMLElement): void {
  const words = getByLabelText<HTMLInputElement>(host, "Logo words");
  words.value = "Nova Pet";
  fireEvent.input(words);
  fireEvent.click(getByRole(host, "button", { name: "Symbol 000" }));
}

function existingMark(): LogoMarkSnapshot {
  return Object.freeze({
    id: "logo-1",
    design: createLogoMarkDesign({
      recipe: "icon-wordmark",
      text: "Nova Pet",
      iconId: "icon-000",
      primary: "#0B6E99",
      secondary: "#F6C85F",
      typeface: "Trebuchet MS",
      seed: 41,
      revision: 0
    })
  });
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("LogoLabPanel", () => {
  it("renders four recipes, native labels and at most forty filtered symbols", () => {
    const { host } = setup();

    expect(getAllByRole(host, "radio").map((radio) => radio.parentElement?.textContent)).toEqual([
      "Icon + Wordmark",
      "Badge / Seal",
      "Monogram",
      "Mascot / Emblem"
    ]);
    expect(getByLabelText(host, "Logo words")).toBeInstanceOf(HTMLInputElement);
    expect(getByLabelText(host, "Symbol category")).toBeInstanceOf(HTMLSelectElement);
    expect(getByLabelText(host, "Search symbols")).toBeInstanceOf(HTMLInputElement);
    expect(getByLabelText(host, "Main colour")).toBeInstanceOf(HTMLInputElement);
    expect(getByLabelText(host, "Second colour")).toBeInstanceOf(HTMLInputElement);
    expect(getByLabelText(host, "Logo on canvas")).toBeInstanceOf(HTMLSelectElement);
    expect(host.querySelectorAll("button[data-logo-icon-id]")).toHaveLength(40);
    expect([...host.querySelectorAll("button[data-logo-icon-id]")]
      .every((button) => button.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(getByRole<HTMLButtonElement>(host, "button", { name: "Add logo" }).disabled).toBe(true);

    chooseReadyDraft(host);

    expect(getByRole<HTMLButtonElement>(host, "button", { name: "Add logo" }).disabled).toBe(false);
    expect(getByRole(host, "button", { name: "Symbol 000" }).getAttribute("aria-pressed"))
      .toBe("true");
    expect(host.textContent).not.toMatch(/\b(?:assignment|unit|task)\b/i);
  });

  it("keeps search focus while filtering and honours category filters", () => {
    const { host } = setup();
    const search = getByLabelText<HTMLInputElement>(host, "Search symbols");
    search.focus();
    search.value = "044";
    fireEvent.input(search);

    expect(document.activeElement).toBe(getByLabelText(host, "Search symbols"));
    expect(host.querySelectorAll("button[data-logo-icon-id]")).toHaveLength(1);
    expect(getByRole(host, "button", { name: "Symbol 044" })).toBeTruthy();

    const refreshedSearch = getByLabelText<HTMLInputElement>(host, "Search symbols");
    refreshedSearch.value = "";
    fireEvent.input(refreshedSearch);
    const category = getByLabelText<HTMLSelectElement>(host, "Symbol category");
    category.value = "tech-gadgets";
    fireEvent.change(category);
    expect([...host.querySelectorAll<HTMLButtonElement>("button[data-logo-icon-id]")]
      .every((button) => Number(button.dataset.logoIconId?.slice(-3)) % 2 === 1)).toBe(true);
  });

  it("adds and updates one mark only after successful async callbacks", async () => {
    const onAdd = vi.fn(async (_design: LogoMarkDesign, _icon: LogoIconRecord) => "logo-1");
    const onReplace = vi.fn(async (
      _id: string,
      _design: LogoMarkDesign,
      _icon: LogoIconRecord
    ) => undefined);
    const announce = vi.fn();
    const { host, panel } = setup({ onAdd, onReplace, announce });
    chooseReadyDraft(host);

    fireEvent.click(getByRole(host, "button", { name: "Add logo" }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledOnce());
    const addedDesign = onAdd.mock.calls[0]![0];
    panel.setMarks([Object.freeze({ id: "logo-1", design: addedDesign })]);
    expect(getByLabelText<HTMLSelectElement>(host, "Logo on canvas").value).toBe("logo-1");
    expect(getByRole(host, "button", { name: "Update logo" })).toBeTruthy();
    expect(announce).toHaveBeenCalledWith("Nova Pet logo added", "polite");

    const mainColour = getByLabelText<HTMLInputElement>(host, "Main colour");
    mainColour.value = "#7c3aed";
    fireEvent.input(mainColour);
    fireEvent.click(getByRole(host, "button", { name: "Update logo" }));
    await waitFor(() => expect(onReplace).toHaveBeenCalledOnce());
    expect(onReplace).toHaveBeenCalledWith(
      "logo-1",
      expect.objectContaining({ primary: "#7C3AED", revision: 1 }),
      expect.objectContaining({ id: "icon-000" })
    );
    expect(announce).toHaveBeenCalledWith("Nova Pet logo updated", "polite");
  });

  it("runs four deterministic remix moves on an existing mark", async () => {
    const onReplace = vi.fn(async (
      _id: string,
      _design: LogoMarkDesign,
      _icon: LogoIconRecord
    ) => undefined);
    const { host, panel } = setup({ onReplace });
    panel.setMarks([existingMark()]);
    const chooser = getByLabelText<HTMLSelectElement>(host, "Logo on canvas");
    chooser.value = "logo-1";
    fireEvent.change(chooser);
    const details = host.querySelector<HTMLDetailsElement>("details")!;
    details.open = true;

    for (const [index, name] of [
      "Remix symbol",
      "Remix type",
      "Remix colours",
      "Surprise me"
    ].entries()) {
      fireEvent.click(getByRole(host, "button", { name }));
      await waitFor(() => expect(onReplace).toHaveBeenCalledTimes(index + 1));
    }

    const designs = onReplace.mock.calls.map((call) => call[1]);
    expect(designs[0]!.iconId).not.toBe("icon-000");
    expect(designs[1]!.typeface).not.toBe(designs[0]!.typeface);
    expect([designs[2]!.primary, designs[2]!.secondary])
      .not.toEqual([designs[1]!.primary, designs[1]!.secondary]);
    expect(designs.map(({ revision }) => revision)).toEqual([1, 2, 3, 4]);
  });

  it("preserves a saved mark whose symbol is absent from the current pack", () => {
    const { host, panel } = setup();
    panel.setMarks([Object.freeze({
      id: "logo-missing",
      design: createLogoMarkDesign({ ...existingMark().design, iconId: "missing-symbol" })
    })]);
    const chooser = getByLabelText<HTMLSelectElement>(host, "Logo on canvas");
    chooser.value = "logo-missing";
    fireEvent.change(chooser);

    expect(getByRole<HTMLButtonElement>(host, "button", { name: "Update logo" }).disabled)
      .toBe(true);
    expect(getByRole(host, "status").textContent).toMatch(/saved symbol.*not in this pack/i);
  });

  it("announces failures, fails softly when unavailable and disposes cleanly", async () => {
    const announce = vi.fn();
    const { host, panel } = setup({
      onAdd: vi.fn(async () => { throw new Error("Synthetic add failure"); }),
      announce
    });
    chooseReadyDraft(host);
    fireEvent.click(getByRole(host, "button", { name: "Add logo" }));
    await waitFor(() => expect(getByRole(host, "alert").textContent)
      .toMatch(/logo could not be added/i));
    expect(announce).toHaveBeenCalledWith("Logo could not be added", "assertive");

    panel.unavailable();
    expect(getByRole(host, "status").textContent).toBe("Logo maker unavailable");
    expect(getByRole<HTMLButtonElement>(host, "button", { name: "Add logo" }).disabled).toBe(true);

    panel.dispose();
    expect(host.childElementCount).toBe(0);
  });
});
