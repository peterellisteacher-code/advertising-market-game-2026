import type { TeacherClient } from "./teacher-client";
import {
  createTeacherPlaytestOperationId,
  type TeacherPlaytestClient
} from "./teacher-playtest-client";
import { openManagedModalDialog } from "./managed-modal-dialog";

export interface TeacherPlaytestControllerOptions {
  readonly root: HTMLElement;
  readonly sessionClient: Pick<TeacherClient, "session">;
  readonly playtestClient: Pick<TeacherPlaytestClient, "reset">;
  readonly startGame: () => void | Promise<void>;
  readonly resetLocalState: () => Promise<void>;
  readonly openFirstScreen: () => void;
  readonly navigate?: (path: "/teacher") => void;
  readonly createOperationId?: () => string;
}

const actionButton = (label: string): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  return button;
};

export class TeacherPlaytestController {
  readonly #root: HTMLElement;
  readonly #sessionClient: Pick<TeacherClient, "session">;
  readonly #playtestClient: Pick<TeacherPlaytestClient, "reset">;
  readonly #startGame: () => void | Promise<void>;
  readonly #resetLocalState: () => Promise<void>;
  readonly #openFirstScreen: () => void;
  readonly #navigate: (path: "/teacher") => void;
  readonly #createOperationId: () => string;

  constructor(options: TeacherPlaytestControllerOptions) {
    this.#root = options.root;
    this.#sessionClient = options.sessionClient;
    this.#playtestClient = options.playtestClient;
    this.#startGame = options.startGame;
    this.#resetLocalState = options.resetLocalState;
    this.#openFirstScreen = options.openFirstScreen;
    this.#navigate = options.navigate ?? ((path) => window.location.assign(path));
    this.#createOperationId =
      options.createOperationId ?? createTeacherPlaytestOperationId;
  }

  async mount(): Promise<void> {
    this.#root.dataset.admarketRoute = "teacher-playtest";
    this.#root.replaceChildren();
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.textContent = "Checking teacher access…";
    this.#root.append(status);

    let authenticated = false;
    try {
      authenticated = (await this.#sessionClient.session()).authenticated;
    } catch {
      this.#renderBoundary(
        "Teacher playtest unavailable",
        "Teacher access could not be checked. Check the connection and try again."
      );
      return;
    }
    if (!authenticated) {
      this.#renderBoundary(
        "Teacher sign-in required",
        "Sign in on the teacher dashboard before opening the teacher playtest."
      );
      return;
    }

    this.#renderStrip();
    try {
      await this.#startGame();
    } catch {
      this.#renderBoundary(
        "Teacher playtest unavailable",
        "The teacher playtest could not open. Return to the dashboard and try again."
      );
    }
  }

  #renderBoundary(headingText: string, message: string): void {
    const main = document.createElement("main");
    main.className = "teacher-page teacher-login";
    main.tabIndex = -1;
    const heading = document.createElement("h1");
    heading.textContent = headingText;
    const explanation = document.createElement("p");
    explanation.textContent = message;
    const returnButton = actionButton("Return to teacher dashboard");
    returnButton.addEventListener("click", () => this.#navigate("/teacher"));
    main.append(heading, explanation, returnButton);
    this.#root.replaceChildren(main);
    main.focus();
  }

  #renderStrip(): void {
    const strip = document.createElement("header");
    strip.className = "teacher-playtest-strip";
    strip.dataset.expanded = "false";
    strip.setAttribute("role", "banner");
    strip.setAttribute("aria-label", "Teacher playtest");
    const identity = document.createElement("strong");
    identity.textContent = "Teacher playtest";
    const description = document.createElement("span");
    description.textContent = "Isolated from every pair account.";
    const toggle = actionButton("Show teacher controls");
    toggle.className = "teacher-playtest-strip__toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "teacher-playtest-actions");
    const actions = document.createElement("div");
    actions.id = "teacher-playtest-actions";
    actions.className = "teacher-playtest-strip__actions";
    actions.hidden = true;
    const dashboard = actionButton("Return to teacher dashboard");
    dashboard.addEventListener("click", () => this.#navigate("/teacher"));
    const reset = actionButton("Factory reset playtest");
    reset.className = "teacher-button--danger";
    reset.addEventListener("click", () => this.#openResetDialog(reset));
    actions.append(dashboard, reset);
    toggle.addEventListener("click", () => {
      const expanded = strip.dataset.expanded !== "true";
      strip.dataset.expanded = String(expanded);
      toggle.textContent = expanded
        ? "Hide teacher controls"
        : "Show teacher controls";
      toggle.setAttribute("aria-expanded", String(expanded));
      actions.hidden = !expanded;
    });
    strip.append(identity, description, toggle, actions);
    this.#root.replaceChildren(strip);
  }

  #openResetDialog(trigger: HTMLButtonElement): void {
    const operationId = this.#createOperationId();
    const dialog = document.createElement("dialog");
    dialog.className = "teacher-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    const title = document.createElement("h2");
    title.id = `teacher-playtest-reset-${operationId}`;
    title.textContent = "Factory reset teacher playtest";
    dialog.setAttribute("aria-labelledby", title.id);
    const explanation = document.createElement("p");
    explanation.textContent =
      "This removes the teacher playtest's saved campaign progress and campaign assets " +
      "from cloud storage and this browser. Student pair accounts and their work remain unchanged.";
    const form = document.createElement("form");
    form.setAttribute("aria-label", "Confirm teacher playtest factory reset");
    const label = document.createElement("label");
    label.textContent = "Type RESET to confirm";
    const confirmation = document.createElement("input");
    confirmation.type = "text";
    confirmation.autocomplete = "off";
    confirmation.spellcheck = false;
    label.append(confirmation);
    const error = document.createElement("p");
    error.className = "teacher-form-error";
    error.setAttribute("role", "alert");
    error.setAttribute("aria-live", "assertive");
    error.hidden = true;
    const actions = document.createElement("div");
    actions.className = "teacher-dialog__actions";
    const cancel = actionButton("Cancel");
    const confirm = document.createElement("button");
    confirm.type = "submit";
    confirm.textContent = "Factory reset playtest";
    confirm.className = "teacher-button--danger";
    actions.append(cancel, confirm);
    form.append(label, error, actions);
    dialog.append(title, explanation, form);
    const surface = openManagedModalDialog(this.#root, trigger, dialog);
    let pending = false;
    cancel.addEventListener("click", surface.close);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (pending) return;
      if (confirmation.value !== "RESET") {
        error.textContent = "Type RESET exactly to confirm.";
        error.hidden = false;
        confirmation.focus();
        return;
      }
      pending = true;
      surface.setPending(true);
      confirmation.disabled = true;
      cancel.disabled = true;
      confirm.disabled = true;
      error.hidden = true;
      void this.#playtestClient.reset({
        operationId,
        confirmation: "RESET"
      }).then(async () => {
        await this.#resetLocalState();
        this.#openFirstScreen();
      }).catch(() => {
        pending = false;
        surface.setPending(false);
        confirmation.disabled = false;
        cancel.disabled = false;
        confirm.disabled = false;
        error.textContent =
          "The teacher playtest could not be reset. Check the connection and try again.";
        error.hidden = false;
        confirmation.focus();
      });
    });
    confirmation.focus();
  }
}
