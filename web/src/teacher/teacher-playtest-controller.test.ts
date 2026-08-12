import {
  fireEvent,
  getByLabelText,
  getByRole,
  queryByRole,
  waitFor
} from "@testing-library/dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeacherPlaytestController } from "./teacher-playtest-controller";

const operationId = "123e4567-e89b-42d3-a456-426614174000";
const replacementOperationId = "223e4567-e89b-42d3-a456-426614174000";
const thirdOperationId = "323e4567-e89b-42d3-a456-426614174000";

function createRoot(): HTMLElement {
  const root = document.createElement("div");
  document.body.append(root);
  return root;
}

function showTeacherControls(root: HTMLElement): void {
  fireEvent.click(
    getByRole(root, "button", { name: "Show teacher controls" })
  );
}

describe("TeacherPlaytestController", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("shares the teacher page typography and background with the dashboard", () => {
    const stylesheet = readFileSync(
      join(process.cwd(), "web", "src", "teacher", "teacher.css"),
      "utf8"
    );

    expect(stylesheet).toContain(
      'body:has([data-admarket-route="teacher-playtest"])'
    );
  });

  it("keeps teacher controls inside the Academy header without a floating strip", async () => {
    const style = document.createElement("style");
    style.textContent = [
      readFileSync(
        join(process.cwd(), "web", "src", "styles", "editor.css"),
        "utf8"
      ),
      readFileSync(
        join(process.cwd(), "web", "src", "teacher", "teacher.css"),
        "utf8"
      )
    ].join("\n");
    document.head.append(style);
    try {
      const creatorRoot = document.createElement("div");
      creatorRoot.id = "creator-root";
      document.body.append(creatorRoot);
      const academyHeader = document.createElement("header");
      academyHeader.className = "creator__academy-header";
      creatorRoot.append(academyHeader);
      const workspace = document.createElement("section");
      workspace.className = "creator__workspace";
      const layers = document.createElement("aside");
      layers.className = "creator__layers";
      workspace.append(layers);
      creatorRoot.append(workspace);
      const root = createRoot();
      const controller = new TeacherPlaytestController({
        root,
        sessionClient: {
          session: async () => ({ authenticated: true })
        },
        playtestClient: { reset: vi.fn() },
        startGame: async () => undefined,
        resetLocalState: vi.fn(),
        openFirstScreen: vi.fn()
      });

      await controller.mount();

      const strip = getByRole(root, "banner", { name: "Teacher playtest" });
      const stripStyle = getComputedStyle(strip);
      expect(root.parentElement).toBe(academyHeader);
      expect(stripStyle.position).toBe("relative");
      expect(getComputedStyle(layers).top).toBe("auto");

      fireEvent.click(getByRole(root, "button", { name: "Show teacher controls" }));

      expect(getComputedStyle(layers).top).toBe("auto");
    } finally {
      style.remove();
    }
  });

  it("lets the teacher reveal and tuck the playtest controls with a pointer", async () => {
    const root = createRoot();
    const controller = new TeacherPlaytestController({
      root,
      sessionClient: {
        session: async () => ({ authenticated: true })
      },
      playtestClient: { reset: vi.fn() },
      startGame: vi.fn(),
      resetLocalState: vi.fn(),
      openFirstScreen: vi.fn()
    });
    await controller.mount();

    const strip = getByRole(root, "banner", { name: "Teacher playtest" });
    const toggle = getByRole(root, "button", { name: "Show teacher controls" });
    const actions = strip.querySelector<HTMLElement>(".teacher-playtest-strip__actions");
    expect(strip.dataset.expanded).toBe("false");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(actions?.hidden).toBe(true);
    expect(actions?.hasAttribute("inert")).toBe(true);

    fireEvent.click(toggle);

    expect(strip.dataset.expanded).toBe("true");
    expect(toggle.textContent).toBe("Hide teacher controls");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(actions?.hidden).toBe(false);
    expect(actions?.hasAttribute("inert")).toBe(false);
    expect(getByRole(root, "button", { name: "Return to teacher dashboard" })).toBeTruthy();
    expect(getByRole(root, "button", { name: "Factory reset playtest" })).toBeTruthy();

    fireEvent.click(toggle);

    expect(strip.dataset.expanded).toBe("false");
    expect(toggle.textContent).toBe("Show teacher controls");
    expect(actions?.hidden).toBe(true);
    expect(actions?.hasAttribute("inert")).toBe(true);
  });

  it("tucks expanded teacher controls with Escape and restores toggle focus", async () => {
    const root = createRoot();
    const controller = new TeacherPlaytestController({
      root,
      sessionClient: {
        session: async () => ({ authenticated: true })
      },
      playtestClient: { reset: vi.fn() },
      startGame: vi.fn(),
      resetLocalState: vi.fn(),
      openFirstScreen: vi.fn()
    });
    await controller.mount();

    const strip = getByRole(root, "banner", { name: "Teacher playtest" });
    const toggle = getByRole(root, "button", { name: "Show teacher controls" });
    fireEvent.click(toggle);
    getByRole(root, "button", { name: "Return to teacher dashboard" }).focus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(strip.dataset.expanded).toBe("false");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toBe("Show teacher controls");
    expect(document.activeElement).toBe(toggle);
  });

  it("checks the independent teacher session before starting the complete game", async () => {
    const order: string[] = [];
    const root = createRoot();
    const controller = new TeacherPlaytestController({
      root,
      sessionClient: {
        session: async () => {
          order.push("session");
          return { authenticated: true };
        }
      },
      playtestClient: { reset: vi.fn() },
      startGame: async () => {
        order.push("game");
      },
      resetLocalState: vi.fn(),
      openFirstScreen: vi.fn()
    });

    await controller.mount();

    expect(order).toEqual(["session", "game"]);
    expect(getByRole(root, "banner", { name: "Teacher playtest" })).toBeTruthy();
    showTeacherControls(root);
    expect(getByRole(root, "button", { name: "Return to teacher dashboard" })).toBeTruthy();
    expect(queryByRole(root, "form", { name: /pair sign-in/i })).toBeNull();
  });

  it("keeps the game locked when the teacher session is absent", async () => {
    const root = createRoot();
    const startGame = vi.fn();
    const navigate = vi.fn();
    const controller = new TeacherPlaytestController({
      root,
      sessionClient: {
        session: async () => ({ authenticated: false })
      },
      playtestClient: { reset: vi.fn() },
      startGame,
      resetLocalState: vi.fn(),
      openFirstScreen: vi.fn(),
      navigate
    });

    await controller.mount();

    expect(startGame).not.toHaveBeenCalled();
    expect(getByRole(root, "heading", { name: "Teacher sign-in required" })).toBeTruthy();
    fireEvent.click(getByRole(root, "button", { name: "Return to teacher dashboard" }));
    expect(navigate).toHaveBeenCalledWith("/teacher");
  });

  it("returns to the dashboard from the persistent teacher strip", async () => {
    const root = createRoot();
    const navigate = vi.fn();
    const controller = new TeacherPlaytestController({
      root,
      sessionClient: {
        session: async () => ({ authenticated: true })
      },
      playtestClient: { reset: vi.fn() },
      startGame: vi.fn(),
      resetLocalState: vi.fn(),
      openFirstScreen: vi.fn(),
      navigate
    });
    await controller.mount();

    showTeacherControls(root);
    fireEvent.click(getByRole(root, "button", { name: "Return to teacher dashboard" }));

    expect(navigate).toHaveBeenCalledWith("/teacher");
  });

  it("cancels factory reset without changing server or local state", async () => {
    const root = createRoot();
    const reset = vi.fn();
    const resetLocalState = vi.fn();
    const openFirstScreen = vi.fn();
    const controller = new TeacherPlaytestController({
      root,
      sessionClient: {
        session: async () => ({ authenticated: true })
      },
      playtestClient: { reset },
      startGame: vi.fn(),
      resetLocalState,
      openFirstScreen
    });
    await controller.mount();

    showTeacherControls(root);
    const trigger = getByRole(root, "button", { name: "Factory reset playtest" });
    fireEvent.click(trigger);
    expect(
      getByRole(root, "dialog", { name: "Factory reset teacher playtest" }).textContent
    ).toContain(
      "saved progress and assets from cloud storage and this browser"
    );
    fireEvent.click(getByRole(root, "button", { name: "Cancel" }));

    expect(queryByRole(root, "dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(reset).not.toHaveBeenCalled();
    expect(resetLocalState).not.toHaveBeenCalled();
    expect(openFirstScreen).not.toHaveBeenCalled();
  });

  it("opens a native modal reset dialog and closes it through the dialog API", async () => {
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    const close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
    const originalShowModal = Object.getOwnPropertyDescriptor(
      HTMLDialogElement.prototype,
      "showModal"
    );
    const originalClose = Object.getOwnPropertyDescriptor(
      HTMLDialogElement.prototype,
      "close"
    );
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: showModal
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: close
    });
    try {
      const root = createRoot();
      const controller = new TeacherPlaytestController({
        root,
        sessionClient: {
          session: async () => ({ authenticated: true })
        },
        playtestClient: { reset: vi.fn() },
        startGame: vi.fn(),
        resetLocalState: vi.fn(),
        openFirstScreen: vi.fn()
      });
      await controller.mount();

      showTeacherControls(root);
      fireEvent.click(getByRole(root, "button", { name: "Factory reset playtest" }));
      const dialog = getByRole(root, "dialog");
      expect(showModal).toHaveBeenCalledOnce();
      fireEvent.click(getByRole(dialog, "button", { name: "Cancel" }));
      expect(close).toHaveBeenCalledOnce();
    } finally {
      if (originalShowModal === undefined) {
        delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
      } else {
        Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShowModal);
      }
      if (originalClose === undefined) {
        delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
      } else {
        Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose);
      }
    }
  });

  it("requires exact RESET then resets server before isolated local state and the first screen", async () => {
    const root = createRoot();
    const order: string[] = [];
    const reset = vi.fn(async () => {
      order.push("server");
      return "reset" as const;
    });
    const controller = new TeacherPlaytestController({
      root,
      sessionClient: {
        session: async () => ({ authenticated: true })
      },
      playtestClient: { reset },
      startGame: vi.fn(),
      resetLocalState: async () => {
        order.push("local");
      },
      openFirstScreen: () => {
        order.push("first-screen");
      },
      createOperationId: () => operationId
    });
    await controller.mount();
    showTeacherControls(root);
    fireEvent.click(getByRole(root, "button", { name: "Factory reset playtest" }));
    const input = getByLabelText(root, "Type RESET to confirm");
    const form = getByRole(root, "form", { name: "Confirm teacher playtest factory reset" });

    fireEvent.input(input, { target: { value: "reset" } });
    fireEvent.submit(form);

    expect(getByRole(root, "alert").textContent).toBe("Type RESET exactly to confirm.");
    expect(reset).not.toHaveBeenCalled();

    fireEvent.input(input, { target: { value: "RESET" } });
    fireEvent.submit(form);

    await waitFor(() => expect(order).toEqual(["server", "local", "first-screen"]));
    expect(reset).toHaveBeenCalledWith({
      operationId,
      confirmation: "RESET"
    });
  });

  it("does not clear local state when the server reset is uncertain", async () => {
    const root = createRoot();
    const resetLocalState = vi.fn();
    const openFirstScreen = vi.fn();
    const controller = new TeacherPlaytestController({
      root,
      sessionClient: {
        session: async () => ({ authenticated: true })
      },
      playtestClient: {
        reset: vi.fn().mockRejectedValue(new Error("synthetic server failure"))
      },
      startGame: vi.fn(),
      resetLocalState,
      openFirstScreen,
      createOperationId: () => operationId
    });
    await controller.mount();
    showTeacherControls(root);
    fireEvent.click(getByRole(root, "button", { name: "Factory reset playtest" }));
    const input = getByLabelText(root, "Type RESET to confirm");
    fireEvent.input(input, { target: { value: "RESET" } });
    fireEvent.submit(
      getByRole(root, "form", { name: "Confirm teacher playtest factory reset" })
    );

    await waitFor(() => expect(getByRole(root, "alert").textContent).toContain(
      "The teacher playtest could not be reset."
    ));
    expect(resetLocalState).not.toHaveBeenCalled();
    expect(openFirstScreen).not.toHaveBeenCalled();
  });

  it("reuses one reset operation ID when a failed request is retried", async () => {
    const root = createRoot();
    const reset = vi.fn()
      .mockRejectedValueOnce(new Error("synthetic interrupted request"))
      .mockResolvedValueOnce("reset");
    const createOperationId = vi.fn()
      .mockReturnValueOnce(operationId)
      .mockReturnValueOnce(replacementOperationId)
      .mockReturnValueOnce(thirdOperationId);
    const controller = new TeacherPlaytestController({
      root,
      sessionClient: {
        session: async () => ({ authenticated: true })
      },
      playtestClient: { reset },
      startGame: vi.fn(),
      resetLocalState: vi.fn().mockResolvedValue(undefined),
      openFirstScreen: vi.fn(),
      createOperationId
    });
    await controller.mount();
    showTeacherControls(root);
    fireEvent.click(getByRole(root, "button", { name: "Factory reset playtest" }));
    const input = getByLabelText(root, "Type RESET to confirm");
    const form = getByRole(root, "form", { name: "Confirm teacher playtest factory reset" });
    fireEvent.input(input, { target: { value: "RESET" } });

    fireEvent.submit(form);
    await waitFor(() => expect(reset).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getByRole(root, "alert").textContent).toContain(
      "The teacher playtest could not be reset."
    ));
    fireEvent.submit(form);
    await waitFor(() => expect(reset).toHaveBeenCalledTimes(2));

    expect(reset.mock.calls.map(([input]) => input.operationId)).toEqual([
      operationId,
      operationId
    ]);
    expect(createOperationId).toHaveBeenCalledTimes(1);
  });
});
