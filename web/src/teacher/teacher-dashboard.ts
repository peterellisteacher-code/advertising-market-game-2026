import {
  createTeacherOperationId,
  TeacherClientError,
  type TeacherClient,
  type TeacherImageLabAccount,
  type TeacherImageLabOverview,
  type TeacherPairSummary,
  type TeacherPendingRegistration
} from "./teacher-client";
import {
  openManagedModalDialog,
  type ManagedModalDialog
} from "./managed-modal-dialog";

interface TeacherDashboardOptions {
  readonly createOperationId?: () => string;
  readonly clipboard?: Pick<Clipboard, "writeText">;
  readonly navigate?: (path: string) => void;
}

type DialogSurface = ManagedModalDialog;

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

const copyForError = (error: unknown): string => {
  const code = error instanceof TeacherClientError ? error.code : "TEACHER_UNAVAILABLE";
  switch (code) {
    case "INVALID_CREDENTIALS":
      return "The teacher password was not accepted. Check the password and try again.";
    case "CSRF_REJECTED":
      return "The server rejected the sign-in as cross-origin. Open the teacher page from the site's own address, then try again.";
    case "TEACHER_NOT_CONFIGURED":
      return "Teacher access is not configured on the server. The teacher password and session secret must be set in the site's environment variables before sign-in works.";
    case "INVALID_REQUEST":
      return "The server rejected the sign-in request as malformed. Reload this page, then try again.";
    case "INVALID_RESPONSE":
      return "The sign-in reply could not be read. Reload this page to check whether the session was created.";
    default:
      return "The teacher service could not be reached. Check the connection, then try again.";
  }
};

export class TeacherDashboard {
  readonly #root: HTMLElement;
  readonly #client: TeacherClient;
  readonly #createOperationId: () => string;
  readonly #clipboard: Pick<Clipboard, "writeText"> | undefined;
  readonly #navigate: (path: string) => void;
  #accounts: readonly TeacherPairSummary[] = [];
  #pending: readonly TeacherPendingRegistration[] = [];
  #imageLab: TeacherImageLabOverview | null = null;
  #imageLabLoadError = "";
  #imageLabAudit = "";
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
        .catch((failure: unknown) => {
          submit.disabled = false;
          password.disabled = false;
          error.hidden = false;
          error.textContent = copyForError(failure);
          password.focus();
        });
    });
    main.append(eyebrow, heading, explanation, form);
    this.#root.replaceChildren(main);
    main.focus();
  }

  async #loadDashboard(): Promise<void> {
    const [accounts, imageLab] = await Promise.allSettled([
      this.#client.listAccounts(),
      this.#client.imageLabStatus()
    ]);
    if (accounts.status === "fulfilled") {
      this.#accounts = accounts.value.accounts;
      this.#pending = accounts.value.pending;
    }
    if (imageLab.status === "fulfilled") {
      this.#imageLab = imageLab.value;
      this.#imageLabLoadError = "";
    } else {
      this.#imageLab = null;
      this.#imageLabLoadError =
        "Image Lab allowances could not be loaded. Check the connection and refresh the allowances.";
    }
    this.#renderDashboard(accounts.status === "rejected"
      ? "Classroom accounts could not be loaded. Check the connection and refresh this page."
      : "");
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
      "Approve student requests, view classroom credentials, replace passwords and reset one pair's saved work.";
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

    this.#announcement = document.createElement("p");
    this.#announcement.className = "teacher-announcement";
    this.#announcement.setAttribute("role", initialError === "" ? "status" : "alert");
    this.#announcement.setAttribute("aria-live", initialError === "" ? "polite" : "assertive");
    this.#announcement.textContent = initialError;

    main.append(
      header,
      toolbar,
      this.#announcement,
      this.#pendingRegion(),
      this.#accountRegion(),
      this.#imageLabRegion()
    );
    this.#root.replaceChildren(main);
    main.focus();
  }

  #pendingRegion(): HTMLElement {
    const region = document.createElement("section");
    region.className = "teacher-accounts teacher-card";
    region.setAttribute("aria-label", "Pending pair approvals");
    const heading = document.createElement("h2");
    heading.textContent = "Pending pair approvals";
    const explanation = document.createElement("p");
    explanation.textContent =
      "Students choose a classroom-only username and password. Check the credentials, then approve the request to create their login.";
    region.append(heading, explanation);
    if (this.#pending.length === 0) {
      const empty = document.createElement("p");
      empty.className = "teacher-empty";
      empty.textContent = "No pair logins are waiting for approval.";
      region.append(empty);
      return region;
    }
    for (const pending of this.#pending) {
      region.append(this.#pendingCard(pending));
    }
    return region;
  }

  #pendingCard(pending: TeacherPendingRegistration): HTMLElement {
    const article = document.createElement("article");
    article.className = "teacher-account";
    const details = document.createElement("div");
    const heading = document.createElement("h3");
    heading.textContent = pending.username;
    const username = document.createElement("p");
    username.textContent = `Username: ${pending.username}`;
    const password = document.createElement("p");
    password.textContent = `Password: ${pending.password}`;
    const requested = document.createElement("p");
    requested.textContent = `Requested ${new Date(pending.requestedAt).toLocaleString()}`;
    details.append(heading, username, password, requested);
    const actions = document.createElement("div");
    actions.className = "teacher-account__actions";
    actions.append(this.#copyCredentialsButton(
      pending.username,
      pending.password
    ));
    const approve = button(`Approve ${pending.username}`);
    approve.addEventListener("click", () => {
      if (approve.disabled) return;
      approve.disabled = true;
      void this.#client.approveRegistration({
        operationId: this.#createOperationId(),
        username: pending.username
      }).then((account) => {
        this.#pending = this.#pending.filter(
          ({ username }) => username !== pending.username
        );
        this.#accounts = [
          ...this.#accounts.filter(({ username }) => username !== account.username),
          account
        ].sort((left, right) => left.username.localeCompare(right.username));
        this.#refreshAccountSurfaces();
        this.#announce(`Login approved for ${pending.username}.`);
      }).catch(() => {
        approve.disabled = false;
        this.#announce(
          `The login for ${pending.username} was not approved. Check the connection and try again.`
        );
      });
    });
    actions.append(approve);
    article.append(details, actions);
    return article;
  }

  #accountRegion(): HTMLElement {
    const region = document.createElement("section");
    region.className = "teacher-accounts";
    region.setAttribute("aria-label", "Pair accounts");
    if (this.#accounts.length === 0) {
      const empty = document.createElement("p");
      empty.className = "teacher-card teacher-empty";
      empty.textContent = "No pair accounts have been created.";
      region.append(empty);
    } else {
      for (const account of this.#accounts) {
        region.append(this.#accountCard(account));
      }
    }
    return region;
  }

  #refreshAccountSurfaces(): void {
    const toolbarSummary = this.#root.querySelector(".teacher-toolbar p");
    if (toolbarSummary !== null) {
      toolbarSummary.textContent =
        `${this.#accounts.length} ${this.#accounts.length === 1 ? "account" : "accounts"}`;
    }
    this.#root.querySelector('[aria-label="Pending pair approvals"]')
      ?.replaceWith(this.#pendingRegion());
    this.#root.querySelector('[aria-label="Pair accounts"]')
      ?.replaceWith(this.#accountRegion());
  }

  #imageLabRegion(): HTMLElement {
    const region = document.createElement("section");
    region.className = "teacher-image-lab teacher-card";
    region.setAttribute("aria-label", "Image Lab allowances");
    const heading = document.createElement("h2");
    heading.textContent = "Image Lab allowances";
    const explanation = document.createElement("p");
    explanation.textContent =
      "Control whether pairs can use Image Lab and set separate Object Forge and Make It Real allowances.";
    const feedback = document.createElement("p");
    feedback.className = "teacher-image-lab__feedback";
    feedback.setAttribute("role", this.#imageLabLoadError === "" ? "status" : "alert");
    feedback.setAttribute("aria-live", this.#imageLabLoadError === "" ? "polite" : "assertive");
    feedback.textContent = this.#imageLabLoadError || this.#imageLabAudit;
    region.append(heading, explanation, feedback);

    if (this.#imageLab === null) {
      const refresh = button("Refresh allowances");
      refresh.addEventListener("click", () => {
        void this.#refreshImageLab(region);
      });
      region.append(refresh);
      return region;
    }

    const status = document.createElement("p");
    status.className = "teacher-image-lab__status";
    status.textContent = this.#imageLab.enabled
      ? "Image Lab is available to pairs."
      : "Image Lab is unavailable to pairs.";

    const globalForm = document.createElement("form");
    globalForm.className = "teacher-image-lab__global";
    const enabled = document.createElement("input");
    enabled.type = "checkbox";
    enabled.checked = this.#imageLab.enabled;
    const enabledField = field("Image Lab available to pairs", enabled);
    const objectDefault = this.#allowanceInput(this.#imageLab.defaults.object);
    const objectDefaultField = field("Default Object Forge uses", objectDefault);
    const realiseDefault = this.#allowanceInput(this.#imageLab.defaults.realise);
    const realiseDefaultField = field("Default Make It Real uses", realiseDefault);
    const saveGlobal = button("Save Image Lab settings", "submit");
    globalForm.append(
      enabledField.wrapper,
      objectDefaultField.wrapper,
      realiseDefaultField.wrapper,
      saveGlobal
    );
    globalForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = this.#readAllowancePair(
        objectDefault,
        realiseDefault,
        feedback,
        true
      );
      if (values === null) return;
      void this.#runImageLabMutation(
        region,
        () => this.#client.setImageLabGlobal({
          operationId: this.#createOperationId(),
          enabled: enabled.checked,
          objectDefault: values.object,
          realiseDefault: values.realise
        }),
        (result) => {
          this.#imageLab = {
            ...this.#imageLab!,
            enabled: result.enabled,
            defaults: result.defaults
          };
          this.#imageLabAudit =
            `Settings saved — Image Lab ${result.enabled ? "available" : "unavailable"}; ` +
            `future accounts receive ${result.defaults.object} Object Forge and ` +
            `${result.defaults.realise} Make It Real uses.`;
        }
      );
    });

    const table = document.createElement("table");
    table.setAttribute("aria-label", "Pair Image Lab allowances");
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const label of [
      "Select",
      "Pair",
      "Object Forge",
      "Make It Real",
      "Change uses"
    ]) {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = label;
      headRow.append(cell);
    }
    head.append(headRow);
    const body = document.createElement("tbody");
    for (const account of this.#imageLab.accounts) {
      body.append(this.#imageLabRow(region, account, feedback));
    }
    table.append(head, body);
    const tableScroll = document.createElement("div");
    tableScroll.className = "teacher-image-lab__table-scroll";
    tableScroll.append(table);

    const batch = document.createElement("form");
    batch.className = "teacher-image-lab__batch";
    const batchHeading = document.createElement("h3");
    batchHeading.textContent = "Add uses to selected pairs";
    const batchObject = this.#allowanceInput(0);
    const batchObjectField = field("Batch Object Forge uses", batchObject);
    const batchRealise = this.#allowanceInput(0);
    const batchRealiseField = field("Batch Make It Real uses", batchRealise);
    const batchSubmit = button("Add uses to selected pairs", "submit");
    batch.append(
      batchHeading,
      batchObjectField.wrapper,
      batchRealiseField.wrapper,
      batchSubmit
    );
    batch.addEventListener("submit", (event) => {
      event.preventDefault();
      const aliases = [...region.querySelectorAll<HTMLInputElement>(
        'input[data-image-lab-batch-alias]:checked'
      )].map((input) => input.dataset.imageLabBatchAlias!);
      const values = this.#readAllowancePair(
        batchObject,
        batchRealise,
        feedback,
        false
      );
      if (values === null) return;
      if (aliases.length === 0) {
        this.#setImageLabFeedback(
          feedback,
          "Select at least one pair before adding uses.",
          true
        );
        return;
      }
      void this.#runImageLabMutation(
        region,
        () => this.#client.batchAddImageLab({
          operationId: this.#createOperationId(),
          aliases,
          object: values.object,
          realise: values.realise
        }),
        (result) => {
          this.#replaceImageLabAccounts(result.accounts);
          this.#imageLabAudit =
            `Added uses to ${result.aliases.length} selected ` +
            `${result.aliases.length === 1 ? "pair" : "pairs"}.`;
        }
      );
    });

    const refresh = button("Refresh allowances");
    refresh.hidden = true;
    refresh.addEventListener("click", () => {
      void this.#refreshImageLab(region);
    });
    region.append(status, globalForm, tableScroll, batch, refresh);
    return region;
  }

  #imageLabRow(
    region: HTMLElement,
    account: TeacherImageLabAccount,
    feedback: HTMLParagraphElement
  ): HTMLTableRowElement {
    const row = document.createElement("tr");
    const selectCell = document.createElement("td");
    selectCell.className = "teacher-image-lab__select";
    const selected = document.createElement("input");
    selected.type = "checkbox";
    selected.dataset.imageLabBatchAlias = account.alias;
    selected.setAttribute("aria-label", `Select ${account.alias} for batch grant`);
    selectCell.append(selected);
    const alias = document.createElement("th");
    alias.scope = "row";
    alias.textContent = account.alias;
    const objectStatus = document.createElement("td");
    objectStatus.textContent =
      `${account.object.remaining} available; ${account.object.reserved} reserved`;
    const realiseStatus = document.createElement("td");
    realiseStatus.textContent =
      `${account.realise.remaining} available; ${account.realise.reserved} reserved`;
    const controls = document.createElement("td");
    const controlGroup = document.createElement("div");
    controlGroup.className = "teacher-image-lab__controls";
    const object = this.#allowanceInput(account.object.remaining);
    object.setAttribute("aria-label", `Object Forge uses for ${account.alias}`);
    const realise = this.#allowanceInput(account.realise.remaining);
    realise.setAttribute("aria-label", `Make It Real uses for ${account.alias}`);
    const set = button(`Set uses for ${account.alias}`);
    const add = button(`Add uses for ${account.alias}`);
    const revoke = button(`Revoke available uses for ${account.alias}`);
    const mutate = (
      operation: "set" | "add" | "revoke",
      invoke: TeacherClient[
        "setImageLabAccount" | "addImageLabAccount" | "revokeImageLabAccount"
      ]
    ): void => {
      const values = this.#readAllowancePair(
        object,
        realise,
        feedback,
        operation === "set"
      );
      if (values === null) return;
      void this.#runImageLabMutation(
        region,
        () => invoke.call(this.#client, {
          operationId: this.#createOperationId(),
          alias: account.alias,
          object: values.object,
          realise: values.realise
        }),
        (result) => {
          this.#replaceImageLabAccounts([result.account]);
          const label = operation === "set"
            ? "Set"
            : operation === "add"
              ? "Add"
              : "Revoke";
          this.#imageLabAudit =
            `${label} — ${account.alias}: ` +
            `Object Forge ${result.account.object.remaining} available, ` +
            `${result.account.object.reserved} reserved; ` +
            `Make It Real ${result.account.realise.remaining} available, ` +
            `${result.account.realise.reserved} reserved.`;
        }
      );
    };
    set.addEventListener("click", () =>
      mutate("set", this.#client.setImageLabAccount));
    add.addEventListener("click", () =>
      mutate("add", this.#client.addImageLabAccount));
    revoke.addEventListener("click", () =>
      mutate("revoke", this.#client.revokeImageLabAccount));
    controlGroup.append(object, realise, set, add, revoke);
    controls.append(controlGroup);
    row.append(selectCell, alias, objectStatus, realiseStatus, controls);
    return row;
  }

  #allowanceInput(value: number): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "100";
    input.step = "1";
    input.value = String(value);
    return input;
  }

  #readAllowancePair(
    object: HTMLInputElement,
    realise: HTMLInputElement,
    feedback: HTMLParagraphElement,
    allowBothZero: boolean
  ): { readonly object: number; readonly realise: number } | null {
    const objectValue = Number(object.value);
    const realiseValue = Number(realise.value);
    if (
      !Number.isInteger(objectValue) ||
      objectValue < 0 ||
      objectValue > 100 ||
      !Number.isInteger(realiseValue) ||
      realiseValue < 0 ||
      realiseValue > 100
    ) {
      this.#setImageLabFeedback(
        feedback,
        "Enter whole numbers from 0 to 100 for both stages.",
        true
      );
      return null;
    }
    if (!allowBothZero && objectValue === 0 && realiseValue === 0) {
      this.#setImageLabFeedback(
        feedback,
        "Enter at least one use to add or revoke.",
        true
      );
      return null;
    }
    return { object: objectValue, realise: realiseValue };
  }

  async #runImageLabMutation<T>(
    region: HTMLElement,
    mutation: () => Promise<T>,
    applyResult: (result: T) => void
  ): Promise<void> {
    const controls = [...region.querySelectorAll<HTMLButtonElement>("button")];
    controls.forEach((control) => {
      control.disabled = true;
    });
    const feedback = region.querySelector<HTMLParagraphElement>(
      ".teacher-image-lab__feedback"
    )!;
    this.#setImageLabFeedback(feedback, "", false);
    try {
      applyResult(await mutation());
      region.replaceWith(this.#imageLabRegion());
    } catch (error) {
      controls.forEach((control) => {
        control.disabled = false;
      });
      const refresh = [...region.querySelectorAll<HTMLButtonElement>("button")]
        .find((control) => control.textContent === "Refresh allowances");
      if (error instanceof TeacherClientError && error.refreshRequired) {
        this.#setImageLabFeedback(
          feedback,
          "The result is uncertain. Keep these values and refresh allowances before another change.",
          true
        );
        if (refresh !== undefined) refresh.hidden = false;
      } else {
        this.#setImageLabFeedback(
          feedback,
          "The allowance change did not finish. Check the connection and try again.",
          true
        );
      }
    }
  }

  async #refreshImageLab(region: HTMLElement): Promise<void> {
    const controls = [...region.querySelectorAll<HTMLButtonElement>("button")];
    controls.forEach((control) => {
      control.disabled = true;
    });
    try {
      this.#imageLab = await this.#client.imageLabStatus();
      this.#imageLabLoadError = "";
      this.#imageLabAudit = "Allowances refreshed.";
      region.replaceWith(this.#imageLabRegion());
    } catch {
      controls.forEach((control) => {
        control.disabled = false;
      });
      const feedback = region.querySelector<HTMLParagraphElement>(
        ".teacher-image-lab__feedback"
      );
      if (feedback !== null) {
        this.#setImageLabFeedback(
          feedback,
          "Allowances could not be refreshed. Check the connection and try again.",
          true
        );
      }
    }
  }

  #replaceImageLabAccounts(accounts: readonly TeacherImageLabAccount[]): void {
    if (this.#imageLab === null) return;
    const replacements = new Map(accounts.map((account) => [account.alias, account]));
    this.#imageLab = {
      ...this.#imageLab,
      accounts: this.#imageLab.accounts.map((account) =>
        replacements.get(account.alias) ?? account)
    };
  }

  #setImageLabFeedback(
    target: HTMLParagraphElement,
    message: string,
    error: boolean
  ): void {
    target.textContent = message;
    target.setAttribute("role", error ? "alert" : "status");
    target.setAttribute("aria-live", error ? "assertive" : "polite");
  }

  #accountCard(account: TeacherPairSummary): HTMLElement {
    const article = document.createElement("article");
    article.className = "teacher-account teacher-card";
    const details = document.createElement("div");
    const heading = document.createElement("h3");
    heading.textContent = account.username;
    const username = document.createElement("p");
    username.textContent = `Username: ${account.username}`;
    const password = document.createElement("p");
    password.textContent = account.password === null
      ? "Password: Not recorded. Replace it to make the new password visible here."
      : `Password: ${account.password}`;
    const activity = document.createElement("p");
    activity.textContent = account.lastSignInAt === null
      ? "Not used yet"
      : `Last used ${new Date(account.lastSignInAt).toLocaleString()}`;
    details.append(heading, username, password, activity);
    const actions = document.createElement("div");
    actions.className = "teacher-account__actions";
    if (account.password !== null) {
      actions.append(this.#copyCredentialsButton(
        account.username,
        account.password
      ));
    }
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

  #copyCredentialsButton(username: string, password: string): HTMLButtonElement {
    const copy = button(`Copy credentials for ${username}`);
    copy.addEventListener("click", () => {
      if (this.#clipboard === undefined) {
        this.#announce(
          "Clipboard access is unavailable. Copy the username and password manually."
        );
        return;
      }
      void this.#clipboard.writeText(
        `Username: ${username}\nPassword: ${password}`
      ).then(() => {
        this.#announce(`Credentials copied for ${username}.`);
      }).catch(() => {
        this.#announce(
          `The credentials for ${username} could not be copied. Copy them manually.`
        );
      });
    });
    return copy;
  }

  #openDialog(trigger: HTMLButtonElement, titleText: string): DialogSurface {
    const dialog = document.createElement("dialog");
    dialog.className = "teacher-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    const title = document.createElement("h2");
    title.id = `teacher-dialog-${crypto.randomUUID()}`;
    title.textContent = titleText;
    dialog.setAttribute("aria-labelledby", title.id);
    dialog.append(title);
    return openManagedModalDialog(this.#root, trigger, dialog);
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
    const operationId = this.#createOperationId();
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
        operationId,
        username: normalisedUsername,
        password: plaintextPassword
      }).then((created) => {
        this.#accounts = [...this.#accounts, created]
          .sort((left, right) => left.username.localeCompare(right.username));
        this.#refreshAccountSurfaces();
        surface.dialog.replaceChildren();
        const title = document.createElement("h2");
        title.id = `teacher-dialog-success-${crypto.randomUUID()}`;
        title.textContent = "Account created";
        surface.dialog.setAttribute("aria-labelledby", title.id);
        const explanation = document.createElement("p");
        explanation.textContent =
          "Copy these credentials now if useful. They will remain visible in the Pair accounts list.";
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
    const operationId = this.#createOperationId();
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
      const plaintextPassword = passwords.password.value;
      void this.#client.replacePassword({
        operationId,
        username,
        password: plaintextPassword
      }).then(() => {
        surface.setPending(false);
        surface.close();
        this.#accounts = this.#accounts.map((account) =>
          account.username === username
            ? { ...account, password: plaintextPassword }
            : account);
        this.#refreshAccountSurfaces();
        this.#announce(`Password replaced for ${username}. The pair must sign in again.`);
        queueMicrotask(() => {
          [...this.#root.querySelectorAll<HTMLButtonElement>(
            '[aria-label="Pair accounts"] button'
          )].find((control) =>
            control.textContent === `Change password for ${username}`
          )?.focus();
        });
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
    const operationId = this.#createOperationId();
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
        operationId,
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
