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
  type AccountSessionClient,
  type AccountSignupClient
} from "./account-gate";
import { AccountClientError } from "./account-client";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const resetGeneration = "7440e792-3ddc-4484-ae32-a53088d0d679";
const authenticatedSession = (
  username = "team-one",
  generation: string | null = null
) => ({
  authenticated: true as const,
  username,
  resetGeneration: generation
});

function mount(client: AccountSessionClient, callbacks: {
  onSession?: (username: string, generation: string | null) => void | Promise<void>;
  onSignedOut?: (explicit: boolean) => void | Promise<void>;
  signupClient?: AccountSignupClient;
  reload?: () => void;
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
    ...(callbacks.signupClient === undefined ? {} : { signupClient: callbacks.signupClient }),
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
      session: vi.fn().mockResolvedValue(authenticatedSession("team-one", resetGeneration)),
      login: vi.fn(),
      logout: vi.fn()
    };
    const onSession = vi.fn(() => activation.promise);
    const harness = mount(client, { onSession });
    let resolved = false;

    const access = harness.controller.requireAccess().then(() => { resolved = true; });
    await waitFor(() => expect(onSession).toHaveBeenCalledWith(
      "team-one",
      resetGeneration
    ));

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

  it("returns to the full student landing screen when account storage activation fails", async () => {
    const client: AccountSessionClient = {
      session: vi.fn().mockResolvedValue(authenticatedSession()),
      login: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined)
    };
    const signupClient: AccountSignupClient = {
      signup: vi.fn()
    };
    const onSignedOut = vi.fn().mockResolvedValue(undefined);
    const harness = mount(client, {
      onSession: vi.fn().mockRejectedValue(new Error("raw indexeddb detail")),
      onSignedOut,
      signupClient
    });

    void harness.controller.requireAccess();

    await waitFor(() => expect(getByRole(harness.gateRoot, "form", {
      name: "Log in"
    })).toBeTruthy());
    expect(getByRole(harness.gateRoot, "alert").textContent)
      .toContain("returned to the start");
    expect(getByRole(harness.gateRoot, "button", {
      name: "Create a pair login"
    })).toBeTruthy();
    expect(harness.gateRoot.textContent).not.toContain("raw indexeddb detail");
    expect(client.logout).toHaveBeenCalledOnce();
    expect(onSignedOut).toHaveBeenCalledWith(false);
    expect(harness.gameSurface.hidden).toBe(true);
    expect(harness.gameSurface.inert).toBe(true);
    expect(harness.creatorRoot.hidden).toBe(true);
    expect(harness.creatorRoot.inert).toBe(true);
  });

  it("clears the server session and reloads when local isolation also fails", async () => {
    const client: AccountSessionClient = {
      session: vi.fn().mockResolvedValue(authenticatedSession()),
      login: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined)
    };
    const reload = vi.fn();
    const harness = mount(client, {
      onSession: vi.fn().mockRejectedValue(new Error("activation failed")),
      onSignedOut: vi.fn().mockRejectedValue(new Error("isolation failed")),
      reload
    });

    void harness.controller.requireAccess();

    await waitFor(() => expect(client.logout).toHaveBeenCalledOnce());
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(harness.gameSurface.hidden).toBe(true);
    expect(harness.gameSurface.inert).toBe(true);
    expect(harness.creatorRoot.hidden).toBe(true);
    expect(harness.creatorRoot.inert).toBe(true);
  });

  it("returns to login without unlocking when authentication expires during activation", async () => {
    const client: AccountSessionClient = {
      session: vi.fn().mockResolvedValue(authenticatedSession()),
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

  it("keeps the game unfocusable and offers pair login without teacher controls", async () => {
    const session = deferred<{ authenticated: false }>();
    const client: AccountSessionClient = {
      session: vi.fn(() => session.promise),
      login: vi.fn().mockResolvedValue(authenticatedSession()),
      logout: vi.fn()
    };
    const onSession = vi.fn();
    const harness = mount(client, { onSession });
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

    expect(queryByRole(harness.gateRoot, "button", { name: /teacher setup/i })).toBeNull();
    expect(harness.gateRoot.textContent).not.toMatch(/teacher setup code/i);
    loginUsername.value = "team-one";
    const loginPassword = getByLabelText<HTMLInputElement>(harness.gateRoot, "Password");
    loginPassword.value = "student-password";
    fireEvent.submit(getByRole(harness.gateRoot, "form", { name: "Log in" }));

    await access;
    expect(client.login).toHaveBeenCalledWith({
      username: "team-one",
      password: "student-password"
    });
    expect(loginPassword.value).toBe("");
    expect(harness.gameSurface.hidden).toBe(false);
    expect(harness.gameSurface.inert).toBe(false);
    expect(harness.gameSurface.hasAttribute("aria-hidden")).toBe(false);
    expect(harness.canvas.tabIndex).toBe(0);
    expect(harness.gateRoot.hidden).toBe(true);
    expect(harness.statusRoot.textContent).toContain("Signed in as team-one");
    expect(queryByRole(harness.statusRoot, "button", { name: /reset progress/i })).toBeNull();
    expect(getByRole(harness.statusRoot, "button", { name: "Sign out" })).toBeTruthy();
    expect(harness.statusRoot.textContent)
      .toContain("Sign out before another pair uses this device.");
    expect(onSession).toHaveBeenCalledWith("team-one", null);
  });

  it("announces a calm login error and moves focus back to the password", async () => {
    const client: AccountSessionClient = {
      session: vi.fn().mockResolvedValue({ authenticated: false }),
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

  it("lets a pair request its own login and keeps the game locked until teacher approval", async () => {
    const client: AccountSessionClient = {
      session: vi.fn().mockResolvedValue({ authenticated: false }),
      login: vi.fn(),
      logout: vi.fn()
    };
    const signupClient: AccountSignupClient = {
      signup: vi.fn().mockResolvedValue({ status: "pending", username: "bright-ideas" })
    };
    const harness = mount(client, { signupClient });
    void harness.controller.requireAccess();
    await waitFor(() => expect(getByRole(harness.gateRoot, "form", {
      name: "Log in"
    })).toBeTruthy());

    fireEvent.click(getByRole(harness.gateRoot, "button", {
      name: "Create a pair login"
    }));
    const form = getByRole(harness.gateRoot, "form", { name: "Create a pair login" });
    fireEvent.input(getByLabelText(form, "Username"), {
      target: { value: "Bright-Ideas" }
    });
    fireEvent.input(getByLabelText(form, "Password"), {
      target: { value: "classroom-only-password" }
    });
    fireEvent.input(getByLabelText(form, "Confirm password"), {
      target: { value: "classroom-only-password" }
    });
    fireEvent.submit(form);

    await waitFor(() => expect(signupClient.signup).toHaveBeenCalledWith({
      username: "Bright-Ideas",
      password: "classroom-only-password"
    }));
    await waitFor(() => expect(getByRole(harness.gateRoot, "heading", {
      name: "Waiting for teacher approval"
    })).toBeTruthy());
    expect(harness.gateRoot.textContent).toContain("bright-ideas");
    expect(harness.gateRoot.textContent).toContain("same username and password");
    expect(harness.gameSurface.hidden).toBe(true);
    expect(harness.creatorRoot.hidden).toBe(true);

    fireEvent.click(getByRole(harness.gateRoot, "button", { name: "Back to log in" }));
    expect(getByRole(harness.gateRoot, "form", { name: "Log in" })).toBeTruthy();
  });

  it("locks both account surfaces immediately and reloads only after logout isolation", async () => {
    const isolated = deferred<void>();
    const client: AccountSessionClient = {
      session: vi.fn().mockResolvedValue(authenticatedSession()),
      login: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined)
    };
    const onSignedOut = vi.fn();
    onSignedOut.mockReturnValue(isolated.promise);
    const reload = vi.fn();
    const harness = mount(client, { onSignedOut, reload });
    await harness.controller.requireAccess();
    harness.creatorRoot.hidden = false;

    fireEvent.click(getByRole(harness.statusRoot, "button", { name: "Sign out" }));

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
    expect(queryByRole(harness.statusRoot, "button", { name: "Sign out" })).toBeNull();
  });

  it("does not expose self-reset to an authenticated pair", async () => {
    const client: AccountSessionClient = {
      session: vi.fn().mockResolvedValue(authenticatedSession()),
      login: vi.fn(),
      logout: vi.fn()
    };
    const harness = mount(client);
    await harness.controller.requireAccess();

    expect(queryByRole(harness.statusRoot, "button", { name: /reset progress/i })).toBeNull();
    expect(queryByRole(document.body, "dialog", { name: /reset account progress/i })).toBeNull();
    expect(client.logout).not.toHaveBeenCalled();
  });

  it("locks another tab during reset and reloads it on completion", async () => {
    const client: AccountSessionClient = {
      session: vi.fn().mockResolvedValue(authenticatedSession()),
      login: vi.fn(),
      logout: vi.fn()
    };
    const reload = vi.fn();
    const harness = mount(client, { reload });
    await harness.controller.requireAccess();

    harness.controller.holdForReset();

    expect(harness.gameSurface.hidden).toBe(true);
    expect(getByRole(harness.gateRoot, "heading", {
      name: "Resetting account progress"
    })).toBeTruthy();
    expect(harness.gateRoot.textContent).toContain("another tab");
    expect(client.logout).not.toHaveBeenCalled();

    harness.controller.completeReset();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("offers explicit cloud-conflict choices without replacing the local copy automatically", async () => {
    const client: AccountSessionClient = {
      session: vi.fn().mockResolvedValue(authenticatedSession()),
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
      session: vi.fn().mockResolvedValue(authenticatedSession()),
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
      session: vi.fn().mockResolvedValue(authenticatedSession()),
      login: vi.fn(),
      logout: vi.fn().mockRejectedValue(new TypeError("network unavailable"))
    };
    const onSignedOut = vi.fn().mockResolvedValue(undefined);
    const reload = vi.fn();
    const harness = mount(client, { onSignedOut, reload });
    await harness.controller.requireAccess();
    harness.creatorRoot.hidden = false;

    fireEvent.click(getByRole(harness.statusRoot, "button", { name: "Sign out" }));

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
      session: vi.fn().mockResolvedValue(authenticatedSession()),
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
