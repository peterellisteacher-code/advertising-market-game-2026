import { z } from "zod";
import {
  PRODUCT_PRICE_POSITIONS,
  parseProductPriceGuide,
  type ProductPriceGuide
} from "../../../shared/product-price-guide-contract";
import { CREATOR_CONFIG } from "../config";
import {
  ADVERTISING_MEDIA,
  MARKET_ZONES,
  PRODUCT_TRAITS
} from "../game/market-route";
import {
  AssignmentPlanSchema,
  WORKSPACE_MODES,
  createBlankAssignmentPlan
} from "../game/assignment-plan";
import { ProductKitCompositionReferenceSchema } from
  "../product-kit/product-kit-document";
import { ELEMENT_KINDS } from "./editor-object";
import { collectCampaignSemanticObjects } from "./campaign-semantic-objects";

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

const moneyCents = z.number().int().nonnegative().refine(Number.isSafeInteger, {
  message: "Money value must be a safe integer"
});

const productPriceGuide = z.unknown().transform((value, context): ProductPriceGuide => {
  try {
    return parseProductPriceGuide(value);
  } catch (error) {
    context.addIssue({
      code: "custom",
      message: error instanceof Error ? error.message : "Product price guide is invalid"
    });
    return z.NEVER;
  }
});

const productPriceLookup = z.object({
  productFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  idempotencyKey: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/)
}).strict();

export const CAMPAIGN_GAMEPLAY_STAGES = Object.freeze([
  "invent",
  "sell",
  "irresistible",
  "publish-check"
] as const);

const pairCounter = z.number().int().min(0).max(1_000_000);

export const CampaignPairStateSchema = z.object({
  activeRole: z.enum(["art-director", "strategist"]),
  handoffCount: pairCounter,
  artDirectorActions: pairCounter,
  strategistActions: pairCounter,
  roleGuideAcknowledged: z.boolean().default(false)
}).strict();

export type CampaignPairStateV1 = z.infer<typeof CampaignPairStateSchema>;
export type CampaignGameplayStage = typeof CAMPAIGN_GAMEPLAY_STAGES[number];

const DEFAULT_PAIR_STATE: CampaignPairStateV1 = Object.freeze({
  activeRole: "art-director",
  handoffCount: 0,
  artDirectorActions: 0,
  strategistActions: 0,
  roleGuideAcknowledged: false
});

const campaignGameplay = z.object({
  stage: z.enum(CAMPAIGN_GAMEPLAY_STAGES),
  pair: CampaignPairStateSchema
}).strict().default({
  stage: "invent",
  pair: DEFAULT_PAIR_STATE
});

const marketZoneIds = new Set(MARKET_ZONES.map(({ id }) => id));
const advertisingMediumIds = new Set(ADVERTISING_MEDIA.map(({ id }) => id));
const productTraitIds = new Set(PRODUCT_TRAITS.map(({ id }) => id));

function uniqueIdArray(label: string, maximum: number) {
  return z.array(z.string().trim().min(1).max(100)).max(maximum)
    .superRefine((ids, context) => {
      if (new Set(ids).size !== ids.length) {
        context.addIssue({
          code: "custom",
          message: `${label} must be unique`
        });
      }
    });
}

const marketRoute = z.object({
  audienceBriefId: z.string().trim().min(1).max(100),
  zoneId: z.string().trim().min(1).max(100).refine(
    (id) => marketZoneIds.has(id as never),
    { message: "Market route zone is unknown" }
  ),
  mediaIds: uniqueIdArray("Market route media", 3).min(1).refine(
    (ids) => ids.every((id) => advertisingMediumIds.has(id as never)),
    { message: "Market route medium is unknown" }
  ),
  proofPoint: z.string().trim().max(240).default(""),
  committed: z.literal(true)
}).strict();

const campaignStrategy = z.object({
  productTraitIds: uniqueIdArray("Product traits", 4).refine(
    (ids) => ids.every((id) => productTraitIds.has(id as never)),
    { message: "Product trait is unknown" }
  ),
  marketedChoiceIds: uniqueIdArray("Marketed product choices", 8),
  marketRoute: marketRoute.nullable(),
  aidaPlan: z.object({
    attention: z.string().max(280),
    interest: z.string().max(280),
    desire: z.string().max(280),
    action: z.string().max(280)
  }).strict()
}).strict().default({
  productTraitIds: [],
  marketedChoiceIds: [],
  marketRoute: null,
  aidaPlan: { attention: "", interest: "", desire: "", action: "" }
});

// Written by the Godot side from its native mission progress when it opens the
// creator or publishes; the web side only displays it (writer's statement).
// Optional on purpose: drafts saved before Phase D stay valid with no migration.
const missionEvidenceEntry = z.object({
  missionId: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(120),
  decisionId: z.string().trim().min(1).max(100),
  effectText: z.string().trim().min(1).max(400)
}).strict();

const missionEvidence = z.array(missionEvidenceEntry).max(24)
  .superRefine((entries, context) => {
    if (new Set(entries.map(({ missionId }) => missionId)).size !== entries.length) {
      context.addIssue({
        code: "custom",
        message: "Mission evidence mission ids must be unique"
      });
    }
  });

export type CampaignMissionEvidenceV1 = z.infer<typeof missionEvidenceEntry>;

const genericAssetReference = z.record(z.string(), z.unknown()).refine(
  (reference) => reference.kind !== "product-kit-composition",
  { message: "Product Kit references must use the strict composition shape" }
);

const assetReference = z.union([
  ProductKitCompositionReferenceSchema,
  genericAssetReference
]).transform((reference): Record<string, unknown> =>
  reference as unknown as Record<string, unknown>
);

const productGroupSelection = z.object({
  groupId: z.string().min(1).max(100),
  choiceIds: z.array(z.string().min(1).max(100)).min(1)
}).strict().superRefine((selection, context) => {
  if (new Set(selection.choiceIds).size !== selection.choiceIds.length) {
    context.addIssue({
      code: "custom",
      path: ["choiceIds"],
      message: "Product build choices must be unique within a group"
    });
  }
});

const productCostLine = z.object({
  groupId: z.string().min(1).max(100),
  groupLabel: z.string().trim().min(1).max(80),
  kind: z.enum(["base", "size", "capacity", "material", "finish", "feature", "part"]),
  choiceId: z.string().min(1).max(100),
  label: z.string().trim().min(1).max(80),
  costCents: moneyCents
}).strict();

export const ProductBuildSnapshotSchema = z.object({
  schema: z.literal("product-build@1"),
  primaryObjectId: z.string().trim().min(1).max(128),
  packId: z.string().min(1).max(100),
  pricingVersion: z.number().int().positive(),
  blueprintId: z.string().min(1).max(100),
  selections: z.array(productGroupSelection).min(1),
  costLines: z.array(productCostLine).min(1),
  unitCostCents: moneyCents
}).strict().superRefine((build, context) => {
  const groupIds = build.selections.map(({ groupId }) => groupId);
  if (new Set(groupIds).size !== groupIds.length) {
    context.addIssue({
      code: "custom",
      path: ["selections"],
      message: "Product build groups must be unique"
    });
  }
  const selectedByChoice = new Map<string, string>();
  for (const selection of build.selections) {
    for (const choiceId of selection.choiceIds) {
      if (selectedByChoice.has(choiceId)) {
        context.addIssue({
          code: "custom",
          path: ["selections"],
          message: "Product build choices must be unique"
        });
      }
      selectedByChoice.set(choiceId, selection.groupId);
    }
  }
  const lineChoiceIds = build.costLines.map(({ choiceId }) => choiceId);
  if (new Set(lineChoiceIds).size !== lineChoiceIds.length ||
    lineChoiceIds.length !== selectedByChoice.size) {
    context.addIssue({
      code: "custom",
      path: ["costLines"],
      message: "Every selected product choice must have exactly one cost line"
    });
  }
  for (const line of build.costLines) {
    if (selectedByChoice.get(line.choiceId) !== line.groupId) {
      context.addIssue({
        code: "custom",
        path: ["costLines"],
        message: "Product cost lines must match their selected groups"
      });
    }
  }
  const total = build.costLines.reduce((sum, line) => sum + line.costCents, 0);
  if (!Number.isSafeInteger(total) || total !== build.unitCostCents) {
    context.addIssue({
      code: "custom",
      path: ["unitCostCents"],
      message: "Product build unit cost must equal its cost lines"
    });
  }
});

export type ProductBuildSnapshotV1 = z.infer<typeof ProductBuildSnapshotSchema>;

export const CampaignDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  editorVersion: z.string().min(1),
  documentId: z.string().min(1),
  sessionId: z.string().min(1),
  mode: z.enum(["offline", "room"]),
  workspaceMode: z.enum(WORKSPACE_MODES).default("guided"),
  assignmentPlan: AssignmentPlanSchema.default(createBlankAssignmentPlan()),
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
    priceCents: moneyCents.nullable(),
    pricePosition: z.enum(PRODUCT_PRICE_POSITIONS).nullable().default(null),
    priceDecisionFingerprint: z.string().regex(/^[0-9a-f]{64}$/).nullable().default(null),
    priceGuide: productPriceGuide.nullable().default(null),
    priceLookup: productPriceLookup.nullable().default(null),
    build: ProductBuildSnapshotSchema.nullable().default(null)
  }).superRefine((product, context) => {
    if (product.priceGuide !== null && product.priceLookup !== null) {
      context.addIssue({
        code: "custom",
        path: ["priceLookup"],
        message: "A completed price guide cannot also be pending"
      });
    }
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
  gameplay: campaignGameplay,
  strategy: campaignStrategy,
  missionEvidence: missionEvidence.optional(),
  evidence: slotMap,
  assetReferences: z.array(assetReference),
  updatedAt: z.string()
}).superRefine((document, context) => {
  if (document.mode === "room" && (!document.roomId || !document.teamId)) {
    context.addIssue({
      code: "custom",
      path: ["mode"],
      message: "Room mode requires roomId and teamId"
    });
  }
  const route = document.strategy.marketRoute;
  if (route !== null && route.audienceBriefId !== document.brief.targetAudienceId) {
    context.addIssue({
      code: "custom",
      path: ["strategy", "marketRoute", "audienceBriefId"],
      message: "Market route audience must match the audience signal"
    });
  }
  if (document.strategy.marketedChoiceIds.length > 0) {
    const selectedChoices = new Set(
      document.product.build?.selections.flatMap(({ choiceIds }) => choiceIds) ?? []
    );
    for (const choiceId of document.strategy.marketedChoiceIds) {
      if (!selectedChoices.has(choiceId)) {
        context.addIssue({
          code: "custom",
          path: ["strategy", "marketedChoiceIds"],
          message: "Marketed product choices must come from the saved product build"
        });
      }
    }
  }
  try {
    collectCampaignSemanticObjects(document.fabricState);
  } catch (error) {
    context.addIssue({
      code: "custom",
      path: ["fabricState", "objects"],
      message: error instanceof Error ? error.message : "Fabric object tree is invalid"
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
    workspaceMode: "guided",
    assignmentPlan: createBlankAssignmentPlan(),
    revision: 0,
    canvas: {
      width: CREATOR_CONFIG.canvasWidth,
      height: CREATOR_CONFIG.canvasHeight,
      background: "#ffffff"
    },
    fabricState: { version: "7.4.0", objects: [] },
    drawingLayers: [],
    product: {
      name: "",
      priceCents: null,
      pricePosition: null,
      priceDecisionFingerprint: null,
      priceGuide: null,
      priceLookup: null,
      build: null
    },
    brief: {
      targetAudienceId: "",
      contextId: "",
      purpose: "persuade",
      audienceNeeds: [],
      audienceValues: [],
      intendedEffects: [],
      techniques: []
    },
    gameplay: {
      stage: "invent",
      pair: structuredClone(DEFAULT_PAIR_STATE)
    },
    strategy: {
      productTraitIds: [],
      marketedChoiceIds: [],
      marketRoute: null,
      aidaPlan: { attention: "", interest: "", desire: "", action: "" }
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
