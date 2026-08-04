import { fireEvent, getByRole } from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";
import { createBlankCampaignDocument } from "../domain/campaign-document";
import { createEditorShell } from "../ui/editor-shell";
import { StudioOnboardingController } from "./studio-onboarding-controller";

function campaign(acknowledged = false) {
  const document = createBlankCampaignDocument({
    documentId: "campaign-1", sessionId: "session-1", mode: "offline"
  });
  document.brief.targetAudienceId = "after-school-wanderers";
  document.gameplay.pair.roleGuideAcknowledged = acknowledged;
  return document;
}

describe("StudioOnboardingController", () => {
  it("shows the supplied brief before the Build area and focuses the starter action after page four", () => {
    document.body.innerHTML = '<div id="creator-root"></div>';
    const root = document.querySelector<HTMLElement>("#creator-root")!;
    const shell = createEditorShell(root);
    const acknowledge = vi.fn();
    const focusStarter = vi.fn();
    const controller = new StudioOnboardingController(root, shell.overlay, acknowledge, focusStarter);

    controller.setCampaign(campaign());

    const dialog = getByRole(root, "dialog", { name: "Studio tour" });
    expect(dialog.textContent).toContain("Context");
    expect(dialog.textContent).toContain("Teenagers. One-hour window between school dismissal and home arrival.");
    expect(dialog.textContent).toContain("Need");
    expect(dialog.textContent).toContain("A method to make the window productive.");
    expect(dialog.textContent).toContain("Page 1 of 4 · Brief");
    expect(shell.overlay.inert).toBe(true);

    fireEvent.click(getByRole(dialog, "button", { name: "Next" }));
    expect(dialog.textContent).toContain("Page 2 of 4 · Roles");
    fireEvent.click(getByRole(dialog, "button", { name: "Next" }));
    expect(dialog.textContent).toContain("Page 3 of 4 · Build area");
    fireEvent.click(getByRole(dialog, "button", { name: "Next" }));
    expect(dialog.textContent).toContain("Page 4 of 4 · First action");
    fireEvent.click(getByRole(dialog, "button", { name: "Start with a product" }));

    expect(acknowledge).toHaveBeenCalledOnce();
    expect(focusStarter).toHaveBeenCalledOnce();
    expect(shell.overlay.inert).toBe(false);
  });

  it("does not force acknowledged campaigns through the tour and allows manual restart", () => {
    document.body.innerHTML = '<div id="creator-root"></div>';
    const root = document.querySelector<HTMLElement>("#creator-root")!;
    const shell = createEditorShell(root);
    const controller = new StudioOnboardingController(root, shell.overlay, vi.fn(), vi.fn());

    controller.setCampaign(campaign(true));
    expect(root.querySelector<HTMLElement>("[data-studio-onboarding-layer]")!.hidden).toBe(true);
    fireEvent.click(getByRole(root, "button", { name: "Studio tour" }));
    expect(getByRole(root, "dialog", { name: "Studio tour" }).textContent)
      .toContain("Page 1 of 4 · Brief");
  });

  it("keeps a required tour open until completion and cycles focus through its visible controls", () => {
    document.body.innerHTML = '<div id="creator-root"></div>';
    const root = document.querySelector<HTMLElement>("#creator-root")!;
    const shell = createEditorShell(root);
    const acknowledge = vi.fn();
    const controller = new StudioOnboardingController(root, shell.overlay, acknowledge, vi.fn());

    controller.setCampaign(campaign());

    const dialog = getByRole(root, "dialog", { name: "Studio tour" });
    const close = getByRole(dialog, "button", { name: "Close" });
    const next = getByRole(dialog, "button", { name: "Next" });
    close.focus();
    fireEvent.keyDown(close, { key: "Tab" });
    expect(document.activeElement).toBe(next);
    fireEvent.keyDown(next, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(close);

    fireEvent.click(close);
    expect(acknowledge).not.toHaveBeenCalled();
    expect(root.querySelector<HTMLElement>("[data-studio-onboarding-layer]")!.hidden).toBe(true);

    fireEvent.click(getByRole(root, "button", { name: "Studio tour" }));
    expect(dialog.textContent).toContain("Page 1 of 4 · Brief");
    expect(acknowledge).not.toHaveBeenCalled();

    fireEvent.click(next);
    const previous = getByRole(dialog, "button", { name: "Previous" });
    close.focus();
    fireEvent.keyDown(close, { key: "Tab" });
    expect(document.activeElement).toBe(previous);
    fireEvent.keyDown(previous, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(close);
    next.focus();
    fireEvent.keyDown(next, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(next);
  });
});
