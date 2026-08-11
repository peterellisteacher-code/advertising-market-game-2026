import { fireEvent, getByRole, within } from "@testing-library/dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createBlankAssignmentPlan } from "./assignment-plan";
import { AssignmentPlannerPanel } from "./assignment-planner-panel";
import { STUDENT_COPY } from "./student-copy";

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

    expect(getByRole(host, "heading", {
      name: STUDENT_COPY.assignmentSandbox.planner.sections.defineProduct
    })).toBeTruthy();
    expect(getByRole(host, "heading", {
      name: STUDENT_COPY.assignmentSandbox.planner.sections.productAida
    })).toBeTruthy();
    expect(getByRole(host, "heading", {
      name: STUDENT_COPY.assignmentSandbox.planner.sections.desireValues
    })).toBeTruthy();
    fireEvent.click(getByRole(host, "group", {
      name: STUDENT_COPY.assignmentSandbox.planner.sections.desireValues
    }).querySelector("summary")!);
    for (const family of [
      "Responsibility", "Practicality", "Identity", "Experience", "Performance", "Care"
    ]) {
      expect(getByRole(host, "group", { name: family })).toBeTruthy();
    }
    expect(getByRole<HTMLInputElement>(host, "textbox", {
      name: STUDENT_COPY.assignmentSandbox.planner.fields.productFunction
    }).value).toBe("Lights a path after dark.");
    expect(getByRole<HTMLInputElement>(host, "checkbox", {
      name: "Sustainability"
    }).checked).toBe(true);
    expect(getByRole<HTMLInputElement>(host, "radio", {
      name: "Make Sustainability the main value"
    }).checked).toBe(true);
  });

  it("uses native compact sections, explicit label associations and unique IDs", () => {
    const firstHost = document.createElement("div");
    const secondHost = document.createElement("div");
    new AssignmentPlannerPanel(firstHost, vi.fn()).setState({
      productName: "",
      plan: createBlankAssignmentPlan()
    });
    new AssignmentPlannerPanel(secondHost, vi.fn()).setState({
      productName: "",
      plan: createBlankAssignmentPlan()
    });

    const sections = [...firstHost.querySelectorAll<HTMLDetailsElement>("details")];
    expect(sections).toHaveLength(4);
    expect(sections[0]?.open).toBe(true);
    expect(sections.slice(1).every(({ open }) => !open)).toBe(true);
    for (const summary of firstHost.querySelectorAll<HTMLElement>("summary")) {
      expect(summary.tabIndex).toBe(0);
    }
    for (const label of firstHost.querySelectorAll<HTMLLabelElement>("label[for]")) {
      expect([...firstHost.querySelectorAll<HTMLElement>("[id]")]
        .some(({ id }) => id === label.htmlFor)).toBe(true);
    }
    const ids = [...firstHost.querySelectorAll<HTMLElement>("[id]"),
      ...secondHost.querySelectorAll<HTMLElement>("[id]")].map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getByRole(firstHost, "status").getAttribute("aria-live")).toBe("polite");
  });

  it("has a bounded independent desktop scroller and display-preference styles", () => {
    const css = readFileSync(join(process.cwd(), "web", "src", "styles", "editor.css"), "utf8");

    expect(css).toMatch(/\.assignment-planner\s*\{[^}]*max-height:[^}]*overflow-y:\s*auto/s);
    expect(css).toMatch(/\.assignment-planner__summary\s*\{[^}]*cursor:\s*pointer/s);
    expect(css).toMatch(/\.student-image-upload\s*\{/);
    expect(css).toMatch(/data-display-colours="high-contrast"[^}]*assignment-planner/s);
    expect(css).toMatch(/data-display-colours="high-contrast"[^}]*student-image-upload/s);
  });

  it("saves one complete cloned plan without replacing the active text control", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const commit = vi.fn().mockResolvedValue(undefined);
    const panel = new AssignmentPlannerPanel(host, commit);
    panel.setState({ productName: "SunPath Lamp", plan: createBlankAssignmentPlan() });
    const field = getByRole<HTMLInputElement>(host, "textbox", {
      name: STUDENT_COPY.assignmentSandbox.planner.fields.productFunction
    });
    field.focus();

    fireEvent.change(field, { target: { value: "Lights a path after dark." } });

    await vi.waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
    const [productName, plan] = commit.mock.calls[0]!;
    expect(productName).toBe("SunPath Lamp");
    expect(plan).toEqual({
      ...createBlankAssignmentPlan(),
      productFunction: "Lights a path after dark."
    });
    expect(plan).not.toBe(createBlankAssignmentPlan());
    await vi.waitFor(() => expect(getByRole(host, "status").textContent)
      .toBe(STUDENT_COPY.assignmentSandbox.planner.saved));
    expect(document.activeElement).toBe(getByRole(host, "textbox", {
      name: STUDENT_COPY.assignmentSandbox.planner.fields.productFunction
    }));
  });

  it("does not steal focus or discard typing in the next field while a blur save is pending", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    let resolveCommit!: () => void;
    const commit = vi.fn(() => new Promise<void>((resolve) => { resolveCommit = resolve; }));
    const panel = new AssignmentPlannerPanel(host, commit);
    panel.setState({ productName: "SunPath Lamp", plan: createBlankAssignmentPlan() });
    const first = getByRole<HTMLInputElement>(host, "textbox", {
      name: STUDENT_COPY.assignmentSandbox.planner.fields.productFunction
    });
    const second = getByRole<HTMLInputElement>(host, "textbox", {
      name: STUDENT_COPY.assignmentSandbox.planner.fields.targetAudience
    });

    first.focus();
    fireEvent.change(first, { target: { value: "Lights a path after dark." } });
    second.focus();
    fireEvent.input(second, { target: { value: "Teen campers" } });
    resolveCommit();

    await vi.waitFor(() => expect(getByRole(host, "status").textContent)
      .toBe(STUDENT_COPY.assignmentSandbox.planner.saved));
    expect(document.activeElement).toBe(second);
    expect(second.value).toBe("Teen campers");
  });

  it("keeps the main Desire value within the selected values", async () => {
    const host = document.createElement("div");
    const commit = vi.fn().mockResolvedValue(undefined);
    const panel = new AssignmentPlannerPanel(host, commit);
    panel.setState({ productName: "SunPath Lamp", plan: createBlankAssignmentPlan() });
    fireEvent.click(getByRole(host, "group", {
      name: STUDENT_COPY.assignmentSandbox.planner.sections.desireValues
    }).querySelector("summary")!);
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
