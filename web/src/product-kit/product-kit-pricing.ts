import {
  quoteProductBuild,
  type ProductBuildSelection,
  type ProductChoiceKind,
  type ProductPricingCatalogue
} from "../product-builder/product-economics";
import { snapshotPlainData } from "./plain-data";
import type { ProductKitCatalogue } from "./product-kit-catalogue";

export interface ProductKitPrice {
  readonly priceAssetId: string;
  readonly groupId: string;
  readonly groupLabel: string;
  readonly kind: ProductChoiceKind;
  readonly label: string;
  readonly costCents: number;
}

export interface ProductKitPricingIndex {
  readonly packId: string;
  readonly pricingVersion: number;
  readonly blueprintTitleByKitId: ReadonlyMap<string, string>;
  readonly byPriceAssetId: ReadonlyMap<string, ProductKitPrice>;
}

function frozenReadonlyMap<Key, Value>(
  source: ReadonlyMap<Key, Value>
): ReadonlyMap<Key, Value> {
  let view: ReadonlyMap<Key, Value>;
  view = Object.freeze({
    get size() {
      return source.size;
    },
    get(key: Key) {
      return source.get(key);
    },
    has(key: Key) {
      return source.has(key);
    },
    entries() {
      return source.entries();
    },
    keys() {
      return source.keys();
    },
    values() {
      return source.values();
    },
    forEach(
      callback: (value: Value, key: Key, map: ReadonlyMap<Key, Value>) => void,
      thisArg?: unknown
    ) {
      for (const [key, value] of source) callback.call(thisArg, value, key, view);
    },
    [Symbol.iterator]() {
      return source[Symbol.iterator]();
    }
  });
  return view;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
  value: Readonly<Record<string, unknown>>,
  required: readonly string[],
  optional: readonly string[] = []
): boolean {
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key)) &&
    keys.every((key) => allowed.has(key));
}

function hasStrictPricingShape(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, [
    "schema", "packId", "pricingVersion", "blueprints", "groups", "choices"
  ]) || !Array.isArray(value.blueprints) || !Array.isArray(value.groups) ||
    !Array.isArray(value.choices) || value.blueprints.length === 0 ||
    value.groups.length === 0 || value.choices.length === 0) return false;

  return value.blueprints.every((blueprint) =>
    isRecord(blueprint) && hasExactKeys(blueprint, ["id", "title", "groupIds"])
  ) && value.groups.every((group) =>
    isRecord(group) && hasExactKeys(group, [
      "id", "label", "kind", "mode", "minSelections", "maxSelections", "choiceIds"
    ])
  ) && value.choices.every((choice) =>
    isRecord(choice) && hasExactKeys(choice, [
      "id", "groupId", "label", "costCents", "compatibleBlueprintIds"
    ], ["requiresChoiceIds", "excludesChoiceIds"])
  );
}

function hasExactMembers(
  values: readonly string[],
  expected: ReadonlySet<string>
): boolean {
  return values.length === expected.size && values.every((value) => expected.has(value));
}

function syntheticSelection(
  pricing: ProductPricingCatalogue,
  blueprint: ProductPricingCatalogue["blueprints"][number],
  groupById: ReadonlyMap<string, ProductPricingCatalogue["groups"][number]>
): ProductBuildSelection | null {
  if (!Array.isArray(blueprint.groupIds)) return null;
  const selections = [];
  for (const groupId of blueprint.groupIds) {
    const group = groupById.get(groupId);
    if (!group || !Array.isArray(group.choiceIds) ||
      !Number.isSafeInteger(group.minSelections)) return null;
    const count = group.mode === "one" ? 1 : group.minSelections;
    if (count < 0 || count > group.choiceIds.length) return null;
    selections.push({ groupId, choiceIds: group.choiceIds.slice(0, count) });
  }
  return { blueprintId: blueprint.id, selections };
}

export function parseProductKitPricing(
  value: unknown,
  catalogue: ProductKitCatalogue
): ProductKitPricingIndex | null {
  const snapshot = snapshotPlainData(value, {
    maxDepth: 32,
    maxNodes: 500_000,
    maxArrayLength: 20_000,
    maxObjectProperties: 16,
    maxStringLength: 2_048
  });
  if (!snapshot || !hasStrictPricingShape(snapshot)) return null;

  try {
    const pricing = snapshot as unknown as ProductPricingCatalogue;
    if (pricing.packId !== catalogue.packId) return null;
    const groupById = new Map(pricing.groups.map((group) => [group.id, group]));
    for (const choice of pricing.choices) {
      const group = groupById.get(choice.groupId);
      if (!group || group.choiceIds.filter((id) => id === choice.id).length !== 1) {
        return null;
      }
    }

    for (const blueprint of pricing.blueprints) {
      const selection = syntheticSelection(pricing, blueprint, groupById);
      if (!selection || quoteProductBuild(pricing, selection) === null) return null;
    }

    const blueprintById = new Map(
      pricing.blueprints.map((blueprint) => [blueprint.id, blueprint])
    );
    const choicesById = new Map<string, typeof pricing.choices>();
    for (const choice of pricing.choices) {
      const existing = choicesById.get(choice.id) ?? [];
      choicesById.set(choice.id, [...existing, choice]);
    }

    const expectedRoleByPriceId = new Map<string, "base" | "part">();
    const expectedKitIdsByPriceId = new Map<string, Set<string>>();
    const registerExpectedPrice = (
      priceAssetId: string,
      role: "base" | "part",
      kitId: string
    ): boolean => {
      const existingRole = expectedRoleByPriceId.get(priceAssetId);
      if (existingRole !== undefined && existingRole !== role) return false;
      expectedRoleByPriceId.set(priceAssetId, role);
      const kitIds = expectedKitIdsByPriceId.get(priceAssetId) ?? new Set<string>();
      kitIds.add(kitId);
      expectedKitIdsByPriceId.set(priceAssetId, kitIds);
      return true;
    };

    for (const kit of catalogue.kits) {
      if (!registerExpectedPrice(kit.priceAssetId, "base", kit.id)) return null;
    }
    for (const component of catalogue.components) {
      const kitIds = new Set(catalogue.certifications
        .filter((certification) => certification.componentId === component.id)
        .map((certification) => certification.kitId));
      if (kitIds.size === 0 || [...kitIds].some((kitId) =>
        !registerExpectedPrice(component.priceAssetId, "part", kitId)
      )) return null;
    }

    if (pricing.blueprints.length !== catalogue.kits.length ||
      pricing.choices.length !== expectedRoleByPriceId.size) return null;
    const reachableGroupIds = new Set<string>();
    const expectedGroupIdsByKitId = new Map(
      catalogue.kits.map((kit) => [kit.id, new Set<string>()])
    );
    for (const [priceAssetId, expectedRole] of expectedRoleByPriceId) {
      const choices = choicesById.get(priceAssetId);
      if (!choices || choices.length !== 1) return null;
      const choice = choices[0]!;
      const group = groupById.get(choice.groupId);
      const expectedKitIds = expectedKitIdsByPriceId.get(priceAssetId);
      if (!group || group.kind !== expectedRole || !expectedKitIds ||
        !hasExactMembers(choice.compatibleBlueprintIds, expectedKitIds)) return null;
      reachableGroupIds.add(group.id);
      for (const kitId of expectedKitIds) {
        expectedGroupIdsByKitId.get(kitId)?.add(group.id);
      }
    }
    if (pricing.groups.length !== reachableGroupIds.size ||
      pricing.groups.some((group) => !reachableGroupIds.has(group.id))) return null;
    for (const kit of catalogue.kits) {
      const blueprint = blueprintById.get(kit.id);
      const expectedGroupIds = expectedGroupIdsByKitId.get(kit.id);
      if (!blueprint || blueprint.title !== kit.title || !expectedGroupIds ||
        !hasExactMembers(blueprint.groupIds, expectedGroupIds)) return null;
    }

    const blueprintTitleByKitId = frozenReadonlyMap(new Map(
      pricing.blueprints.map((blueprint) => [blueprint.id, blueprint.title])
    ));
    const byPriceAssetId = new Map<string, ProductKitPrice>();
    for (const choice of pricing.choices) {
      const group = groupById.get(choice.groupId);
      if (!group) return null;
      byPriceAssetId.set(choice.id, Object.freeze({
        priceAssetId: choice.id,
        groupId: group.id,
        groupLabel: group.label,
        kind: group.kind,
        label: choice.label,
        costCents: choice.costCents
      }));
    }

    return Object.freeze({
      packId: pricing.packId,
      pricingVersion: pricing.pricingVersion,
      blueprintTitleByKitId,
      byPriceAssetId: frozenReadonlyMap(byPriceAssetId)
    });
  } catch {
    return null;
  }
}
