export interface ImageLabPair {
  sessionId: string;
  teamId: string;
  productName: string;
}

export type ImageLabConfig =
  | { enabled: false; reason: string }
  | {
      enabled: true;
      accountCapUsd: number;
      objectAllowance: number;
      realiseAllowance: number;
    };

export interface ImageLabAllowance {
  remainingObject: number;
  remainingRealise: number;
  expiresAt: number;
}

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
  getConfig(signal: AbortSignal): Promise<ImageLabConfig>;
  unlock(
    input: { sessionId: string; teamId: string; code: string },
    signal: AbortSignal
  ): Promise<ImageLabAllowance>;
  lock(signal: AbortSignal): Promise<void>;
  forgeObject(input: ObjectForgeChoice, signal: AbortSignal): Promise<ImageLabAllowance>;
  makeReal(input: MakeItRealChoice, signal: AbortSignal): Promise<ImageLabAllowance>;
}

type PanelState = "checking" | "disabled" | "locked" | "unlocked";
type Operation = "unlock" | "lock" | "object" | "realise";

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

function requiresTeacherUnlock(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const code = (error as { code?: unknown }).code;
  return code === "IMAGE_LAB_LOCKED" || code === "SESSION_EXPIRED";
}

export class ImageLabPanel {
  #pair: ImageLabPair | null = null;
  #state: PanelState = "checking";
  #config: ImageLabConfig | null = null;
  #allowance: ImageLabAllowance | null = null;
  #busy: Operation | null = null;
  #message = "Checking the image tools…";
  #error = "";
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
    if (this.#state === "unlocked") {
      this.#state = "locked";
      this.#allowance = null;
      this.#message = "Ask your teacher to wake the Image Lab.";
    }
    this.#draw();
  }

  async initialise(): Promise<void> {
    if (this.#disposed) return;
    const controller = this.#begin();
    this.#state = "checking";
    this.#message = "Checking the image tools…";
    this.#draw();
    try {
      const config = await this.actions.getConfig(controller.signal);
      if (!this.#current(controller)) return;
      this.#config = config;
      this.#state = config.enabled ? "locked" : "disabled";
      this.#message = config.enabled
        ? "Ask your teacher to wake the Image Lab."
      : "Image Lab is asleep. Built-in tools still work.";
    } catch (error) {
      if (!this.#current(controller) || controller.signal.aborted) return;
      this.#config = { enabled: false, reason: "unavailable" };
      this.#state = "disabled";
    this.#message = "Image Lab is asleep. Built-in tools still work.";
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
    if (this.#state === "locked") {
      this.#drawLocked();
      return;
    }
    this.#drawUnlocked();
  }

  #drawLocked(): void {
    const root = document.createElement("div");
    root.className = "image-lab image-lab--locked";
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.textContent = this.#message;
    const label = labelledInput("Teacher code", "teacher-code");
    const code = label.querySelector("input")!;
    code.type = "password";
    code.autocomplete = "off";
    code.disabled = this.#pair === null || this.#busy !== null;
    const unlock = button(this.#busy === "unlock" ? "Waking…" : "Wake Image Lab");
    unlock.disabled = code.disabled;
    unlock.addEventListener("click", () => void this.#unlock(code.value));
    root.append(status, label, unlock);
    this.host.replaceChildren(root);
  }

  #drawUnlocked(): void {
    const allowance = this.#allowance;
    const root = document.createElement("div");
    root.className = "image-lab";
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.textContent = this.#message;
    const sparks = document.createElement("p");
    sparks.className = "image-lab__sparks";
    sparks.textContent = `${allowance?.remainingObject ?? 0} Object Forge uses remaining · ` +
      `${allowance?.remainingRealise ?? 0} Make It Real uses remaining`;
    root.append(status, sparks);
    if (this.#error) {
      const alert = document.createElement("p");
      alert.setAttribute("role", "alert");
      alert.textContent = this.#error;
      root.append(alert);
    }
    root.append(this.#objectForge(), this.#makeItReal());
    const close = button(this.#busy === "lock" ? "Closing…" : "Close Image Lab");
    close.className = "image-lab__close";
    close.disabled = this.#busy !== null;
    close.addEventListener("click", () => void this.#lock());
    root.append(close);
    this.host.replaceChildren(root);
  }

  #objectForge(): HTMLElement {
    const section = document.createElement("section");
    section.className = "image-lab__stage";
    section.setAttribute("aria-label", "Object Forge");
    const heading = document.createElement("h3");
    heading.textContent = "Object Forge";
    const guidance = document.createElement("p");
    guidance.textContent = "Invent one new object. Decorate it on the canvas.";
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
    forge.disabled = this.#busy !== null || !this.#pair || (this.#allowance?.remainingObject ?? 0) < 1;
    forge.addEventListener("click", () => void this.#forge(section));
    section.append(heading, guidance, name, category, style, colour, background, forge);
    return section;
  }

  #makeItReal(): HTMLElement {
    const section = document.createElement("section");
    section.className = "image-lab__stage";
    section.setAttribute("aria-label", "Make It Real");
    const heading = document.createElement("h3");
    heading.textContent = "Make It Real";
    const guidance = document.createElement("p");
    guidance.textContent = "Use this after the product design is ready, before you build the ad. " +
      "Existing words and marks will be fitted to the product surface.";
    const product = labelledInput("Product kind", "product-kind", this.#pair?.productName ?? "");
    const scene = labelledSelect("Product scene", "product-scene", SCENE_CHOICES);
    const realise = button(this.#busy === "realise" ? "Building showcase…" : "Make it real");
    realise.disabled = this.#busy !== null || !this.#pair || (this.#allowance?.remainingRealise ?? 0) < 1;
    realise.addEventListener("click", () => void this.#realise(section));
    section.append(heading, guidance, product, scene, realise);
    return section;
  }

  async #unlock(code: string): Promise<void> {
    if (!this.#pair || !code.trim() || this.#busy !== null) return;
    const controller = this.#begin();
    this.#busy = "unlock";
    this.#error = "";
    this.#message = "Waking the Image Lab…";
    this.#draw();
    try {
      const allowance = await this.actions.unlock({
        sessionId: this.#pair.sessionId,
        teamId: this.#pair.teamId,
        code: code.trim()
      }, controller.signal);
      if (!this.#current(controller)) return;
      this.#allowance = allowance;
      this.#state = "unlocked";
      this.#message = "Image Lab is awake.";
    } catch {
      if (!this.#current(controller) || controller.signal.aborted) return;
      this.#message = "That code did not wake the Image Lab.";
    } finally {
      if (this.#current(controller)) {
        this.#busy = null;
        this.#operation = null;
        this.#draw();
      }
    }
  }

  async #lock(): Promise<void> {
    if (this.#busy !== null) return;
    const controller = this.#begin();
    this.#busy = "lock";
    this.#error = "";
    this.#message = "Closing the Image Lab…";
    this.#draw();
    try {
      await this.actions.lock(controller.signal);
      if (!this.#current(controller)) return;
      this.#state = "locked";
      this.#allowance = null;
      this.#message = "Image Lab is closed for this pair. Ask your teacher to wake it.";
    } catch {
      if (!this.#current(controller) || controller.signal.aborted) return;
      this.#error = "Image Lab could not close. Try again.";
      this.#message = "Image Lab is ready.";
    } finally {
      if (this.#current(controller)) {
        this.#busy = null;
        this.#operation = null;
        this.#draw();
      }
    }
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
    await this.#run("object", "Creating your object…", "Your new object is on the canvas.",
      (signal) => this.actions.forgeObject(input, signal));
  }

  async #realise(root: HTMLElement): Promise<void> {
    if (!this.#pair || this.#busy !== null) return;
    const productKind = fieldValue(root, "product-kind");
    if (!productKind) {
      this.#error = "Name the kind of product you want to showcase.";
      this.#draw();
      return;
    }
    const input: MakeItRealChoice = {
      sessionId: this.#pair.sessionId,
      teamId: this.#pair.teamId,
      productKind,
      scene: fieldValue(root, "product-scene")
    };
    await this.#run("realise", "Creating your product image…", "Your product image is on the canvas.",
      (signal) => this.actions.makeReal(input, signal));
  }

  async #run(
    operation: Exclude<Operation, "unlock">,
    busyMessage: string,
    doneMessage: string,
    work: (signal: AbortSignal) => Promise<ImageLabAllowance>
  ): Promise<void> {
    const controller = this.#begin();
    this.#busy = operation;
    this.#error = "";
    this.#message = busyMessage;
    this.#draw();
    try {
      const allowance = await work(controller.signal);
      if (!this.#current(controller)) return;
      this.#allowance = allowance;
      this.#message = doneMessage;
    } catch (error) {
      if (!this.#current(controller) || controller.signal.aborted) return;
      if (requiresTeacherUnlock(error)) {
        this.#state = "locked";
        this.#allowance = null;
        this.#error = "";
        this.#message = "Ask your teacher to wake the Image Lab.";
      } else {
        this.#error = "The image could not finish. Try again or keep creating with the built-in tools.";
        this.#message = "Image Lab is ready.";
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
