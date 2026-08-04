import { getAudienceBrief, type AudienceBrief } from "./audience-briefs";

export type MarketZoneId =
  | "neighbourhood"
  | "city"
  | "regional"
  | "national"
  | "global"
  | "destination";

export type AdvertisingMediumId =
  | "billboard"
  | "transit"
  | "storefront"
  | "magazine"
  | "social-feed"
  | "search"
  | "streaming-video"
  | "podcast-audio"
  | "cinema"
  | "event-sponsorship"
  | "direct";

export type ProductTraitId =
  | "value"
  | "premium"
  | "portability"
  | "durability"
  | "visibility"
  | "capacity"
  | "comfort"
  | "sustainability"
  | "novelty"
  | "convenience"
  | "experience-escape"
  | "space-property";

export interface MarketZoneDefinition {
  readonly id: MarketZoneId;
  readonly label: string;
  readonly scale: string;
  readonly geolocation: string;
  readonly clue: string;
}

export interface AdvertisingMediumDefinition {
  readonly id: AdvertisingMediumId;
  readonly label: string;
  readonly placement: string;
  readonly clue: string;
}

export interface ProductTraitDefinition {
  readonly id: ProductTraitId;
  readonly label: string;
  readonly clue: string;
}

function immutableCatalogue<T extends object>(entries: readonly T[]): readonly Readonly<T>[] {
  return Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));
}

export const MARKET_ZONES: readonly MarketZoneDefinition[] = immutableCatalogue([
  {
    id: "neighbourhood",
    label: "Neighbourhood Loop",
    scale: "Nearby streets",
    geolocation: "Juniper Lane and the surrounding blocks",
    clue: "Reaches local residents within nearby streets."
  },
  {
    id: "city",
    label: "City Pulse",
    scale: "One city",
    geolocation: "Harbourlight City",
    clue: "Reaches the population of one city during daily travel, socialising and purchasing."
  },
  {
    id: "regional",
    label: "Regional Run",
    scale: "Several towns",
    geolocation: "The Copper Plains region",
    clue: "Reaches several towns in one region linked by travel and trade."
  },
  {
    id: "national",
    label: "National Stage",
    scale: "Across the country",
    geolocation: "The Republic of Wattle",
    clue: "Reaches audiences across the whole country through one consistent message."
  },
  {
    id: "global",
    label: "Global Launch",
    scale: "Across borders",
    geolocation: "The Meridian world market",
    clue: "Reaches audiences in multiple countries through one consistent message."
  },
  {
    id: "destination",
    label: "Destination Spotlight",
    scale: "One destination",
    geolocation: "Starfall Coast",
      clue: "Uses one location as the advertisement's central subject."
  }
]);

export const ADVERTISING_MEDIA: readonly AdvertisingMediumDefinition[] = immutableCatalogue([
  {
    id: "billboard",
    label: "Billboard",
    placement: "Roadside and skyline panels",
    clue: "One short message on roadside and skyline panels, viewed briefly."
  },
  {
    id: "transit",
    label: "Transit",
    placement: "Buses, trains, shelters and stations",
    clue: "Appears on buses, trains, shelters and stations during daily travel."
  },
  {
    id: "storefront",
    label: "Storefront",
    placement: "Windows, counters and street signs",
    clue: "Reaches people at the point of purchase on windows, counters and street signs."
  },
  {
    id: "magazine",
    label: "Magazine",
    placement: "Print and digital feature pages",
    clue: "Carries detailed content across print and digital feature pages."
  },
  {
    id: "social-feed",
    label: "Social feed",
    placement: "Short posts, stories and creator spots",
    clue: "Short-form content for quick viewing and sharing."
  },
  {
    id: "search",
    label: "Search",
    placement: "Results pages and local listings",
    clue: "Displayed on results pages and local listings when a user searches."
  },
  {
    id: "streaming-video",
    label: "Streaming video",
    placement: "Short video spots around streamed shows",
    clue: "Video with sound and motion around streamed shows."
  },
  {
    id: "podcast-audio",
    label: "Podcast and audio",
    placement: "Host reads, music streams and audio spots",
    clue: "Audio-led content delivered through host reads, music streams and audio spots."
  },
  {
    id: "cinema",
    label: "Cinema",
    placement: "Big-screen spots before a film",
    clue: "Big-screen spots shown before a film screening."
  },
  {
    id: "event-sponsorship",
    label: "Event and sponsorship",
    placement: "Festivals, clubs, matches and pop-ups",
    clue: "Placed at festivals, clubs, matches and pop-ups where audiences gather."
  },
  {
    id: "direct",
    label: "Direct",
    placement: "Email, mail, handouts and messages",
    clue: "Sent to a known audience via email, mail, handouts or messages."
  }
]);

export const PRODUCT_TRAITS: readonly ProductTraitDefinition[] = immutableCatalogue([
  { id: "value", label: "Value", clue: "Signals that the offer matches its price." },
  { id: "premium", label: "Premium", clue: "Special, polished or rare product." },
  { id: "portability", label: "Portability", clue: "Easy to carry or take along." },
  { id: "durability", label: "Durability", clue: "Made to last through repeated use." },
  { id: "visibility", label: "Visibility", clue: "Easy to notice, recognise or show." },
  { id: "capacity", label: "Capacity", clue: "Holds, serves or supports more." },
  { id: "comfort", label: "Comfort", clue: "Improves time or space." },
  { id: "sustainability", label: "Sustainability", clue: "Uses resources with care." },
  { id: "novelty", label: "Novelty", clue: "Offers something new." },
  { id: "convenience", label: "Convenience", clue: "Makes a choice quicker or easier." },
  { id: "experience-escape", label: "Experience and escape", clue: "Provides a change of scene." },
  { id: "space-property", label: "Space and property", clue: "Shapes how a place looks or works." }
]);

export interface MarketRouteInput {
  readonly audienceBriefId: string;
  readonly zoneId: string;
  readonly mediaIds: readonly string[];
  readonly proofPoint?: string;
}

export interface MarketRouteDraft {
  readonly audienceBriefId: string;
  readonly zoneId: MarketZoneId;
  readonly mediaIds: readonly AdvertisingMediumId[];
  readonly proofPoint: string;
  readonly committed: false;
}

export interface CommittedMarketRoute {
  readonly audienceBriefId: string;
  readonly zoneId: MarketZoneId;
  readonly mediaIds: readonly AdvertisingMediumId[];
  readonly proofPoint: string;
  readonly committed: true;
}

function nonBlankId(value: string, name: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${name} must be non-blank`);
  }
  return trimmed;
}

function marketZoneId(value: string): MarketZoneId {
  const id = nonBlankId(value, "zoneId");
  const zone = MARKET_ZONES.find((candidate) => candidate.id === id);
  if (zone === undefined) {
    throw new Error(`Unknown market zone: ${id}`);
  }
  return zone.id;
}

function advertisingMediumId(value: string): AdvertisingMediumId {
  const id = nonBlankId(value, "advertising medium ID");
  const medium = ADVERTISING_MEDIA.find((candidate) => candidate.id === id);
  if (medium === undefined) {
    throw new Error(`Unknown advertising medium: ${id}`);
  }
  return medium.id;
}

export function createMarketRoute(input: MarketRouteInput): MarketRouteDraft {
  const audienceBriefId = nonBlankId(input.audienceBriefId, "audienceBriefId");
  getAudienceBrief(audienceBriefId);
  const proofPoint = (input.proofPoint ?? "").trim();

  if (input.mediaIds.length === 0) {
    throw new Error("Choose at least one advertising medium");
  }

  const seen = new Set<AdvertisingMediumId>();
  const mediaIds = input.mediaIds.map((value) => {
    const id = advertisingMediumId(value);
    if (seen.has(id)) {
      throw new Error(`Duplicate advertising medium: ${id}`);
    }
    seen.add(id);
    return id;
  });
  mediaIds.sort((left, right) => {
    const leftIndex = ADVERTISING_MEDIA.findIndex((medium) => medium.id === left);
    const rightIndex = ADVERTISING_MEDIA.findIndex((medium) => medium.id === right);
    return leftIndex - rightIndex;
  });

  return Object.freeze({
    audienceBriefId,
    zoneId: marketZoneId(input.zoneId),
    mediaIds: Object.freeze(mediaIds),
    proofPoint,
    committed: false
  });
}

export function commitMarketRoute(route: MarketRouteDraft): CommittedMarketRoute {
  const validated = createMarketRoute(route);
  if (validated.proofPoint.length === 0) {
    throw new Error("Market route proof point must be non-blank");
  }
  return Object.freeze({
    audienceBriefId: validated.audienceBriefId,
    zoneId: validated.zoneId,
    mediaIds: Object.freeze([...validated.mediaIds]),
    proofPoint: validated.proofPoint,
    committed: true
  });
}

export interface ProductSignalInput {
  readonly pricePosition: ProductPricePosition;
  readonly traitIds: readonly string[];
}

export interface ProductSignal {
  readonly pricePosition: ProductPricePosition;
  readonly selectedTraitIds: readonly ProductTraitId[];
  readonly effectiveTraitIds: readonly ProductTraitId[];
}

function productTraitId(value: string): ProductTraitId {
  const id = nonBlankId(value, "product trait ID");
  const trait = PRODUCT_TRAITS.find((candidate) => candidate.id === id);
  if (trait === undefined) {
    throw new Error(`Unknown product trait: ${id}`);
  }
  return trait.id;
}

function orderProductTraits(ids: Iterable<ProductTraitId>): ProductTraitId[] {
  const selected = new Set(ids);
  return PRODUCT_TRAITS
    .map((trait) => trait.id)
    .filter((id) => selected.has(id));
}

export function createProductSignal(input: ProductSignalInput): ProductSignal {
  if (input.pricePosition !== "budget" && input.pricePosition !== "everyday" &&
    input.pricePosition !== "premium") {
    throw new Error("pricePosition must be budget, everyday or premium");
  }
  if (input.traitIds.length === 0) {
    throw new Error("Choose at least one product trait");
  }

  const seen = new Set<ProductTraitId>();
  for (const value of input.traitIds) {
    const id = productTraitId(value);
    if (seen.has(id)) {
      throw new Error(`Duplicate product trait: ${id}`);
    }
    seen.add(id);
  }

  const selectedTraitIds = orderProductTraits(seen);
  const effective = new Set(selectedTraitIds);
  if (input.pricePosition === "budget") effective.add("value");
  if (input.pricePosition === "premium") effective.add("premium");

  return Object.freeze({
    pricePosition: input.pricePosition,
    selectedTraitIds: Object.freeze(selectedTraitIds),
    effectiveTraitIds: Object.freeze(orderProductTraits(effective))
  });
}

type RouteFit = "supports" | "stretch";
export type MarketRouteOutcome = "strong" | "promising" | "risky";

export interface MarketRouteEvidence {
  readonly kind: "audience" | "zone" | "media";
  readonly fit: RouteFit;
  readonly reason: string;
}

export interface MarketRouteFeedback {
  readonly outcome: MarketRouteOutcome;
  readonly headline: string;
  readonly evidence: readonly MarketRouteEvidence[];
  readonly nextMove: string;
}

interface FitProfile {
  readonly traitIds: readonly ProductTraitId[];
  readonly audienceValues: readonly string[];
}

function fitProfile(
  traitIds: readonly ProductTraitId[],
  audienceValues: readonly string[]
): FitProfile {
  return Object.freeze({
    traitIds: Object.freeze([...traitIds]),
    audienceValues: Object.freeze(audienceValues.map((value) => value.toLowerCase()))
  });
}

const TRAIT_AUDIENCE_VALUES: Readonly<Record<ProductTraitId, readonly string[]>> = Object.freeze({
  value: Object.freeze(["fairness", "practicality", "accessibility"]),
  premium: Object.freeze(["confidence", "quality", "status"]),
  portability: Object.freeze(["independence", "practicality", "accessibility"]),
  durability: Object.freeze(["practicality", "fairness", "reliability"]),
  visibility: Object.freeze(["belonging", "connection", "confidence"]),
  capacity: Object.freeze(["practicality", "connection", "accessibility"]),
  comfort: Object.freeze(["accessibility", "connection", "belonging"]),
  sustainability: Object.freeze(["fairness", "connection", "responsibility"]),
  novelty: Object.freeze(["independence", "belonging", "curiosity"]),
  convenience: Object.freeze(["independence", "practicality", "accessibility"]),
  "experience-escape": Object.freeze(["belonging", "connection", "independence"]),
  "space-property": Object.freeze(["connection", "comfort", "practicality"])
});

const ZONE_FIT: Readonly<Record<MarketZoneId, FitProfile>> = Object.freeze({
  neighbourhood: fitProfile(
    ["visibility", "convenience", "comfort", "experience-escape", "space-property"],
    ["belonging", "connection", "accessibility", "practicality"]
  ),
  city: fitProfile(
    ["portability", "visibility", "convenience", "novelty", "experience-escape"],
    ["independence", "belonging", "accessibility", "practicality"]
  ),
  regional: fitProfile(
    ["value", "durability", "capacity", "sustainability", "space-property"],
    ["connection", "fairness", "practicality", "accessibility"]
  ),
  national: fitProfile(
    ["value", "premium", "durability", "visibility", "capacity"],
    ["independence", "fairness", "practicality", "belonging"]
  ),
  global: fitProfile(
    ["premium", "visibility", "sustainability", "novelty", "experience-escape"],
    ["independence", "fairness", "connection", "belonging"]
  ),
  destination: fitProfile(
    ["premium", "comfort", "novelty", "experience-escape", "space-property"],
    ["independence", "connection", "belonging", "accessibility"]
  )
});

const MEDIA_FIT: Readonly<Record<AdvertisingMediumId, FitProfile>> = Object.freeze({
  billboard: fitProfile(
    ["premium", "visibility", "novelty", "space-property"],
    ["belonging", "connection"]
  ),
  transit: fitProfile(
    ["value", "portability", "visibility", "convenience"],
    ["independence", "accessibility", "practicality"]
  ),
  storefront: fitProfile(
    ["visibility", "comfort", "novelty", "convenience"],
    ["connection", "accessibility"]
  ),
  magazine: fitProfile(
    ["premium", "durability", "comfort", "sustainability", "space-property"],
    ["fairness", "practicality"]
  ),
  "social-feed": fitProfile(
    ["portability", "visibility", "novelty", "experience-escape"],
    ["independence", "belonging", "connection"]
  ),
  search: fitProfile(
    ["value", "durability", "capacity", "convenience", "space-property"],
    ["fairness", "practicality"]
  ),
  "streaming-video": fitProfile(
    ["premium", "visibility", "comfort", "novelty", "experience-escape"],
    ["belonging", "connection"]
  ),
  "podcast-audio": fitProfile(
    ["portability", "durability", "convenience", "experience-escape"],
    ["independence", "connection"]
  ),
  cinema: fitProfile(
    ["premium", "visibility", "comfort", "novelty", "experience-escape"],
    ["belonging", "connection"]
  ),
  "event-sponsorship": fitProfile(
    ["visibility", "capacity", "sustainability", "experience-escape"],
    ["belonging", "connection"]
  ),
  direct: fitProfile(
    ["value", "durability", "capacity", "convenience", "space-property"],
    ["fairness", "practicality", "accessibility"]
  )
});

const NEED_TRAIT_CUES = Object.freeze([
  Object.freeze({
    terms: Object.freeze(["simple", "easy"]),
    traitIds: Object.freeze(["value", "convenience"] as const)
  }),
  Object.freeze({
    terms: Object.freeze(["hour", "time", "plans"]),
    traitIds: Object.freeze(["portability", "experience-escape"] as const)
  }),
  Object.freeze({
    terms: Object.freeze(["join", "together"]),
    traitIds: Object.freeze(["comfort", "capacity", "experience-escape"] as const)
  }),
  Object.freeze({
    terms: Object.freeze(["clear", "choice", "suits"]),
    traitIds: Object.freeze(["value", "durability", "visibility", "convenience"] as const)
  })
]);

function audienceDesiredTraits(brief: AudienceBrief): Set<ProductTraitId> {
  const values = new Set(brief.values.map((value) => value.toLowerCase()));
  const desired = new Set<ProductTraitId>();

  for (const trait of PRODUCT_TRAITS) {
    if (TRAIT_AUDIENCE_VALUES[trait.id].some((value) => values.has(value))) {
      desired.add(trait.id);
    }
  }

  const need = brief.need.toLowerCase();
  for (const cue of NEED_TRAIT_CUES) {
    if (cue.terms.some((term) => need.includes(term))) {
      for (const traitId of cue.traitIds) desired.add(traitId);
    }
  }
  return desired;
}

function sharedValues(profile: FitProfile, brief: AudienceBrief): string[] {
  const profileValues = new Set(profile.audienceValues);
  return brief.values.filter((value) => profileValues.has(value.toLowerCase()));
}

function sharedTraits(profile: FitProfile, product: ProductSignal): ProductTraitId[] {
  const profileTraits = new Set(profile.traitIds);
  return product.effectiveTraitIds.filter((traitId) => profileTraits.has(traitId));
}

function traitLabel(id: ProductTraitId): string {
  const trait = PRODUCT_TRAITS.find((candidate) => candidate.id === id);
  if (trait === undefined) throw new Error(`Unknown product trait: ${id}`);
  return trait.label;
}

function formatList(values: readonly string[]): string {
  if (values.length === 0) return "the audience's priorities";
  if (values.length === 1) return values[0]!;
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
}

function immutableEvidence(
  kind: MarketRouteEvidence["kind"],
  fit: RouteFit,
  reason: string
): MarketRouteEvidence {
  return Object.freeze({ kind, fit, reason });
}

export function evaluateCommittedMarketRoute(
  product: ProductSignal,
  route: CommittedMarketRoute
): MarketRouteFeedback {
  if (route.committed !== true) {
    throw new Error("Commit the market route before feedback");
  }

  const validatedProduct = createProductSignal({
    pricePosition: product.pricePosition,
    traitIds: product.selectedTraitIds
  });
  const validatedRoute = commitMarketRoute(createMarketRoute(route));
  const brief = getAudienceBrief(validatedRoute.audienceBriefId);
  const zone = MARKET_ZONES.find((candidate) => candidate.id === validatedRoute.zoneId);
  if (zone === undefined) throw new Error(`Unknown market zone: ${validatedRoute.zoneId}`);
  const media = validatedRoute.mediaIds.map((id) => {
    const medium = ADVERTISING_MEDIA.find((candidate) => candidate.id === id);
    if (medium === undefined) throw new Error(`Unknown advertising medium: ${id}`);
    return medium;
  });

  const desiredTraits = audienceDesiredTraits(brief);
  const audienceTraits = validatedProduct.effectiveTraitIds.filter((id) => desiredTraits.has(id));
  const audienceFit: RouteFit = audienceTraits.length > 0 ? "supports" : "stretch";
  const audienceTraitLabels = formatList(audienceTraits.map(traitLabel));
  const audienceTraitVerb = audienceTraits.length === 1 ? "supports" : "support";
  const audienceReason = audienceFit === "supports"
    ? `${audienceTraitLabels} ${audienceTraitVerb} ${formatList(brief.values)}. It also addresses this need: ${brief.need}`
    : `${formatList(validatedProduct.effectiveTraitIds.map(traitLabel))} are clear, but their link to ${formatList(brief.values)} and the need "${brief.need}" needs a clearer link.`;

  const zoneProfile = ZONE_FIT[validatedRoute.zoneId];
  const zoneValues = sharedValues(zoneProfile, brief);
  const zoneTraits = sharedTraits(zoneProfile, validatedProduct);
  const zoneFit: RouteFit = zoneValues.length > 0 && zoneTraits.length > 0
    ? "supports"
    : "stretch";
  const zoneReason = zoneFit === "supports"
    ? `${zone.label} connects ${formatList(zoneValues)} with ${formatList(zoneTraits.map(traitLabel))} at ${zone.scale.toLowerCase()}.`
    : `${zone.label} exceeds this audience's usual reach. State the reason for this scale.`;

  const matchingMedium = media.find((medium) => {
    const profile = MEDIA_FIT[medium.id];
    return sharedValues(profile, brief).length > 0
      && sharedTraits(profile, validatedProduct).length > 0;
  });
  const mediumLabels = formatList(media.map((medium) => medium.label));
  const mediaFit: RouteFit = matchingMedium === undefined ? "stretch" : "supports";
  const matchingProfile = matchingMedium === undefined ? undefined : MEDIA_FIT[matchingMedium.id];
  const mediaTraits = matchingProfile === undefined
    ? []
    : sharedTraits(matchingProfile, validatedProduct);
  const mediaValues = matchingProfile === undefined
    ? []
    : sharedValues(matchingProfile, brief);
  const mediaReason = mediaFit === "supports"
    ? `${mediumLabels} can show ${formatList(mediaTraits.map(traitLabel))} in a way that matches ${formatList(mediaValues)}.`
    : `${mediumLabels} gives you a clear placement, but the audience connection needs a more direct message.`;

  const evidence = Object.freeze([
    immutableEvidence("audience", audienceFit, audienceReason),
    immutableEvidence("zone", zoneFit, zoneReason),
    immutableEvidence("media", mediaFit, mediaReason)
  ]);
  const supportCount = evidence.filter((item) => item.fit === "supports").length;
  const outcome: MarketRouteOutcome = supportCount === 3
    ? "strong"
    : supportCount === 2
      ? "promising"
      : "risky";
  const headline = outcome === "strong"
    ? "Strong fit"
    : outcome === "promising"
      ? "Possible fit"
      : "Weak fit";

  const firstTrait = traitLabel(validatedProduct.effectiveTraitIds[0]!);
  const firstValue = brief.values[0] ?? "audience values";
  const nextMove = audienceFit === "stretch"
    ? `Continue with ${firstTrait}; show how it answers "${brief.need}" in one statement.`
    : zoneFit === "stretch"
      ? `Use ${zone.label} and connect it to ${firstValue} in the message.`
      : mediaFit === "stretch"
        ? `Use ${media[0]!.label} to show ${firstTrait} in a way that matches ${firstValue}.`
        : `State one proof point: show how ${media[0]!.label} delivers ${firstTrait} for ${firstValue}.`;

  return Object.freeze({ outcome, headline, evidence, nextMove });
}
import type { ProductPricePosition } from "../../../shared/product-price-guide-contract";
