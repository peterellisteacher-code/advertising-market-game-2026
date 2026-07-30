export interface ManagedModalDialog {
  readonly dialog: HTMLDialogElement;
  readonly close: () => void;
  readonly setPending: (pending: boolean) => void;
}

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export function openManagedModalDialog(
  root: HTMLElement,
  trigger: HTMLButtonElement,
  dialog: HTMLDialogElement
): ManagedModalDialog {
  let pending = false;
  let fallback = typeof dialog.showModal !== "function";
  const background = [...root.children]
    .filter((element): element is HTMLElement =>
      element instanceof HTMLElement && element !== dialog)
    .map((element) => ({
      element,
      inert: element.hasAttribute("inert")
    }));

  const restoreBackground = (): void => {
    for (const entry of background) {
      if (!entry.inert) entry.element.removeAttribute("inert");
    }
  };
  const close = (): void => {
    if (pending || !dialog.isConnected) return;
    if (typeof dialog.close === "function" && dialog.open) {
      try {
        dialog.close();
      } catch {
        dialog.removeAttribute("open");
      }
    } else {
      dialog.removeAttribute("open");
    }
    restoreBackground();
    dialog.remove();
    trigger.focus();
  };
  const trapFallbackTab = (event: KeyboardEvent): void => {
    if (!fallback || event.key !== "Tab") return;
    const controls = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)]
      .filter((control) => !control.hidden && control.getAttribute("aria-hidden") !== "true");
    if (controls.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = controls[0]!;
    const last = controls.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    trapFallbackTab(event);
  });
  root.append(dialog);
  if (!fallback) {
    try {
      dialog.showModal();
    } catch {
      fallback = true;
    }
  }
  if (fallback) {
    for (const { element } of background) element.setAttribute("inert", "");
    dialog.setAttribute("open", "");
  }

  return {
    dialog,
    close,
    setPending(value) {
      pending = value;
    }
  };
}
