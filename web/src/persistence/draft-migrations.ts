import { CampaignDocumentSchema, type CampaignDocumentV1 } from "../domain/campaign-document";

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function defaultMissingArray(record: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(record, key) && record[key] !== undefined ? record[key] : [];
}

export function migrateCampaignDocument(value: unknown): CampaignDocumentV1 {
  const source = structuredClone(value);
  const record = asRecord(source, "Campaign document");
  const version = record.schemaVersion;

  if (version === 1) return CampaignDocumentSchema.parse(record);
  if (version !== 0) throw new Error(`Unsupported campaign schema version: ${String(version)}`);

  const brief = asRecord(record.brief, "Schema-zero brief");
  const evidence = asRecord(record.evidence, "Schema-zero evidence");
  const migrated = {
    ...record,
    schemaVersion: 1,
    drawingLayers: Object.hasOwn(record, "drawingLayers") && record.drawingLayers !== undefined
      ? record.drawingLayers
      : [],
    brief: {
      ...brief,
      audienceNeeds: defaultMissingArray(brief, "audienceNeeds"),
      audienceValues: defaultMissingArray(brief, "audienceValues"),
      intendedEffects: defaultMissingArray(brief, "intendedEffects"),
      techniques: defaultMissingArray(brief, "techniques")
    },
    evidence: {
      ...evidence,
      price: defaultMissingArray(evidence, "price")
    }
  };

  return CampaignDocumentSchema.parse(migrated);
}
