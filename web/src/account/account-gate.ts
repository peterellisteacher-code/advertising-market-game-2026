import {
  AccountClientError,
  type AccountSessionClient
} from "./account-client";
import { generateStrongPairPassword } from "./pair-credential-generator";

export type { AccountSessionClient } from "./account-client";

export interface AccountAccessControllerOptions {
  readonly client: AccountSessionClient;
  readonly gateRoot: HTMLElement;
  readonly statusRoot: HTMLElement;
  readonly gameSurface: HTMLElement;
  readonly gameCanvas: HTMLCanvasElement;
  readonly creatorRoot: HTMLElement;
  readonly onSession?: (username: string) => void | Promise<void>;
  readonly onSignedOut?: (explicit: boolean) => void | Promise<void>;
  readonly reload?: () => void;
  readonly generatePairPassword?: () => string;
}

const copyForError = (error: unknown): string => {
  const code = error instanceof AccountClientError ? error.code : "ACCOUNT_UNAVAILABLE";
  switch (code) {
    case "INVALID_CREDENTIALS":
      return "That username or password did not match. Try again.";
    case "SIGNUP_DENIED":
      return "That teacher setup code was not accepted.";
    case "USERNAME_UNAVAILABLE":
      return "That pair username is already taken. Choose another one.";
    case "ACCOUNT_NOT_CONFIGURED":
      return "Accounts are not ready yet. Ask your teacher to try again later.";
    case "AUTHENTICATION_REQUIRED":
      return "Your session ended. Log in again to reconnect your private save.";
    default:
      return "Account access is unavailable just now. Your game has not started; try again.";
  }
};

export class AccountAccessController {
  readonly #client: AccountSessionClient;
  readonly #gateRoot: HTMLElement;
  readonly #statusRoot: HTMLElement;
  readonly #gameSurface: HTMLElement;
  readonly #gameCanvas: HTMLCanvasElement;
  readonly #creatorRoot: HTMLElement;
  readonly #onSession: ((username: string) => void | Promise<void>) | undefined;
  readonly #onSignedOut: ((explicit: boolean) => void | Promise<void>) | undefined;
  readonly #reload: () => void;
  readonly #generatePairPassword: () => string;
  #accessPromise: Promise<void> | null = null;
  #resolveAccess: (() => void) | null = null;
  #username: string | null = null;
  #cloudMessage = "Progress saves on this device first.";
  #lifecycleGeneration = 0;
  #leavingAccount = false;

  constructor(options: AccountAccessControllerOptions) {
    this.#client = options.client;
    this.#gateRoot = options.gateRoot;
    this.#statusRoot = options.statusRoot;
    this.#gameSurface = options.gameSurface;
    this.#gameCanvas = options.gameCanvas;
    this.#creatorRoot = options.creatorRoot;
    this.#onSession = options.onSession;
    this.#onSignedOut = options.onSignedOut;
    this.#reload = options.reload ?? (() => globalThis.location.reload());
    this.#generatePairPassword = options.generatePairPassword ?? generateStrongPairPassword;
  }

  requireAccess(): Promise<void> {
    if (this.#accessPromise !== null) return this.#accessPromise;
    this.#accessPromise = new Promise<void>((resolve) => { this.#resolveAccess = resolve; });
    this.#lockAccountSurfaces();
    this.#renderChecking();
    void this.#client.session()
      .then((session) => {
        if (session.authenticated) void this.#admit(session.username);
        else this.#renderLogin();
      })
      .catch((error: unknown) => this.#renderLogin(copyForError(error)));
    return this.#accessPromise;
  }

  setCloudMessage(message: string): void {
    this.#cloudMessage = message;
    if (this.#username !== null) this.#renderStatus(this.#username);
  }

  requireReauthentication(): void {
    this.#leaveAccount(false);
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
    const switchMode = document.createElement("button");
    switchMode.type = "button";
    switchMode.textContent = "Teacher setup";
    switchMode.addEventListener("click", () => this.#renderSignup());
    form.append(error, submit, switchMode);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = { username: username.value, password: password.value };
      password.value = "";
      this.#setBusy(form, true);
      error.textContent = "";
      void this.#client.login(input)
        .then(async (session) => {
          if (!await this.#admit(session.username)) this.#setBusy(form, false);
        })
        .catch((failure: unknown) => {
          this.#setBusy(form, false);
          error.textContent = copyForError(failure);
          password.focus();
        });
    });
    section.append(intro, form);
    this.#gateRoot.replaceChildren(section);
    queueMicrotask(() => username.focus());
  }

  #renderSignup(message = ""): void {
    this.#gateRoot.hidden = false;
    const section = this.#gateCard("Create a pair login");
    const intro = document.createElement("p");
    intro.textContent = "Teacher only: choose a pair username, save the generated password, then enter the setup code.";
    const form = document.createElement("form");
    form.setAttribute("aria-label", "Create pair login");
    const username = this.#field(form, "Pair username", "text", "username", "username");
    username.pattern = "[A-Za-z0-9][A-Za-z0-9_-]{2,23}";
    const password = this.#field(form, "Generated password", "text", "password", "new-password");
    password.minLength = 20;
    password.maxLength = 128;
    password.readOnly = true;
    password.spellcheck = false;
    password.value = this.#generatePairPassword();
    const regenerate = document.createElement("button");
    regenerate.type = "button";
    regenerate.textContent = "Generate another password";
    regenerate.addEventListener("click", () => {
      password.value = this.#generatePairPassword();
      password.focus();
      password.select();
    });
    const classroomCode = this.#field(form, "Teacher setup code", "password", "classroom-code", "off");
    const error = this.#liveError(message);
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Create pair login";
    const switchMode = document.createElement("button");
    switchMode.type = "button";
    switchMode.textContent = "Back to login";
    switchMode.addEventListener("click", () => this.#renderLogin());
    form.append(regenerate, error, submit, switchMode);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = {
        username: username.value,
        password: password.value,
        classroomCode: classroomCode.value
      };
      password.value = "";
      classroomCode.value = "";
      this.#setBusy(form, true);
      error.textContent = "";
      void this.#client.signup(input)
        .then(async (session) => {
          if (!await this.#admit(session.username)) this.#setBusy(form, false);
        })
        .catch((failure: unknown) => {
          this.#setBusy(form, false);
          error.textContent = copyForError(failure);
          const code = failure instanceof AccountClientError ? failure.code : "";
          (code === "SIGNUP_DENIED" ? classroomCode : username).focus();
        });
    });
    section.append(intro, form);
    this.#gateRoot.replaceChildren(section);
    queueMicrotask(() => username.focus());
  }

  async #admit(username: string): Promise<boolean> {
    const generation = this.#lifecycleGeneration;
    try {
      await this.#onSession?.(username);
    } catch (error) {
      if (generation === this.#lifecycleGeneration && !this.#leavingAccount) {
        if (error instanceof AccountClientError && error.code === "AUTHENTICATION_REQUIRED") {
          this.#renderLogin(copyForError(error));
        } else {
          this.#renderActivationFailure();
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
    return true;
  }

  #renderActivationFailure(): void {
    this.#lockAccountSurfaces();
    this.#statusRoot.hidden = true;
    this.#statusRoot.replaceChildren();
    this.#gateRoot.hidden = false;
    this.#gateRoot.className = "account-access";
    const section = this.#gateCard("Your private save could not open");
    const message = this.#liveError(
      "We could not prepare private device storage. Your game stayed locked and no other account's work was opened. Reload this page and try again."
    );
    section.append(message);
    this.#gateRoot.replaceChildren(section);
  }

  #renderStatus(username: string): void {
    this.#statusRoot.hidden = false;
    this.#statusRoot.className = "account-session";
    this.#statusRoot.setAttribute("aria-label", "Account");
    const identity = document.createElement("span");
    identity.dataset.accountIdentity = "";
    identity.textContent = `Signed in as ${username}`;
    const cloud = document.createElement("span");
    cloud.dataset.accountCloudStatus = "";
    cloud.setAttribute("role", "status");
    cloud.setAttribute("aria-live", "polite");
    cloud.textContent = this.#cloudMessage;
    const logout = document.createElement("button");
    logout.type = "button";
    logout.textContent = "Log out";
    logout.addEventListener("click", () => {
      logout.disabled = true;
      cloud.textContent = "Signing out…";
      this.#leaveAccount(true);
    });
    this.#statusRoot.replaceChildren(identity, cloud, logout);
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

  #renderIdentityBoundary(message: string, assertive = false): void {
    this.#gateRoot.hidden = false;
    this.#gateRoot.className = "account-access";
    const section = this.#gateCard("Account locked");
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
