export interface AccountResetDialogOptions {
  readonly onConfirm: () => void | Promise<void>;
  readonly container?: HTMLElement;
}

let dialogSequence = 0;

export class AccountResetDialog {
  readonly #dialog: HTMLDialogElement;
  readonly #onConfirm: () => void | Promise<void>;
  #trigger: HTMLButtonElement | null = null;
  #pending = false;

  constructor(options: AccountResetDialogOptions) {
    this.#onConfirm = options.onConfirm;
    this.#dialog = document.createElement("dialog");
    this.#dialog.className = "account-reset-dialog";
    this.#dialog.setAttribute("role", "dialog");
    this.#dialog.setAttribute("aria-modal", "true");
    this.#dialog.hidden = true;
    (options.container ?? document.body).append(this.#dialog);
  }

  open(trigger: HTMLButtonElement, username: string): void {
    this.#trigger = trigger;
    this.#pending = false;
    const titleId = `account-reset-dialog-title-${++dialogSequence}`;
    this.#dialog.setAttribute("aria-labelledby", titleId);

    const form = document.createElement("form");
    form.method = "dialog";
    const title = document.createElement("h2");
    title.id = titleId;
    title.textContent = "Reset account progress";
    const account = document.createElement("p");
    account.textContent = `This reset applies only to ${username}.`;
    const scope = document.createElement("p");
    scope.textContent =
      "It deletes the account's game progress, drafts, advertisement designs, uploaded images, cloud saves, and pending AI work. The username and password will remain.";
    const instruction = document.createElement("p");
    instruction.textContent = "Type RESET to confirm.";
    const label = document.createElement("label");
    label.textContent = "Type RESET to confirm";
    const input = document.createElement("input");
    input.type = "text";
    input.name = "confirmation";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.maxLength = 5;
    label.append(input);
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const error = document.createElement("p");
    error.setAttribute("role", "alert");
    error.setAttribute("aria-live", "assertive");
    error.hidden = true;
    const actions = document.createElement("div");
    actions.className = "account-reset-dialog__actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    const confirm = document.createElement("button");
    confirm.type = "submit";
    confirm.textContent = "Reset account progress";
    confirm.disabled = true;
    actions.append(cancel, confirm);
    form.append(title, account, scope, instruction, label, status, error, actions);
    this.#dialog.replaceChildren(form);

    input.addEventListener("input", () => {
      confirm.disabled = this.#pending || input.value !== "RESET";
    });
    cancel.addEventListener("click", () => {
      if (!this.#pending) this.#close();
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (this.#pending || input.value !== "RESET") return;
      this.#pending = true;
      input.disabled = true;
      cancel.disabled = true;
      confirm.disabled = true;
      error.hidden = true;
      error.textContent = "";
      status.textContent = "Resetting account progress…";
      void Promise.resolve()
        .then(this.#onConfirm)
        .catch(() => {
          this.#pending = false;
          input.disabled = false;
          cancel.disabled = false;
          confirm.disabled = false;
          status.textContent = "";
          error.hidden = false;
          error.textContent =
            "The reset did not finish. Check your connection, then try again. The username and password have not changed.";
          input.focus();
        });
    });
    this.#dialog.onkeydown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (!this.#pending) this.#close();
    };

    this.#dialog.hidden = false;
    try {
      if (typeof this.#dialog.showModal === "function") this.#dialog.showModal();
      else this.#dialog.setAttribute("open", "");
    } catch {
      this.#dialog.setAttribute("open", "");
    }
    queueMicrotask(() => input.focus());
  }

  #close(): void {
    try {
      if (typeof this.#dialog.close === "function" && this.#dialog.open) {
        this.#dialog.close();
      } else {
        this.#dialog.removeAttribute("open");
      }
    } catch {
      this.#dialog.removeAttribute("open");
    }
    this.#dialog.hidden = true;
    this.#trigger?.focus();
  }
}
