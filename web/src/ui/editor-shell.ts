import type { PairGameView } from "../game/pair-game-controller";
import { STUDENT_COPY } from "../game/student-copy";

export interface EditorShell extends PairGameView {
  overlay: HTMLElement;
  library: HTMLElement;
  productBuilder: HTMLElement;
  productBuilderPanel: HTMLElement;
  moneyCheckPanel: HTMLElement;
  marketRoutePanel: HTMLElement;
  aidaPlaybookPanel: HTMLElement;
  imageLabPanel: HTMLElement;
  studioCoachPanel: HTMLElement;
  logoLabPanel: HTMLElement;
  librarySearch: HTMLInputElement;
  libraryView: HTMLSelectElement;
  libraryCategory: HTMLSelectElement;
  libraryColour: HTMLInputElement;
  livePhotos: HTMLInputElement;
  libraryStatus: HTMLElement;
  libraryResults: HTMLElement;
  saveStatus: HTMLElement;
  canvasRegion: HTMLElement;
  canvasEmptyState: HTMLElement;
  canvas: HTMLCanvasElement;
  zoomOut: HTMLButtonElement;
  zoomFill: HTMLButtonElement;
  zoomIn: HTMLButtonElement;
  zoomStatus: HTMLElement;
  layersToggle: HTMLButtonElement;
  inspector: HTMLElement;
  layers: HTMLElement;
}

const AIDA = ["Price", "Attention", "Interest", "Desire", "Action"];

export function createEditorShell(root: HTMLElement): EditorShell {
  root.innerHTML = `
    <section class="creator" aria-label="Campaign studio" data-studio-drawer-open="true">
      <header class="creator__topbar">
        <p class="creator__brand"><strong>AD MARKET</strong><span>Studio</span></p>
        <input aria-label="Product name" maxlength="48" placeholder="Name your product">
        <button type="button" data-command="undo">Undo</button>
        <button type="button" data-command="redo">Redo</button>
        <span class="creator__save-status" role="status" aria-label="Saved progress" data-save-status></span>
        <button type="button" data-command="return">Return to game</button>
      </header>
      <section class="creator__pair-strip" role="region" aria-label="${STUDENT_COPY.labels.pairPlay}">
        <div class="creator__level-chip">
          <span class="creator__eyebrow" data-creator-level-label>${STUDENT_COPY.phaseLabels["round-zero"]}</span>
        </div>
        <div class="creator__audience-picker">
          <label><span>${STUDENT_COPY.labels.audienceSignal}</span>
            <select data-audience-signal aria-label="${STUDENT_COPY.labels.audienceSignal}"></select>
          </label>
          <button type="button" class="creator__brief-toggle" aria-expanded="false" aria-controls="studio-full-brief" data-brief-toggle>Open full brief</button>
        </div>
        <nav class="creator__checklist" role="group" aria-label="AIDA steps" data-creator-checklist>
          ${AIDA.map((label, index) => `<button type="button" aria-pressed="${index === 0}" data-slot="${label.toLowerCase()}">${label}</button>`).join("")}
        </nav>
        <div class="creator__role-card">
          <div class="creator__role-turn creator__role-turn--active">
            <span class="creator__role-label">Now: <strong data-active-role>${STUDENT_COPY.rolePrompts["art-director"].label}</strong></span>
            <p class="creator__next-action" data-active-role-action>${STUDENT_COPY.rolePrompts["art-director"].productiveAction}</p>
          </div>
          <div class="creator__role-turn creator__role-turn--partner">
            <span class="creator__role-label">Partner: <strong data-partner-role>${STUDENT_COPY.rolePrompts.strategist.label}</strong></span>
            <p class="creator__partner-action" data-partner-role-action>${STUDENT_COPY.rolePrompts.strategist.holdingAction}</p>
          </div>
          <p class="creator__round-progress" role="status" aria-label="${STUDENT_COPY.labels.roundProgress}" data-round-progress>${STUDENT_COPY.roundZero.progressNone}</p>
          <button type="button" data-swap-roles>${STUDENT_COPY.handoff.buttonLabel}</button>
        </div>
        <article class="creator__audience-brief" id="studio-full-brief" role="region" aria-label="${STUDENT_COPY.labels.audienceBrief}" hidden>
          <dl>
            <div><dt>${STUDENT_COPY.labels.context}</dt><dd data-audience-context></dd></div>
            <div><dt>${STUDENT_COPY.labels.need}</dt><dd data-audience-need></dd></div>
            <div><dt>${STUDENT_COPY.labels.values}</dt><dd data-audience-values></dd></div>
            <div><dt>${STUDENT_COPY.labels.intendedEffect}</dt><dd data-audience-effect></dd></div>
          </dl>
        </article>
      </section>
      <div class="creator__workspace">
        <nav class="creator__tool-rail" role="tablist" aria-label="Studio tools">
          <button type="button" role="tab" aria-selected="true" aria-controls="studio-panel-product" tabindex="0" aria-label="Build" data-glyph="◆" data-studio-tool="product">Build</button>
          <button type="button" role="tab" aria-selected="false" aria-controls="studio-panel-assets" tabindex="-1" aria-label="Assets" data-glyph="✦" data-studio-tool="assets">Assets</button>
          <button type="button" role="tab" aria-selected="false" aria-controls="studio-panel-words" tabindex="-1" aria-label="Words" data-glyph="Aa" data-studio-tool="words">Words</button>
          <button type="button" role="tab" aria-selected="false" aria-controls="studio-panel-logo" tabindex="-1" aria-label="Logo" data-glyph="◎" data-studio-tool="logo">Logo</button>
          <button type="button" role="tab" aria-selected="false" aria-controls="studio-panel-image" tabindex="-1" aria-label="Image" data-glyph="▧" data-studio-tool="image">Image</button>
          <button type="button" role="tab" aria-selected="false" aria-controls="studio-panel-price" tabindex="-1" aria-label="Price" data-glyph="$" data-studio-tool="price" data-creator-feature="price">Price</button>
          <button type="button" role="tab" aria-selected="false" aria-controls="studio-panel-route" tabindex="-1" aria-label="Route" data-glyph="↗" data-studio-tool="route" data-creator-feature="route">Route</button>
          <button type="button" role="tab" aria-selected="false" aria-controls="studio-panel-aida" tabindex="-1" aria-label="AIDA" data-glyph="A" data-studio-tool="aida" data-creator-feature="aida">AIDA</button>
          <button type="button" role="tab" aria-selected="false" aria-controls="studio-panel-coach" tabindex="-1" aria-label="Coach" data-glyph="?" data-studio-tool="coach" data-creator-feature="coach">Coach</button>
        </nav>
        <aside class="creator__library creator__tool-drawer" aria-label="Studio drawer" data-studio-drawer>
          <button type="button" class="creator__drawer-collapse" data-studio-collapse aria-label="Hide library">Hide library</button>
          <section class="creator__tool-panel creator__product-builder" id="studio-panel-product" role="region" aria-label="Product builder" data-studio-panel="product" data-creator-feature="product">
            <h2>Build your product</h2>
            <div data-product-builder-panel>
              <p role="status">Product maker loading</p>
              <button type="button" disabled>Drop it on the canvas</button>
            </div>
            <aside class="creator__launch-path" role="note" aria-label="Launch path">
              <p>LAUNCH PATH</p>
              <ol>
                <li><span>1</span><strong>Build</strong></li>
                <li><span>2</span><strong>Place</strong></li>
                <li><span>3</span><strong>Design</strong></li>
              </ol>
              <p>Each choice changes the product's cost and the audience most likely to want it.</p>
            </aside>
          </section>
          <section class="creator__tool-panel creator__assets" id="studio-panel-assets" role="region" aria-label="Asset library" data-studio-panel="assets" hidden>
            <h2>Find a piece</h2>
            <div class="creator__asset-controls">
              <label class="creator__library-view">Library view <select aria-label="Library view" data-library-view>
                <option value="products" selected>Products</option>
                <option value="parts">Parts</option>
                <option value="all">All pieces</option>
              </select></label>
              <label class="creator__asset-search">Search assets <input type="search" aria-label="Search assets" placeholder="Try running shoe, tent or pet shop"></label>
              <label class="creator__asset-category">Product category <select aria-label="Product category" data-library-category><option value="">All categories</option></select></label>
              <label class="creator__asset-colour">Colour for new pieces <input type="color" value="#e4572e" data-library-colour></label>
              <label class="creator__live-photos"><input type="checkbox" data-live-photos>Show photo products</label>
              <p class="creator__library-status" role="status" data-library-status></p>
            </div>
            <div class="creator__library-results" data-library-results></div>
          </section>
          <section class="creator__tool-panel creator__quick-tools" id="studio-panel-words" role="region" aria-label="${STUDENT_COPY.labels.roundZeroTools}" data-studio-panel="words" hidden>
            <h2>Words</h2>
            <div class="creator__words-body">
              <label>${STUDENT_COPY.labels.canvasWords}<input data-canvas-words aria-label="${STUDENT_COPY.labels.canvasWords}" placeholder="${STUDENT_COPY.roundZero.textPlaceholder}"></label>
              <button type="button" data-add-words>${STUDENT_COPY.roundZero.addWords}</button>
              <button type="button" data-add-product-words>${STUDENT_COPY.roundZero.productWords}</button>
              <p class="creator__words-hint">${STUDENT_COPY.roundZero.productWordsHint}</p>
            </div>
          </section>
          <section class="creator__tool-panel creator__logo-lab" id="studio-panel-logo" role="region" aria-label="Logo Lab" data-studio-panel="logo" hidden>
            <h2>Logo Lab</h2>
            <div data-logo-lab-panel><p role="status">Logo maker loading</p></div>
          </section>
          <section class="creator__tool-panel creator__image-lab" id="studio-panel-image" role="region" aria-label="Image Lab" data-studio-panel="image" hidden>
            <h2>Image Lab</h2>
            <div data-image-lab-panel><p role="status">Image options loading</p></div>
          </section>
          <section class="creator__tool-panel creator__money-check" id="studio-panel-price" role="region" aria-label="Money check" data-studio-panel="price" data-creator-feature="price" hidden>
            <h2>Price your idea</h2>
            <div data-money-check-panel><p role="status">Price data loading</p></div>
          </section>
          <section class="creator__tool-panel creator__market-route" id="studio-panel-route" role="region" aria-label="Market Route" data-studio-panel="route" data-creator-feature="route" hidden>
            <h2>Pick your market</h2>
            <div data-market-route-panel><p role="status">Market map loading</p></div>
          </section>
          <section class="creator__tool-panel creator__aida-playbook" id="studio-panel-aida" role="region" aria-label="AIDA move deck" data-studio-panel="aida" data-creator-feature="aida" hidden>
            <h2>AIDA move deck</h2>
            <div data-aida-playbook-panel><p role="status">Move deck shuffling</p></div>
          </section>
          <section class="creator__tool-panel creator__studio-coach" id="studio-panel-coach" role="region" aria-label="Studio Coach" data-studio-panel="coach" data-creator-feature="coach" hidden>
            <h2>Studio Coach</h2>
            <div data-studio-coach-panel><p role="status">Coach guide loading</p></div>
          </section>
        </aside>
        <main class="creator__canvas" role="region" aria-label="Campaign canvas" tabindex="0">
          <p class="creator__canvas-label" aria-hidden="true">LIVE AD</p>
          <div class="creator__canvas-size" role="group" aria-label="Selected product or image size">
            <button type="button" data-canvas-zoom="out" aria-label="Make selected product or image smaller" title="Make selected product or image smaller">−</button>
            <button type="button" data-canvas-zoom="fill" aria-label="Fill ad with selected image" title="Fill the ad, then drag the image to choose the crop">Fill ad</button>
            <button type="button" data-canvas-zoom="in" aria-label="Make selected product or image larger" title="Make selected product or image larger">+</button>
            <button type="button" data-canvas-layers aria-label="Open canvas layers">Layers</button>
            <span role="status" data-canvas-zoom-status>Select a product or image</span>
          </div>
          <div class="creator__canvas-empty" role="status" aria-label="Empty canvas" data-canvas-empty-state>
            <div class="creator__canvas-empty-card">
              <span class="creator__canvas-empty-mark" aria-hidden="true">✦</span>
              <strong>Canvas empty</strong>
              <span>Build a product. Then choose <b>Place product on ad</b>.</span>
            </div>
          </div>
          <canvas width="1600" height="900"></canvas>
        </main>
        <aside class="creator__inspector" role="region" aria-label="Selected element" hidden></aside>
        <aside class="creator__layers" id="canvas-layers-panel" role="region" aria-label="Canvas layers" hidden></aside>
      </div>
      <p class="sr-only" data-live="polite" aria-live="polite"></p>
      <p class="sr-only" data-live="assertive" aria-live="assertive"></p>
    </section>`;

  const briefToggle = root.querySelector<HTMLButtonElement>("[data-brief-toggle]")!;
  const brief = root.querySelector<HTMLElement>("#studio-full-brief")!;
  briefToggle.addEventListener("click", () => {
    const open = brief.hidden;
    brief.hidden = !open;
    briefToggle.setAttribute("aria-expanded", String(open));
    briefToggle.textContent = open ? "Close full brief" : "Open full brief";
  });

  return {
    overlay: root.querySelector(".creator")!,
    library: root.querySelector(".creator__library")!,
    productBuilder: root.querySelector(".creator__product-builder")!,
    productBuilderPanel: root.querySelector('[data-product-builder-panel]')!,
    moneyCheckPanel: root.querySelector('[data-money-check-panel]')!,
    marketRoutePanel: root.querySelector('[data-market-route-panel]')!,
    aidaPlaybookPanel: root.querySelector('[data-aida-playbook-panel]')!,
    imageLabPanel: root.querySelector('[data-image-lab-panel]')!,
    studioCoachPanel: root.querySelector('[data-studio-coach-panel]')!,
    logoLabPanel: root.querySelector('[data-logo-lab-panel]')!,
    activeRole: root.querySelector('[data-active-role]')!,
    activeRoleAction: root.querySelector('[data-active-role-action]')!,
    partnerRole: root.querySelector('[data-partner-role]')!,
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
    productWords: root.querySelector('[data-add-product-words]')!,
    undo: root.querySelector('[data-command="undo"]')!,
    redo: root.querySelector('[data-command="redo"]')!,
    librarySearch: root.querySelector('input[aria-label="Search assets"]')!,
    libraryView: root.querySelector('[data-library-view]')!,
    libraryCategory: root.querySelector('[data-library-category]')!,
    libraryColour: root.querySelector('[data-library-colour]')!,
    livePhotos: root.querySelector('[data-live-photos]')!,
    libraryStatus: root.querySelector('[data-library-status]')!,
    libraryResults: root.querySelector('[data-library-results]')!,
    saveStatus: root.querySelector('[data-save-status]')!,
    canvasRegion: root.querySelector(".creator__canvas")!,
    canvasEmptyState: root.querySelector('[data-canvas-empty-state]')!,
    canvas: root.querySelector("canvas")!,
    zoomOut: root.querySelector('[data-canvas-zoom="out"]')!,
    zoomFill: root.querySelector('[data-canvas-zoom="fill"]')!,
    zoomIn: root.querySelector('[data-canvas-zoom="in"]')!,
    zoomStatus: root.querySelector('[data-canvas-zoom-status]')!,
    layersToggle: root.querySelector('[data-canvas-layers]')!,
    inspector: root.querySelector(".creator__inspector")!,
    layers: root.querySelector(".creator__layers")!,
    polite: root.querySelector('[data-live="polite"]')!,
    assertive: root.querySelector('[data-live="assertive"]')!
  };
}
