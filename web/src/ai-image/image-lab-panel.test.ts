import { fireEvent, getByLabelText, getByRole, queryByRole, waitFor } from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";
import { ImageLabClientError } from "./image-lab-client";
import {
  ImageLabPanel,
  type ImageLabActions,
  type ImageLabAllowance
} from "./image-lab-panel";

const identity = {
  sessionId: "session-pair-7",
  teamId: "team-pair-7",
  productName: "Fizz Finch"
};

const ready = {
  enabled: true as const,
  accountCapUsd: 5,
  objectAllowance: 6,
  realiseAllowance: 2
};

const allowance: ImageLabAllowance = {
  remainingObject: 5,
  remainingRealise: 2,
  expiresAt: 2_000_000_000
};

function actions(overrides: Partial<ImageLabActions> = {}): ImageLabActions {
  return {
    getConfig: vi.fn().mockResolvedValue(ready),
    unlock: vi.fn().mockResolvedValue(allowance),
    lock: vi.fn().mockResolvedValue(undefined),
    forgeObject: vi.fn().mockResolvedValue({ ...allowance, remainingObject: 4 }),
    makeReal: vi.fn().mockResolvedValue({ ...allowance, remainingRealise: 1 }),
    ...overrides
  };
}

describe("ImageLabPanel", () => {
  it("cancels an initial check immediately and can restart it without staying stuck", async () => {
    const host = document.createElement("div");
    const signals: AbortSignal[] = [];
    const getConfig = vi.fn().mockImplementation((signal: AbortSignal) => {
      signals.push(signal);
      if (signals.length > 1) return Promise.resolve(ready);
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")), {
          once: true
        });
      });
    });
    const panel = new ImageLabPanel(host, actions({ getConfig }));
    panel.setPair(identity);
    const firstCheck = panel.initialise();
    await waitFor(() => expect(getConfig).toHaveBeenCalledOnce());

    panel.cancel();

    expect(signals[0]?.aborted).toBe(true);
    await firstCheck;
    await panel.initialise();
    expect(getConfig).toHaveBeenCalledTimes(2);
    expect(getByLabelText(host, "Teacher code")).toBeTruthy();
  });

  it("keeps the built-in creator reassuringly available when Image Lab is off", async () => {
    const host = document.createElement("div");
    const panel = new ImageLabPanel(host, actions({
      getConfig: vi.fn().mockResolvedValue({
        enabled: false,
        reason: "school-approval-required"
      })
    }));

    await panel.initialise();

    expect(getByRole(host, "status").textContent).toContain("Image Lab is asleep");
    expect(host.textContent).toContain("Built-in tools still work");
    expect(queryByRole(host, "button")).toBeNull();
  });

  it("requires a teacher unlock and never exposes models or image settings", async () => {
    const host = document.createElement("div");
    const port = actions();
    const panel = new ImageLabPanel(host, port);
    panel.setPair(identity);
    await panel.initialise();

    const code = getByLabelText<HTMLInputElement>(host, "Teacher code");
    code.value = "room-code";
    fireEvent.click(getByRole(host, "button", { name: "Wake Image Lab" }));

    await waitFor(() => expect(port.unlock).toHaveBeenCalledWith({
      sessionId: identity.sessionId,
      teamId: identity.teamId,
      code: "room-code"
    }, expect.any(AbortSignal)));
    await waitFor(() => expect(getByRole(host, "button", { name: "Forge object" })).toBeTruthy());
    expect(host.textContent).toContain("5 Object Forge uses remaining");
    expect(host.textContent).toContain("2 Make It Real uses remaining");
    expect(host.textContent).not.toMatch(/model|slug|steps|quality|dimensions/i);
  });

  it("lets the teacher close the pair session immediately", async () => {
    const host = document.createElement("div");
    const port = actions();
    const panel = new ImageLabPanel(host, port);
    panel.setPair(identity);
    await panel.initialise();

    const code = getByLabelText<HTMLInputElement>(host, "Teacher code");
    code.value = "room-code";
    fireEvent.click(getByRole(host, "button", { name: "Wake Image Lab" }));
    await waitFor(() => expect(getByRole(host, "button", { name: "Close Image Lab" })).toBeTruthy());

    fireEvent.click(getByRole(host, "button", { name: "Close Image Lab" }));

    await waitFor(() => expect(port.lock).toHaveBeenCalledWith(expect.any(AbortSignal)));
    await waitFor(() => expect(getByLabelText(host, "Teacher code")).toBeTruthy());
    expect(getByRole(host, "status").textContent).toContain("closed for this pair");
  });

  it("forges one constrained object and forwards the background choice", async () => {
    const host = document.createElement("div");
    const port = actions();
    const panel = new ImageLabPanel(host, port);
    panel.setPair(identity);
    await panel.initialise();
    const code = getByLabelText<HTMLInputElement>(host, "Teacher code");
    code.value = "room-code";
    fireEvent.click(getByRole(host, "button", { name: "Wake Image Lab" }));
    await waitFor(() => expect(getByRole(host, "button", { name: "Forge object" })).toBeTruthy());

    const objectName = getByRole<HTMLInputElement>(host, "textbox", { name: "Object idea" });
    objectName.value = "curved reusable drink bottle";
    fireEvent.change(getByRole(host, "combobox", { name: "Object type" }), {
      target: { value: "drink packaging" }
    });
    fireEvent.change(getByRole(host, "combobox", { name: "Object look" }), {
      target: { value: "clean 3D cutout" }
    });
    const colour = getByRole<HTMLInputElement>(host, "textbox", { name: "Main colour" });
    colour.value = "electric blue";
    fireEvent.click(getByRole(host, "button", { name: "Forge object" }));

    await waitFor(() => expect(port.forgeObject).toHaveBeenCalledWith({
      sessionId: identity.sessionId,
      teamId: identity.teamId,
      objectName: "curved reusable drink bottle",
      category: "drink packaging",
      style: "clean 3D cutout",
      colour: "electric blue",
      removeWhiteBackground: true
    }, expect.any(AbortSignal)));
    await waitFor(() => expect(getByRole(host, "status").textContent).toContain("Your new object is on the canvas."));
  });

  it("uses the current product name for Make It Real and reports failures without losing controls", async () => {
    const host = document.createElement("div");
    const port = actions({ makeReal: vi.fn().mockRejectedValue(new Error("offline")) });
    const panel = new ImageLabPanel(host, port);
    panel.setPair(identity);
    await panel.initialise();
    const code = getByLabelText<HTMLInputElement>(host, "Teacher code");
    code.value = "room-code";
    fireEvent.click(getByRole(host, "button", { name: "Wake Image Lab" }));
    await waitFor(() => expect(getByRole(host, "button", { name: "Make it real" })).toBeTruthy());

    expect(getByRole(host, "region", { name: "Make It Real" }).textContent)
      .toContain("Use this after the product design is ready, before you build the ad");
    expect(getByRole(host, "region", { name: "Make It Real" }).textContent)
      .toContain("Existing words and marks will be fitted to the product surface");
    expect(getByRole<HTMLInputElement>(host, "textbox", { name: "Product kind" }).value)
      .toBe("Fizz Finch");
    fireEvent.change(getByRole(host, "combobox", { name: "Product scene" }), {
      target: { value: "bright shop shelf" }
    });
    fireEvent.click(getByRole(host, "button", { name: "Make it real" }));

    await waitFor(() => expect(port.makeReal).toHaveBeenCalledWith({
      sessionId: identity.sessionId,
      teamId: identity.teamId,
      productKind: "Fizz Finch",
      scene: "bright shop shelf"
    }, expect.any(AbortSignal)));
    await waitFor(() => expect(getByRole(host, "alert").textContent).toContain("could not finish"));
    expect(getByRole<HTMLButtonElement>(host, "button", { name: "Make it real" }).disabled)
      .toBe(false);
  });

  it.each(["IMAGE_LAB_LOCKED", "SESSION_EXPIRED"] as const)(
    "returns to the teacher-code state when generation reports %s",
    async (code) => {
      const host = document.createElement("div");
      const port = actions({
        forgeObject: vi.fn().mockRejectedValue(new ImageLabClientError(code, code))
      });
      const panel = new ImageLabPanel(host, port);
      panel.setPair(identity);
      await panel.initialise();
      const teacherCode = getByLabelText<HTMLInputElement>(host, "Teacher code");
      teacherCode.value = "room-code";
      fireEvent.click(getByRole(host, "button", { name: "Wake Image Lab" }));
      await waitFor(() => expect(getByRole(host, "button", { name: "Forge object" })).toBeTruthy());
      getByRole<HTMLInputElement>(host, "textbox", { name: "Object idea" }).value = "lamp";

      fireEvent.click(getByRole(host, "button", { name: "Forge object" }));

      await waitFor(() => expect(getByLabelText(host, "Teacher code")).toBeTruthy());
      expect(getByRole(host, "status").textContent).toContain("teacher");
      expect(queryByRole(host, "button", { name: "Forge object" })).toBeNull();
    }
  );

  it("contains no schoolwork framing", async () => {
    const host = document.createElement("div");
    const panel = new ImageLabPanel(host, actions());
    panel.setPair(identity);
    await panel.initialise();
    expect(host.textContent).not.toMatch(/\b(?:assignment|unit|task)\b/i);
  });
});
