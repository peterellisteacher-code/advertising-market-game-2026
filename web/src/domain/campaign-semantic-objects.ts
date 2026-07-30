import {
  ELEMENT_KINDS,
  type ElementKind
} from "./editor-object";

const SEMANTIC_KEYS = [
  "objectId",
  "elementKind",
  "accessibleName",
  "assetId",
  "sourceHash"
] as const;
const ELEMENT_KIND_SET = new Set<string>(ELEMENT_KINDS);
const MAX_FABRIC_OBJECT_DEPTH = 100;
const MAX_FABRIC_OBJECT_NODES = 100_000;

export interface CampaignSemanticObject {
  objectId: string;
  elementKind: ElementKind;
  accessibleName: string;
  assetId?: string;
  sourceHash?: string;
  object: Record<string, unknown>;
  path: readonly number[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pathLabel(path: readonly number[]): string {
  return path.reduce((label, index, depth) =>
    `${label}${depth === 0 ? "" : ".objects"}[${index}]`, "objects");
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

export function collectCampaignSemanticObjects(
  fabricState: unknown
): CampaignSemanticObject[] {
  if (!isRecord(fabricState) || !Array.isArray(fabricState.objects)) {
    throw new Error("Fabric state objects must be an array");
  }
  const collected: CampaignSemanticObject[] = [];
  const seen = new Set<string>();
  const visited = new WeakSet<object>();
  const stack: Array<{ value: unknown; path: readonly number[] }> = [];
  for (let index = fabricState.objects.length - 1; index >= 0; index -= 1) {
    stack.push({ value: fabricState.objects[index], path: [index] });
  }
  let nodes = 0;

  while (stack.length > 0) {
    const { value, path } = stack.pop()!;
    const label = pathLabel(path);
    if (!isRecord(value)) throw new Error(`${label} must be an object`);
    if (path.length > MAX_FABRIC_OBJECT_DEPTH) {
      throw new Error("Fabric object tree exceeds maximum depth");
    }
    if (++nodes > MAX_FABRIC_OBJECT_NODES) {
      throw new Error("Fabric object tree exceeds maximum node count");
    }
    if (visited.has(value)) {
      throw new Error("Fabric object tree must not contain cycles or aliases");
    }
    visited.add(value);
    const semantic = SEMANTIC_KEYS.some((key) => Object.hasOwn(value, key));
    if (semantic) {
      const objectId = nonEmptyString(value.objectId, `${label} objectId`);
      const rawKind = nonEmptyString(value.elementKind, `${objectId} elementKind`);
      if (!ELEMENT_KIND_SET.has(rawKind)) {
        throw new Error(`${objectId} has unsupported elementKind ${rawKind}`);
      }
      const accessibleName = nonEmptyString(
        value.accessibleName,
        `${objectId} accessibleName`
      );
      const optional = (key: "assetId" | "sourceHash"): string | undefined => {
        if (!Object.hasOwn(value, key)) return undefined;
        return nonEmptyString(value[key], `${objectId} ${key}`);
      };
      if (seen.has(objectId)) throw new Error(`Duplicate Fabric object ID ${objectId}`);
      seen.add(objectId);
      const assetId = optional("assetId");
      const sourceHash = optional("sourceHash");
      collected.push({
        objectId,
        elementKind: rawKind as ElementKind,
        accessibleName,
        ...(assetId === undefined ? {} : { assetId }),
        ...(sourceHash === undefined ? {} : { sourceHash }),
        object: value,
        path: Object.freeze([...path])
      });
    }
    if (value.objects === undefined) continue;
    if (!Array.isArray(value.objects)) {
      throw new Error(`${label} children must be an array`);
    }
    for (let index = value.objects.length - 1; index >= 0; index -= 1) {
      stack.push({ value: value.objects[index], path: [...path, index] });
    }
  }
  return collected;
}

export function campaignSemanticObjectMap(
  fabricState: unknown
): Map<string, CampaignSemanticObject> {
  return new Map(
    collectCampaignSemanticObjects(fabricState).map((object) => [object.objectId, object])
  );
}
