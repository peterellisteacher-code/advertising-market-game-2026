import { z } from "zod";
import {
  CAMPAIGN_GAMEPLAY_STAGES,
  CampaignDocumentSchema,
  type CampaignDocumentV1,
  type CampaignGameplayStage
} from "../domain/campaign-document";
import { PRACTICE_ID_PATTERN } from "../domain/practice-identity";

export const PRACTICE_BRIDGE_CONTRACT = "practice-run@1" as const;
export const LOCAL_PRACTICE_CHECKPOINT_CONTRACT = "local-practice-checkpoint@1" as const;

const safeInteger = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const safeId = z.string().min(1).max(128).regex(PRACTICE_ID_PATTERN);
const operationId = safeId;
const stage = z.enum(CAMPAIGN_GAMEPLAY_STAGES);

export const PracticeCheckpointTokenSchema = z.strictObject({
  runId: safeId,
  documentId: safeId,
  documentRevision: safeInteger,
  sequence: safeInteger,
  stage
});

export type PracticeCheckpointToken = z.infer<typeof PracticeCheckpointTokenSchema>;

export const LocalPracticeCheckpointSchema = z.strictObject({
  contract: z.literal(LOCAL_PRACTICE_CHECKPOINT_CONTRACT),
  runId: safeId,
  documentId: safeId,
  sessionId: safeId,
  teamId: safeId,
  teamAlias: z.string().trim().min(2).max(32),
  documentRevision: safeInteger,
  documentHash: z.string().regex(/^[0-9a-f]{64}$/u),
  stage,
  levelLocked: z.boolean(),
  sequence: safeInteger,
  operationId,
  savedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u)
}).superRefine((checkpoint, context) => {
  if (checkpoint.stage === "publish-check" && checkpoint.levelLocked) {
    context.addIssue({
      code: "custom",
      path: ["levelLocked"],
      message: "Publish check cannot be level-locked"
    });
  }
});

export const LocalPracticeRecoverySchema = z.strictObject({
  checkpoint: LocalPracticeCheckpointSchema,
  document: CampaignDocumentSchema
}).superRefine(({ checkpoint, document }, context) => {
  const mismatches: Array<[string, unknown, unknown]> = [
    ["documentId", document.documentId, checkpoint.documentId],
    ["sessionId", document.sessionId, checkpoint.sessionId],
    ["teamId", document.teamId, checkpoint.teamId],
    ["documentRevision", document.revision, checkpoint.documentRevision],
    ["stage", document.gameplay.stage, checkpoint.stage]
  ];
  if (document.mode !== "offline") {
    context.addIssue({ code: "custom", path: ["document", "mode"], message: "Practice recovery must be offline" });
  }
  for (const [field, actual, expected] of mismatches) {
    if (actual !== expected) {
      context.addIssue({
        code: "custom",
        path: ["document", field],
        message: `Practice recovery ${field} does not match its checkpoint`
      });
    }
  }
});

export type LocalPracticeCheckpointV1 = z.infer<typeof LocalPracticeCheckpointSchema>;
export type LocalPracticeRecoveryV1 = {
  checkpoint: LocalPracticeCheckpointV1;
  document: CampaignDocumentV1;
};

const requestBase = {
  contract: z.literal(PRACTICE_BRIDGE_CONTRACT),
  requestId: z.string().min(1).max(128)
};

const setLockPayload = z.strictObject({
  checkpoint: PracticeCheckpointTokenSchema,
  levelLocked: z.boolean(),
  operationId
});

const advancePayload = z.strictObject({
  checkpoint: PracticeCheckpointTokenSchema,
  nextStage: stage,
  operationId
}).superRefine(({ checkpoint, nextStage }, context) => {
  const currentIndex = CAMPAIGN_GAMEPLAY_STAGES.indexOf(checkpoint.stage);
  if (CAMPAIGN_GAMEPLAY_STAGES[currentIndex + 1] !== nextStage) {
    context.addIssue({
      code: "custom",
      path: ["nextStage"],
      message: "nextStage must be the next pitch stage"
    });
  }
});

export const PracticeRequestSchema = z.discriminatedUnion("method", [
  z.strictObject({ ...requestBase, method: z.literal("resume"), payload: z.null() }),
  z.strictObject({
    ...requestBase,
    method: z.literal("begin"),
    payload: z.strictObject({
      teamAlias: z.string().trim().min(2).max(32),
      operationId
    })
  }),
  z.strictObject({ ...requestBase, method: z.literal("setLock"), payload: setLockPayload }),
  z.strictObject({ ...requestBase, method: z.literal("advance"), payload: advancePayload })
]);

export type PracticeSetLockInput = z.infer<typeof setLockPayload>;
export type PracticeAdvanceInput = z.infer<typeof advancePayload>;

type MaybePromise<T> = T | Promise<T>;

export interface PracticeRunHandler {
  resume(): MaybePromise<LocalPracticeRecoveryV1 | null>;
  begin(teamAlias: string, operationId: string): MaybePromise<LocalPracticeRecoveryV1>;
  setLock(input: PracticeSetLockInput): MaybePromise<LocalPracticeRecoveryV1>;
  advance(input: PracticeAdvanceInput): MaybePromise<LocalPracticeRecoveryV1>;
}

export interface PracticePublicApi {
  handle(requestJson: string): Promise<string>;
}

export function checkpointToken(recovery: LocalPracticeRecoveryV1): PracticeCheckpointToken {
  const checkpoint = recovery.checkpoint;
  return PracticeCheckpointTokenSchema.parse({
    runId: checkpoint.runId,
    documentId: checkpoint.documentId,
    documentRevision: checkpoint.documentRevision,
    sequence: checkpoint.sequence,
    stage: checkpoint.stage
  });
}

export function nextPracticeStage(current: CampaignGameplayStage): CampaignGameplayStage | null {
  const next = CAMPAIGN_GAMEPLAY_STAGES[CAMPAIGN_GAMEPLAY_STAGES.indexOf(current) + 1];
  return next ?? null;
}
