import {
  createTeacherOperationId,
  type TeacherClient,
  type TeacherPairSummary
} from "./teacher-client";

interface TeacherDashboardOptions {
  readonly createOperationId?: () => string;
  readonly clipboard?: Pick<Clipboard, "writeText">;
  readonly navigate?: (path: string) => void;
}

interface DialogSurface {
  readonly dialog: HTMLDialogElement;
  readonly close: () => void;
  readonly setPending: (pending: boolean) => void;
}

const passwordBytes = (value: string): number =>
  new TextEncoder().encode(value).byteLength;

const validPassword = (value: string): boolean => {
  const bytes = passwordBytes(value);
  return bytes >= 8 && bytes <= 128 && !value.includes("\0");
};

const button = (text: string, type: "button" | "submit" = "button"): HTMLButtonElement => {
  const element = document.createElement("button");
  element.type = type;
  element.textContent = text;
  return element;
};

const field = (
  labelText: string,
  input: HTMLInputElement,
  description?: string
): { wrapper: HTMLDivElement; error: HTMLParagraphElement } => {
  const wrapper = document.createElement("div");
  wrapper.className = "teacher-field";
  const label = document.createElement("label");
  label.textContent = labelText;
  label.append(input);
  wrapper.append(label);
  if (description !== undefined) {
    const help = document.createElement("p");
    help.className = "teacher-field__help";
    help.textContent = description;
    wrapper.append(help);
  }
  const error = document.createElement("p");
  error.className = "teacher-field__error";
  error.setAttribute("role", "alert");
  error.setAttribute("aria-live", "assertive");
  error.hidden = true;
  wrapper.append(error);
  return { wrapper, error };
};

const showFieldError = (target: HTMLParagraphElement, message: string): void => {
  target.textContent = message;
  target.hidden = message === "";
};

const errorMessage = (fallback: string): string => fallback;

export class TeacherDashboard {
  readonly #root: HTMLElement;
  readonly #client: TeacherClient;
  readonly #createOperationId: () => string;
  readonly #clipboard: Pick<Clipboard, "writeText"> | undefined;
  readonly #navigate: (path: string) => void;
  #accounts: readonly TeacherPairSummary[] = [];
  #announcement: HTMLParagraphElement | null = null;

  constructor(
    root: HTMLElement,
    client: TeacherClient,
    options: TeacherDashboardOptions = {}
  ) {
    this.#root = root;
    this.#client = client;
    this.#createOperationId = options.createOperationId ?? createTeacherOperationId;
    this.#clipboard = options.clipboard ?? navigator.clipboard;
    this.#navigate = options.navigate ?? ((path) => window.location.assign(path));
  }

  async mount(): Promise<void> {
    this.#root.dataset.admarketRoute = "teacher-dashboard";
    this.#root.replaceChildren();
    const loading = document.createElement("p");
    loading.textContent = "Checking teacher access…";
    loading.setAttribute("role", "status");
    this.#root.append(loading);
    try {
      const session = await this.#client.session();
      if (session.authenticated) {
        await this.#loadDashboard();
      } else {
        this.#renderLogin();
      }
    } catch {
      this.#renderLogin("Teacher access could not be checked. Check the connection and try again.");
    }
  }

  #renderLogin(initialError = ""): void {
    const main = document.createElement("main");
    main.className = "teacher-page teacher-login";
    main.tabIndex = -1;
    const eyebrow = document.createElement("p");
    eyebrow.className = "teacher-eyebrow";
    eyebrow.textContent = "AD MARKET";
    const heading = document.createElement("h1");
    heading.textContent = "Teacher access";
    const explanation = document.createElement("p");
    explanation.textContent =
      "Enter the teacher password to manage classroom accounts and open the teacher playtest.";
    const form = document.createElement("form");
    form.className = "teacher-card teacher-login__form";
    const password = document.createElement("input");
    password.type = "password";
    password.name = "teacher-password";
    password.autocomplete = "current-password";
    password.required = true;
    const passwordField = field("Teacher password", password);
    const submit = button("Sign in", "submit");
    const error = document.createElement("p");
    error.className = "teacher-form-error";
    error.setAttribute("role", "alert");
    error.setAttribute("aria-live", "assertive");
    error.hidden = initialError === "";
    error.textContent = initialError;
    form.append(passwordField.wrapper, submit, error);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (submit.disabled) return;
      submit.disabled = true;
      password.disabled = true;
      error.hidden = true;
      void this.#client.login(password.value)
        .then(() => this.#loadDashboard())
        .catch(() => {
          submit.disabled = false;
          password.disabled = false;
          error.hidden = false;
          error.textContent =
            "The teacher password was not accepted. Check the password and try again.";
          password.focus();
        });
    });
    main.append(eyebrow, heading, explanation, form);
    this.#root.replaceChildren(main);
    main.focus();
  }

  async #loadDashboard(): Promise<void> {
    try {
      this.#accounts = await this.#client.listAccounts();
      this.#renderDashboard();
    } catch {
      this.#renderDashboard(
        "Classroom accounts could not be loaded. Check the connection and refresh this page."
      );
    }
  }

  #renderDashboard(initialError = ""): void {
    const main = document.createElement("main");
    main.className = "teacher-page";
    main.tabIndex = -1;
    const header = document.createElement("header");
    header.className = "teacher-header";
    const identity = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.className = "teacher-eyebrow";
    eyebrow.textContent = "AD MARKET";
    const heading = document.createElement("h1");
    heading.textContent = "Classroom accounts";
    const summary = document.createElement("p");
    summary.textContent =
      "Create pair logins, replace passwords and reset one pair's saved work.";
    identity.append(eyebrow, heading, summary);
    const headerActions = document.createElement("div");
    headerActions.className = "teacher-header__actions";
    const playtest = button("Open teacher playtest");
    playtest.addEventListener("click", () => this.#navigate("/teacher/playtest"));
    const logout = button("Sign out");
    logout.addEventListener("click", () => {
      logout.disabled = true;
      void this.#client.logout()
        .then(() => this.#renderLogin())
        .catch(() => {
          logout.disabled = false;
          this.#announce("Sign out did not finish. Check the connection and try again.");
        });
    });
    headerActions.append(playtest, logout);
    header.append(identity, headerActions);

    const toolbar = document.createElement("section");
    toolbar.className = "teacher-toolbar teacher-card";
    const toolbarCopy = document.createElement("div");
    const toolbarHeading = document.createElement("h2");
    toolbarHeading.textContent = "Pair logins";
    const toolbarSummary = document.createElement("p");
    toolbarSummary.textContent =
      `${this.#accounts.length} ${this.#accounts.length === 1 ? "account" : "accounts"}`;
    toolbarCopy.append(toolbarHeading, toolbarSummary);
    const create = button("Create account");
    create.addEventListener("click", () => this.#openCreateDialog(create));
    toolbar.append(toolbarCopy, create);

    const accountRegion = document.createElement("section");
    accountRegion.className = "teacher-accounts";
    accountRegion.setAttribute("aria-label", "Pair accounts");
    if (this.#accounts.length === 0) {
      const empty = document.createElement("p");
      empty.className = "teacher-card teacher-empty";
      empty.textContent = "No pair accounts have been created.";
      accountRegion.append(empty);
    } else {
      for (const account of this.#accounts) {
        accountRegion.append(this.#accountCard(account));
      }
    }

    this.#announcement = document.createElement("p");
    this.#announcement.className = "teacher-announcement";
    this.#announcement.setAttribute("role", initialError === "" ? "status" : "alert");
    this.#announcement.setAttribute("aria-live", initialError === "" ? "polite" : "assertive");
    this.#announcement.textContent = initialError;

    main.append(header, toolbar, this.#announcement, accountRegion);
    this.#root.replaceChildren(main);
    main.focus();
  }

  #accountCard(account: TeacherPairSummary): HTMLElement {
    const article = document.createElement("article");
    article.className = "teacher-account teacher-card";
    const details = document.createElement("div");
    const heading = document.createElement("h3");
    heading.textContent = account.username;
    const activity = document.createElement("p");
    activity.textContent = account.lastSignInAt === null
      ? "Not used yet"
      : `Last used ${new Date(account.lastSignInAt).toLocaleString()}`;
    details.append(heading, activity);
    const actions = document.createElement("div");
    actions.className = "teacher-account__actions";
    const replace = button(`Change password for ${account.username}`);
    replace.addEventListener("click", () =>
      this.#openPasswordDialog(replace, account.username));
    const reset = button(`Reset progress for ${account.username}`);
    reset.className = "teacher-button--danger";
    reset.addEventListener("click", () =>
      this.#openResetDialog(reset, account.username));
    actions.append(replace, reset);
    article.append(details, actions);
    return article;
  }

  #openDialog(trigger: HTMLButtonElement, titleText: string): DialogSurface {
    const dialog = document.createElement("dialog");
    dialog.className = "teacher-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    const title = document.createElement("h2");
    title.id = `teacher-dialog-${this.#createOperationId()}`;
    title.textContent = titleText;
    dialog.setAttribute("aria-labelledby", title.id);
    dialog.append(title);
    this.#root.append(dialog);
    let pending = false;
    const close = () => {
      if (pending) return;
      dialog.remove();
      trigger.focus();
    };
    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
    });
    dialog.setAttribute("open", "");
    return {
      dialog,
      close,
      setPending(value) {
        pending = value;
      }
    };
  }

  #passwordControls(
    passwordLabel: string,
    confirmationLabel: string
  ): {
    wrapper: DocumentFragment;
    password: HTMLInputElement;
    confirmation: HTMLInputElement;
    passwordError: HTMLParagraphElement;
    confirmationError: HTMLParagraphElement;
  } {
    const wrapper = document.createDocumentFragment();
    const password = document.createElement("input");
    password.type = "password";
    password.autocomplete = "new-password";
    password.maxLength = 128;
    const passwordField = field(
      passwordLabel,
      password,
      "Use 8 to 128 UTF-8 bytes."
    );
    const confirmation = document.createElement("input");
    confirmation.type = "password";
    confirmation.autocomplete = "new-password";
    confirmation.maxLength = 128;
    const confirmationField = field(confirmationLabel, confirmation);
    const controls = document.createElement("div");
    controls.className = "teacher-password-controls";
    const generate = button("Generate password");
    generate.addEventListener("click", () => {
      const generated = `Pair-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
      password.value = generated;
      confirmation.value = generated;
      showFieldError(passwordField.error, "");
      showFieldError(confirmationField.error, "");
    });
    const show = button("Show password");
    show.addEventListener("click", () => {
      const visible = password.type === "text";
      password.type = visible ? "password" : "text";
      confirmation.type = visible ? "password" : "text";
      show.textContent = visible ? "Show password" : "Hide password";
    });
    controls.append(generate, show);
    wrapper.append(
      passwordField.wrapper,
      confirmationField.wrapper,
      controls
    );
    return {
      wrapper,
      password,
      confirmation,
      passwordError: passwordField.error,
      confirmationError: confirmationField.error
    };
  }

  #openCreateDialog(trigger: HTMLButtonElement): void {
    const surface = this.#openDialog(trigger, "Create pair account");
    const form = document.createElement("form");
    const introduction = document.createElement("p");
    introduction.textContent =
      "Choose the username and password that this pair will use on the student site.";
    const username = document.createElement("input");
    username.type = "text";
    username.autocomplete = "off";
    username.spellcheck = false;
    username.maxLength = 24;
    const usernameField = field(
      "Username",
      username,
      "Use 3 to 24 lowercase letters, numbers, hyphens or underscores."
    );
    const passwords = this.#passwordControls("Password", "Confirm password");
    const formError = document.createElement("p");
    formError.className = "teacher-form-error";
    formError.setAttribute("role", "alert");
    formError.setAttribute("aria-live", "assertive");
    formError.hidden = true;
    const actions = document.createElement("div");
    actions.className = "teacher-dialog__actions";
    const cancel = button("Cancel");
    cancel.addEventListener("click", surface.close);
    const submit = button("Create account", "submit");
    actions.append(cancel, submit);
    form.append(
      introduction,
      usernameField.wrapper,
      passwords.wrapper,
      formError,
      actions
    );
    surface.dialog.append(form);
    queueMicrotask(() => username.focus());

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const normalisedUsername = username.value.normalize("NFKC").trim().toLowerCase();
      const usernameValid = /^[a-z0-9][a-z0-9_-]{2,23}$/u.test(normalisedUsername) &&
        normalisedUsername !== "teacher-playtest";
      showFieldError(
        usernameField.error,
        usernameValid ? "" : "Enter a valid pair username."
      );
      showFieldError(
        passwords.passwordError,
        validPassword(passwords.password.value) ? "" : "Use 8 to 128 UTF-8 bytes."
      );
      showFieldError(
        passwords.confirmationError,
        passwords.confirmation.value === passwords.password.value
          ? ""
          : "Passwords must match."
      );
      if (
        !usernameValid ||
        !validPassword(passwords.password.value) ||
        passwords.confirmation.value !== passwords.password.value
      ) return;

      surface.setPending(true);
      for (const control of form.elements) {
        if (control instanceof HTMLInputElement || control instanceof HTMLButtonElement) {
          control.disabled = true;
        }
      }
      formError.hidden = true;
      const plaintextPassword = passwords.password.value;
      void this.#client.createAccount({
        operationId: this.#createOperationId(),
        username: normalisedUsername,
        password: plaintextPassword
      }).then((created) => {
        this.#accounts = [...this.#accounts, created]
          .sort((left, right) => left.username.localeCompare(right.username));
        surface.dialog.replaceChildren();
        const title = document.createElement("h2");
        title.id = `teacher-dialog-success-${this.#createOperationId()}`;
        title.textContent = "Account created";
        surface.dialog.setAttribute("aria-labelledby", title.id);
        const explanation = document.createElement("p");
        explanation.textContent =
          "Copy these credentials now. The password will be removed from this page when you close this panel.";
        const credentials = document.createElement("dl");
        const usernameTerm = document.createElement("dt");
        usernameTerm.textContent = "Username";
        const usernameValue = document.createElement("dd");
        usernameValue.textContent = normalisedUsername;
        const passwordTerm = document.createElement("dt");
        passwordTerm.textContent = "Password";
        const passwordValue = document.createElement("dd");
        passwordValue.textContent = plaintextPassword;
        credentials.append(
          usernameTerm,
          usernameValue,
          passwordTerm,
          passwordValue
        );
        const copyStatus = document.createElement("p");
        copyStatus.setAttribute("role", "status");
        copyStatus.setAttribute("aria-live", "polite");
        const copy = button("Copy username and password");
        copy.addEventListener("click", () => {
          if (this.#clipboard === undefined) {
            copyStatus.textContent = "Clipboard access is unavailable. Copy the credentials manually.";
            return;
          }
          void this.#clipboard.writeText(
            `Username: ${normalisedUsername}\nPassword: ${plaintextPassword}`
          ).then(() => {
            copyStatus.textContent = "Username and password copied.";
          }).catch(() => {
            copyStatus.textContent =
              "The credentials could not be copied. Copy them manually.";
          });
        });
        const done = button("Done");
        done.addEventListener("click", () => {
          surface.setPending(false);
          copyStatus.textContent = "";
          surface.close();
          this.#announce(`Account created for ${normalisedUsername}.`);
        });
        surface.dialog.append(
          title,
          explanation,
          credentials,
          copy,
          copyStatus,
          done
        );
        queueMicrotask(() => copy.focus());
      }).catch(() => {
        surface.setPending(false);
        for (const control of form.elements) {
          if (control instanceof HTMLInputElement || control instanceof HTMLButtonElement) {
            control.disabled = false;
          }
        }
        formError.hidden = false;
        formError.textContent = errorMessage(
          "The account could not be created. Check the details and connection, then try again."
        );
        submit.focus();
      });
    });
  }

  #openPasswordDialog(trigger: HTMLButtonElement, username: string): void {
    const surface = this.#openDialog(trigger, `Replace password for ${username}`);
    const warning = document.createElement("p");
    warning.className = "teacher-warning";
    warning.textContent =
      "After this change, the old password will stop working and the pair must sign in again.";
    const form = document.createElement("form");
    const passwords = this.#passwordControls("New password", "Confirm new password");
    const formError = document.createElement("p");
    formError.setAttribute("role", "alert");
    formError.setAttribute("aria-live", "assertive");
    formError.hidden = true;
    const actions = document.createElement("div");
    actions.className = "teacher-dialog__actions";
    const cancel = button("Cancel");
    cancel.addEventListener("click", surface.close);
    const submit = button("Replace password", "submit");
    actions.append(cancel, submit);
    form.append(passwords.wrapper, formError, actions);
    surface.dialog.append(warning, form);
    queueMicrotask(() => passwords.password.focus());
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      showFieldError(
        passwords.passwordError,
        validPassword(passwords.password.value) ? "" : "Use 8 to 128 UTF-8 bytes."
      );
      showFieldError(
        passwords.confirmationError,
        passwords.confirmation.value === passwords.password.value
          ? ""
          : "Passwords must match."
      );
      if (
        !validPassword(passwords.password.value) ||
        passwords.confirmation.value !== passwords.password.value
      ) return;
      surface.setPending(true);
      void this.#client.replacePassword({
        operationId: this.#createOperationId(),
        username,
        password: passwords.password.value
      }).then(() => {
        surface.setPending(false);
        surface.close();
        this.#announce(`Password replaced for ${username}. The pair must sign in again.`);
      }).catch(() => {
        surface.setPending(false);
        formError.hidden = false;
        formError.textContent =
          "The password was not replaced. Check the connection and try again.";
        submit.focus();
      });
    });
  }

  #openResetDialog(trigger: HTMLButtonElement, username: string): void {
    const surface = this.#openDialog(trigger, `Reset progress for ${username}`);
    const scope = document.createElement("p");
    scope.textContent =
      "This deletes this account's game progress, drafts, advertisement designs, uploaded images and cloud saves. The username and password remain.";
    const instruction = document.createElement("p");
    instruction.textContent = `Type ${username} to confirm.`;
    const confirmation = document.createElement("input");
    confirmation.type = "text";
    confirmation.autocomplete = "off";
    confirmation.spellcheck = false;
    confirmation.maxLength = 24;
    const confirmationField = field(`Type ${username} to confirm`, confirmation);
    const error = document.createElement("p");
    error.setAttribute("role", "alert");
    error.setAttribute("aria-live", "assertive");
    error.hidden = true;
    const actions = document.createElement("div");
    actions.className = "teacher-dialog__actions";
    const cancel = button("Cancel");
    cancel.addEventListener("click", surface.close);
    const confirm = button("Reset progress");
    confirm.disabled = true;
    confirmation.addEventListener("input", () => {
      confirm.disabled = confirmation.value !== username;
    });
    confirm.addEventListener("click", () => {
      if (confirmation.value !== username) return;
      surface.setPending(true);
      confirmation.disabled = true;
      cancel.disabled = true;
      confirm.disabled = true;
      void this.#client.resetAccount({
        operationId: this.#createOperationId(),
        username,
        confirmation: username
      }).then(() => {
        surface.setPending(false);
        surface.close();
        this.#announce(`Progress reset for ${username}. The login has not changed.`);
      }).catch(() => {
        surface.setPending(false);
        confirmation.disabled = false;
        cancel.disabled = false;
        confirm.disabled = false;
        error.hidden = false;
        error.textContent =
          "The reset did not finish. Refresh the account list before trying another reset.";
        confirmation.focus();
      });
    });
    actions.append(cancel, confirm);
    surface.dialog.append(
      scope,
      instruction,
      confirmationField.wrapper,
      error,
      actions
    );
    queueMicrotask(() => confirmation.focus());
  }

  #announce(message: string): void {
    if (this.#announcement !== null) this.#announcement.textContent = message;
  }
}
