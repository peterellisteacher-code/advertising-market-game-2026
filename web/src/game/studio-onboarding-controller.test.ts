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
    shell.productBuilderPanel.innerHTML = '<button type="button">Choose starter product</button>';
    const starter = getByRole<HTMLButtonElement>(shell.productBuilderPanel, "button", {
      name: "Choose starter product"
    });
    const focusStarter = vi.fn(() => starter.focus());
    const controller = new StudioOnboardingController(root, shell.overlay, acknowledge, focusStarter);

    controller.setCampaign(campaign());

    const dialog = getByRole(root, "dialog", { name: "Studio tour" });
    expect(dialog.textContent).toContain("Context");
    expect(dialog.textContent).toContain("Teenagers. One-hour window between school dismissal and home arrival.");
    expect(dialog.textContent).toContain("Need");
    expect(dialog.textContent).toContain("A method to make the window productive.");
    expect(dialog.textContent).toContain("Page 1 of 4 · Brief");
    expect(shell.overlay.inert).not.toBe(true);
    expect(shell.overlay.querySelector<HTMLElement>(".creator__workspace")!.inert).toBe(true);
    expect(shell.overlay.querySelector<HTMLElement>(".creator__topbar")!.inert).toBe(true);
    expect(shell.overlay.querySelector<HTMLElement>("[data-studio-onboarding-layer]")!.inert).not.toBe(true);

    fireEvent.click(getByRole(dialog, "button", { name: "Next" }));
    expect(dialog.textContent).toContain("Page 2 of 4 · Roles");
    expect(acknowledge).not.toHaveBeenCalled();
    fireEvent.click(getByRole(dialog, "button", { name: "Next" }));
    expect(dialog.textContent).toContain("Page 3 of 4 · Build area");
    expect(acknowledge).not.toHaveBeenCalled();
    fireEvent.click(getByRole(dialog, "button", { name: "Next" }));
    expect(dialog.textContent).toContain("Page 4 of 4 · First action");
    expect(acknowledge).not.toHaveBeenCalled();
    fireEvent.click(getByRole(dialog, "button", { name: "Start with a product" }));

    expect(acknowledge).toHaveBeenCalledOnce();
    expect(focusStarter).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(starter);
    expect(shell.overlay.querySelector<HTMLElement>(".creator__workspace")!.inert).toBe(false);
    expect(shell.overlay.querySelector<HTMLElement>(".creator__topbar")!.inert).toBe(false);
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
    expect(document.activeElement).toBe(getByRole(root, "button", { name: "Studio tour" }));

    fireEvent.click(getByRole(root, "button", { name: "Studio tour" }));
    expect(dialog.textContent).toContain("Page 1 of 4 · Brief");
    expect(acknowledge).not.toHaveBeenCalled();

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(acknowledge).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(getByRole(root, "button", { name: "Studio tour" }));

    fireEvent.click(getByRole(root, "button", { name: "Studio tour" }));

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

  it("offers optional first-page brief definitions without hiding the brief facts", () => {
    document.body.innerHTML = '<div id="creator-root"></div>';
    const root = document.querySelector<HTMLElement>("#creator-root")!;
    const shell = createEditorShell(root);
    const controller = new StudioOnboardingController(root, shell.overlay, vi.fn(), vi.fn());

    controller.setCampaign(campaign());

    const dialog = getByRole(root, "dialog", { name: "Studio tour" });
    expect(dialog.textContent).toContain("Teenagers. One-hour window between school dismissal and home arrival.");
    expect(dialog.textContent).toContain("A method to make the window productive.");
    expect(getByRole(dialog, "button", { name: "What does Context mean?" })).toBeTruthy();
    expect(getByRole(dialog, "button", { name: "What does Need mean?" })).toBeTruthy();
    expect(getByRole(dialog, "button", { name: "What does Values mean?" })).toBeTruthy();
    const help = getByRole<HTMLButtonElement>(dialog, "button", {
      name: "What does Intended audience response mean?"
    });

    fireEvent.click(help);
    const definition = getByRole(dialog, "dialog", { name: "About Intended audience response" });
    expect(definition.textContent).toContain(
      "Intended audience response is what the advertisement should encourage the audience to think, feel or do."
    );
    const dismiss = getByRole<HTMLButtonElement>(definition, "button", {
      name: "Close Intended audience response definition"
    });
    expect(dismiss.textContent).toBe("×");
    expect(document.activeElement).toBe(dismiss);

    fireEvent.click(dismiss);
    expect(dialog.querySelector("[data-studio-onboarding-help-card]")).toBeNull();
    expect(document.activeElement).toBe(help);

    fireEvent.click(help);
    const reopenedDefinition = getByRole(dialog, "dialog", {
      name: "About Intended audience response"
    });

    fireEvent.keyDown(reopenedDefinition, { key: "Escape" });
    expect(dialog.querySelector("[data-studio-onboarding-help-card]")).toBeNull();
    expect(document.activeElement).toBe(help);
  });

  it("spotlights one real Studio target at a time with click and keyboard page navigation", () => {
    document.body.innerHTML = '<div id="creator-root"></div>';
    const root = document.querySelector<HTMLElement>("#creator-root")!;
    const shell = createEditorShell(root);
    const acknowledge = vi.fn();
    const controller = new StudioOnboardingController(root, shell.overlay, acknowledge, vi.fn());
    const highlighted = () => root.querySelectorAll<HTMLElement>("[data-studio-onboarding-highlight]");

    controller.setCampaign(campaign());

    const dialog = getByRole(root, "dialog", { name: "Studio tour" });
    expect(shell.overlay.inert).not.toBe(true);
    expect(shell.overlay.querySelector<HTMLElement>(".creator__workspace")!.inert).toBe(true);
    expect(shell.overlay.querySelector<HTMLElement>(".creator__topbar")!.inert).toBe(true);
    expect(shell.overlay.querySelector<HTMLElement>("[data-studio-onboarding-layer]")!.inert).not.toBe(true);
    expect(highlighted()).toHaveLength(1);
    expect(highlighted()[0]).toBe(getByRole(root, "button", { name: "Open full brief" }));
    expect(highlighted()[0]?.dataset.studioOnboardingHighlight).toBe("brief");

    fireEvent.click(getByRole(dialog, "button", { name: "Next" }));
    expect(highlighted()).toHaveLength(1);
    expect(highlighted()[0]).toBe(root.querySelector(".creator__role-card"));
    expect(highlighted()[0]?.dataset.studioOnboardingHighlight).toBe("roles");
    expect(acknowledge).not.toHaveBeenCalled();

    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(highlighted()).toHaveLength(1);
    expect(highlighted()[0]).toBe(getByRole(root, "tab", { name: "Build" }));
    expect(highlighted()[0]?.dataset.studioOnboardingHighlight).toBe("build");
    expect(acknowledge).not.toHaveBeenCalled();

    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(highlighted()).toHaveLength(1);
    expect(highlighted()[0]).toBe(shell.productBuilderPanel);
    expect(highlighted()[0]?.dataset.studioOnboardingHighlight).toBe("first-action");
    expect(acknowledge).not.toHaveBeenCalled();

    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(highlighted()).toHaveLength(1);
    expect(highlighted()[0]?.dataset.studioOnboardingHighlight).toBe("build");
  });
});
