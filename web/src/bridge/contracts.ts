import { z } from "zod";
import {
  CampaignDocumentSchema,
  type CampaignDocumentV1
} from "../domain/campaign-document";
import type { PublishedCampaign } from "../export/campaign-exporter";

export const CREATOR_BRIDGE_CONTRACT = "creator-bridge@1" as const;

export const CreatorMethodSchema = z.enum([
  "open",
  "getState",
  "save",
  "publish",
  "close"
]);

export type CreatorMethod = z.infer<typeof CreatorMethodSchema>;

export interface CreatorRequest {
  contract: typeof CREATOR_BRIDGE_CONTRACT;
  requestId: string;
  method: CreatorMethod;
  payload: unknown;
}

const requestBase = {
  contract: z.literal(CREATOR_BRIDGE_CONTRACT),
  requestId: z.string().min(1).max(128)
};

export const CreatorRequestSchema = z.discriminatedUnion("method", [
  z.strictObject({
    ...requestBase,
    method: z.literal("open"),
    payload: CampaignDocumentSchema
  }),
  z.strictObject({
    ...requestBase,
    method: z.literal("getState"),
    payload: z.null()
  }),
  z.strictObject({
    ...requestBase,
    method: z.literal("save"),
    payload: z.null()
  }),
  z.strictObject({
    ...requestBase,
    method: z.literal("publish"),
    payload: z.null()
  }),
  z.strictObject({
    ...requestBase,
    method: z.literal("close"),
    payload: z.null()
  })
]);

export interface CreatorResponse {
  contract: typeof CREATOR_BRIDGE_CONTRACT;
  requestId: string;
  ok: boolean;
  payload?: unknown | undefined;
  error?: { code: string; message: string } | undefined;
}

export const CreatorResponseSchema: z.ZodType<CreatorResponse> = z.strictObject({
  contract: z.literal(CREATOR_BRIDGE_CONTRACT),
  requestId: z.string(),
  ok: z.boolean(),
  payload: z.unknown().optional(),
  error: z.strictObject({
    code: z.string().min(1),
    message: z.string()
  }).optional()
}).superRefine((response, context) => {
  if (response.ok && response.error !== undefined) {
    context.addIssue({ code: "custom", path: ["error"], message: "Success responses cannot contain an error" });
  }
  if (!response.ok && response.error === undefined) {
    context.addIssue({ code: "custom", path: ["error"], message: "Error responses require an error" });
  }
  if (!response.ok && response.payload !== undefined) {
    context.addIssue({ code: "custom", path: ["payload"], message: "Error responses cannot contain a payload" });
  }
});

type MaybePromise<T> = T | Promise<T>;

/** Runtime operations injected behind the one public JSON boundary. */
export interface CreatorBridgeHandler {
  open(document: CampaignDocumentV1): MaybePromise<void>;
  getState(): MaybePromise<CampaignDocumentV1>;
  save(): MaybePromise<void>;
  publish(): MaybePromise<PublishedCampaign>;
  close(): MaybePromise<void>;
}

export interface PublishedCampaignJson {
  contract: PublishedCampaign["contract"];
  documentId: string;
  revision: number;
  pngBase64: string;
  metadata: PublishedCampaign["metadata"];
}
