import type { CampaignDocumentV1 } from "../domain/campaign-document";
import { AUDIENCE_BRIEFS } from "../game/audience-briefs";
import { STUDENT_COPY } from "../game/student-copy";

export type StatementSectionId =
  | "audience-purpose"
  | "visual-choices"
  | "language-choices"
  | "evidence";

export interface StatementFact {
  readonly label: string;
  readonly text: string;
}

export interface StatementMissionSentence {
  readonly title: string;
  readonly effectText: string;
}

export interface StatementSection {
  readonly id: StatementSectionId;
  readonly heading: string;
  readonly facts: readonly StatementFact[];
  readonly missionSentences: readonly StatementMissionSentence[];
}

export interface WritersStatementContent {
  readonly productName: string;
  readonly audienceSignal: string | null;
  readonly sections: readonly StatementSection[];
}

const SECTION_ORDER: readonly StatementSectionId[] = [
  "audience-purpose",
  "visual-choices",
  "language-choices",
  "evidence"
];

// Godot mission ids (agency_mission_catalog.gd) keyed to the rubric heading
// their evidence sentence belongs under. Ids missing from this map land under
// "evidence" so a new mission never silently drops a pair's sentence.
const MISSION_SECTIONS: Readonly<Record<string, StatementSectionId>> = Object.freeze({
  "audience-brief": "audience-purpose",
  "media-match": "audience-purpose",
  "meet-client": "audience-purpose",
  salience: "visual-choices",
  "reading-path": "visual-choices",
  contrast: "visual-choices",
  framing: "visual-choices",
  "thirty-second-rescue": "visual-choices",
  "colour-clinic": "visual-choices",
  "crop-lab": "visual-choices",
  "direct-attention": "visual-choices",
  "focus-image": "visual-choices",
  "set-campaign-tone": "visual-choices",
  aida: "language-choices",
  "headline-surgery": "language-choices",
  "shape-message": "language-choices",
  "claim-proof": "evidence",
  "prove-value": "evidence"
});

const AIDA_LINE_ORDER = ["attention", "interest", "desire", "action"] as const;
const EVIDENCE_SLOT_ORDER = ["price", "attention", "interest", "desire", "action"] as const;

export function assembleWritersStatement(
  document: CampaignDocumentV1
): WritersStatementContent {
  const copy = STUDENT_COPY.writersStatement;
  const audience = AUDIENCE_BRIEFS.find(
    (brief) => brief.id === document.brief.targetAudienceId
  ) ?? null;

  const facts = new Map<StatementSectionId, StatementFact[]>(
    SECTION_ORDER.map((id) => [id, []])
  );
  const sentences = new Map<StatementSectionId, StatementMissionSentence[]>(
    SECTION_ORDER.map((id) => [id, []])
  );

  if (audience !== null) {
    facts.get("audience-purpose")!.push(
      { label: STUDENT_COPY.labels.context, text: audience.context },
      { label: STUDENT_COPY.labels.need, text: audience.need },
      { label: STUDENT_COPY.labels.values, text: audience.values.join(", ") },
      { label: STUDENT_COPY.labels.intendedEffect, text: audience.intendedEffect }
    );
  }

  for (const line of AIDA_LINE_ORDER) {
    const text = document.strategy.aidaPlan[line].trim();
    if (text.length === 0) continue;
    facts.get("language-choices")!.push({ label: copy.aidaLabels[line], text });
  }

  const proofPoint = document.strategy.marketRoute?.proofPoint.trim() ?? "";
  if (proofPoint.length > 0) {
    facts.get("evidence")!.push({ label: copy.proofPointLabel, text: proofPoint });
  }

  const namesById = new Map<string, string>(
    document.fabricState.objects.map((object) => [object.objectId, object.accessibleName])
  );
  for (const slot of EVIDENCE_SLOT_ORDER) {
    const names = document.evidence[slot]
      .map((objectId) => namesById.get(objectId))
      .filter((name): name is string => typeof name === "string" && name.length > 0);
    if (names.length === 0) continue;
    facts.get("evidence")!.push({
      label: copy.slotEvidenceLabels[slot],
      text: names.join("; ")
    });
  }

  for (const entry of document.missionEvidence ?? []) {
    const section = MISSION_SECTIONS[entry.missionId] ?? "evidence";
    sentences.get(section)!.push({ title: entry.title, effectText: entry.effectText });
  }

  return {
    productName: document.product.name.trim(),
    audienceSignal: audience?.signal ?? null,
    sections: SECTION_ORDER.map((id) => ({
      id,
      heading: copy.sections[id],
      facts: facts.get(id)!,
      missionSentences: sentences.get(id)!
    }))
  };
}

export interface WritersStatementView {
  readonly layer: HTMLElement;
  open(document: CampaignDocumentV1, options?: { focus?: boolean }): void;
  close(options?: { focus?: boolean }): void;
  isOpen(): boolean;
  offerAfterPublish(document: CampaignDocumentV1): void;
  dismissOffer(): void;
  reset(): void;
}

export interface WritersStatementViewOptions {
  onOpened?: () => void;
  print?: () => void;
}

export function createWritersStatementView(
  host: HTMLElement,
  options: WritersStatementViewOptions = {}
): WritersStatementView {
  const copy = STUDENT_COPY.writersStatement;
  const documentRef = host.ownerDocument;
  const print = options.print ?? ((): void => { documentRef.defaultView?.print(); });

  const layer = documentRef.createElement("section");
  layer.className = "creator__writers-statement";
  layer.dataset.writersStatementLayer = "";
  layer.setAttribute("role", "dialog");
  layer.setAttribute("aria-label", copy.title);
  layer.hidden = true;
  layer.innerHTML = `
    <article class="creator__writers-statement-page">
      <header class="creator__writers-statement-header">
        <h2 tabindex="-1" data-statement-heading>${copy.title}</h2>
        <p data-statement-subject></p>
        <p>${copy.description}</p>
        <div class="creator__writers-statement-actions">
          <button type="button" data-statement-print>${copy.print}</button>
          <button type="button" data-statement-close>${copy.close}</button>
        </div>
      </header>
      <div data-statement-sections></div>
    </article>`;

  const offer = documentRef.createElement("aside");
  offer.className = "creator__statement-offer";
  offer.dataset.statementOffer = "";
  offer.setAttribute("role", "status");
  offer.hidden = true;
  offer.innerHTML = `
    <p>${copy.publishOffer.message}</p>
    <div class="creator__writers-statement-actions">
      <button type="button" data-statement-offer-open>${copy.publishOffer.open}</button>
      <button type="button" data-statement-offer-dismiss>${copy.publishOffer.dismiss}</button>
    </div>`;

  host.append(layer, offer);

  const heading = layer.querySelector<HTMLElement>("[data-statement-heading]")!;
  const subject = layer.querySelector<HTMLElement>("[data-statement-subject]")!;
  const sectionsHost = layer.querySelector<HTMLElement>("[data-statement-sections]")!;
  let restoreFocus: HTMLElement | null = null;
  let lastDocument: CampaignDocumentV1 | null = null;

  const render = (campaign: CampaignDocumentV1): void => {
    const content = assembleWritersStatement(campaign);
    const subjectParts: string[] = [];
    if (content.productName.length > 0) {
      subjectParts.push(`${copy.productLabel}: ${content.productName}`);
    }
    if (content.audienceSignal !== null) {
      subjectParts.push(`${copy.audienceLabel}: ${content.audienceSignal}`);
    }
    subject.textContent = subjectParts.join(" · ");
    subject.hidden = subjectParts.length === 0;
    sectionsHost.replaceChildren(...content.sections.map((section) => {
      const region = documentRef.createElement("section");
      region.dataset.statementSection = section.id;
      const headingEl = documentRef.createElement("h3");
      headingEl.textContent = section.heading;
      region.append(headingEl);
      if (section.facts.length === 0 && section.missionSentences.length === 0) {
        const empty = documentRef.createElement("p");
        empty.className = "creator__writers-statement-empty";
        empty.textContent = copy.emptySection;
        region.append(empty);
        return region;
      }
      if (section.facts.length > 0) {
        const list = documentRef.createElement("dl");
        for (const fact of section.facts) {
          const row = documentRef.createElement("div");
          const term = documentRef.createElement("dt");
          term.textContent = fact.label;
          const definition = documentRef.createElement("dd");
          definition.textContent = fact.text;
          row.append(term, definition);
          list.append(row);
        }
        region.append(list);
      }
      if (section.missionSentences.length > 0) {
        const list = documentRef.createElement("ul");
        for (const sentence of section.missionSentences) {
          const item = documentRef.createElement("li");
          const title = documentRef.createElement("strong");
          title.textContent = sentence.title;
          item.append(title, ` — ${sentence.effectText}`);
          list.append(item);
        }
        region.append(list);
      }
      return region;
    }));
  };

  const view: WritersStatementView = {
    layer,
    isOpen: () => !layer.hidden,
    open(campaign, openOptions = {}) {
      lastDocument = campaign;
      render(campaign);
      offer.hidden = true;
      layer.hidden = false;
      documentRef.body.setAttribute("data-writers-statement-open", "");
      options.onOpened?.();
      if (openOptions.focus ?? true) {
        restoreFocus = documentRef.activeElement instanceof HTMLElement
          ? documentRef.activeElement
          : null;
        heading.focus();
      }
    },
    close(closeOptions = {}) {
      if (layer.hidden) return;
      layer.hidden = true;
      documentRef.body.removeAttribute("data-writers-statement-open");
      if ((closeOptions.focus ?? true) && restoreFocus !== null && restoreFocus.isConnected) {
        restoreFocus.focus();
      }
      restoreFocus = null;
    },
    offerAfterPublish(campaign) {
      lastDocument = campaign;
      if (!layer.hidden) return;
      offer.hidden = false;
    },
    dismissOffer() {
      offer.hidden = true;
    },
    reset() {
      view.close({ focus: false });
      offer.hidden = true;
      lastDocument = null;
    }
  };

  layer.querySelector<HTMLButtonElement>("[data-statement-close]")!
    .addEventListener("click", () => view.close());
  layer.querySelector<HTMLButtonElement>("[data-statement-print]")!
    .addEventListener("click", () => print());
  layer.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      view.close();
    }
  });
  offer.querySelector<HTMLButtonElement>("[data-statement-offer-dismiss]")!
    .addEventListener("click", () => view.dismissOffer());
  offer.querySelector<HTMLButtonElement>("[data-statement-offer-open]")!
    .addEventListener("click", () => {
      if (lastDocument === null) return;
      view.open(lastDocument);
    });

  return Object.freeze(view);
}
