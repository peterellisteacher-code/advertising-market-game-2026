export interface ImageLabPair {
  sessionId: string;
  teamId: string;
  productName: string;
}

export interface ImageLabStageStatus {
  remaining: number;
  reserved: number;
}

export type ImageLabStatus =
  | { enabled: false; reason: string }
  | {
      enabled: true;
      object: ImageLabStageStatus;
      realise: ImageLabStageStatus;
    };

export interface ObjectForgeChoice {
  sessionId: string;
  teamId: string;
  objectName: string;
  category: string;
  style: string;
  colour: string;
  removeWhiteBackground: boolean;
}

export interface MakeItRealChoice {
  sessionId: string;
  teamId: string;
  productKind: string;
  scene: string;
}

export interface ImageLabActions {
  status(signal: AbortSignal): Promise<ImageLabStatus>;
  forgeObject(input: ObjectForgeChoice, signal: AbortSignal): Promise<ImageLabStatus>;
  makeReal(input: MakeItRealChoice, signal: AbortSignal): Promise<ImageLabStatus>;
}

type PanelState = "checking" | "disabled" | "ready";
type Operation = "object" | "realise";
type PendingCheck = {
  operation: Operation;
  busyMessage: string;
  doneMessage: string;
  work: (signal: AbortSignal) => Promise<ImageLabStatus>;
};

const CATEGORY_CHOICES = [
  "drink packaging",
  "food packaging",
  "fashion",
  "technology",
  "home and garden",
  "pets",
  "toys and games",
  "transport",
  "shop or service",
  "other"
] as const;

const STYLE_CHOICES = [
  "clean 3D cutout",
  "bold flat illustration",
  "soft animated style",
  "simple realistic product",
  "hand-drawn outline"
] as const;

const SCENE_CHOICES = [
  "clean studio display",
  "bright shop shelf",
  "colourful window display",
  "sunny outdoor setting",
  "cosy home setting",
  "sporty action setting",
  "premium showcase"
] as const;

function button(label: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  return element;
}

function labelledInput(labelText: string, name: string, value = ""): HTMLLabelElement {
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.name = name;
  input.value = value;
  input.maxLength = 96;
  input.setAttribute("aria-label", labelText);
  label.append(input);
  return label;
}

function labelledSelect(
  labelText: string,
  name: string,
  choices: readonly string[]
): HTMLLabelElement {
  const label = document.createElement("label");
  label.textContent = labelText;
  const select = document.createElement("select");
  select.name = name;
  select.setAttribute("aria-label", labelText);
  for (const value of choices) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
  label.append(select);
  return label;
}

function fieldValue(root: ParentNode, name: string): string {
  return root.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)?.value.trim() ?? "";
}

function isUncertainRequest(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  return (error as { code?: unknown }).code === "JOB_OUTCOME_UNCERTAIN";
}

export class ImageLabPanel {
  #pair: ImageLabPair | null = null;
  #state: PanelState = "checking";
  #status: ImageLabStatus | null = null;
  #busy: Operation | null = null;
  #message = "Checking the image tools…";
  #error = "";
  #pendingChecks: Partial<Record<Operation, PendingCheck>> = {};
  #operation: AbortController | null = null;
  #disposed = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly actions: ImageLabActions
  ) {
    this.#draw();
  }

  cancel(): void {
    this.#operation?.abort();
    this.#operation = null;
    this.#busy = null;
  }

  setPair(pair: ImageLabPair): void {
    this.cancel();
    this.#pair = { ...pair };
    this.#state = "checking";
    this.#status = null;
    this.#pendingChecks = {};
    this.#message = "Checking the image tools…";
    this.#error = "";
    this.#draw();
  }

  async initialise(): Promise<void> {
    if (this.#disposed) return;
    const controller = this.#begin();
    this.#state = "checking";
    this.#message = "Checking the image tools…";
    this.#draw();
    try {
      const status = await this.actions.status(controller.signal);
      if (!this.#current(controller)) return;
      this.#applyStatus(status);
      this.#message = status.enabled
        ? "Image Lab is ready."
        : "Image Lab is not available for this account. Built-in tools still work.";
    } catch (error) {
      if (!this.#current(controller) || controller.signal.aborted) return;
      this.#status = { enabled: false, reason: "unavailable" };
      this.#state = "disabled";
      this.#message = "Image Lab is unavailable. Built-in tools still work.";
    } finally {
      if (this.#current(controller)) this.#operation = null;
      this.#draw();
    }
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.cancel();
    this.host.replaceChildren();
  }

  #begin(): AbortController {
    this.#operation?.abort();
    const controller = new AbortController();
    this.#operation = controller;
    return controller;
  }

  #current(controller: AbortController): boolean {
    return !this.#disposed && this.#operation === controller;
  }

  #draw(): void {
    if (this.#disposed) return;
    if (this.#state === "checking" || this.#state === "disabled") {
      const status = document.createElement("p");
      status.setAttribute("role", "status");
      status.textContent = this.#message;
      this.host.replaceChildren(status);
      return;
    }
    this.#drawReady();
  }

  #applyStatus(status: ImageLabStatus): void {
    this.#status = status;
    this.#state = status.enabled ? "ready" : "disabled";
  }

  #drawReady(): void {
    const current = this.#status?.enabled === true ? this.#status : null;
    const root = document.createElement("div");
    root.className = "image-lab";
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.textContent = this.#message;
    const sparks = document.createElement("p");
    sparks.className = "image-lab__sparks";
    sparks.textContent = `Object Forge: ${this.#useCopy(current?.object.remaining ?? 0)} · ` +
      `Make It Real: ${this.#useCopy(current?.realise.remaining ?? 0)}`;
    root.append(status, sparks);
    if (this.#error) {
      const alert = document.createElement("p");
      alert.setAttribute("role", "alert");
      alert.textContent = this.#error;
      root.append(alert);
    }
    root.append(this.#objectForge(), this.#makeItReal());
    this.host.replaceChildren(root);
  }

  #useCopy(remaining: number): string {
    return `${remaining} ${remaining === 1 ? "use" : "uses"} available`;
  }

  #reservedCopy(reserved: number): string {
    return `${reserved} ${reserved === 1 ? "request is" : "requests are"} being checked`;
  }

  #objectForge(): HTMLElement {
    const section = document.createElement("section");
    section.className = "image-lab__stage";
    section.setAttribute("aria-label", "Object Forge");
    const heading = document.createElement("h3");
    heading.textContent = "Object Forge";
    const allowance = this.#status?.enabled === true
      ? this.#status.object
      : { remaining: 0, reserved: 0 };
    const guidance = document.createElement("p");
    guidance.textContent = "Invent one new object. Decorate it in the advertisement.";
    section.append(heading, guidance);
    if (allowance.reserved > 0) {
      const reserved = document.createElement("p");
      reserved.className = "image-lab__reserved";
      reserved.textContent = this.#reservedCopy(allowance.reserved);
      section.append(reserved);
    }
    const pending = this.#pendingChecks.object ?? null;
    if (pending) {
      const check = button(this.#busy === "object" ? "Checking…" : "Check request");
      check.disabled = this.#busy !== null;
      check.addEventListener("click", () => void this.#run(pending));
      section.append(check);
      return section;
    }
    if (allowance.remaining < 1) {
      const unmet = document.createElement("p");
      unmet.className = "image-lab__unmet";
      unmet.textContent = "No Object Forge uses are available.";
      const forge = button("Forge object");
      forge.disabled = true;
      section.append(unmet, forge);
      return section;
    }
    const name = labelledInput("Object idea", "object-name");
    const category = labelledSelect("Object type", "object-category", CATEGORY_CHOICES);
    const style = labelledSelect("Object look", "object-style", STYLE_CHOICES);
    const colour = labelledInput("Main colour", "object-colour", "bright orange");
    const background = document.createElement("label");
    const remove = document.createElement("input");
    remove.type = "checkbox";
    remove.name = "remove-background";
    remove.checked = true;
    background.append(remove, " Cut the object from the white background");
    const forge = button(this.#busy === "object" ? "Forging…" : "Forge object");
    forge.disabled = this.#busy !== null || !this.#pair;
    forge.addEventListener("click", () => void this.#forge(section));
    section.append(name, category, style, colour, background, forge);
    return section;
  }

  #makeItReal(): HTMLElement {
    const section = document.createElement("section");
    section.className = "image-lab__stage";
    section.setAttribute("aria-label", "Make It Real");
    const heading = document.createElement("h3");
    heading.textContent = "Make It Real";
    const allowance = this.#status?.enabled === true
      ? this.#status.realise
      : { remaining: 0, reserved: 0 };
    const guidance = document.createElement("p");
    guidance.textContent = "Use this after the product design is ready, before you build the ad. " +
      "Existing words and marks will be fitted to the product surface.";
    section.append(heading, guidance);
    if (allowance.reserved > 0) {
      const reserved = document.createElement("p");
      reserved.className = "image-lab__reserved";
      reserved.textContent = this.#reservedCopy(allowance.reserved);
      section.append(reserved);
    }
    const pending = this.#pendingChecks.realise ?? null;
    if (pending) {
      const check = button(this.#busy === "realise" ? "Checking…" : "Check request");
      check.disabled = this.#busy !== null;
      check.addEventListener("click", () => void this.#run(pending));
      section.append(check);
      return section;
    }
    if (allowance.remaining < 1) {
      const unmet = document.createElement("p");
      unmet.className = "image-lab__unmet";
      unmet.textContent = "No Make It Real uses are available.";
      const realise = button("Make it real");
      realise.disabled = true;
      section.append(unmet, realise);
      return section;
    }
    const product = labelledInput("Product kind", "product-kind", this.#pair?.productName ?? "");
    const scene = labelledSelect("Product scene", "product-scene", SCENE_CHOICES);
    const realise = button(this.#busy === "realise" ? "Building showcase…" : "Make it real");
    realise.disabled = this.#busy !== null || !this.#pair;
    realise.addEventListener("click", () => void this.#realise(section));
    section.append(product, scene, realise);
    return section;
  }

  async #forge(root: HTMLElement): Promise<void> {
    if (!this.#pair || this.#busy !== null) return;
    const objectName = fieldValue(root, "object-name");
    const colour = fieldValue(root, "object-colour");
    if (!objectName || !colour) {
      this.#error = "Your object needs an idea and a main colour.";
      this.#draw();
      return;
    }
    const input: ObjectForgeChoice = {
      sessionId: this.#pair.sessionId,
      teamId: this.#pair.teamId,
      objectName,
      category: fieldValue(root, "object-category"),
      style: fieldValue(root, "object-style"),
      colour,
      removeWhiteBackground: root.querySelector<HTMLInputElement>('[name="remove-background"]')?.checked === true
    };
    await this.#run({
      operation: "object",
      busyMessage: "Creating your object…",
      doneMessage: "Your new object is in the advertisement.",
      work: (signal) => this.actions.forgeObject(input, signal)
    });
  }

  async #realise(root: HTMLElement): Promise<void> {
    if (!this.#pair || this.#busy !== null) return;
    const productKind = fieldValue(root, "product-kind");
    if (!productKind) {
      this.#error = "Name the kind of product you want to create.";
      this.#draw();
      return;
    }
    const input: MakeItRealChoice = {
      sessionId: this.#pair.sessionId,
      teamId: this.#pair.teamId,
      productKind,
      scene: fieldValue(root, "product-scene")
    };
    await this.#run({
      operation: "realise",
      busyMessage: "Creating your product image…",
      doneMessage: "Your product image is in the advertisement.",
      work: (signal) => this.actions.makeReal(input, signal)
    });
  }

  async #run(pending: PendingCheck): Promise<void> {
    if (this.#busy !== null) return;
    const controller = this.#begin();
    this.#busy = pending.operation;
    this.#error = "";
    this.#message = pending.busyMessage;
    this.#draw();
    try {
      const status = await pending.work(controller.signal);
      if (!this.#current(controller)) return;
      delete this.#pendingChecks[pending.operation];
      this.#applyStatus(status);
      this.#message = pending.doneMessage;
    } catch (error) {
      if (!this.#current(controller) || controller.signal.aborted) return;
      if (isUncertainRequest(error)) {
        this.#pendingChecks[pending.operation] = pending;
        this.#error = "";
        this.#message = "The request is still being checked.";
      } else {
        delete this.#pendingChecks[pending.operation];
        this.#error = "The image could not finish. You can run the action again or keep creating with the built-in tools.";
        this.#message = "Image Lab is ready.";
        try {
          const status = await this.actions.status(controller.signal);
          if (!this.#current(controller)) return;
          this.#applyStatus(status);
        } catch {
          if (!this.#current(controller) || controller.signal.aborted) return;
        }
      }
    } finally {
      if (this.#current(controller)) {
        this.#busy = null;
        this.#operation = null;
        this.#draw();
      }
    }
  }
}
