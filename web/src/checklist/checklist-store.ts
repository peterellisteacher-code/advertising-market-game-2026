import { CampaignDocumentSchema, type CampaignDocumentV1 } from "../domain/campaign-document";

export const CHECKLIST_SLOTS = ["price", "attention", "interest", "desire", "action"] as const;
export type ChecklistSlot = typeof CHECKLIST_SLOTS[number];

const SLOT_LABELS: Record<ChecklistSlot, string> = {
  price: "Price",
  attention: "Attention",
  interest: "Interest",
  desire: "Desire",
  action: "Action"
};

export interface ChecklistCompletionState {
  slot: ChecklistSlot;
  label: string;
  complete: boolean;
  indicator: "✓" | "○";
  statusText: string;
}

export function campaignObjectIds(document: CampaignDocumentV1): Set<string> {
  const ids = new Set<string>();
  for (const object of document.fabricState.objects) {
    if (ids.has(object.objectId)) throw new Error(`Duplicate Fabric object ID ${object.objectId}`);
    ids.add(object.objectId);
  }
  return ids;
}

export function assertEvidenceReferences(document: CampaignDocumentV1): void {
  const objectIds = campaignObjectIds(document);
  for (const slot of CHECKLIST_SLOTS) {
    for (const objectId of document.evidence[slot]) {
      if (!objectIds.has(objectId)) throw new Error(`Missing Fabric object ${objectId}`);
    }
  }
}

export class ChecklistStore {
  #document: CampaignDocumentV1;

  constructor(document: CampaignDocumentV1) {
    this.#document = CampaignDocumentSchema.parse(structuredClone(document));
    assertEvidenceReferences(this.#document);
  }

  setEvidence(slot: ChecklistSlot, objectIds: readonly string[]): CampaignDocumentV1 {
    if (!CHECKLIST_SLOTS.includes(slot)) throw new Error(`Unknown checklist slot ${String(slot)}`);
    const deduplicated = [...new Set(objectIds)];
    const available = campaignObjectIds(this.#document);
    for (const objectId of deduplicated) {
      if (!available.has(objectId)) throw new Error(`Missing Fabric object ${objectId}`);
    }
    this.#document = CampaignDocumentSchema.parse({
      ...this.#document,
      evidence: {
        ...this.#document.evidence,
        [slot]: deduplicated
      }
    });
    return this.getDocument();
  }

  getEvidence(slot: ChecklistSlot): readonly string[] {
    return [...this.#document.evidence[slot]];
  }

  getCompletionState(): ChecklistCompletionState[] {
    return CHECKLIST_SLOTS.map((slot) => {
      const label = SLOT_LABELS[slot];
      const complete = this.#document.evidence[slot].length > 0;
      return {
        slot,
        label,
        complete,
        indicator: complete ? "✓" : "○",
        statusText: complete ? `${label} complete` : `${label} needs evidence`
      };
    });
  }

  getDocument(): CampaignDocumentV1 {
    return CampaignDocumentSchema.parse(structuredClone(this.#document));
  }
}
