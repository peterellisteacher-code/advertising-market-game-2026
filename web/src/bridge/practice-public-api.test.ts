import { describe, expect, it } from "vitest";
import { createBlankCampaignDocument } from "../domain/campaign-document";
import {
  PRACTICE_BRIDGE_CONTRACT,
  type LocalPracticeRecoveryV1,
  type PracticeRunHandler
} from "./practice-contracts";
import { createPracticePublicApi } from "./practice-public-api";

const recovery = (overrides: Partial<LocalPracticeRecoveryV1["checkpoint"]> = {}): LocalPracticeRecoveryV1 => {
  const document = createBlankCampaignDocument({
    documentId: "practice-document-0123456789",
    sessionId: "practice-session-0123456789",
    teamId: "practice-team-0123456789",
    mode: "offline"
  });
  return {
    checkpoint: {
      contract: "local-practice-checkpoint@1",
      runId: "run-0123456789",
      documentId: document.documentId,
      sessionId: document.sessionId,
      teamId: document.teamId!,
      teamAlias: "Neon Narwhals",
      documentRevision: document.revision,
      documentHash: "a".repeat(64),
      stage: document.gameplay.stage,
      levelLocked: false,
      sequence: 0,
      operationId: "operation-begin-1",
      savedAt: "2026-07-17T04:00:00.000Z",
      ...overrides
    },
    document
  };
};

class HandlerHarness implements PracticeRunHandler {
  calls: Array<{ method: string; payload: unknown }> = [];
  current: LocalPracticeRecoveryV1 | null = recovery();

  async resume(): Promise<LocalPracticeRecoveryV1 | null> {
    this.calls.push({ method: "resume", payload: null });
    return structuredClone(this.current);
  }

  async begin(teamAlias: string, operationId: string): Promise<LocalPracticeRecoveryV1> {
    this.calls.push({ method: "begin", payload: { teamAlias, operationId } });
    return structuredClone(recovery({ teamAlias, operationId }));
  }

  async setLock(input: Parameters<PracticeRunHandler["setLock"]>[0]): Promise<LocalPracticeRecoveryV1> {
    this.calls.push({ method: "setLock", payload: input });
    const value = recovery({
      ...input.checkpoint,
      levelLocked: input.levelLocked,
      documentRevision: input.checkpoint.documentRevision + 1,
      sequence: input.checkpoint.sequence + 1,
      operationId: input.operationId
    });
    value.document.revision = input.checkpoint.documentRevision + 1;
    return structuredClone(value);
  }

  async advance(input: Parameters<PracticeRunHandler["advance"]>[0]): Promise<LocalPracticeRecoveryV1> {
    this.calls.push({ method: "advance", payload: input });
    const value = recovery({
      ...input.checkpoint,
      stage: input.nextStage,
      levelLocked: false,
      documentRevision: input.checkpoint.documentRevision + 1,
      sequence: input.checkpoint.sequence + 1,
      operationId: input.operationId
    });
    value.document.gameplay.stage = input.nextStage;
    value.document.revision = input.checkpoint.documentRevision + 1;
    return structuredClone(value);
  }
}

async function request(
  handler: HandlerHarness,
  requestId: string,
  method: string,
  payload: unknown
): Promise<Record<string, unknown>> {
  const api = createPracticePublicApi(handler);
  return JSON.parse(await api.handle(JSON.stringify({
    contract: PRACTICE_BRIDGE_CONTRACT,
    requestId,
    method,
    payload
  }))) as Record<string, unknown>;
}

describe("practice public API", () => {
  it("routes strict begin, resume, lock and one-step advance requests", async () => {
    const handler = new HandlerHarness();
    const current = recovery();
    const checkpoint = {
      runId: current.checkpoint.runId,
      documentId: current.checkpoint.documentId,
      documentRevision: current.checkpoint.documentRevision,
      sequence: current.checkpoint.sequence,
      stage: current.checkpoint.stage
    };

    expect(await request(handler, "resume-1", "resume", null)).toMatchObject({ ok: true });
    expect(await request(handler, "begin-1", "begin", {
      teamAlias: "Neon Narwhals",
      operationId: "operation-begin-1"
    })).toMatchObject({ ok: true });
    expect(await request(handler, "lock-1", "setLock", {
      checkpoint,
      levelLocked: true,
      operationId: "operation-lock-1"
    })).toMatchObject({
      ok: true,
      payload: { checkpoint: { levelLocked: true, documentRevision: 1, sequence: 1 } }
    });
    expect(await request(handler, "advance-1", "advance", {
      checkpoint,
      nextStage: "sell",
      operationId: "operation-advance-1"
    })).toMatchObject({
      ok: true,
      payload: { checkpoint: { stage: "sell", documentRevision: 1, sequence: 1 } }
    });
    expect(handler.calls.map(({ method }) => method)).toEqual([
      "resume", "begin", "setLock", "advance"
    ]);
  });

  it("returns an explicit null resume without opening or inventing a run", async () => {
    const handler = new HandlerHarness();
    handler.current = null;
    expect(await request(handler, "resume-none", "resume", null)).toEqual({
      contract: PRACTICE_BRIDGE_CONTRACT,
      requestId: "resume-none",
      ok: true,
      payload: null
    });
  });

  it.each([
    ["blank alias", "begin", { teamAlias: " ", operationId: "operation-1" }],
    ["unsafe operation", "begin", { teamAlias: "Neon Narwhals", operationId: "bad operation" }],
    ["extra field", "resume", { unexpected: true }],
    ["same-stage advance", "advance", {
      checkpoint: {
        runId: "run-1", documentId: "document-1", documentRevision: 0,
        sequence: 0, stage: "invent"
      },
      nextStage: "invent",
      operationId: "operation-1"
    }]
  ])("rejects %s before invoking the handler", async (_label, method, payload) => {
    const handler = new HandlerHarness();
    expect(await request(handler, "invalid", method, payload)).toMatchObject({
      ok: false,
      error: { code: "INVALID_REQUEST" }
    });
    expect(handler.calls).toHaveLength(0);
  });

  it("rejects unsupported contracts and invalid handler recovery", async () => {
    const handler = new HandlerHarness();
    const api = createPracticePublicApi(handler);
    const unsupported = JSON.parse(await api.handle(JSON.stringify({
      contract: "practice-run@999",
      requestId: "wrong-contract",
      method: "resume",
      payload: null
    }))) as Record<string, unknown>;
    expect(unsupported).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_CONTRACT" }
    });

    handler.current = recovery({ documentHash: "not-a-hash" });
    expect(await request(handler, "bad-recovery", "resume", null)).toMatchObject({
      ok: false,
      error: { code: "HANDLER_ERROR" }
    });
  });
});
