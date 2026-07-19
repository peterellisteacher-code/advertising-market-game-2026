import { z } from "zod";

export const MARKET_LIMITS = Object.freeze({
  teams: 30,
  defaultTeams: 15,
  campaigns: 30,
  receipts: 900,
  commandReceipts: 512,
  artworkUploadsPerTeam: 4,
  artworkBytesPerUpload: 4 * 1_024 * 1_024,
  artworkBytesPerTeam: 16 * 1_024 * 1_024,
  aliasLength: 32,
  productNameLength: 80,
  taglineLength: 160,
  reviewNoteLength: 240,
  artworkKeyLength: 256,
  canonicalPayloadLength: 256,
  maxPrice: 1_000_000_000_000,
  maxWallet: 1_000_000,
  latestTimestamp: 4_102_444_800
});

const noControlCharacters = (value: string): boolean =>
  !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value);

const boundedText = (maximum: number) => z.string()
  .min(1)
  .max(maximum)
  .refine((value) => value === value.trim() && noControlCharacters(value));

export const MarketIdSchema = z.string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);

export const AliasSchema = z.string()
  .min(2)
  .max(MARKET_LIMITS.aliasLength)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} &'().+\-]*$/u)
  .refine(noControlCharacters);

export const AliasInputSchema = z.string()
  .min(2)
  .max(MARKET_LIMITS.aliasLength + 16)
  .refine(noControlCharacters)
  .transform((value) => value.trim().replace(/\p{Zs}+/gu, " "))
  .pipe(AliasSchema);

export const TimestampSchema = z.number()
  .int()
  .min(1)
  .max(MARKET_LIMITS.latestTimestamp);

export const RevisionSchema = z.number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);

export const PriceSchema = z.number()
  .int()
  .min(1)
  .max(MARKET_LIMITS.maxPrice);

export const WalletSchema = z.number()
  .int()
  .min(1)
  .max(MARKET_LIMITS.maxWallet);

export const MaxTeamsSchema = z.number().int().min(3).max(MARKET_LIMITS.teams);

export const ContentHashSchema = z.string().regex(/^[0-9a-f]{64}$/u);
export const ArtworkKeySchema = z.string()
  .min(1)
  .max(MARKET_LIMITS.artworkKeyLength)
  .regex(/^rooms\/[0-9a-f]{64}\/artwork\/[0-9a-f]{64}\/[0-9a-f]{64}\.png$/u);

export const RoomPhaseSchema = z.enum(["building", "market", "reveal", "closed"]);
export const CampaignStatusSchema = z.enum(["pending", "approved", "returned", "hidden"]);

export const TeamSchema = z.object({
  id: MarketIdSchema,
  alias: AliasSchema,
  joinedAt: TimestampSchema
}).strict();

export const CampaignV1Schema = z.object({
  id: MarketIdSchema,
  sellerTeamId: MarketIdSchema,
  status: CampaignStatusSchema,
  productName: boundedText(MARKET_LIMITS.productNameLength),
  tagline: boundedText(MARKET_LIMITS.taglineLength).optional(),
  price: PriceSchema,
  artworkKey: ArtworkKeySchema,
  submittedAt: TimestampSchema,
  reviewedAt: TimestampSchema.optional(),
  reviewNote: boundedText(MARKET_LIMITS.reviewNoteLength).optional()
}).strict().superRefine((campaign, context) => {
  if (campaign.status === "pending" && campaign.reviewedAt !== undefined) {
    context.addIssue({ code: "custom", message: "Pending campaigns cannot be reviewed" });
  }
  if (campaign.status !== "pending" && campaign.reviewedAt === undefined) {
    context.addIssue({ code: "custom", message: "Reviewed campaigns require reviewedAt" });
  }
});

export const CampaignSchema = z.object({
  id: MarketIdSchema,
  sellerTeamId: MarketIdSchema,
  submissionVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  status: CampaignStatusSchema,
  productName: boundedText(MARKET_LIMITS.productNameLength),
  tagline: boundedText(MARKET_LIMITS.taglineLength).optional(),
  price: PriceSchema,
  artworkKey: ArtworkKeySchema,
  submittedAt: TimestampSchema,
  reviewedAt: TimestampSchema.optional(),
  reviewNote: boundedText(MARKET_LIMITS.reviewNoteLength).optional()
}).strict().superRefine((campaign, context) => {
  if (campaign.status === "pending" && campaign.reviewedAt !== undefined) {
    context.addIssue({ code: "custom", message: "Pending campaigns cannot be reviewed" });
  }
  if (campaign.status !== "pending" && campaign.reviewedAt === undefined) {
    context.addIssue({ code: "custom", message: "Reviewed campaigns require reviewedAt" });
  }
});

export const ReceiptSchema = z.object({
  id: MarketIdSchema,
  buyerTeamId: MarketIdSchema,
  sellerTeamId: MarketIdSchema,
  campaignId: MarketIdSchema,
  price: PriceSchema,
  requestId: MarketIdSchema,
  canonicalPayload: z.string()
    .min(1)
    .max(MARKET_LIMITS.canonicalPayloadLength)
    .refine(noControlCharacters),
  purchasedAt: TimestampSchema
}).strict();

export const ArtworkUploadSchema = z.object({
  contentHash: ContentHashSchema,
  artworkKey: ArtworkKeySchema,
  byteLength: z.number().int().min(1).max(MARKET_LIMITS.artworkBytesPerUpload),
  registeredAt: TimestampSchema
}).strict();

const TeamRecordSchema = z.record(MarketIdSchema, TeamSchema);
const CampaignV1RecordSchema = z.record(MarketIdSchema, CampaignV1Schema);
const CampaignRecordSchema = z.record(MarketIdSchema, CampaignSchema);
const ReceiptRecordSchema = z.record(MarketIdSchema, ReceiptSchema);
const FinishedRecordSchema = z.record(MarketIdSchema, TimestampSchema);
const ArtworkUploadRecordSchema = z.record(ContentHashSchema, ArtworkUploadSchema);
const ArtworkUploadsByTeamSchema = z.record(MarketIdSchema, ArtworkUploadRecordSchema);

export const canonicalPurchasePayload = (campaignId: string): string =>
  `purchase:v1:${JSON.stringify({ campaignId })}`;

export const canonicalPublishCommandPayload = (input: {
  readonly campaignId: string;
  readonly sellerTeamId: string;
  readonly productName: string;
  readonly tagline?: string | undefined;
  readonly price: number;
  readonly artworkKey: string;
}): string => `publish:v1:${JSON.stringify({
  campaignId: input.campaignId,
  sellerTeamId: input.sellerTeamId,
  productName: input.productName,
  tagline: input.tagline ?? null,
  price: input.price,
  artworkKey: input.artworkKey
})}`;

export const canonicalFinishCommandPayload = (teamId: string): string =>
  `finish:v1:${JSON.stringify({ teamId })}`;

export const canonicalReviewCommandPayload = (input: {
  readonly campaignId: string;
  readonly submissionVersion: number;
  readonly status: "approved" | "returned" | "hidden";
  readonly reviewNote?: string | undefined;
}): string => `review:v1:${JSON.stringify({
  campaignId: input.campaignId,
  submissionVersion: input.submissionVersion,
  status: input.status,
  reviewNote: input.reviewNote ?? null
})}`;

export const canonicalControlCommandPayload = (
  action: "openMarket" | "openReveal" | "closeMarket"
): string => `${action}:v1:${JSON.stringify({ action })}`;

export const canonicalRemoveTeamCommandPayload = (teamId: string): string =>
  `removeTeam:v1:${JSON.stringify({ teamId })}`;

export const MarketCohortSchema = z.object({
  buyerTeamIds: z.array(MarketIdSchema).max(MARKET_LIMITS.teams),
  sellerTeamIds: z.array(MarketIdSchema).max(MARKET_LIMITS.teams),
  campaignIds: z.array(MarketIdSchema).max(MARKET_LIMITS.campaigns)
}).strict().superRefine((cohort, context) => {
  for (const key of ["buyerTeamIds", "sellerTeamIds", "campaignIds"] as const) {
    const values = cohort[key];
    const sorted = [...values].sort((left, right) => left.localeCompare(right, "en-AU"));
    if (new Set(values).size !== values.length || values.some((value, index) => value !== sorted[index])) {
      context.addIssue({ code: "custom", path: [key], message: "Cohort ids must be sorted and unique" });
    }
  }
});

export const CommandOperationSchema = z.enum([
  "publish",
  "finish",
  "review",
  "openMarket",
  "openReveal",
  "closeMarket",
  "removeTeam"
]);

export const CommandPostconditionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("publish"),
    campaignId: MarketIdSchema,
    submissionVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
  }).strict(),
  z.object({ kind: z.literal("finish"), finishedAt: TimestampSchema }).strict(),
  z.object({
    kind: z.literal("review"),
    campaignId: MarketIdSchema,
    submissionVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    status: z.enum(["approved", "returned", "hidden"])
  }).strict(),
  z.object({
    kind: z.literal("control"),
    action: z.enum(["openMarket", "openReveal", "closeMarket"])
  }).strict(),
  z.object({ kind: z.literal("removeTeam"), teamId: MarketIdSchema }).strict()
]);

export const CommandReceiptSchema = z.object({
  operation: CommandOperationSchema,
  payloadHash: ContentHashSchema,
  committedAt: TimestampSchema,
  committedRevision: RevisionSchema,
  postcondition: CommandPostconditionSchema
}).strict().superRefine((receipt, context) => {
  const valid =
    (receipt.operation === "publish" && receipt.postcondition.kind === "publish") ||
    (receipt.operation === "finish" && receipt.postcondition.kind === "finish") ||
    (receipt.operation === "review" && receipt.postcondition.kind === "review") ||
    (receipt.operation === "removeTeam" && receipt.postcondition.kind === "removeTeam") ||
    (receipt.postcondition.kind === "control" && receipt.operation === receipt.postcondition.action);
  if (!valid) context.addIssue({ code: "custom", path: ["postcondition"], message: "Postcondition differs from operation" });
});

export const CommandActorSchema = z.string().refine((value) =>
  value === "teacher" || (value.startsWith("team:") && MarketIdSchema.safeParse(value.slice(5)).success));
const CommandReceiptRecordSchema = z.record(MarketIdSchema, CommandReceiptSchema);
const CommandReceiptsByActorSchema = z.record(CommandActorSchema, CommandReceiptRecordSchema);

const SessionBindingSchema = z.object({
  intentKey: ContentHashSchema,
  payloadHash: ContentHashSchema
}).strict();
const JoinSessionBindingSchema = z.object({
  teamId: MarketIdSchema,
  payloadHash: ContentHashSchema
}).strict();
export const SessionBindingsSchema = z.object({
  createdBy: SessionBindingSchema.nullable(),
  joins: z.record(ContentHashSchema, JoinSessionBindingSchema)
}).strict();

const MarketRoomV1ObjectSchema = z.object({
  schemaVersion: z.literal(1),
  id: MarketIdSchema,
  revision: RevisionSchema,
  phase: RoomPhaseSchema,
  openingWallet: WalletSchema,
  maxTeams: MaxTeamsSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  teams: TeamRecordSchema,
  campaigns: CampaignV1RecordSchema,
  receipts: ReceiptRecordSchema,
  finishedAtByTeamId: FinishedRecordSchema,
  artworkUploadsByTeam: ArtworkUploadsByTeamSchema
}).strict();

const MarketRoomV2ObjectSchema = z.object({
  schemaVersion: z.literal(2),
  id: MarketIdSchema,
  revision: RevisionSchema,
  phase: RoomPhaseSchema,
  openingWallet: WalletSchema,
  maxTeams: MaxTeamsSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  teams: TeamRecordSchema,
  campaigns: CampaignRecordSchema,
  receipts: ReceiptRecordSchema,
  finishedAtByTeamId: FinishedRecordSchema,
  artworkUploadsByTeam: ArtworkUploadsByTeamSchema,
  marketCohort: MarketCohortSchema.nullable(),
  commandReceipts: CommandReceiptsByActorSchema,
  sessionBindings: SessionBindingsSchema
}).strict();

type ValidatedMarketRoom =
  | z.infer<typeof MarketRoomV1ObjectSchema>
  | z.infer<typeof MarketRoomV2ObjectSchema>;

function validateMarketRoomRelations(room: ValidatedMarketRoom, context: z.RefinementCtx): void {
  const teamEntries = Object.entries(room.teams);
  const campaignEntries = Object.entries(room.campaigns);
  const receiptEntries = Object.entries(room.receipts);
  const finishedEntries = Object.entries(room.finishedAtByTeamId);
  const uploadTeamEntries = Object.entries(room.artworkUploadsByTeam);

  if (teamEntries.length > MARKET_LIMITS.teams) {
    context.addIssue({ code: "custom", path: ["teams"], message: "Too many teams" });
  }
  if (teamEntries.length > room.maxTeams) {
    context.addIssue({ code: "custom", path: ["teams"], message: "Room seat limit exceeded" });
  }
  if (campaignEntries.length > MARKET_LIMITS.campaigns) {
    context.addIssue({ code: "custom", path: ["campaigns"], message: "Too many campaigns" });
  }
  if (receiptEntries.length > MARKET_LIMITS.receipts) {
    context.addIssue({ code: "custom", path: ["receipts"], message: "Too many receipts" });
  }
  if (finishedEntries.length > MARKET_LIMITS.teams) {
    context.addIssue({ code: "custom", path: ["finishedAtByTeamId"], message: "Too many finishes" });
  }
  if (room.updatedAt < room.createdAt) {
    context.addIssue({ code: "custom", path: ["updatedAt"], message: "updatedAt predates createdAt" });
  }

  const aliases = new Set<string>();
  for (const [key, team] of teamEntries) {
    if (key !== team.id) {
      context.addIssue({ code: "custom", path: ["teams", key], message: "Team key differs from id" });
    }
    const folded = team.alias.toLocaleLowerCase("en-AU");
    if (aliases.has(folded)) {
      context.addIssue({ code: "custom", path: ["teams", key, "alias"], message: "Duplicate alias" });
    }
    aliases.add(folded);
  }

  for (const [key, campaign] of campaignEntries) {
    if (key !== campaign.id) {
      context.addIssue({ code: "custom", path: ["campaigns", key], message: "Campaign key differs from id" });
    }
    if (!room.teams[campaign.sellerTeamId]) {
      context.addIssue({
        code: "custom",
        path: ["campaigns", key, "sellerTeamId"],
        message: "Unknown seller"
      });
    }
    const registered = Object.values(room.artworkUploadsByTeam[campaign.sellerTeamId] ?? {})
      .some((upload) => upload.artworkKey === campaign.artworkKey);
    if (!registered) {
      context.addIssue({
        code: "custom",
        path: ["campaigns", key, "artworkKey"],
        message: "Campaign artwork was not registered"
      });
    }
  }

  for (const [teamId, uploads] of uploadTeamEntries) {
    if (!room.teams[teamId]) {
      context.addIssue({
        code: "custom",
        path: ["artworkUploadsByTeam", teamId],
        message: "Unknown artwork team"
      });
    }
    const entries = Object.entries(uploads);
    if (entries.length > MARKET_LIMITS.artworkUploadsPerTeam) {
      context.addIssue({
        code: "custom",
        path: ["artworkUploadsByTeam", teamId],
        message: "Artwork count exceeded"
      });
    }
    const bytes = entries.reduce((total, [, upload]) => total + upload.byteLength, 0);
    if (bytes > MARKET_LIMITS.artworkBytesPerTeam) {
      context.addIssue({
        code: "custom",
        path: ["artworkUploadsByTeam", teamId],
        message: "Artwork byte budget exceeded"
      });
    }
    for (const [contentHash, upload] of entries) {
      if (contentHash !== upload.contentHash ||
        !upload.artworkKey.endsWith(`/${contentHash}.png`)) {
        context.addIssue({
          code: "custom",
          path: ["artworkUploadsByTeam", teamId, contentHash],
          message: "Artwork hash/key mismatch"
        });
      }
    }
  }

  const buyerCampaigns = new Set<string>();
  const actorRequests = new Set<string>();
  const spentByBuyer = new Map<string, number>();
  for (const [key, receipt] of receiptEntries) {
    if (key !== receipt.id) {
      context.addIssue({ code: "custom", path: ["receipts", key], message: "Receipt key differs from id" });
    }
    const campaign = room.campaigns[receipt.campaignId];
    if (!room.teams[receipt.buyerTeamId] || !room.teams[receipt.sellerTeamId] || !campaign) {
      context.addIssue({ code: "custom", path: ["receipts", key], message: "Unknown receipt relation" });
      continue;
    }
    if (receipt.buyerTeamId === receipt.sellerTeamId ||
      receipt.sellerTeamId !== campaign.sellerTeamId || receipt.price !== campaign.price) {
      context.addIssue({ code: "custom", path: ["receipts", key], message: "Untrusted receipt fields" });
    }
    if (receipt.canonicalPayload !== canonicalPurchasePayload(receipt.campaignId)) {
      context.addIssue({ code: "custom", path: ["receipts", key, "canonicalPayload"], message: "Invalid payload" });
    }
    const buyerCampaign = `${receipt.buyerTeamId}\0${receipt.campaignId}`;
    if (buyerCampaigns.has(buyerCampaign)) {
      context.addIssue({ code: "custom", path: ["receipts", key], message: "Duplicate purchase" });
    }
    buyerCampaigns.add(buyerCampaign);
    const actorRequest = `${receipt.buyerTeamId}\0${receipt.requestId}`;
    if (actorRequests.has(actorRequest)) {
      context.addIssue({ code: "custom", path: ["receipts", key], message: "Duplicate actor request" });
    }
    actorRequests.add(actorRequest);
    spentByBuyer.set(
      receipt.buyerTeamId,
      (spentByBuyer.get(receipt.buyerTeamId) ?? 0) + receipt.price
    );
  }
  for (const [buyerTeamId, spent] of spentByBuyer) {
    if (spent > room.openingWallet) {
      context.addIssue({
        code: "custom",
        path: ["receipts"],
        message: `Buyer ${buyerTeamId} exceeds the opening wallet`
      });
    }
  }

  for (const [teamId] of finishedEntries) {
    if (!room.teams[teamId]) {
      context.addIssue({
        code: "custom",
        path: ["finishedAtByTeamId", teamId],
        message: "Unknown finished team"
      });
    }
  }
}

export const MarketRoomV1Schema = MarketRoomV1ObjectSchema.superRefine(
  validateMarketRoomRelations
);

export const MarketRoomV2Schema = MarketRoomV2ObjectSchema.superRefine((room, context) => {
  validateMarketRoomRelations(room, context);

  if (room.phase === "building" && room.marketCohort !== null) {
    context.addIssue({
      code: "custom",
      path: ["marketCohort"],
      message: "Building rooms cannot have a frozen cohort"
    });
  }
  if (room.phase !== "building" && room.marketCohort === null) {
    context.addIssue({
      code: "custom",
      path: ["marketCohort"],
      message: "Live rooms require a frozen cohort"
    });
  }

  const commandReceiptCount = Object.values(room.commandReceipts)
    .reduce((total, receipts) => total + Object.keys(receipts).length, 0);
  if (commandReceiptCount > MARKET_LIMITS.commandReceipts) {
    context.addIssue({
      code: "custom",
      path: ["commandReceipts"],
      message: "Too many command receipts"
    });
  }

  const joinBindings = Object.entries(room.sessionBindings.joins);
  if (joinBindings.length > MARKET_LIMITS.teams) {
    context.addIssue({ code: "custom", path: ["sessionBindings", "joins"], message: "Too many join bindings" });
  }
  for (const [intentKey, binding] of joinBindings) {
    if (!room.teams[binding.teamId]) {
      context.addIssue({
        code: "custom",
        path: ["sessionBindings", "joins", intentKey, "teamId"],
        message: "Unknown joined team"
      });
    }
  }

  if (room.marketCohort !== null) {
    for (const teamId of room.marketCohort.buyerTeamIds) {
      if (!room.teams[teamId]) {
        context.addIssue({ code: "custom", path: ["marketCohort", "buyerTeamIds"], message: "Unknown buyer" });
      }
    }
    for (const teamId of room.marketCohort.sellerTeamIds) {
      if (!room.teams[teamId]) {
        context.addIssue({ code: "custom", path: ["marketCohort", "sellerTeamIds"], message: "Unknown seller" });
      }
    }
    for (const campaignId of room.marketCohort.campaignIds) {
      const campaign = room.campaigns[campaignId];
      if (!campaign || campaign.status !== "approved" ||
        !room.marketCohort.sellerTeamIds.includes(campaign.sellerTeamId)) {
        context.addIssue({
          code: "custom",
          path: ["marketCohort", "campaignIds"],
          message: "Invalid cohort campaign"
        });
      }
    }
    for (const teamId of Object.keys(room.finishedAtByTeamId)) {
      if (!room.marketCohort.buyerTeamIds.includes(teamId)) {
        context.addIssue({
          code: "custom",
          path: ["finishedAtByTeamId", teamId],
          message: "Only frozen buyers can finish"
        });
      }
    }
    for (const [receiptId, receipt] of Object.entries(room.receipts)) {
      if (!room.marketCohort.buyerTeamIds.includes(receipt.buyerTeamId) ||
        !room.marketCohort.campaignIds.includes(receipt.campaignId)) {
        context.addIssue({
          code: "custom",
          path: ["receipts", receiptId],
          message: "Receipt falls outside the frozen cohort"
        });
      }
    }
  }
});

export const MarketRoomSchema = MarketRoomV2Schema;

export function normalizeMarketRoom(value: unknown): MarketRoomV2 | null {
  const current = MarketRoomV2Schema.safeParse(value);
  if (current.success) return current.data;

  const legacy = MarketRoomV1Schema.safeParse(value);
  if (!legacy.success) return null;

  const campaigns = Object.fromEntries(Object.entries(legacy.data.campaigns).map(([id, campaign]) => [
    id,
    { ...campaign, submissionVersion: 1 }
  ]));
  const approvedCampaigns = Object.values(campaigns)
    .filter((campaign) => campaign.status === "approved")
    .sort((left, right) => left.id.localeCompare(right.id, "en-AU"));
  const marketCohort = legacy.data.phase === "building"
    ? null
    : {
        buyerTeamIds: Object.keys(legacy.data.teams).sort((left, right) => left.localeCompare(right, "en-AU")),
        sellerTeamIds: [...new Set(approvedCampaigns.map((campaign) => campaign.sellerTeamId))]
          .sort((left, right) => left.localeCompare(right, "en-AU")),
        campaignIds: approvedCampaigns.map((campaign) => campaign.id)
      };
  const normalized = MarketRoomV2Schema.safeParse({
    ...legacy.data,
    schemaVersion: 2,
    campaigns,
    marketCohort,
    commandReceipts: {},
    sessionBindings: { createdBy: null, joins: {} }
  });
  return normalized.success ? normalized.data : null;
}

const RevisionMutationSchema = z.object({
  expectedRevision: RevisionSchema,
  now: TimestampSchema
});

const CommandMutationSchema = RevisionMutationSchema.extend({
  commandId: MarketIdSchema
});

export const CreateMarketRoomInputSchema = z.object({
  roomId: MarketIdSchema,
  openingWallet: WalletSchema,
  maxTeams: MaxTeamsSchema.optional(),
  now: TimestampSchema
}).strict();

export const JoinTeamInputSchema = RevisionMutationSchema.extend({
  teamId: MarketIdSchema,
  alias: AliasInputSchema
}).strict();

export const RegisterArtworkUploadInputSchema = RevisionMutationSchema.extend({
  teamId: MarketIdSchema,
  contentHash: ContentHashSchema,
  artworkKey: ArtworkKeySchema,
  byteLength: z.number().int().min(1).max(MARKET_LIMITS.artworkBytesPerUpload)
}).strict();

export const RemoveTeamInputSchema = CommandMutationSchema.extend({
  teamId: MarketIdSchema
}).strict();

export const SubmitCampaignInputSchema = CommandMutationSchema.extend({
  campaignId: MarketIdSchema,
  sellerTeamId: MarketIdSchema,
  productName: boundedText(MARKET_LIMITS.productNameLength),
  tagline: boundedText(MARKET_LIMITS.taglineLength).optional(),
  price: PriceSchema,
  artworkKey: ArtworkKeySchema
}).strict();

export const ReviewCampaignInputSchema = CommandMutationSchema.extend({
  campaignId: MarketIdSchema,
  submissionVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  status: z.enum(["approved", "returned", "hidden"]),
  reviewNote: boundedText(MARKET_LIMITS.reviewNoteLength).optional()
}).strict();

export const OpenMarketInputSchema = CommandMutationSchema.strict();

export const PurchaseInputSchema = RevisionMutationSchema.extend({
  buyerTeamId: MarketIdSchema,
  campaignId: MarketIdSchema,
  requestId: MarketIdSchema,
  receiptId: MarketIdSchema
}).strict();

export const FinishTeamInputSchema = CommandMutationSchema.extend({
  teamId: MarketIdSchema
}).strict();

export const OpenRevealInputSchema = CommandMutationSchema.strict();
export const CloseMarketInputSchema = CommandMutationSchema.strict();

export type Team = z.infer<typeof TeamSchema>;
export type CampaignV1 = z.infer<typeof CampaignV1Schema>;
export type Campaign = z.infer<typeof CampaignSchema>;
export type Receipt = z.infer<typeof ReceiptSchema>;
export type ArtworkUpload = z.infer<typeof ArtworkUploadSchema>;
export type MarketCohort = z.infer<typeof MarketCohortSchema>;
export type CommandOperation = z.infer<typeof CommandOperationSchema>;
export type CommandPostcondition = z.infer<typeof CommandPostconditionSchema>;
export type CommandReceipt = z.infer<typeof CommandReceiptSchema>;
export type SessionBindings = z.infer<typeof SessionBindingsSchema>;
export type MarketRoomV1 = z.infer<typeof MarketRoomV1Schema>;
export type MarketRoomV2 = z.infer<typeof MarketRoomV2Schema>;
export type MarketRoom = MarketRoomV2;
export type CreateMarketRoomInput = z.infer<typeof CreateMarketRoomInputSchema>;
export type JoinTeamInput = z.infer<typeof JoinTeamInputSchema>;
export type RegisterArtworkUploadInput = z.infer<typeof RegisterArtworkUploadInputSchema>;
export type RemoveTeamInput = z.infer<typeof RemoveTeamInputSchema>;
export type SubmitCampaignInput = z.infer<typeof SubmitCampaignInputSchema>;
export type ReviewCampaignInput = z.infer<typeof ReviewCampaignInputSchema>;
export type OpenMarketInput = z.infer<typeof OpenMarketInputSchema>;
export type PurchaseInput = z.infer<typeof PurchaseInputSchema>;
export type FinishTeamInput = z.infer<typeof FinishTeamInputSchema>;
export type OpenRevealInput = z.infer<typeof OpenRevealInputSchema>;
export type CloseMarketInput = z.infer<typeof CloseMarketInputSchema>;
