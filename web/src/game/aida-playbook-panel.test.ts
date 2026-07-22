import { fireEvent, getAllByRole, getByRole } from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";
import { AidaPlaybookPanel } from "./aida-playbook-panel";

describe("AidaPlaybookPanel", () => {
  it("offers a broad move deck and saves the pair's own plan", async () => {
    const host = document.createElement("div");
    const save = vi.fn().mockResolvedValue(undefined);
    const panel = new AidaPlaybookPanel(host, save);

    panel.setState({
      stage: "attention",
      plan: { attention: "", interest: "", desire: "", action: "" }
    });

    expect(getByRole(host, "heading", { name: "Attention: earn the first glance." }))
      .toBeTruthy();
    expect(getAllByRole(host, "button", { name: /Try move:/ })).toHaveLength(10);
    expect(host.textContent)
      .toContain("Select the canvas piece that delivers it");
    expect(host.textContent).not.toMatch(/\b(?:assignment|unit|task)\b/i);

    fireEvent.click(getByRole(host, "button", { name: /Try move: Pattern break/ }));
    const idea = getByRole<HTMLTextAreaElement>(host, "textbox", { name: "Your Attention move" });
    expect(idea.value).toContain("disrupts the visual pattern");
    fireEvent.input(idea, {
      target: { value: "Open with one tiny bottle in a field of oversized circles." }
    });
    fireEvent.click(getByRole(host, "button", { name: "Lock in Attention" }));

    await vi.waitFor(() => expect(save).toHaveBeenCalledWith(
      "attention",
      "Open with one tiny bottle in a field of oversized circles."
    ));
    expect(getByRole(host, "status").textContent)
      .toBe("Attention move locked to the selected canvas piece. Next: Interest.");
  });

  it("sends the pair back to the game after the Action move completes AIDA", async () => {
    const host = document.createElement("div");
    const save = vi.fn().mockResolvedValue(undefined);
    const panel = new AidaPlaybookPanel(host, save);
    panel.setState({
      stage: "action",
      plan: {
        attention: "Open bright.",
        interest: "Show how it works.",
        desire: "Connect it to freedom.",
        action: ""
      }
    });

    fireEvent.input(getByRole(host, "textbox", { name: "Your Action move" }), {
      target: { value: "Try it after school." }
    });
    fireEvent.click(getByRole(host, "button", { name: "Lock in Action" }));

    await vi.waitFor(() => expect(getByRole(host, "status").textContent)
      .toBe("Action move locked to the selected canvas piece. AIDA is complete. Return to the game."));
  });

  it("restores each saved stage independently", () => {
    const host = document.createElement("div");
    const panel = new AidaPlaybookPanel(host, vi.fn());

    panel.setState({
      stage: "desire",
      plan: {
        attention: "A bright opening.",
        interest: "Show the mechanism.",
        desire: "Make the spare hour feel like an escape.",
        action: "Invite a visit."
      }
    });

    expect(getByRole<HTMLTextAreaElement>(host, "textbox", { name: "Your Desire move" }).value)
      .toBe("Make the spare hour feel like an escape.");
    expect(getByRole(host, "heading", { name: "Desire: connect the feature to the audience's preferred feeling." }))
      .toBeTruthy();
  });
});
