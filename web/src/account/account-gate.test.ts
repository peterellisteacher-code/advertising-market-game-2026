import {
  fireEvent,
  getByLabelText,
  getByRole,
  queryByRole,
  waitFor
} from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AccountAccessController,
  type AccountSessionClient
} from "./account-gate";
import { AccountClientError } from "./account-client";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function mount(client: AccountSessionClient, callbacks: {
  onSession?: (username: string) => void | Promise<void>;
  onSignedOut?: (explicit: boolean) => void | Promise<void>;
  reload?: () => void;
  generatePairPassword?: () => string;
} = {}) {
  document.body.innerHTML = `
    <div id="account-gate-root"></div>
    <section id="account-session-root" hidden></section>
    <main aria-label="Advertising Market Game"><canvas id="canvas" tabindex="0"></canvas></main>
    <div id="creator-root" hidden></div>`;
  const gateRoot = document.querySelector<HTMLElement>("#account-gate-root")!;
  const statusRoot = document.querySelector<HTMLElement>("#account-session-root")!;
  const gameSurface = document.querySelector<HTMLElement>("main")!;
  const canvas = document.querySelector<HTMLCanvasElement>("canvas")!;
  const creatorRoot = document.querySelector<HTMLElement>("#creator-root")!;
  const reload = callbacks.reload ?? vi.fn();
  const controller = new AccountAccessController({
    client,
    gateRoot,
    statusRoot,
    gameSurface,
    gameCanvas: canvas,
    creatorRoot,
    reload,
    ...(callbacks.generatePairPassword === undefined
      ? {}
      : { generatePairPassword: callbacks.generatePairPassword }),
    ...(callbacks.onSession === undefined ? {} : { onSession: callbacks.onSession }),
    ...(callbacks.onSignedOut === undefined ? {} : { onSignedOut: callbacks.onSignedOut })
  });
  return { controller, gateRoot, statusRoot, gameSurface, canvas, creatorRoot, reload };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("AccountAccessController", () => {
  it("waits for asynchronous account activation before the first game unlock", async () => {
    const activation = deferred<void>();
    const client: AccountSessionClient = {
      session: vi.fn().mockResolvedValue({ authenticated: true, username: "team-one" }),
      signup: vi.fn(),
      login: vi.fn(),
      logout: vi.fn()
    };
    const onSession = vi.fn(() => activation.promise);
    const harness = mount(client, { onSession });
    let resolved = false;

    const access = harness.controller.requireAccess().then(() => { resolved = true; });
    await waitFor(() => expect(onSession).toHaveBeenCalledWith("team-one"));

    expect(resolved).toBe(false);
    expect(harness.gameSurface.hidden).toBe(true);
    expect(harness.gameSurface.inert).toBe(true);
    expect(harness.creatorRoot.hidden).toBe(true);
    expect(harness.creatorRoot.inert).toBe(true);

    activation.resolve();
    await access;
    expect(harness.gameSurface.hidden).toBe(false);
    expect(harness.creatorRoot.inert).toBe(false);
  });

  it("fails closed with safe copy when account storage activation fails", async () => {
    const client: AccountSessionClient = {
      session: vi.fn().mockResolvedValue({ authenticated: true, username: "team-one" }),
      signup: vi.fn(),
      login: vi.fn(),
      logout: vi.fn()
    };
    const harness = mount(client, {
      onSession: vi.fn().mockRejectedValue(new Error("raw indexeddb detail"))
    });

    void harness.controller.requireAccess();

    await waitFor(() => expect(getByRole(harness.gateRoot, "alert").textContent)
      .toContain("private device storage"));
    expect(harness.gateRoot.textContent).not.toContain("raw indexeddb detail");
    expect(harness.gameSurface.hidden).toBe(true);
    expect(harness.gameSurface.inert).toBe(true);
    expect(harness.creatorRoot.hidden).toBe(true);
    expect(harness.creatorRoot.inert).toBe(true);
  });

  it("returns to login without unlocking when authentication expires during activation", async () => {
    const client: AccountSessionClient = {
      session: vi.fn().mockResolvedValue({ authenticated: true, username: "team-one" }),
      signup: vi.fn(),
      login: vi.fn(),
      logout: vi.fn()
    };
    const harness = mount(client, {
      onSession: vi.fn().mockRejectedValue(new AccountClientError("AUTHENTICATION_REQUIRED"))
    });

    void harness.controller.requireAccess();

    await waitFor(() => expect(getByRole(harness.gateRoot, "form", { name: "Log in" })).toBeTruthy());
    expect(getByRole(harness.gateRoot, "alert").textContent)
      .toBe("Your session ended. Log in again to reconnect your private save.");
    expect(harness.gameSurface.hidden).toBe(true);
    expect(harness.gameSurface.inert).toBe(true);
    expect(harness.creatorRoot.hidden).toBe(true);
    expect(harness.creatorRoot.inert).toBe(true);
  });

  it("keeps the game unfocusable and the bootstrap pending until account access succeeds", async () => {
    const generatedPassword = "Abcdefghijkm23456789";
    const session = deferred<{ authenticated: false }>();
    const client: AccountSessionClient = {
      session: vi.fn(() => session.promise),
      signup: vi.fn().mockResolvedValue({ authenticated: true, username: "team-one" }),
      login: vi.fn(),
      logout: vi.fn()
    };
    const onSession = vi.fn();
    const harness = mount(client, {
      onSession,
      generatePairPassword: () => generatedPassword
    });
    let resolved = false;

    const access = harness.controller.requireAccess().then(() => { resolved = true; });

    expect(harness.gameSurface.hidden).toBe(true);
    expect(harness.gameSurface.inert).toBe(true);
    expect(harness.gameSurface.getAttribute("aria-hidden")).toBe("true");
    expect(harness.canvas.tabIndex).toBe(-1);
    expect(getByRole(harness.gateRoot, "status").textContent).toContain("Checking your account");
    expect(resolved).toBe(false);

    session.resolve({ authenticated: false });
    await waitFor(() => expect(getByRole(harness.gateRoot, "heading", {
      name: "Welcome to Ad Market"
    })).toBeTruthy());
    const loginUsername = getByLabelText<HTMLInputElement>(harness.gateRoot, "Username");
    expect(loginUsername.autocomplete).toBe("username");
    expect(getByLabelText<HTMLInputElement>(harness.gateRoot, "Password").autocomplete)
      .toBe("current-password");
    await Promise.resolve();
    expect(document.activeElement).toBe(loginUsername);
    expect(resolved).toBe(false);

    fireEvent.click(getByRole(harness.gateRoot, "button", { name: "Teacher setup" }));
    expect(harness.gateRoot.textContent).toContain("Teacher only");
    const signupUsername = getByLabelText<HTMLInputElement>(harness.gateRoot, "Pair username");
    const signupPassword = getByLabelText<HTMLInputElement>(harness.gateRoot, "Generated password");
    const classroomCode = getByLabelText<HTMLInputElement>(harness.gateRoot, "Teacher setup code");
    expect(signupUsername.autocomplete).toBe("username");
    expect(signupPassword.autocomplete).toBe("new-password");
    expect(signupPassword.readOnly).toBe(true);
    expect(signupPassword.value).toBe(generatedPassword);
    expect(classroomCode.autocomplete).toBe("off");
    signupUsername.value = "team-one";
    classroomCode.value = "classroom-access";
    fireEvent.submit(getByRole(harness.gateRoot, "form", { name: "Create pair login" }));

    await access;
    expect(client.signup).toHaveBeenCalledWith({
      username: "team-one",
      password: generatedPassword,
      classroomCode: "classroom-access"
    });
    expect(signupPassword.value).toBe("");
    expect(harness.gameSurface.hidden).toBe(false);
    expect(harness.gameSurface.inert).toBe(false);
    expect(harness.gameSurface.hasAttribute("aria-hidden")).toBe(false);
    expect(harness.canvas.tabIndex).toBe(0);
    expect(harness.gateRoot.hidden).toBe(true);
    expect(harness.statusRoot.textContent).toContain("Signed in as team-one");
    expect(getByRole(harness.statusRoot, "button", { name: "Log out" })).toBeTruthy();
    expect(onSession).toHaveBeenCalledWith("team-one");
  });

  it("announces a calm login error and moves focus back to the password", async () => {
    const client: AccountSessionClient = {
      session: vi.fn().mockResolvedValue({ authenticated: false }),
      signup: vi.fn(),
      login: vi.fn().mockRejectedValue(new AccountClientError("INVALID_CREDENTIALS")),
      logout: vi.fn()
    };
    const harness = mount(client);
    void harness.controller.requireAccess();
    await waitFor(() => expect(getByRole(harness.gateRoot, "form", {
      name: "Log in"
    })).toBeTruthy());
    getByLabelText<HTMLInputElement>(harness.gateRoot, "Username").value = "team-one";
    const password = getByLabelText<HTMLInputElement>(harness.gateRoot, "Password");
    password.value = "wrong-password";

    fireEvent.submit(getByRole(harness.gateRoot, "form", { name: "Log in" }));

    await waitFor(() => expect(getByRole(harness.gateRoot, "alert").textContent)
      .toBe("That username or password did not match. Try again."));
    expect(document.activeElement).toBe(password);
    expect(password.value).toBe("");
    expect(harness.gameSurface.hidden).toBe(true);
  });

  it("locks both account surfaces immediately and reloads only after logout isolation", async () => {
    const isolated = deferred<void>();
    const client: AccountSessionClient = {
      session: vi.fn().mockResolvedValue({ authenticated: true, username: "team-one" }),
      signup: vi.fn(),
      login: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined)
    };
    const onSignedOut = vi.fn();
    onSignedOut.mockReturnValue(isolated.promise);
    const reload = vi.fn();
    const harness = mount(client, { onSignedOut, reload });
    await harness.controller.requireAccess();
    harness.creatorRoot.hidden = false;

    fireEvent.click(getByRole(harness.statusRoot, "button", { name: "Log out" }));

    expect(harness.gameSurface.hidden).toBe(true);
    expect(harness.gameSurface.inert).toBe(true);
    expect(harness.canvas.tabIndex).toBe(-1);
    expect(harness.creatorRoot.hidden).toBe(true);
    expect(harness.creatorRoot.inert).toBe(true);
    expect(onSignedOut).toHaveBeenCalledWith(true);
    expect(reload).not.toHaveBeenCalled();

    isolated.resolve();
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(client.logout).toHaveBeenCalledOnce();
    expect(queryByRole(harness.statusRoot, "button", { name: "Log out" })).toBeNull();
  });

  it("offers explicit cloud-conflict choices without replacing the local copy automatically", async () => {
    const client: AccountSessionClient = {
      session: vi.fn().mockResolvedValue({ authenticated: true, username: "team-one" }),
      signup: vi.fn(),
      login: vi.fn(),
      logout: vi.fn()
    };
    const harness = mount(client);
    await harness.controller.requireAccess();
    const onKeepLocal = vi.fn().mockResolvedValue(undefined);
    const onUseCloud = vi.fn().mockResolvedValue(undefined);

    harness.controller.setCloudConflict({
      documentId: "campaign-main",
      cloudAvailable: true,
      onKeepLocal,
      onUseCloud,
      onRetry: vi.fn()
    });

    expect(getByRole(harness.statusRoot, "group", { name: "Choose which saved copy to use" }))
      .toBeTruthy();
    fireEvent.click(getByRole(harness.statusRoot, "button", {
      name: "Keep this device's copy"
    }));
    await waitFor(() => expect(onKeepLocal).toHaveBeenCalledOnce());
    expect(onUseCloud).not.toHaveBeenCalled();
  });

  it("restores focus and keeps both copies untouched when a conflict action fails", async () => {
    const client: AccountSessionClient = {
      session: vi.fn().mockResolvedValue({ authenticated: true, username: "team-one" }),
      signup: vi.fn(),
      login: vi.fn(),
      logout: vi.fn()
    };
    const harness = mount(client);
    await harness.controller.requireAccess();
    const onRetry = vi.fn().mockRejectedValue(new Error("offline"));
    harness.controller.setCloudConflict({
      documentId: "campaign-main",
      cloudAvailable: false,
      onKeepLocal: vi.fn(),
      onRetry
    });
    const retry = getByRole<HTMLButtonElement>(harness.statusRoot, "button", {
      name: "Retry cloud check"
    });

    fireEvent.click(retry);

    await waitFor(() => expect(getByRole(harness.statusRoot, "alert").textContent)
      .toContain("Both copies are still safe"));
    expect(document.activeElement).toBe(retry);
    expect(retry.disabled).toBe(false);
  });

  it("stays locked without reloading when the server logout cannot be confirmed", async () => {
    const client: AccountSessionClient = {
      session: vi.fn().mockResolvedValue({ authenticated: true, username: "team-one" }),
      signup: vi.fn(),
      login: vi.fn(),
      logout: vi.fn().mockRejectedValue(new TypeError("network unavailable"))
    };
    const onSignedOut = vi.fn().mockResolvedValue(undefined);
    const reload = vi.fn();
    const harness = mount(client, { onSignedOut, reload });
    await harness.controller.requireAccess();
    harness.creatorRoot.hidden = false;

    fireEvent.click(getByRole(harness.statusRoot, "button", { name: "Log out" }));

    await waitFor(() => expect(getByRole(harness.gateRoot, "alert").textContent)
      .toBe("This account is locked because sign-out could not be confirmed. Check your connection, then reload this page before another person signs in."));
    expect(client.logout).toHaveBeenCalledOnce();
    expect(reload).not.toHaveBeenCalled();
    expect(harness.gameSurface.hidden).toBe(true);
    expect(harness.gameSurface.inert).toBe(true);
    expect(harness.creatorRoot.hidden).toBe(true);
    expect(harness.creatorRoot.inert).toBe(true);
  });

  it("locks both account surfaces and isolates before reloading on auth expiry", async () => {
    const isolated = deferred<void>();
    const client: AccountSessionClient = {
      session: vi.fn().mockResolvedValue({ authenticated: true, username: "team-one" }),
      signup: vi.fn(),
      login: vi.fn(),
      logout: vi.fn()
    };
    const onSignedOut = vi.fn(() => isolated.promise);
    const reload = vi.fn();
    const harness = mount(client, { onSignedOut, reload });
    await harness.controller.requireAccess();
    harness.creatorRoot.hidden = false;

    harness.controller.requireReauthentication();

    expect(harness.gameSurface.hidden).toBe(true);
    expect(harness.gameSurface.inert).toBe(true);
    expect(harness.creatorRoot.hidden).toBe(true);
    expect(harness.creatorRoot.inert).toBe(true);
    expect(onSignedOut).toHaveBeenCalledWith(false);
    expect(reload).not.toHaveBeenCalled();

    isolated.resolve();
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(client.logout).not.toHaveBeenCalled();
  });
});
