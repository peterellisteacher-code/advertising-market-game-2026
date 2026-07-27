import { fireEvent, getByRole } from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";
import {
  createBlankCampaignDocument,
  type CampaignDocumentV1
} from "../domain/campaign-document";
import { createEditorShell } from "../ui/editor-shell";
import { RoleGuideController } from "./role-guide-controller";

function campaign(acknowledged = false): CampaignDocumentV1 {
  const document = createBlankCampaignDocument({
    documentId: "role-guide-document",
    sessionId: "role-guide-session",
    mode: "offline"
  });
  document.gameplay.pair.roleGuideAcknowledged = acknowledged;
  return document;
}

function setup() {
  document.body.innerHTML = '<div id="creator-root"></div>';
  const root = document.querySelector<HTMLElement>("#creator-root")!;
  const shell = createEditorShell(root);
  const acknowledge = vi.fn();
  const focusCurrentAction = vi.fn();
  const controller = new RoleGuideController(
    root,
    shell.overlay,
    acknowledge,
    focusCurrentAction
  );
  return { root, shell, acknowledge, focusCurrentAction, controller };
}

describe("RoleGuideController", () => {
  it("requires acknowledgement on first entry and states both responsibilities", () => {
    const { root, shell, acknowledge, focusCurrentAction, controller } = setup();

    controller.setCampaign(campaign());

    const dialog = getByRole(root, "dialog", { name: "Partner role guide" });
    expect(dialog.textContent).toContain("Art Director");
    expect(dialog.textContent).toContain(
      "Controls the product's appearance, images, colour, arrangement and layout."
    );
    expect(dialog.textContent).toContain("Strategist");
    expect(dialog.textContent).toContain(
      "Controls the product name, advertising words, claim, price reasoning and market-route reasoning."
    );
    expect(dialog.textContent).toContain("The Art Director begins with control.");
    expect(shell.overlay.inert).toBe(true);
    expect(document.activeElement).toBe(getByRole(dialog, "button", { name: "Begin work" }));

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(dialog.closest<HTMLElement>("[data-role-guide-layer]")?.hidden).toBe(false);
    expect(acknowledge).not.toHaveBeenCalled();

    fireEvent.click(getByRole(dialog, "button", { name: "Begin work" }));
    expect(acknowledge).toHaveBeenCalledOnce();
    expect(dialog.closest<HTMLElement>("[data-role-guide-layer]")?.hidden).toBe(true);
    expect(shell.overlay.inert).toBe(false);
    expect(focusCurrentAction).toHaveBeenCalledOnce();
  });

  it("stays closed after acknowledgement and can be reopened and dismissed", () => {
    const { root, shell, acknowledge, controller } = setup();
    const campaignDocument = campaign(true);
    campaignDocument.gameplay.pair.activeRole = "strategist";

    controller.setCampaign(campaignDocument);

    const layer = root.querySelector<HTMLElement>("[data-role-guide-layer]")!;
    expect(layer.hidden).toBe(true);
    const opener = getByRole(root, "button", { name: "Role guide" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = getByRole(root, "dialog", { name: "Partner role guide" });
    expect(dialog.textContent).toContain("The Strategist begins with control.");
    expect(shell.overlay.inert).toBe(true);

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(layer.hidden).toBe(true);
    expect(shell.overlay.inert).toBe(false);
    expect(document.activeElement).toBe(opener);
    expect(acknowledge).not.toHaveBeenCalled();
  });
});
