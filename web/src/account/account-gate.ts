import {
  AccountClientError,
  type AccountSessionClient,
  type AccountSignupClient
} from "./account-client";

export type { AccountSessionClient, AccountSignupClient } from "./account-client";

export interface AccountAccessControllerOptions {
  readonly client: AccountSessionClient;
  readonly signupClient?: AccountSignupClient;
  readonly gateRoot: HTMLElement;
  readonly statusRoot: HTMLElement;
  readonly gameSurface: HTMLElement;
  readonly gameCanvas: HTMLCanvasElement;
  readonly creatorRoot: HTMLElement;
  readonly onSession?: (
    username: string,
    resetGeneration: string | null
  ) => void | Promise<void>;
  readonly onSignedOut?: (explicit: boolean) => void | Promise<void>;
  readonly reload?: () => void;
  readonly retryGame?: () => void;
}

export interface AccountCloudConflictOptions {
  readonly documentId: string;
  readonly cloudAvailable: boolean;
  readonly onKeepLocal: () => void | Promise<void>;
  readonly onUseCloud?: () => void | Promise<void>;
  readonly onRetry: () => void | Promise<void>;
}

const copyForError = (error: unknown): string => {
  const code = error instanceof AccountClientError ? error.code : "ACCOUNT_UNAVAILABLE";
  switch (code) {
    case "INVALID_CREDENTIALS":
      return "That username or password did not match. Try again.";
    case "USERNAME_UNAVAILABLE":
      return "That username is already in use or waiting for approval. Choose another.";
    case "INVALID_REQUEST":
      return "Check the username and password, then try again.";
    case "ACCOUNT_NOT_CONFIGURED":
      return "Accounts are not ready yet. Ask your teacher to try again later.";
    case "ACCOUNT_RATE_LIMITED": {
      const seconds = error instanceof AccountClientError
        ? Math.max(1, error.retryAfterSeconds ?? 5)
        : 5;
      return `Lots of pairs are connecting at once. Wait ${seconds} seconds, then try again.`;
    }
    case "AUTHENTICATION_REQUIRED":
      return "Your session ended. Log in again to reconnect your private save.";
    default:
      return "Account access is unavailable just now. Your game has not started; try again.";
  }
};

export class AccountAccessController {
  readonly #client: AccountSessionClient;
  readonly #signupClient: AccountSignupClient | undefined;
  readonly #gateRoot: HTMLElement;
  readonly #statusRoot: HTMLElement;
  readonly #gameSurface: HTMLElement;
  readonly #gameCanvas: HTMLCanvasElement;
  readonly #creatorRoot: HTMLElement;
  readonly #onSession: ((
    username: string,
    resetGeneration: string | null
  ) => void | Promise<void>) | undefined;
  readonly #onSignedOut: ((explicit: boolean) => void | Promise<void>) | undefined;
  readonly #reload: () => void;
  readonly #retryGame: () => void;
  #accessPromise: Promise<void> | null = null;
  #resolveAccess: (() => void) | null = null;
  #username: string | null = null;
  #cloudMessage = "Progress saves on this device first.";
  #cloudConflict: AccountCloudConflictOptions | null = null;
  #lifecycleGeneration = 0;
  #leavingAccount = false;
  #gameStartFailed = false;

  constructor(options: AccountAccessControllerOptions) {
    this.#client = options.client;
    this.#signupClient = options.signupClient;
    this.#gateRoot = options.gateRoot;
    this.#statusRoot = options.statusRoot;
    this.#gameSurface = options.gameSurface;
    this.#gameCanvas = options.gameCanvas;
    this.#creatorRoot = options.creatorRoot;
    this.#onSession = options.onSession;
    this.#onSignedOut = options.onSignedOut;
    this.#reload = options.reload ?? (() => globalThis.location.reload());
    this.#retryGame = options.retryGame ?? (() => {
      globalThis.location.replace(`/student?retry=${Date.now()}`);
    });
  }

  requireAccess(): Promise<void> {
    if (this.#accessPromise !== null) return this.#accessPromise;
    this.#accessPromise = new Promise<void>((resolve) => { this.#resolveAccess = resolve; });
    this.#lockAccountSurfaces();
    this.#renderChecking();
    void this.#client.session()
      .then((session) => {
        if (session.authenticated) {
          void this.#admit(session.username, session.resetGeneration);
        }
        else this.#renderLogin();
      })
      .catch((error: unknown) => this.#renderLogin(copyForError(error)));
    return this.#accessPromise;
  }

  setCloudMessage(message: string): void {
    this.#cloudMessage = message;
    this.#cloudConflict = null;
    if (this.#username !== null) this.#renderStatus(this.#username);
  }

  setCloudConflict(options: AccountCloudConflictOptions): void {
    this.#cloudMessage =
      "Saved on this device · another cloud copy needs review. Nothing was replaced.";
    this.#cloudConflict = options;
    if (this.#username !== null) this.#renderStatus(this.#username);
  }

  requireReauthentication(): void {
    this.#leaveAccount(false);
  }

  holdForReset(): void {
    this.#lifecycleGeneration += 1;
    this.#lockAccountSurfaces();
    this.#statusRoot.hidden = true;
    this.#statusRoot.replaceChildren();
    this.#renderIdentityBoundary(
      "This account's progress is being reset in another tab. This page will reload when the reset finishes.",
      false,
      "Resetting account progress"
    );
  }

  completeReset(): void {
    this.#reload();
  }

  reportGameStartFailure(reason: "timeout" | "engine"): void {
    this.#lifecycleGeneration += 1;
    this.#lockAccountSurfaces();
    this.#statusRoot.hidden = true;
    this.#statusRoot.replaceChildren();
    this.#gateRoot.hidden = false;
    this.#gateRoot.className = "account-access";

    const section = this.#gateCard("The game could not start");
    const message = document.createElement("p");
    message.setAttribute("role", "alert");
    message.textContent = reason === "timeout"
      ? "Loading took too long. Your saved work is safe."
      : "The game stopped while loading. Your saved work is safe.";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Try loading again";
    retry.addEventListener("click", () => this.#retryGame());
    const signIn = document.createElement("button");
    signIn.type = "button";
    signIn.textContent = "Return to sign in";
    signIn.addEventListener("click", () => {
      this.#gameStartFailed = true;
      retry.disabled = true;
      signIn.disabled = true;
      void this.#recoverActivationFailure();
    });
    section.append(message, retry, signIn);
    this.#gateRoot.replaceChildren(section);
    queueMicrotask(() => retry.focus());
  }

  #lockAccountSurfaces(): void {
    this.#lockGame();
    this.#creatorRoot.hidden = true;
    this.#creatorRoot.inert = true;
    this.#creatorRoot.setAttribute("aria-hidden", "true");
  }

  #lockGame(): void {
    this.#gameSurface.hidden = true;
    this.#gameSurface.inert = true;
    this.#gameSurface.setAttribute("aria-hidden", "true");
    this.#gameCanvas.tabIndex = -1;
  }

  #unlockGame(): void {
    this.#gameSurface.hidden = false;
    this.#gameSurface.inert = false;
    this.#gameSurface.removeAttribute("aria-hidden");
    this.#gameCanvas.tabIndex = 0;
    this.#creatorRoot.inert = false;
    this.#creatorRoot.removeAttribute("aria-hidden");
  }

  #renderChecking(): void {
    this.#statusRoot.hidden = true;
    this.#gateRoot.hidden = false;
    this.#gateRoot.className = "account-access";
    const section = document.createElement("section");
    section.className = "account-access__card";
    section.setAttribute("aria-label", "Account access");
    const heading = document.createElement("h1");
    heading.textContent = "Welcome to Ad Market";
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.textContent = "Checking your account…";
    section.append(heading, status);
    this.#gateRoot.replaceChildren(section);
  }

  #renderLogin(message = ""): void {
    this.#gateRoot.hidden = false;
    this.#gateRoot.className = "account-access";
    const section = this.#gateCard("Welcome to Ad Market");
    const intro = document.createElement("p");
    intro.textContent = "Enter your pair username and password to reconnect your private save.";
    const form = document.createElement("form");
    form.setAttribute("aria-label", "Log in");
    const username = this.#field(form, "Username", "text", "username", "username");
    const password = this.#field(form, "Password", "password", "password", "current-password");
    password.minLength = 8;
    password.maxLength = 128;
    const error = this.#liveError(message);
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Log in";
    form.append(error, submit);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = { username: username.value, password: password.value };
      password.value = "";
      this.#setBusy(form, true);
      error.textContent = "";
      void this.#client.login(input)
        .then(async (session) => {
          if (!await this.#admit(session.username, session.resetGeneration)) {
            this.#setBusy(form, false);
          }
        })
        .catch((failure: unknown) => {
          this.#setBusy(form, false);
          error.textContent = copyForError(failure);
          password.focus();
        });
    });
    section.append(intro, form);
    if (this.#signupClient !== undefined) {
      const create = document.createElement("button");
      create.type = "button";
      create.textContent = "Create a pair login";
      create.addEventListener("click", () => this.#renderSignup());
      section.append(create);
    }
    this.#gateRoot.replaceChildren(section);
    queueMicrotask(() => username.focus());
  }

  #renderSignup(message = ""): void {
    if (this.#signupClient === undefined) return;
    const section = this.#gateCard("Create a pair login");
    const explanation = document.createElement("p");
    explanation.textContent =
      "Choose a classroom-only username and password for your pair. Your teacher must approve them before you can log in.";
    const form = document.createElement("form");
    form.setAttribute("aria-label", "Create a pair login");
    const username = this.#field(form, "Username", "text", "username", "username");
    username.maxLength = 24;
    username.pattern = "[A-Za-z0-9][A-Za-z0-9_-]{2,23}";
    const password = this.#field(form, "Password", "password", "password", "new-password");
    password.minLength = 8;
    password.maxLength = 128;
    const confirmation = this.#field(
      form,
      "Confirm password",
      "password",
      "password-confirmation",
      "new-password"
    );
    confirmation.minLength = 8;
    confirmation.maxLength = 128;
    const error = this.#liveError(message);
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Send for teacher approval";
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = "Back to log in";
    back.addEventListener("click", () => this.#renderLogin());
    form.append(error, submit, back);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (password.value !== confirmation.value) {
        error.textContent = "The passwords do not match.";
        confirmation.focus();
        return;
      }
      const input = { username: username.value, password: password.value };
      password.value = "";
      confirmation.value = "";
      this.#setBusy(form, true);
      error.textContent = "";
      void this.#signupClient!.signup(input)
        .then((result) => this.#renderPendingApproval(result.username))
        .catch((failure: unknown) => {
          this.#setBusy(form, false);
          error.textContent = copyForError(failure);
          password.focus();
        });
    });
    section.append(explanation, form);
    this.#gateRoot.replaceChildren(section);
    queueMicrotask(() => username.focus());
  }

  #renderPendingApproval(username: string): void {
    const section = this.#gateCard("Waiting for teacher approval");
    const message = document.createElement("p");
    message.setAttribute("role", "status");
    message.setAttribute("aria-live", "polite");
    message.textContent =
      `Your request for ${username} has been sent. Ask your teacher to approve it. ` +
      "After approval, return here and log in with the same username and password.";
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = "Back to log in";
    back.addEventListener("click", () => this.#renderLogin());
    section.append(message, back);
    this.#gateRoot.replaceChildren(section);
    queueMicrotask(() => section.querySelector("h1")?.focus());
  }

  async #admit(username: string, resetGeneration: string | null): Promise<boolean> {
    const generation = this.#lifecycleGeneration;
    try {
      await this.#onSession?.(username, resetGeneration);
    } catch (error) {
      if (generation === this.#lifecycleGeneration && !this.#leavingAccount) {
        if (error instanceof AccountClientError && error.code === "AUTHENTICATION_REQUIRED") {
          this.#renderLogin(copyForError(error));
        } else {
          await this.#recoverActivationFailure();
        }
      }
      return false;
    }
    if (generation !== this.#lifecycleGeneration || this.#leavingAccount) return false;
    this.#username = username;
    this.#gateRoot.hidden = true;
    this.#gateRoot.replaceChildren();
    this.#unlockGame();
    this.#renderStatus(username);
    this.#resolveAccess?.();
    this.#resolveAccess = null;
    if (this.#gameStartFailed) {
      this.#retryGame();
    }
    return true;
  }

  #renderActivationFailure(): void {
    this.#lockAccountSurfaces();
    this.#statusRoot.hidden = true;
    this.#statusRoot.replaceChildren();
    this.#gateRoot.hidden = false;
    this.#gateRoot.className = "account-access";
    const section = this.#gateCard("Your private save could not open.");
    const message = this.#liveError(
      "We could not prepare private device storage. Your game stayed locked and no other account's work was opened. Return to the start and try again."
    );
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Return to start";
    retry.addEventListener("click", () => {
      retry.disabled = true;
      void this.#recoverActivationFailure();
    });
    section.append(message, retry);
    this.#gateRoot.replaceChildren(section);
  }

  async #recoverActivationFailure(): Promise<void> {
    this.#lockAccountSurfaces();
    this.#statusRoot.hidden = true;
    this.#statusRoot.replaceChildren();
    let localIsolationFailed = false;
    try {
      await this.#onSignedOut?.(false);
    } catch {
      localIsolationFailed = true;
    }
    try {
      await this.#client.logout();
    } catch (error) {
      if (!(error instanceof AccountClientError && error.code === "AUTHENTICATION_REQUIRED")) {
        this.#renderActivationFailure();
        return;
      }
    }
    this.#username = null;
    if (localIsolationFailed) {
      this.#reload();
      return;
    }
    this.#renderLogin(this.#gameStartFailed
      ? "The game did not start, so you were signed out and returned to the start. " +
        "Log in again or create a pair login."
      : "Private storage did not open, so you were signed out and returned to the start. " +
        "Log in again or create a pair login.");
  }

  #renderStatus(username: string): void {
    this.#statusRoot.hidden = false;
    this.#statusRoot.className = "account-session";
    this.#statusRoot.setAttribute("aria-label", "Account");
    const expanded = this.#cloudConflict !== null;
    const panelId = "account-session-panel";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "account-session__toggle";
    toggle.textContent = `Account · ${username}`;
    toggle.setAttribute("aria-controls", panelId);
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.setAttribute("aria-label", expanded
      ? "Hide account details"
      : "Show account details");
    const identity = document.createElement("span");
    identity.dataset.accountIdentity = "";
    identity.textContent = `Signed in as ${username}`;
    const cloud = document.createElement("span");
    cloud.dataset.accountCloudStatus = "";
    cloud.setAttribute("role", "status");
    cloud.setAttribute("aria-live", "polite");
    cloud.textContent = this.#cloudMessage;
    const handover = document.createElement("span");
    handover.dataset.accountHandover = "";
    handover.textContent = "Sign out before another pair uses this device.";
    const signOut = document.createElement("button");
    signOut.type = "button";
    signOut.textContent = "Sign out";
    signOut.addEventListener("click", () => {
      signOut.disabled = true;
      cloud.textContent = "Signing out…";
      this.#leaveAccount(true);
    });
    const conflict = this.#cloudConflict === null
      ? null
      : this.#cloudConflictControls(this.#cloudConflict);
    const sessionActions = document.createElement("div");
    sessionActions.className = "account-session__actions";
    sessionActions.append(signOut);
    const panel = document.createElement("div");
    panel.id = panelId;
    panel.className = "account-session__panel";
    panel.dataset.accountPanel = "";
    panel.hidden = !expanded;
    panel.append(
      identity,
      cloud,
      handover,
      ...(conflict === null ? [] : [conflict]),
      sessionActions
    );
    toggle.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      const nowExpanded = !panel.hidden;
      toggle.setAttribute("aria-expanded", String(nowExpanded));
      toggle.setAttribute("aria-label", nowExpanded
        ? "Hide account details"
        : "Show account details");
    });
    this.#statusRoot.replaceChildren(toggle, panel);
  }

  #cloudConflictControls(options: AccountCloudConflictOptions): HTMLElement {
    const group = document.createElement("div");
    group.className = "account-session__conflict";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Choose which saved copy to use");
    const explanation = document.createElement("p");
    explanation.textContent = options.cloudAvailable
      ? "This device and the cloud both have changes. Choose one. The game will not choose for you."
      : "The cloud copy could not be checked. Keep this device's copy or retry the check.";
    const error = document.createElement("p");
    error.className = "account-session__conflict-error";
    error.setAttribute("role", "alert");
    error.setAttribute("aria-live", "assertive");
    const actions = document.createElement("div");
    actions.className = "account-session__conflict-actions";
    const controls: HTMLButtonElement[] = [];
    const action = (
      label: string,
      operation: () => void | Promise<void>
    ): HTMLButtonElement => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      controls.push(button);
      button.addEventListener("click", () => {
        controls.forEach((control) => { control.disabled = true; });
        error.textContent = "";
        void Promise.resolve()
          .then(operation)
          .catch(() => {
            controls.forEach((control) => { control.disabled = false; });
            error.textContent =
              "That cloud action did not finish. Both copies are still safe. Try again.";
            button.focus();
          });
      });
      return button;
    };
    actions.append(action("Keep this device's copy", options.onKeepLocal));
    if (options.cloudAvailable && options.onUseCloud) {
      actions.append(action("Use cloud copy", options.onUseCloud));
    }
    actions.append(action("Retry cloud check", options.onRetry));
    group.append(explanation, actions, error);
    return group;
  }

  #leaveAccount(explicit: boolean): void {
    if (this.#leavingAccount) return;
    this.#leavingAccount = true;
    this.#lifecycleGeneration += 1;
    this.#username = null;
    this.#lockAccountSurfaces();
    this.#statusRoot.hidden = true;
    this.#statusRoot.replaceChildren();
    this.#renderIdentityBoundary(explicit
      ? "Signing out and securing this account's saved work…"
      : "Your session ended. Securing this account's saved work…");

    let isolation: Promise<void>;
    try {
      isolation = Promise.resolve(this.#onSignedOut?.(explicit));
    } catch (error) {
      isolation = Promise.reject(error);
    }
    void isolation
      .then(async () => {
        if (!explicit) return true;
        try {
          await this.#client.logout();
          return true;
        } catch {
          this.#renderIdentityBoundary(
            "This account is locked because sign-out could not be confirmed. Check your connection, then reload this page before another person signs in.",
            true
          );
          return false;
        }
      })
      .then((shouldReload) => {
        if (shouldReload) this.#reload();
      })
      .catch(() => this.#renderIdentityBoundary(
        "This account is locked. Reload the page before another person signs in.",
        true
      ));
  }

  #renderIdentityBoundary(
    message: string,
    assertive = false,
    title = "Account locked"
  ): void {
    this.#gateRoot.hidden = false;
    this.#gateRoot.className = "account-access";
    const section = this.#gateCard(title);
    const status = document.createElement("p");
    status.setAttribute("role", assertive ? "alert" : "status");
    status.setAttribute("aria-live", assertive ? "assertive" : "polite");
    status.textContent = message;
    section.append(status);
    this.#gateRoot.replaceChildren(section);
  }

  #gateCard(title: string): HTMLElement {
    const section = document.createElement("section");
    section.className = "account-access__card";
    section.setAttribute("aria-label", "Account access");
    const heading = document.createElement("h1");
    heading.tabIndex = -1;
    heading.textContent = title;
    section.append(heading);
    return section;
  }

  #field(
    form: HTMLFormElement,
    labelText: string,
    type: "text" | "password",
    name: string,
    autocomplete: string
  ): HTMLInputElement {
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = document.createElement("input");
    input.type = type;
    input.name = name;
    input.setAttribute("autocomplete", autocomplete);
    input.required = true;
    input.maxLength = type === "password" ? 128 : 64;
    label.append(input);
    form.append(label);
    return input;
  }

  #liveError(message: string): HTMLElement {
    const error = document.createElement("p");
    error.className = "account-access__error";
    error.setAttribute("role", "alert");
    error.setAttribute("aria-live", "assertive");
    error.textContent = message;
    return error;
  }

  #setBusy(form: HTMLFormElement, busy: boolean): void {
    form.setAttribute("aria-busy", String(busy));
    for (const control of form.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
      "input, button"
    )) control.disabled = busy;
  }
}
