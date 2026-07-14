import type { PairGameView } from "../game/pair-game-controller";
import { STUDENT_COPY } from "../game/student-copy";

export interface EditorShell extends PairGameView {
  overlay: HTMLElement;
  library: HTMLElement;
  productBuilder: HTMLElement;
  productBuilderPanel: HTMLElement;
  librarySearch: HTMLInputElement;
  livePhotos: HTMLInputElement;
  libraryStatus: HTMLElement;
  libraryResults: HTMLElement;
  canvasRegion: HTMLElement;
  canvas: HTMLCanvasElement;
  inspector: HTMLElement;
  layers: HTMLElement;
}

const AIDA = ["Price", "Attention", "Interest", "Desire", "Action"];

export function createEditorShell(root: HTMLElement): EditorShell {
  root.innerHTML = `
    <section class="creator" aria-label="Campaign creator">
      <header class="creator__topbar">
        <input aria-label="Product name" maxlength="48" placeholder="Name your product">
        <button type="button" data-command="undo">Undo</button>
        <button type="button" data-command="redo">Redo</button>
        <button type="button" data-command="return">Return to game</button>
      </header>
      <section class="creator__pair-strip" role="region" aria-label="${STUDENT_COPY.labels.pairPlay}">
        <div class="creator__role-card">
          <p class="creator__eyebrow">${STUDENT_COPY.phaseLabels["round-zero"]}</p>
          <h2 data-active-role>${STUDENT_COPY.rolePrompts["art-director"].label}</h2>
          <p data-active-role-action>${STUDENT_COPY.rolePrompts["art-director"].productiveAction}</p>
          <p class="creator__partner-action" data-partner-role-action>${STUDENT_COPY.rolePrompts.strategist.holdingAction}</p>
          <div class="creator__handoff-row">
            <p role="status" aria-label="${STUDENT_COPY.labels.roundProgress}" data-round-progress>${STUDENT_COPY.roundZero.progressNone}</p>
            <button type="button" data-swap-roles>${STUDENT_COPY.handoff.buttonLabel}</button>
          </div>
        </div>
        <div class="creator__audience-picker">
          <label>${STUDENT_COPY.labels.audienceSignal}
            <select data-audience-signal aria-label="${STUDENT_COPY.labels.audienceSignal}"></select>
          </label>
          <article class="creator__audience-brief" role="region" aria-label="${STUDENT_COPY.labels.audienceBrief}">
            <dl>
              <div><dt>${STUDENT_COPY.labels.context}</dt><dd data-audience-context></dd></div>
              <div><dt>${STUDENT_COPY.labels.need}</dt><dd data-audience-need></dd></div>
              <div><dt>${STUDENT_COPY.labels.values}</dt><dd data-audience-values></dd></div>
              <div><dt>${STUDENT_COPY.labels.intendedEffect}</dt><dd data-audience-effect></dd></div>
            </dl>
          </article>
        </div>
      </section>
      <nav role="tablist" aria-label="Campaign checklist">
        ${AIDA.map((label, index) => `<button type="button" role="tab" aria-selected="${index === 0}" data-slot="${label.toLowerCase()}">${label}</button>`).join("")}
      </nav>
      <aside class="creator__library" aria-label="Asset library">
        <section class="creator__product-builder" role="region" aria-label="Product builder">
          <h2>Make your product</h2>
          <div data-product-builder-panel>
            <p role="status">Product maker loading</p>
            <button type="button" disabled>Drop it on the canvas</button>
          </div>
        </section>
        <section class="creator__quick-tools" role="region" aria-label="${STUDENT_COPY.labels.roundZeroTools}">
          <label>${STUDENT_COPY.labels.canvasWords}
            <input data-canvas-words aria-label="${STUDENT_COPY.labels.canvasWords}" placeholder="${STUDENT_COPY.roundZero.textPlaceholder}">
          </label>
          <button type="button" data-add-words>${STUDENT_COPY.roundZero.addWords}</button>
        </section>
        <label>Search assets <input type="search" aria-label="Search assets" placeholder="Try crowd, beach or neon"></label>
        <label class="creator__live-photos">
          <input type="checkbox" data-live-photos>
          Use live photos
        </label>
        <p class="creator__library-status" role="status" data-library-status></p>
        <div class="creator__library-results" data-library-results></div>
      </aside>
      <main class="creator__canvas" role="region" aria-label="Campaign canvas" tabindex="-1">
        <canvas width="1600" height="900"></canvas>
      </main>
      <aside class="creator__inspector" role="region" aria-label="Selected element"></aside>
      <aside class="creator__layers" role="region" aria-label="Layers"></aside>
      <p class="sr-only" data-live="polite" aria-live="polite"></p>
      <p class="sr-only" data-live="assertive" aria-live="assertive"></p>
    </section>`;

  return {
    overlay: root.querySelector(".creator")!,
    library: root.querySelector(".creator__library")!,
    productBuilder: root.querySelector(".creator__product-builder")!,
    productBuilderPanel: root.querySelector('[data-product-builder-panel]')!,
    activeRole: root.querySelector('[data-active-role]')!,
    activeRoleAction: root.querySelector('[data-active-role-action]')!,
    partnerRoleAction: root.querySelector('[data-partner-role-action]')!,
    roundProgress: root.querySelector('[data-round-progress]')!,
    swapRoles: root.querySelector('[data-swap-roles]')!,
    audienceSignal: root.querySelector('[data-audience-signal]')!,
    audienceContext: root.querySelector('[data-audience-context]')!,
    audienceNeed: root.querySelector('[data-audience-need]')!,
    audienceValues: root.querySelector('[data-audience-values]')!,
    audienceEffect: root.querySelector('[data-audience-effect]')!,
    canvasWords: root.querySelector('[data-canvas-words]')!,
    addWords: root.querySelector('[data-add-words]')!,
    undo: root.querySelector('[data-command="undo"]')!,
    redo: root.querySelector('[data-command="redo"]')!,
    librarySearch: root.querySelector('input[aria-label="Search assets"]')!,
    livePhotos: root.querySelector('[data-live-photos]')!,
    libraryStatus: root.querySelector('[data-library-status]')!,
    libraryResults: root.querySelector('[data-library-results]')!,
    canvasRegion: root.querySelector(".creator__canvas")!,
    canvas: root.querySelector("canvas")!,
    inspector: root.querySelector(".creator__inspector")!,
    layers: root.querySelector(".creator__layers")!,
    polite: root.querySelector('[data-live="polite"]')!,
    assertive: root.querySelector('[data-live="assertive"]')!
  };
}
