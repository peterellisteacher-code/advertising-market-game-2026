import { fireEvent, getByRole, within } from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";
import { createBlankAssignmentPlan } from "./assignment-plan";
import { AssignmentPlannerPanel } from "./assignment-planner-panel";

describe("AssignmentPlannerPanel", () => {
  it("shows the page-five product, Product AIDA and six Desire-value families", () => {
    const host = document.createElement("div");
    const panel = new AssignmentPlannerPanel(host, vi.fn());

    panel.setState({
      productName: "SunPath Lamp",
      plan: {
        ...createBlankAssignmentPlan(),
        productFunction: "Lights a path after dark.",
        targetAudience: "Teen campers",
        desireValueIds: ["responsibility:sustainability"],
        primaryDesireValueId: "responsibility:sustainability"
      }
    });

    expect(getByRole(host, "heading", { name: "Define the product" })).toBeTruthy();
    expect(getByRole(host, "heading", { name: "Product AIDA" })).toBeTruthy();
    expect(getByRole(host, "heading", { name: "Values for Desire" })).toBeTruthy();
    for (const family of [
      "Responsibility", "Practicality", "Identity", "Experience", "Performance", "Care"
    ]) {
      expect(getByRole(host, "group", { name: family })).toBeTruthy();
    }
    expect(getByRole<HTMLInputElement>(host, "textbox", {
      name: "What does the product do?"
    }).value).toBe("Lights a path after dark.");
    expect(getByRole<HTMLInputElement>(host, "checkbox", {
      name: "Sustainability"
    }).checked).toBe(true);
    expect(getByRole<HTMLInputElement>(host, "radio", {
      name: "Make Sustainability the main value"
    }).checked).toBe(true);
  });

  it("saves one complete cloned plan and restores focus after redraw", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const commit = vi.fn().mockResolvedValue(undefined);
    const panel = new AssignmentPlannerPanel(host, commit);
    panel.setState({ productName: "SunPath Lamp", plan: createBlankAssignmentPlan() });
    const field = getByRole<HTMLInputElement>(host, "textbox", {
      name: "What does the product do?"
    });

    fireEvent.change(field, { target: { value: "Lights a path after dark." } });

    await vi.waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
    const [productName, plan] = commit.mock.calls[0]!;
    expect(productName).toBe("SunPath Lamp");
    expect(plan).toEqual({
      ...createBlankAssignmentPlan(),
      productFunction: "Lights a path after dark."
    });
    expect(plan).not.toBe(createBlankAssignmentPlan());
    await vi.waitFor(() => expect(getByRole(host, "status").textContent).toBe("Saved"));
    expect(document.activeElement).toBe(getByRole(host, "textbox", {
      name: "What does the product do?"
    }));
  });

  it("keeps the main Desire value within the selected values", async () => {
    const host = document.createElement("div");
    const commit = vi.fn().mockResolvedValue(undefined);
    const panel = new AssignmentPlannerPanel(host, commit);
    panel.setState({ productName: "SunPath Lamp", plan: createBlankAssignmentPlan() });
    const responsibility = getByRole(host, "group", { name: "Responsibility" });

    fireEvent.change(within(responsibility).getByRole("checkbox", { name: "Sustainability" }), {
      target: { checked: true }
    });
    await vi.waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
    const updatedResponsibility = getByRole(host, "group", { name: "Responsibility" });
    fireEvent.change(within(updatedResponsibility).getByRole("radio", {
      name: "Make Sustainability the main value"
    }), { target: { checked: true } });

    await vi.waitFor(() => expect(commit).toHaveBeenCalledTimes(2));
    expect(commit.mock.calls[1]![1]).toMatchObject({
      desireValueIds: ["responsibility:sustainability"],
      primaryDesireValueId: "responsibility:sustainability"
    });
  });
});
