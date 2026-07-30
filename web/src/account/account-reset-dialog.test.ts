import {
  fireEvent,
  getByLabelText,
  getByRole,
  waitFor
} from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountResetDialog } from "./account-reset-dialog";

afterEach(() => {
  document.body.replaceChildren();
});

describe("AccountResetDialog", () => {
  it("requires exact RESET and states what is deleted and preserved", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Reset progress";
    document.body.append(trigger);
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const dialog = new AccountResetDialog({ onConfirm });

    dialog.open(trigger, "team-one");

    const surface = getByRole(document.body, "dialog", {
      name: "Reset account progress"
    });
    expect(surface.textContent).toContain("drafts");
    expect(surface.textContent).toContain("advertisement designs");
    expect(surface.textContent).toContain("uploaded images");
    expect(surface.textContent).toContain("cloud saves");
    expect(surface.textContent).toContain("username and password will remain");
    expect(surface.textContent).not.toContain("pending AI work");
    const input = getByLabelText(surface, "Type RESET to confirm");
    const confirm = getByRole(surface, "button", { name: "Reset account progress" }) as
      HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    fireEvent.input(input, { target: { value: "reset" } });
    expect(confirm.disabled).toBe(true);
    fireEvent.input(input, { target: { value: "RESET" } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);

    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
  });

  it("restores trigger focus on Cancel and Escape", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Reset progress";
    document.body.append(trigger);
    const dialog = new AccountResetDialog({ onConfirm: vi.fn() });

    trigger.focus();
    dialog.open(trigger, "team-one");
    fireEvent.click(getByRole(document.body, "button", { name: "Cancel" }));
    expect(document.activeElement).toBe(trigger);

    dialog.open(trigger, "team-one");
    fireEvent.keyDown(getByRole(document.body, "dialog"), { key: "Escape" });
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps the dialog open and announces a retryable failure", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Reset progress";
    document.body.append(trigger);
    const dialog = new AccountResetDialog({
      onConfirm: vi.fn().mockRejectedValue(new Error("offline"))
    });
    dialog.open(trigger, "team-one");
    const surface = getByRole(document.body, "dialog");
    const input = getByLabelText(surface, "Type RESET to confirm");
    fireEvent.input(input, { target: { value: "RESET" } });
    fireEvent.click(getByRole(surface, "button", { name: "Reset account progress" }));

    await waitFor(() => expect(getByRole(surface, "alert").textContent)
      .toContain("did not finish"));
    expect(surface.hasAttribute("open")).toBe(true);
    expect((input as HTMLInputElement).value).toBe("RESET");
    expect((input as HTMLInputElement).disabled).toBe(false);
  });
});
