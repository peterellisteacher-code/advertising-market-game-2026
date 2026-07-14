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

  const visit = (value: unknown, path: readonly number[]): void => {
    const label = pathLabel(path);
    if (!isRecord(value)) throw new Error(`${label} must be an object`);
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
    if (value.objects === undefined) return;
    if (!Array.isArray(value.objects)) {
      throw new Error(`${label} children must be an array`);
    }
    value.objects.forEach((child, index) => visit(child, [...path, index]));
  };

  fabricState.objects.forEach((object, index) => visit(object, [index]));
  return collected;
}

export function campaignSemanticObjectMap(
  fabricState: unknown
): Map<string, CampaignSemanticObject> {
  return new Map(
    collectCampaignSemanticObjects(fabricState).map((object) => [object.objectId, object])
  );
}
