import {
  fireEvent,
  getByLabelText,
  getByRole,
  queryByRole,
  waitFor
} from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TeacherDashboard } from "./teacher-dashboard";
import type { TeacherClient } from "./teacher-client";

const operationId = "2d90c112-4de8-4e7b-92d2-0d655738987f";
const account = {
  username: "team-one",
  createdAt: "2026-07-20T01:02:03.000Z",
  lastSignInAt: null
};

const client = (authenticated = true): TeacherClient => ({
  session: vi.fn().mockResolvedValue({ authenticated }),
  login: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  listAccounts: vi.fn().mockResolvedValue([account]),
  createAccount: vi.fn().mockResolvedValue(account),
  replacePassword: vi.fn().mockResolvedValue(undefined),
  resetAccount: vi.fn().mockResolvedValue(undefined)
});

const mount = async (fake = client()) => {
  const root = document.createElement("div");
  document.body.append(root);
  const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
  const dashboard = new TeacherDashboard(root, fake, {
    createOperationId: () => operationId,
    clipboard
  });
  await dashboard.mount();
  return { root, fake, clipboard, dashboard };
};

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("TeacherDashboard", () => {
  it("shows the teacher password gate before loading accounts", async () => {
    const fake = client(false);
    const { root } = await mount(fake);

    expect(getByRole(root, "heading", { name: "Teacher access" })).toBeTruthy();
    const password = getByLabelText<HTMLInputElement>(root, "Teacher password");
    fireEvent.input(password, { target: { value: "teacher-password" } });
    fireEvent.submit(password.form!);

    await waitFor(() => expect(fake.login).toHaveBeenCalledWith("teacher-password"));
    await waitFor(() =>
      expect(getByRole(root, "heading", { name: "Classroom accounts" })).toBeTruthy()
    );
    expect(fake.listAccounts).toHaveBeenCalledOnce();
  });

  it("creates manually chosen credentials and keeps them copyable until dismissed", async () => {
    const { root, fake, clipboard } = await mount();
    const trigger = getByRole<HTMLButtonElement>(root, "button", {
      name: "Create account"
    });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = getByRole(root, "dialog", { name: "Create pair account" });
    fireEvent.input(getByLabelText(dialog, "Username"), {
      target: { value: "team-two" }
    });
    fireEvent.input(getByLabelText(dialog, "Password"), {
      target: { value: "class-pair-12" }
    });
    fireEvent.input(getByLabelText(dialog, "Confirm password"), {
      target: { value: "class-pair-12" }
    });
    fireEvent.submit(getByLabelText(dialog, "Password").closest("form")!);

    await waitFor(() => expect(fake.createAccount).toHaveBeenCalledWith({
      operationId,
      username: "team-two",
      password: "class-pair-12"
    }));
    await waitFor(() =>
      expect(getByRole(root, "heading", { name: "Account created" })).toBeTruthy()
    );
    expect(dialog.textContent).toContain("team-two");
    expect(dialog.textContent).toContain("class-pair-12");

    fireEvent.click(getByRole(dialog, "button", {
      name: "Copy username and password"
    }));
    await waitFor(() => expect(clipboard.writeText).toHaveBeenCalledWith(
      "Username: team-two\nPassword: class-pair-12"
    ));

    fireEvent.click(getByRole(dialog, "button", { name: "Done" }));
    expect(queryByRole(root, "dialog")).toBeNull();
    expect(root.textContent).not.toContain("class-pair-12");
    expect(document.activeElement).toBe(trigger);
  });

  it("places password-length and mismatch errors beside the relevant fields", async () => {
    const { root, fake } = await mount();
    fireEvent.click(getByRole(root, "button", { name: "Create account" }));
    const dialog = getByRole(root, "dialog");
    fireEvent.input(getByLabelText(dialog, "Username"), {
      target: { value: "team-two" }
    });
    fireEvent.input(getByLabelText(dialog, "Password"), {
      target: { value: "short" }
    });
    fireEvent.input(getByLabelText(dialog, "Confirm password"), {
      target: { value: "different" }
    });
    fireEvent.submit(getByLabelText(dialog, "Password").closest("form")!);

    expect(getByLabelText(dialog, "Password").parentElement?.parentElement?.textContent)
      .toContain("8 to 128 UTF-8 bytes");
    expect(getByLabelText(dialog, "Confirm password").parentElement?.parentElement?.textContent)
      .toContain("Passwords must match");
    expect(fake.createAccount).not.toHaveBeenCalled();
  });

  it("warns before replacing a password and sends the manually entered value", async () => {
    const { root, fake } = await mount();
    fireEvent.click(getByRole(root, "button", {
      name: "Change password for team-one"
    }));
    const dialog = getByRole(root, "dialog", {
      name: "Replace password for team-one"
    });
    expect(dialog.textContent).toContain("old password will stop working");
    fireEvent.input(getByLabelText(dialog, "New password"), {
      target: { value: "replacement-password" }
    });
    fireEvent.input(getByLabelText(dialog, "Confirm new password"), {
      target: { value: "replacement-password" }
    });
    fireEvent.submit(getByLabelText(dialog, "New password").closest("form")!);

    await waitFor(() => expect(fake.replacePassword).toHaveBeenCalledWith({
      operationId,
      username: "team-one",
      password: "replacement-password"
    }));
    await waitFor(() => expect(queryByRole(root, "dialog")).toBeNull());
    expect(root.textContent).toContain("Password replaced for team-one");
  });

  it("explains account reset scope, requires the exact username and restores focus on Escape", async () => {
    const { root, fake } = await mount();
    const trigger = getByRole<HTMLButtonElement>(root, "button", {
      name: "Reset progress for team-one"
    });
    trigger.focus();
    fireEvent.click(trigger);
    let dialog = getByRole(root, "dialog", {
      name: "Reset progress for team-one"
    });
    expect(dialog.textContent).toContain("progress");
    expect(dialog.textContent).toContain("uploaded images");
    expect(dialog.textContent).toContain("username and password remain");
    fireEvent.input(getByLabelText(dialog, "Type team-one to confirm"), {
      target: { value: "RESET" }
    });
    expect(getByRole<HTMLButtonElement>(dialog, "button", {
      name: "Reset progress"
    }).disabled).toBe(true);

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(queryByRole(root, "dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    dialog = getByRole(root, "dialog");
    fireEvent.input(getByLabelText(dialog, "Type team-one to confirm"), {
      target: { value: "team-one" }
    });
    fireEvent.click(getByRole(dialog, "button", { name: "Reset progress" }));
    await waitFor(() => expect(fake.resetAccount).toHaveBeenCalledWith({
      operationId,
      username: "team-one",
      confirmation: "team-one"
    }));
  });

  it("provides optional generated, visible and directly copied credentials", async () => {
    const { root } = await mount();
    fireEvent.click(getByRole(root, "button", { name: "Create account" }));
    const dialog = getByRole(root, "dialog");
    const password = getByLabelText<HTMLInputElement>(dialog, "Password");
    const confirmation = getByLabelText<HTMLInputElement>(dialog, "Confirm password");

    fireEvent.click(getByRole(dialog, "button", { name: "Generate password" }));
    expect(password.value.length).toBeGreaterThanOrEqual(8);
    expect(confirmation.value).toBe(password.value);
    fireEvent.click(getByRole(dialog, "button", { name: "Show password" }));
    expect(password.type).toBe("text");
    expect(confirmation.type).toBe("text");
  });
});
