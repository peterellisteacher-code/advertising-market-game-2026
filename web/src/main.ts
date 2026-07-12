import "./styles/editor.css";
import { createEditorShell } from "./ui/editor-shell";

const root = document.querySelector<HTMLElement>("#creator-root");
if (!root) throw new Error("Missing #creator-root");

const shell = createEditorShell(root);
root.hidden = true;

type CreatorEventCallback = (payloadJson: string) => void;

export interface CreatorSpikeApi {
  open(payloadJson: string): string;
  close(): string;
  publishProbe(): string;
  setEventCallback(callback: CreatorEventCallback): void;
}

let eventCallback: CreatorEventCallback | null = null;

function emitToGodot(event: string): void {
  eventCallback?.(JSON.stringify({ contract: "creator-spike@1", event }));
}

root.querySelector<HTMLButtonElement>('[data-command="return"]')
  ?.addEventListener("click", () => emitToGodot("closeRequested"));

const spike: CreatorSpikeApi = Object.freeze({
  open(payloadJson: string): string {
    JSON.parse(payloadJson);
    root.hidden = false;
    shell.canvasRegion.focus({ preventScroll: true });
    return JSON.stringify({ contract: "creator-spike@1", event: "opened" });
  },
  close(): string {
    root.hidden = true;
    return JSON.stringify({ contract: "creator-spike@1", event: "closed" });
  },
  publishProbe(): string {
    const png = shell.canvas.toDataURL("image/png");
    return JSON.stringify({ contract: "creator-spike@1", event: "published", png });
  },
  setEventCallback(callback: CreatorEventCallback): void {
    eventCallback = callback;
  }
});

declare global {
  interface Window { AdMarketCreatorSpike: typeof spike }
}

window.AdMarketCreatorSpike = spike;
