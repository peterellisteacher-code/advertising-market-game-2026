import {
  CREATOR_BRIDGE_CONTRACT,
  CreatorResponseSchema,
  type CreatorMethod
} from "../../src/bridge/contracts";
import {
  CampaignDocumentSchema,
  createBlankCampaignDocument,
  type CampaignDocumentV1
} from "../../src/domain/campaign-document";
import { AUDIENCE_BRIEFS } from "../../src/game/audience-briefs";

const checkpointIds = [
  "open",
  "brief",
  "art-director",
  "text-add",
  "pointer-move",
  "pointer-resize",
  "undo-redo",
  "role-swap",
  "strategist-action",
  "close"
] as const;

type CheckpointId = typeof checkpointIds[number];
type CheckpointResult = "pending" | "pass" | "fail";

interface DiagnosticState {
  status: "running" | "pass" | "fail";
  checkpoints: Record<CheckpointId, CheckpointResult>;
  errors: string[];
  viewport: { width: number; height: number };
}

declare global {
  interface Window {
    __ROUND_ZERO_DIAGNOSTIC__?: DiagnosticState;
  }
}

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Round 0 diagnostic is missing ${selector}`);
  return element;
}

const checkpointList = requiredElement<HTMLOListElement>("#diagnostic-checkpoints");
const summary = requiredElement<HTMLElement>("#diagnostic-summary");
const creatorRoot = requiredElement<HTMLElement>("#creator-root");

const state: DiagnosticState = {
  status: "running",
  checkpoints: Object.fromEntries(
    checkpointIds.map((id) => [id, "pending"])
  ) as Record<CheckpointId, CheckpointResult>,
  errors: [],
  viewport: { width: window.innerWidth, height: window.innerHeight }
};
window.__ROUND_ZERO_DIAGNOSTIC__ = state;

const checkpointRows = new Map<CheckpointId, HTMLLIElement>();
for (const id of checkpointIds) {
  const row = document.createElement("li");
  row.dataset.checkpoint = id;
  row.dataset.result = "pending";
  row.textContent = `${id}: pending`;
  checkpointRows.set(id, row);
  checkpointList.append(row);
}

function mark(id: CheckpointId, result: Exclude<CheckpointResult, "pending">): void {
  if (state.checkpoints[id] === "pass" && result === "pass") return;
  state.checkpoints[id] = result;
  const row = checkpointRows.get(id)!;
  row.dataset.result = result;
  row.textContent = `${id}: ${result}`;
  updateSummary();
}

function recordError(value: unknown): void {
  const message = value instanceof Error ? value.message : String(value);
  if (!state.errors.includes(message)) state.errors.push(message);
  state.status = "fail";
  summary.textContent = `Browser diagnostic failed: ${message}`;
}

function updateSummary(): void {
  const passed = checkpointIds.filter((id) => state.checkpoints[id] === "pass").length;
  if (passed === checkpointIds.length && state.errors.length === 0) {
    state.status = "pass";
    summary.textContent = `All ${passed} browser checkpoints passed`;
    return;
  }
  if (state.errors.length === 0) {
    summary.textContent = `${passed}/${checkpointIds.length} browser checkpoints passed`;
  }
}

const originalWarn = console.warn.bind(console);
const originalError = console.error.bind(console);
console.warn = (...values: unknown[]) => {
  recordError(`Console warning: ${values.map(String).join(" ")}`);
  originalWarn(...values);
};
console.error = (...values: unknown[]) => {
  recordError(`Console error: ${values.map(String).join(" ")}`);
  originalError(...values);
};
window.addEventListener("error", (event) => recordError(event.error ?? event.message));
window.addEventListener("unhandledrejection", (event) => recordError(event.reason));

let requestNumber = 0;
async function call(method: CreatorMethod, payload: unknown): Promise<unknown> {
  const response = CreatorResponseSchema.parse(JSON.parse(await window.AdMarketCreator.handle(
    JSON.stringify({
      contract: CREATOR_BRIDGE_CONTRACT,
      requestId: `round-zero-browser-${++requestNumber}`,
      method,
      payload
    })
  )));
  if (!response.ok) {
    const code = response.error?.code ?? "UNKNOWN_ERROR";
    const message = response.error?.message ?? "Creator request failed";
    throw new Error(`${code}: ${message}`);
  }
  return response.payload;
}

async function campaignState(): Promise<CampaignDocumentV1> {
  return CampaignDocumentSchema.parse(await call("getState", null));
}

interface ObjectBaseline {
  objectId: string;
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} is not a finite number`);
  }
  return value;
}

let baseline: ObjectBaseline | null = null;
let maximumObjectCount = 0;
let sawUndo = false;
let refreshInFlight = false;
let closeRequested = false;

async function refresh(): Promise<void> {
  if (refreshInFlight || state.status === "fail") return;
  refreshInFlight = true;
  try {
    const rootVisible = !creatorRoot.hidden;
    if (rootVisible) mark("open", "pass");
    if (!rootVisible && closeRequested) mark("close", "pass");

    const campaign = await campaignState();
    if (campaign.brief.targetAudienceId === AUDIENCE_BRIEFS[0].id &&
      campaign.brief.contextId === AUDIENCE_BRIEFS[0].id &&
      campaign.brief.audienceNeeds[0] === AUDIENCE_BRIEFS[0].need) {
      mark("brief", "pass");
    }

    const objects = campaign.fabricState.objects;
    maximumObjectCount = Math.max(maximumObjectCount, objects.length);
    if (maximumObjectCount >= 2 && objects.length < maximumObjectCount) sawUndo = true;
    if (sawUndo && objects.length === maximumObjectCount) mark("undo-redo", "pass");

    const firstText = objects.find((object) => object.elementKind === "text");
    if (firstText !== undefined) {
      mark("text-add", "pass");
      const next: ObjectBaseline = {
        objectId: firstText.objectId,
        left: finite(firstText.left, "text left"),
        top: finite(firstText.top, "text top"),
        scaleX: finite(firstText.scaleX, "text scaleX"),
        scaleY: finite(firstText.scaleY, "text scaleY")
      };
      if (baseline === null) {
        baseline = next;
      } else if (baseline.objectId === next.objectId) {
        if (Math.abs(next.left - baseline.left) > 1 || Math.abs(next.top - baseline.top) > 1) {
          mark("pointer-move", "pass");
        }
        if (Math.abs(next.scaleX - baseline.scaleX) > 0.01 ||
          Math.abs(next.scaleY - baseline.scaleY) > 0.01) {
          mark("pointer-resize", "pass");
        }
      }
    }

    const activeRole = creatorRoot.querySelector("[data-active-role]")?.textContent?.trim();
    if (activeRole === "Art Director") mark("art-director", "pass");
    if (activeRole === "Strategist") mark("role-swap", "pass");
    if (creatorRoot.querySelector("[data-round-progress]")?.textContent?.trim() ===
      "Both roles have made a change") {
      mark("strategist-action", "pass");
    }

    if (creatorRoot.querySelector("iframe") !== null) {
      throw new Error("Creator opened an iframe");
    }
    if (creatorRoot.textContent?.match(/\b(?:assignment|unit|task)\b/i)) {
      throw new Error("Creator displayed banned classroom framing");
    }
  } catch (error) {
    recordError(error);
  } finally {
    refreshInFlight = false;
  }
}

window.addEventListener("ad-market-creator:return-to-game", () => {
  if (closeRequested) return;
  closeRequested = true;
  void call("close", null).then(() => refresh()).catch(recordError);
});

async function run(): Promise<void> {
  await import("../../src/main");
  const campaign = createBlankCampaignDocument({
    documentId: "round-zero-browser-campaign",
    sessionId: "round-zero-browser-session",
    mode: "offline"
  });
  await call("open", campaign);
  await refresh();
  window.setInterval(() => void refresh(), 120);
}

run().catch(recordError);
