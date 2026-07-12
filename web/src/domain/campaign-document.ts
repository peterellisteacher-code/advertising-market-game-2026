import { z } from "zod";
import { CREATOR_CONFIG } from "../config";
import { ELEMENT_KINDS } from "./editor-object";

const slotMap = z.object({
  price: z.array(z.string()),
  attention: z.array(z.string()),
  interest: z.array(z.string()),
  desire: z.array(z.string()),
  action: z.array(z.string())
});

const fabricObjectState = z.object({
  objectId: z.string().min(1),
  elementKind: z.enum(ELEMENT_KINDS),
  assetId: z.string().min(1).optional(),
  sourceHash: z.string().min(1).optional(),
  accessibleName: z.string().min(1)
}).passthrough();

const fabricState = z.object({
  version: z.string().min(1),
  objects: z.array(fabricObjectState)
}).passthrough();

export const CampaignDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  editorVersion: z.string().min(1),
  documentId: z.string().min(1),
  sessionId: z.string().min(1),
  mode: z.enum(["offline", "room"]),
  roomId: z.string().min(1).optional(),
  teamId: z.string().min(1).optional(),
  revision: z.number().int().nonnegative(),
  canvas: z.object({
    width: z.literal(CREATOR_CONFIG.canvasWidth),
    height: z.literal(CREATOR_CONFIG.canvasHeight),
    background: z.string()
  }),
  fabricState,
  drawingLayers: z.array(z.record(z.string(), z.unknown())),
  product: z.object({
    name: z.string().max(48),
    priceCents: z.number().int().nonnegative().nullable()
  }),
  brief: z.object({
    targetAudienceId: z.string(),
    contextId: z.string(),
    purpose: z.literal("persuade"),
    audienceNeeds: z.array(z.string()),
    audienceValues: z.array(z.string()),
    intendedEffects: z.array(z.string()),
    techniques: z.array(z.string())
  }),
  evidence: slotMap,
  assetReferences: z.array(z.record(z.string(), z.unknown())),
  updatedAt: z.string()
}).superRefine((document, context) => {
  if (document.mode === "room" && (!document.roomId || !document.teamId)) {
    context.addIssue({
      code: "custom",
      path: ["mode"],
      message: "Room mode requires roomId and teamId"
    });
  }
});

export type CampaignDocumentV1 = z.infer<typeof CampaignDocumentSchema>;

export function createBlankCampaignDocument(ids: {
  documentId: string;
  sessionId: string;
  mode: "offline" | "room";
  roomId?: string;
  teamId?: string;
}): CampaignDocumentV1 {
  return CampaignDocumentSchema.parse({
    schemaVersion: 1,
    editorVersion: CREATOR_CONFIG.editorVersion,
    ...ids,
    revision: 0,
    canvas: {
      width: CREATOR_CONFIG.canvasWidth,
      height: CREATOR_CONFIG.canvasHeight,
      background: "#ffffff"
    },
    fabricState: { version: "7.4.0", objects: [] },
    drawingLayers: [],
    product: { name: "", priceCents: null },
    brief: {
      targetAudienceId: "",
      contextId: "",
      purpose: "persuade",
      audienceNeeds: [],
      audienceValues: [],
      intendedEffects: [],
      techniques: []
    },
    evidence: {
      price: [],
      attention: [],
      interest: [],
      desire: [],
      action: []
    },
    assetReferences: [],
    updatedAt: new Date(0).toISOString()
  });
}

export function parseCampaignDocument(value: unknown): CampaignDocumentV1 {
  return CampaignDocumentSchema.parse(value);
}
