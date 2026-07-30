export type ProductChoiceKind =
  | "base"
  | "size"
  | "capacity"
  | "material"
  | "finish"
  | "feature"
  | "part";

export interface ProductBlueprintDefinition {
  readonly id: string;
  readonly title: string;
  readonly groupIds: readonly string[];
}

export interface ProductChoiceGroupDefinition {
  readonly id: string;
  readonly label: string;
  readonly kind: ProductChoiceKind;
  readonly mode: "one" | "many";
  readonly minSelections: number;
  readonly maxSelections: number;
  readonly choiceIds: readonly string[];
}

export interface ProductChoiceDefinition {
  readonly id: string;
  readonly groupId: string;
  readonly label: string;
  readonly costCents: number;
  readonly compatibleBlueprintIds: readonly string[];
  readonly requiresChoiceIds?: readonly string[];
  readonly excludesChoiceIds?: readonly string[];
}

export interface ProductPricingCatalogue {
  readonly schema: "product-pricing@1";
  readonly packId: string;
  readonly pricingVersion: number;
  readonly blueprints: readonly ProductBlueprintDefinition[];
  readonly groups: readonly ProductChoiceGroupDefinition[];
  readonly choices: readonly ProductChoiceDefinition[];
}

export interface ProductGroupSelection {
  readonly groupId: string;
  readonly choiceIds: readonly string[];
}

export interface ProductBuildSelection {
  readonly blueprintId: string;
  readonly selections: readonly ProductGroupSelection[];
}

export interface ProductCostLine {
  readonly groupId: string;
  readonly groupLabel: string;
  readonly kind: ProductChoiceKind;
  readonly choiceId: string;
  readonly label: string;
  readonly costCents: number;
}

export interface ProductSuggestedPrice {
  readonly minimumCents: number;
  readonly maximumCents: number;
}

export interface ProductBuildQuote {
  readonly packId: string;
  readonly pricingVersion: number;
  readonly blueprintId: string;
  readonly blueprintTitle: string;
  readonly selections: readonly ProductGroupSelection[];
  readonly costLines: readonly ProductCostLine[];
  readonly unitCostCents: number;
  readonly suggestedPrice: ProductSuggestedPrice;
}

export interface ProductBuildSnapshot {
  readonly schema: "product-build@1";
  readonly primaryObjectId: string;
  readonly packId: string;
  readonly pricingVersion: number;
  readonly blueprintId: string;
  readonly selections: readonly ProductGroupSelection[];
  readonly costLines: readonly ProductCostLine[];
  readonly unitCostCents: number;
}

export interface ProductMargin {
  readonly priceCents: number;
  readonly unitCostCents: number;
  readonly marginCents: number;
}

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CHOICE_KINDS: readonly ProductChoiceKind[] = [
  "base", "size", "capacity", "material", "finish", "feature", "part"
];

const unique = (values: readonly string[]): boolean => new Set(values).size === values.length;
const validId = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 100 && ID_PATTERN.test(value);
const validLabel = (value: unknown): value is string =>
  typeof value === "string" && value === value.trim() && value.length > 0 && value.length <= 80;
const validCount = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 32;
const validCost = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

interface CatalogueIndex {
  readonly blueprintById: ReadonlyMap<string, ProductBlueprintDefinition>;
  readonly groupById: ReadonlyMap<string, ProductChoiceGroupDefinition>;
  readonly choiceById: ReadonlyMap<string, ProductChoiceDefinition>;
}

function catalogueIndex(catalogue: ProductPricingCatalogue): CatalogueIndex | null {
  if (catalogue.schema !== "product-pricing@1" || !validId(catalogue.packId) ||
    !Number.isInteger(catalogue.pricingVersion) || catalogue.pricingVersion < 1 ||
    catalogue.pricingVersion > 1_000_000 || !Array.isArray(catalogue.blueprints) ||
    !Array.isArray(catalogue.groups) || !Array.isArray(catalogue.choices) ||
    catalogue.blueprints.length < 1 || catalogue.groups.length < 1 || catalogue.choices.length < 1) {
    return null;
  }
  const blueprintIds = catalogue.blueprints.map(({ id }) => id);
  const groupIds = catalogue.groups.map(({ id }) => id);
  const choiceIds = catalogue.choices.map(({ id }) => id);
  if (!blueprintIds.every(validId) || !groupIds.every(validId) || !choiceIds.every(validId) ||
    !unique(blueprintIds) || !unique(groupIds) || !unique(choiceIds)) return null;

  const blueprintById = new Map(catalogue.blueprints.map((item) => [item.id, item]));
  const groupById = new Map(catalogue.groups.map((item) => [item.id, item]));
  const choiceById = new Map(catalogue.choices.map((item) => [item.id, item]));

  for (const blueprint of catalogue.blueprints) {
    if (!validLabel(blueprint.title) || !Array.isArray(blueprint.groupIds) ||
      blueprint.groupIds.length < 1 || !blueprint.groupIds.every(validId) ||
      !unique(blueprint.groupIds) || blueprint.groupIds.some((id: string) => !groupById.has(id))) return null;
    const baseGroups = blueprint.groupIds.filter((id: string) => groupById.get(id)?.kind === "base");
    if (baseGroups.length !== 1) return null;
  }

  for (const group of catalogue.groups) {
    if (!validLabel(group.label) || !CHOICE_KINDS.includes(group.kind) ||
      (group.mode !== "one" && group.mode !== "many") || !validCount(group.minSelections) ||
      !validCount(group.maxSelections) || group.minSelections > group.maxSelections ||
      group.maxSelections < 1 || group.mode === "one" && group.maxSelections !== 1 ||
      !Array.isArray(group.choiceIds) || group.choiceIds.length < group.maxSelections ||
      !group.choiceIds.every(validId) || !unique(group.choiceIds)) return null;
    for (const choiceId of group.choiceIds) {
      const choice = choiceById.get(choiceId);
      if (!choice || choice.groupId !== group.id) return null;
    }
  }

  for (const choice of catalogue.choices) {
    if (!validId(choice.groupId) || !groupById.has(choice.groupId) || !validLabel(choice.label) ||
      !validCost(choice.costCents) || !Array.isArray(choice.compatibleBlueprintIds) ||
      choice.compatibleBlueprintIds.length < 1 || !choice.compatibleBlueprintIds.every(validId) ||
      !unique(choice.compatibleBlueprintIds) ||
      choice.compatibleBlueprintIds.some((id: string) => !blueprintById.has(id))) return null;
    for (const relation of [choice.requiresChoiceIds ?? [], choice.excludesChoiceIds ?? []]) {
      if (!Array.isArray(relation) || !relation.every(validId) || !unique(relation) ||
        relation.some((id) => id === choice.id || !choiceById.has(id))) return null;
    }
  }

  return { blueprintById, groupById, choiceById };
}

function roundUpHundred(value: number): number {
  return Math.ceil(value / 100) * 100;
}

export function suggestedPriceForCost(unitCostCents: number): ProductSuggestedPrice | null {
  if (!validCost(unitCostCents)) return null;
  const minimumCents = roundUpHundred(unitCostCents * 1.2);
  const maximumCents = Math.max(minimumCents, roundUpHundred(unitCostCents * 1.8));
  if (!Number.isSafeInteger(minimumCents) || !Number.isSafeInteger(maximumCents)) return null;
  return Object.freeze({ minimumCents, maximumCents });
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): Readonly<T> {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

export function quoteProductBuild(
  catalogue: ProductPricingCatalogue,
  selection: ProductBuildSelection
): ProductBuildQuote | null {
  const index = catalogueIndex(catalogue);
  const blueprint = index?.blueprintById.get(selection.blueprintId);
  if (!index || !blueprint || !Array.isArray(selection.selections) ||
    selection.selections.length !== blueprint.groupIds.length) return null;

  const byGroup = new Map<string, readonly string[]>();
  for (const selectedGroup of selection.selections) {
    if (!selectedGroup || !validId(selectedGroup.groupId) ||
      byGroup.has(selectedGroup.groupId) || !Array.isArray(selectedGroup.choiceIds) ||
      !selectedGroup.choiceIds.every(validId) || !unique(selectedGroup.choiceIds)) return null;
    byGroup.set(selectedGroup.groupId, selectedGroup.choiceIds);
  }
  if ([...byGroup.keys()].some((id) => !blueprint.groupIds.includes(id))) return null;

  const normalizedSelections: ProductGroupSelection[] = [];
  const lines: ProductCostLine[] = [];
  const selectedChoiceIds = new Set<string>();
  for (const groupId of blueprint.groupIds) {
    const group = index.groupById.get(groupId);
    const selected = byGroup.get(groupId);
    if (!group || selected === undefined || selected.length < group.minSelections ||
      selected.length > group.maxSelections || group.mode === "one" && selected.length !== 1) return null;
    const selectedSet = new Set(selected);
    const ordered = group.choiceIds.filter((id) => selectedSet.has(id));
    if (ordered.length !== selected.length) return null;
    for (const choiceId of ordered) {
      const choice = index.choiceById.get(choiceId);
      if (!choice || choice.groupId !== group.id ||
        !choice.compatibleBlueprintIds.includes(blueprint.id) || selectedChoiceIds.has(choiceId)) return null;
      selectedChoiceIds.add(choiceId);
      lines.push({
        groupId: group.id,
        groupLabel: group.label,
        kind: group.kind,
        choiceId: choice.id,
        label: choice.label,
        costCents: choice.costCents
      });
    }
    normalizedSelections.push({ groupId, choiceIds: ordered });
  }

  for (const line of lines) {
    const choice = index.choiceById.get(line.choiceId)!;
    if ((choice.requiresChoiceIds ?? []).some((id) => !selectedChoiceIds.has(id)) ||
      (choice.excludesChoiceIds ?? []).some((id) => selectedChoiceIds.has(id))) return null;
  }

  const unitCostCents = lines.reduce((total, line) => total + line.costCents, 0);
  if (!validCost(unitCostCents)) return null;
  const priceRange = suggestedPriceForCost(unitCostCents);
  if (!priceRange) return null;
  return deepFreeze({
    packId: catalogue.packId,
    pricingVersion: catalogue.pricingVersion,
    blueprintId: blueprint.id,
    blueprintTitle: blueprint.title,
    selections: normalizedSelections,
    costLines: lines,
    unitCostCents,
    suggestedPrice: priceRange
  }) as ProductBuildQuote;
}

export function createProductBuildSnapshot(
  quote: ProductBuildQuote,
  primaryObjectId: string
): ProductBuildSnapshot {
  if (typeof primaryObjectId !== "string" || primaryObjectId !== primaryObjectId.trim() ||
    primaryObjectId.length < 1 || primaryObjectId.length > 128) {
    throw new Error("Primary product object id is invalid");
  }
  return deepFreeze({
    schema: "product-build@1" as const,
    primaryObjectId,
    packId: quote.packId,
    pricingVersion: quote.pricingVersion,
    blueprintId: quote.blueprintId,
    selections: quote.selections.map((selection) => ({
      groupId: selection.groupId,
      choiceIds: [...selection.choiceIds]
    })),
    costLines: quote.costLines.map((line) => ({ ...line })),
    unitCostCents: quote.unitCostCents
  }) as ProductBuildSnapshot;
}

export function marginAtPrice(
  quote: Pick<ProductBuildQuote, "unitCostCents">,
  priceCents: number
): ProductMargin | null {
  if (!Number.isSafeInteger(priceCents) || priceCents < 0 || !validCost(quote.unitCostCents)) {
    return null;
  }
  return Object.freeze({
    priceCents,
    unitCostCents: quote.unitCostCents,
    marginCents: priceCents - quote.unitCostCents
  });
}
