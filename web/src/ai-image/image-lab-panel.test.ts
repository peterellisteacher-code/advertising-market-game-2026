import { fireEvent, getByRole, queryByRole, waitFor } from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";
import { ImageLabClientError } from "./image-lab-client";
import {
  ImageLabPanel,
  type ImageLabActions,
  type ImageLabStatus
} from "./image-lab-panel";
import { STUDENT_COPY } from "../game/student-copy";

const identity = {
  sessionId: "session-pair-7",
  teamId: "team-pair-7",
  productName: "Fizz Finch"
};

const ready: ImageLabStatus = {
  enabled: true,
  object: { remaining: 2, reserved: 0 },
  realise: { remaining: 1, reserved: 0 }
};

const afterObject: ImageLabStatus = {
  enabled: true,
  object: { remaining: 1, reserved: 0 },
  realise: { remaining: 1, reserved: 0 }
};

function actions(overrides: Partial<ImageLabActions> = {}): ImageLabActions {
  return {
    status: vi.fn().mockResolvedValue(ready),
    forgeObject: vi.fn().mockResolvedValue(afterObject),
    makeReal: vi.fn().mockResolvedValue({
      enabled: true,
      object: { remaining: 2, reserved: 0 },
      realise: { remaining: 0, reserved: 0 }
    }),
    makeAdvertisementReal: vi.fn().mockResolvedValue({
      enabled: true,
      object: { remaining: 2, reserved: 0 },
      realise: { remaining: 0, reserved: 0 }
    }),
    ...overrides
  };
}

describe("ImageLabPanel", () => {
  it("cancels an initial account check and can restart without staying stuck", async () => {
    const host = document.createElement("div");
    const signals: AbortSignal[] = [];
    const status = vi.fn().mockImplementation((signal: AbortSignal) => {
      signals.push(signal);
      if (signals.length > 1) return Promise.resolve(ready);
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")), {
          once: true
        });
      });
    });
    const panel = new ImageLabPanel(host, actions({ status }));
    panel.setPair(identity);
    const firstCheck = panel.initialise();
    await waitFor(() => expect(status).toHaveBeenCalledOnce());

    panel.cancel();

    expect(signals[0]?.aborted).toBe(true);
    await firstCheck;
    await panel.initialise();
    expect(status).toHaveBeenCalledTimes(2);
    expect(getByRole(host, "button", { name: "Forge object" })).toBeTruthy();
  });

  it("keeps the built-in creator available when the authenticated account has no allowance", async () => {
    const host = document.createElement("div");
    const panel = new ImageLabPanel(host, actions({
      status: vi.fn().mockResolvedValue({ enabled: false, reason: "disabled" })
    }));

    await panel.initialise();

    expect(getByRole(host, "status").textContent).toContain("not available for this account");
    expect(host.textContent).toContain("Built-in tools still work");
    expect(queryByRole(host, "button")).toBeNull();
  });

  it("shows factual account allowances and no teacher controls or model settings", async () => {
    const host = document.createElement("div");
    const panel = new ImageLabPanel(host, actions({
      status: vi.fn().mockResolvedValue({
        enabled: true,
        object: { remaining: 2, reserved: 1 },
        realise: { remaining: 1, reserved: 0 }
      })
    }));
    panel.setPair(identity);

    await panel.initialise();

    expect(host.textContent).toContain("Object Forge: 2 uses available");
    expect(host.textContent).toContain("Make It Real: 1 use available");
    expect(host.textContent).toContain("1 request is being checked");
    expect(host.textContent).not.toMatch(/Teacher code|Wake Image Lab|Close Image Lab/i);
    expect(host.querySelector('input[type="password"]')).toBeNull();
    expect(host.textContent).not.toMatch(/model|slug|steps|quality|dimensions/i);
  });

  it("keeps the two stage allowances independent and explains a zero allowance", async () => {
    const host = document.createElement("div");
    const panel = new ImageLabPanel(host, actions({
      status: vi.fn().mockResolvedValue({
        enabled: true,
        object: { remaining: 0, reserved: 0 },
        realise: { remaining: 1, reserved: 0 }
      })
    }));
    panel.setPair(identity);

    await panel.initialise();

    expect(host.textContent).toContain("Object Forge: 0 uses available");
    expect(host.textContent).toContain("No Object Forge uses are available.");
    expect(getByRole<HTMLButtonElement>(host, "button", { name: "Forge object" }).disabled).toBe(true);
    expect(queryByRole(host, "textbox", { name: "Object idea" })).toBeNull();
    expect(getByRole<HTMLInputElement>(host, "textbox", { name: "Product kind" }).value)
      .toBe("Fizz Finch");
    expect(getByRole<HTMLButtonElement>(host, "button", { name: "Make it real" }).disabled)
      .toBe(false);
  });

  it("forges one constrained object and forwards the local pair and background choice", async () => {
    const host = document.createElement("div");
    const port = actions();
    const panel = new ImageLabPanel(host, port);
    panel.setPair(identity);
    await panel.initialise();

    const objectName = getByRole<HTMLInputElement>(host, "textbox", { name: "Object idea" });
    objectName.value = "curved reusable drink bottle";
    fireEvent.change(getByRole(host, "combobox", { name: "Object type" }), {
      target: { value: "drink packaging" }
    });
    fireEvent.change(getByRole(host, "combobox", { name: "Object look" }), {
      target: { value: "clean 3D cutout" }
    });
    getByRole<HTMLInputElement>(host, "textbox", { name: "Main colour" }).value = "electric blue";
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
    await waitFor(() =>
    expect(getByRole(host, "status").textContent).toContain("Your new object is in the advertisement."));
    expect(host.textContent).toContain("Object Forge: 1 use available");
  });

  it("uses the current product name and refreshes account status after a terminal failure", async () => {
    const host = document.createElement("div");
    const status = vi.fn().mockResolvedValue(ready);
    const port = actions({
      status,
      makeReal: vi.fn().mockRejectedValue(new Error("offline"))
    });
    const panel = new ImageLabPanel(host, port);
    panel.setPair(identity);
    await panel.initialise();

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
    expect(status).toHaveBeenCalledTimes(2);
    expect(getByRole<HTMLButtonElement>(host, "button", { name: "Make it real" }).disabled)
      .toBe(false);
  });

  it("offers the advertisement operation only in assignment sandbox and shares the realise allowance", async () => {
    const guidedHost = document.createElement("div");
    const guided = new ImageLabPanel(guidedHost, actions());
    guided.setPair(identity);
    await guided.initialise();
    expect(queryByRole(guidedHost, "button", { name: "Make this advertisement realistic" }))
      .toBeNull();

    const sandboxHost = document.createElement("div");
    const port = actions();
    const sandbox = new ImageLabPanel(sandboxHost, port);
    sandbox.setPair({ ...identity, workspaceMode: "assignment-sandbox" });
    await sandbox.initialise();

    expect(sandboxHost.textContent).toContain("Make It Real: 1 use available");
    expect(getByRole(sandboxHost, "button", {
      name: STUDENT_COPY.assignmentSandbox.imageLab.makeProductReal
    })).toBeTruthy();
    expect(getByRole(sandboxHost, "note").textContent)
      .toBe(STUDENT_COPY.assignmentSandbox.imageLab.textWarning);
    fireEvent.click(getByRole(sandboxHost, "button", {
      name: STUDENT_COPY.assignmentSandbox.imageLab.makeAdvertisementRealistic
    }));

    await waitFor(() => expect(port.makeAdvertisementReal).toHaveBeenCalledWith({
      sessionId: identity.sessionId,
      teamId: identity.teamId
    }, expect.any(AbortSignal)));
  });

  it("offers Check request for an unknown outcome and reconciles the same submission", async () => {
    const host = document.createElement("div");
    const forgeObject = vi.fn()
      .mockRejectedValueOnce(new ImageLabClientError(
        "JOB_OUTCOME_UNCERTAIN",
        "The request outcome is unknown."
      ))
      .mockResolvedValueOnce(afterObject);
    const panel = new ImageLabPanel(host, actions({ forgeObject }));
    panel.setPair(identity);
    await panel.initialise();
    getByRole<HTMLInputElement>(host, "textbox", { name: "Object idea" }).value = "desk lamp";

    fireEvent.click(getByRole(host, "button", { name: "Forge object" }));

    await waitFor(() => expect(getByRole(host, "button", { name: "Check request" })).toBeTruthy());
    expect(host.textContent).not.toContain("Try again");
    fireEvent.click(getByRole(host, "button", { name: "Check request" }));
    await waitFor(() => expect(forgeObject).toHaveBeenCalledTimes(2));
    expect(forgeObject.mock.calls[1]?.[0]).toEqual(forgeObject.mock.calls[0]?.[0]);
    await waitFor(() =>
    expect(getByRole(host, "status").textContent).toContain("Your new object is in the advertisement."));
  });

  it("contains no schoolwork framing", async () => {
    const host = document.createElement("div");
    const panel = new ImageLabPanel(host, actions());
    panel.setPair(identity);
    await panel.initialise();
    expect(host.textContent).not.toMatch(/\b(?:assignment|unit|task)\b/i);
  });
});
