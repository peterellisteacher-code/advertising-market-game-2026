import {
  fireEvent,
  getByLabelText,
  getByRole,
  queryByRole,
  waitFor
} from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TeacherDashboard } from "./teacher-dashboard";
import { TeacherClientError, type TeacherClient } from "./teacher-client";

const operationId = "2d90c112-4de8-4e7b-92d2-0d655738987f";
const account = {
  username: "team-one",
  createdAt: "2026-07-20T01:02:03.000Z",
  lastSignInAt: null
};
const counts = (granted: number, consumed = 0, reserved = 0) => ({
  granted,
  consumed,
  reserved,
  remaining: granted - consumed - reserved
});
const imageLab = {
  enabled: true,
  defaults: { object: 0, realise: 0 },
  accounts: [{
    alias: "team-one",
    object: counts(2, 0, 1),
    realise: counts(1)
  }]
};
const updatedAccount = {
  alias: "team-one",
  object: counts(3),
  realise: counts(1)
};

const client = (authenticated = true): TeacherClient => ({
  session: vi.fn().mockResolvedValue({ authenticated }),
  login: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  listAccounts: vi.fn().mockResolvedValue([account]),
  createAccount: vi.fn().mockResolvedValue(account),
  replacePassword: vi.fn().mockResolvedValue(undefined),
  resetAccount: vi.fn().mockResolvedValue(undefined),
  imageLabStatus: vi.fn().mockResolvedValue(imageLab),
  setImageLabGlobal: vi.fn().mockResolvedValue({
    status: "updated",
    operationId,
    operation: "global",
    enabled: false,
    defaults: { object: 2, realise: 1 }
  }),
  setImageLabAccount: vi.fn().mockResolvedValue({
    status: "updated",
    operationId,
    operation: "set",
    alias: "team-one",
    account: updatedAccount
  }),
  addImageLabAccount: vi.fn().mockResolvedValue({
    status: "updated",
    operationId,
    operation: "add",
    alias: "team-one",
    account: updatedAccount
  }),
  revokeImageLabAccount: vi.fn().mockResolvedValue({
    status: "updated",
    operationId,
    operation: "revoke",
    alias: "team-one",
    account: updatedAccount
  }),
  batchAddImageLab: vi.fn().mockResolvedValue({
    status: "updated",
    operationId,
    operation: "batch-add",
    aliases: ["team-one"],
    accounts: [updatedAccount]
  })
});

const mount = async (
  fake = client(),
  createOperationId: () => string = () => operationId
) => {
  const root = document.createElement("div");
  document.body.append(root);
  const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
  const dashboard = new TeacherDashboard(root, fake, {
    createOperationId,
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
    expect(fake.imageLabStatus).toHaveBeenCalledOnce();
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

  it("opens a native modal dialog and closes it through the dialog API", async () => {
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    const close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
    const originalShowModal = Object.getOwnPropertyDescriptor(
      HTMLDialogElement.prototype,
      "showModal"
    );
    const originalClose = Object.getOwnPropertyDescriptor(
      HTMLDialogElement.prototype,
      "close"
    );
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: showModal
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: close
    });
    try {
      const { root } = await mount();
      fireEvent.click(getByRole(root, "button", { name: "Create account" }));
      const dialog = getByRole(root, "dialog");

      expect(showModal).toHaveBeenCalledOnce();
      fireEvent.click(getByRole(dialog, "button", { name: "Cancel" }));
      expect(close).toHaveBeenCalledOnce();
    } finally {
      if (originalShowModal === undefined) {
        delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
      } else {
        Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShowModal);
      }
      if (originalClose === undefined) {
        delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
      } else {
        Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose);
      }
    }
  });

  it("reuses one account reset operation ID after an interrupted request", async () => {
    const firstOperationId = "123e4567-e89b-42d3-a456-426614174000";
    const secondOperationId = "223e4567-e89b-42d3-a456-426614174000";
    const createOperationId = vi.fn()
      .mockReturnValueOnce(firstOperationId)
      .mockReturnValueOnce(secondOperationId);
    const fake = client();
    vi.mocked(fake.resetAccount)
      .mockRejectedValueOnce(new Error("interrupted"))
      .mockResolvedValueOnce(undefined);
    const { root } = await mount(fake, createOperationId);
    fireEvent.click(getByRole(root, "button", {
      name: "Reset progress for team-one"
    }));
    const dialog = getByRole(root, "dialog");
    fireEvent.input(getByLabelText(dialog, "Type team-one to confirm"), {
      target: { value: "team-one" }
    });
    const reset = getByRole(
      dialog,
      "button",
      { name: "Reset progress" }
    ) as HTMLButtonElement;

    fireEvent.click(reset);
    await waitFor(() => expect(fake.resetAccount).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(reset.disabled).toBe(false));
    fireEvent.click(reset);
    await waitFor(() => expect(fake.resetAccount).toHaveBeenCalledTimes(2));

    expect(vi.mocked(fake.resetAccount).mock.calls.map(([input]) => input.operationId))
      .toEqual([firstOperationId, firstOperationId]);
    expect(createOperationId).toHaveBeenCalledOnce();
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

  it("shows global defaults and an alias-only allowance table with independent stage counts", async () => {
    const { root } = await mount();

    const region = getByRole(root, "region", { name: "Image Lab allowances" });
    expect(region.textContent).toContain("Image Lab is available");
    expect(getByLabelText<HTMLInputElement>(region, "Image Lab available to pairs").checked)
      .toBe(true);
    expect(getByLabelText<HTMLInputElement>(region, "Default Object Forge uses").value).toBe("0");
    expect(getByLabelText<HTMLInputElement>(region, "Default Make It Real uses").value).toBe("0");
    expect(getByRole(region, "table", { name: "Pair Image Lab allowances" }).textContent)
      .toContain("team-one");
    expect(region.textContent).toContain("Object Forge");
    expect(region.textContent).toContain("1 available");
    expect(region.textContent).toContain("1 reserved");
    expect(region.textContent).toContain("Make It Real");
    expect(getByLabelText(region, "Select team-one for batch grant")).toBeTruthy();
    expect(root.textContent).not.toMatch(/provider key|job token|user id|guaranteed price/i);
  });

  it("supports Set, Add, Revoke available uses, and a selected-pair batch grant", async () => {
    const { root, fake } = await mount();
    const region = getByRole(root, "region", { name: "Image Lab allowances" });
    const object = getByLabelText<HTMLInputElement>(region, "Object Forge uses for team-one");
    const realise = getByLabelText<HTMLInputElement>(region, "Make It Real uses for team-one");
    fireEvent.input(object, { target: { value: "3" } });
    fireEvent.input(realise, { target: { value: "1" } });

    fireEvent.click(getByRole(region, "button", { name: "Set uses for team-one" }));
    await waitFor(() => expect(fake.setImageLabAccount).toHaveBeenCalledWith({
      operationId,
      alias: "team-one",
      object: 3,
      realise: 1
    }));
    await waitFor(() => expect(
      getByRole(root, "region", { name: "Image Lab allowances" }).textContent
    ).toContain(
      "Set — team-one: Object Forge 3 available, 0 reserved; Make It Real 1 available, 0 reserved."
    ));

    const rerendered = getByRole(root, "region", { name: "Image Lab allowances" });
    fireEvent.input(
      getByLabelText<HTMLInputElement>(rerendered, "Object Forge uses for team-one"),
      { target: { value: "1" } }
    );
    fireEvent.input(
      getByLabelText<HTMLInputElement>(rerendered, "Make It Real uses for team-one"),
      { target: { value: "0" } }
    );
    fireEvent.click(getByRole(rerendered, "button", { name: "Add uses for team-one" }));
    await waitFor(() => expect(fake.addImageLabAccount).toHaveBeenCalledOnce());

    const afterAdd = getByRole(root, "region", { name: "Image Lab allowances" });
    fireEvent.click(getByRole(afterAdd, "button", {
      name: "Revoke available uses for team-one"
    }));
    await waitFor(() => expect(fake.revokeImageLabAccount).toHaveBeenCalledOnce());

    const afterRevoke = getByRole(root, "region", { name: "Image Lab allowances" });
    fireEvent.click(getByLabelText(afterRevoke, "Select team-one for batch grant"));
    fireEvent.input(getByLabelText(afterRevoke, "Batch Object Forge uses"), {
      target: { value: "2" }
    });
    fireEvent.input(getByLabelText(afterRevoke, "Batch Make It Real uses"), {
      target: { value: "0" }
    });
    fireEvent.click(getByRole(afterRevoke, "button", { name: "Add uses to selected pairs" }));
    await waitFor(() => expect(fake.batchAddImageLab).toHaveBeenCalledWith({
      operationId,
      aliases: ["team-one"],
      object: 2,
      realise: 0
    }));
  });

  it("retains entered values and offers Refresh allowances after an uncertain mutation", async () => {
    const fake = client();
    vi.mocked(fake.addImageLabAccount).mockRejectedValueOnce(new TeacherClientError(
      "IMAGE_LAB_MUTATION_UNCERTAIN",
      409,
      false,
      true
    ));
    const { root } = await mount(fake);
    const region = getByRole(root, "region", { name: "Image Lab allowances" });
    const object = getByLabelText<HTMLInputElement>(region, "Object Forge uses for team-one");
    fireEvent.input(object, { target: { value: "4" } });

    fireEvent.click(getByRole(region, "button", { name: "Add uses for team-one" }));

    await waitFor(() => expect(getByRole(region, "button", {
      name: "Refresh allowances"
    })).toBeTruthy());
    expect(object.value).toBe("4");
    expect(fake.addImageLabAccount).toHaveBeenCalledOnce();
    expect(getByRole<HTMLButtonElement>(region, "button", {
      name: "Add uses for team-one"
    }).disabled).toBe(false);
  });
});
