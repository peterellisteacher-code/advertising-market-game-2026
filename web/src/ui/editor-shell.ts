import type { PairGameView } from "../game/pair-game-controller";
import { ROLE_GUIDE } from "../game/role-guide-controller";
import { STUDENT_COPY } from "../game/student-copy";

export interface EditorShell extends PairGameView {
  overlay: HTMLElement;
  workspace: HTMLElement;
  library: HTMLElement;
  workspaceSeparator: HTMLElement;
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
  deleteSelected: HTMLButtonElement;
  deleteStatus: HTMLElement;
  inspector: HTMLElement;
  sectionFillPanel: HTMLElement;
  layers: HTMLElement;
}

const CHECKLIST_STEPS = ["Price", "Attention", "Interest", "Desire", "Action"];

export function createEditorShell(root: HTMLElement): EditorShell {
  root.innerHTML = `
    <section class="creator" aria-label="Campaign studio">
      <header class="creator__topbar">
        <p class="creator__brand"><strong>AD MARKET</strong><span>Studio</span></p>
        <input aria-label="Product name" maxlength="48" placeholder="Name your product">
        <button type="button" data-command="undo">Undo</button>
        <button type="button" data-command="redo">Redo</button>
        <span class="creator__save-status" role="status" aria-label="Saved progress" data-save-status></span>
        <button type="button" data-guide-review-top>How to use this site</button>
        <button type="button" data-studio-tour-open>Studio tour</button>
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
          ${CHECKLIST_STEPS.map((label, index) => `<button type="button" aria-pressed="${index === 0}" data-slot="${label.toLowerCase()}">${label}</button>`).join("")}
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
          <div class="creator__role-actions" role="group" aria-label="Partner role controls">
            <button type="button" data-swap-roles>${STUDENT_COPY.handoff.buttonLabel}</button>
            <button type="button" data-role-guide-open>Role guide</button>
          </div>
        </div>
        <article class="creator__audience-brief" id="studio-full-brief" role="region" aria-label="${STUDENT_COPY.labels.audienceBrief}" hidden>
          <dl>
            <div>
              <dt>${STUDENT_COPY.labels.context}<button type="button" class="creator__brief-help" aria-label="What does Context mean?" data-brief-help="context">?</button></dt>
              <dd>
                <span data-audience-context></span>
              </dd>
            </div>
            <div>
              <dt>${STUDENT_COPY.labels.need}<button type="button" class="creator__brief-help" aria-label="What does Need mean?" data-brief-help="need">?</button></dt>
              <dd>
                <span data-audience-need></span>
              </dd>
            </div>
            <div>
              <dt>${STUDENT_COPY.labels.values}<button type="button" class="creator__brief-help" aria-label="What does Values mean?" data-brief-help="values">?</button></dt>
              <dd>
                <span data-audience-values></span>
              </dd>
            </div>
            <div>
              <dt>${STUDENT_COPY.labels.intendedEffect}<button type="button" class="creator__brief-help" aria-label="What does Intended audience response mean?" data-brief-help="intendedEffect">?</button></dt>
              <dd>
                <span data-audience-effect></span>
              </dd>
            </div>
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
        <nav class="creator__pane-tabs" role="tablist" aria-label="Studio areas" data-studio-pane-tabs hidden>
          <button type="button" role="tab" aria-selected="true" aria-controls="studio-browse-pane" tabindex="0" data-studio-pane-tab="browse">Browse</button>
          <button type="button" role="tab" aria-selected="false" aria-controls="studio-edit-pane" tabindex="-1" data-studio-pane-tab="edit">Edit</button>
        </nav>
        <aside class="creator__library creator__tool-drawer" id="studio-browse-pane" aria-label="Studio drawer" data-studio-drawer>
          <section class="creator__guide" role="region" aria-label="Current instruction" data-guide>
            <p class="creator__guide-progress" data-guide-progress>Step 1 of 11</p>
            <h2 data-guide-title>Audience evidence</h2>
            <dl>
              <div><dt>Now</dt><dd data-guide-now></dd></div>
              <div><dt>Why</dt><dd data-guide-why></dd></div>
              <div><dt>Done</dt><dd data-guide-done></dd></div>
              <div><dt>Next</dt><dd data-guide-next></dd></div>
            </dl>
            <details class="creator__guide-methods" role="group"
              aria-label="Available methods" data-guide-methods hidden>
              <summary>Available methods</summary>
              <ul data-guide-method-list></ul>
            </details>
            <div class="creator__guide-actions">
              <button type="button" data-guide-open-tool>Open Audience evidence</button>
              <button type="button" data-guide-review>How to use this site</button>
            </div>
            <p class="creator__guide-locks" id="studio-locked-actions-status"
              data-locked-actions-status hidden></p>
          </section>
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
            <h2>Set the product price</h2>
            <div data-money-check-panel><p role="status">Price data loading</p></div>
          </section>
          <section class="creator__tool-panel creator__market-route" id="studio-panel-route" role="region" aria-label="Market Route" data-studio-panel="route" data-creator-feature="route" hidden>
            <h2>Choose a market route</h2>
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
        <div
          class="creator__workspace-separator"
          role="separator"
          aria-label="Resize the library and design areas"
          aria-orientation="vertical"
          aria-describedby="studio-split-hint"
          tabindex="0"
          data-studio-separator></div>
        <p class="creator__workspace-separator-hint" id="studio-split-hint"
          data-studio-split-hint>
          Use Left Arrow or Right Arrow to resize. Hold Shift for a larger change.
          Home and End set the limits. Press R or double-click to reset.
        </p>
        <main class="creator__canvas" id="studio-edit-pane" role="region" aria-label="Campaign canvas" tabindex="0">
          <p class="creator__canvas-label" aria-hidden="true">LIVE AD</p>
          <div class="creator__canvas-size" role="group" aria-label="Selected product or image size">
            <button type="button" data-canvas-zoom="out" aria-label="Make selected product or image smaller" title="Make selected product or image smaller">−</button>
            <button type="button" data-canvas-zoom="fill" aria-label="Fill ad with selected image" title="Fill the ad, then drag the image to choose the crop">Fill ad</button>
            <button type="button" data-canvas-zoom="in" aria-label="Make selected product or image larger" title="Make selected product or image larger">+</button>
            <button type="button" data-canvas-layers aria-label="Open canvas layers">Layers</button>
            <span role="status" data-canvas-zoom-status>Select a product or image</span>
            <button type="button" data-canvas-delete aria-describedby="canvas-delete-status" disabled>Delete selected item</button>
            <span id="canvas-delete-status" data-canvas-delete-status>Select an item to delete</span>
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
        <aside class="creator__section-fill" role="region" aria-label="Selected item fill"
          data-section-fill-panel hidden></aside>
        <aside class="creator__layers" id="canvas-layers-panel" role="region" aria-label="Canvas layers" hidden></aside>
      </div>
      <div class="creator__instruction-dialog" role="dialog" aria-modal="true"
        aria-label="How to use this site"
        data-guide-dialog hidden>
        <div class="creator__instruction-dialog-panel">
          <header>
            <div>
              <p class="creator__eyebrow">Complete reference</p>
              <h2 id="advertising-campaign-instructions-title">How to use this site</h2>
            </div>
            <div class="creator__instruction-dialog-actions">
              <span data-guide-page-position></span>
              <button type="button" data-guide-previous>Previous</button>
              <button type="button" data-guide-next>Next</button>
              <button type="button" data-guide-close>Close guide</button>
            </div>
          </header>
          <div class="creator__instruction-dialog-body" data-guide-reference></div>
        </div>
      </div>
      <p class="sr-only" data-live="polite" aria-live="polite"></p>
      <p class="sr-only" data-live="assertive" aria-live="assertive"></p>
    </section>
    <div class="creator__studio-onboarding-layer" data-studio-onboarding-layer hidden>
      <div class="creator__studio-onboarding-spotlight" data-studio-onboarding-spotlight aria-hidden="true" hidden></div>
      <section class="creator__studio-onboarding" role="dialog" aria-modal="true"
        aria-label="Studio tour" data-studio-onboarding-dialog tabindex="-1">
        <p class="creator__eyebrow" data-studio-onboarding-position></p>
        <div data-studio-onboarding-page="brief">
          <h2>Read the audience brief</h2>
          <dl class="creator__onboarding-brief">
            <div><dt>Context<button type="button" class="creator__brief-help" aria-label="What does Context mean?" data-studio-onboarding-help="context" data-studio-onboarding-help-label="Context">?</button></dt><dd data-onboarding-context></dd></div>
            <div><dt>Need<button type="button" class="creator__brief-help" aria-label="What does Need mean?" data-studio-onboarding-help="need" data-studio-onboarding-help-label="Need">?</button></dt><dd data-onboarding-need></dd></div>
            <div><dt>Values<button type="button" class="creator__brief-help" aria-label="What does Values mean?" data-studio-onboarding-help="values" data-studio-onboarding-help-label="Values">?</button></dt><dd data-onboarding-values></dd></div>
            <div><dt>Intended audience response<button type="button" class="creator__brief-help" aria-label="What does Intended audience response mean?" data-studio-onboarding-help="intendedEffect" data-studio-onboarding-help-label="Intended audience response">?</button></dt><dd data-onboarding-effect></dd></div>
          </dl>
        </div>
        <div data-studio-onboarding-page="roles" hidden>
          <h2>Share the roles</h2>
          <p>The Art Director leads appearance choices. The Strategist leads audience, message, evidence and offer choices.</p>
          <p>Both partners can use the same controls. Swap roles changes responsibility, not permissions.</p>
        </div>
        <div data-studio-onboarding-page="build" hidden>
          <h2>Use the Build area</h2>
          <p>Build lets you choose a starter product for the advertisement. Other tools appear when their next action needs them.</p>
        </div>
        <div data-studio-onboarding-page="first-action" hidden>
          <h2>Choose a starter product</h2>
          <p>Choose one product. It will appear in the advertisement, ready for your first design edit.</p>
        </div>
        <div class="creator__studio-onboarding-actions">
          <button type="button" data-studio-onboarding-close>Close</button>
          <button type="button" data-studio-onboarding-previous>Previous</button>
          <button type="button" data-studio-onboarding-next>Next</button>
        </div>
      </section>
    </div>
    <div class="creator__role-guide-layer" data-role-guide-layer hidden>
      <section class="creator__role-guide" role="dialog" aria-modal="true"
        aria-label="Partner role guide" data-role-guide-dialog tabindex="-1">
        <p class="creator__eyebrow">Pair responsibilities</p>
        <h2>Partner role guide</h2>
        <div class="creator__role-guide-access" role="note">
          <p><strong>Both partners share the controls.</strong> ${ROLE_GUIDE.sharedAccess}</p>
          <p>${ROLE_GUIDE.sameButtons} The role names divide the decisions between the partners; they are not separate site permissions.</p>
        </div>
        <div class="creator__role-guide-definitions">
          <section>
            <h3>Art Director</h3>
            <p>${ROLE_GUIDE.artDirector.responsibilities}</p>
            <p>${ROLE_GUIDE.artDirector.example}</p>
          </section>
          <section>
            <h3>Strategist</h3>
            <p>${ROLE_GUIDE.strategist.responsibilities}</p>
            <p>${ROLE_GUIDE.strategist.example}</p>
          </section>
        </div>
        <p class="creator__role-guide-assignment" data-role-guide-assignment></p>
        <div class="creator__role-guide-turn">
          <p><strong>How a turn works</strong></p>
          <p>${ROLE_GUIDE.activeTurn} The other partner should advise, check the audience brief and prepare the next decision.</p>
          <p>${ROLE_GUIDE.recordedRole} ${ROLE_GUIDE.physicalUser}</p>
        </div>
        <div class="creator__role-guide-swap">
          <p><strong>What Swap roles changes</strong></p>
          <p>${ROLE_GUIDE.swapEffect} ${ROLE_GUIDE.retainedWork}</p>
        </div>
        <div class="creator__role-guide-actions">
          <button type="button" data-role-guide-close>Close role guide</button>
          <button type="button" data-role-guide-begin>Begin work</button>
        </div>
      </section>
    </div>`;

  const briefToggle = root.querySelector<HTMLButtonElement>("[data-brief-toggle]")!;
  const brief = root.querySelector<HTMLElement>("#studio-full-brief")!;
  const overlay = root.querySelector<HTMLElement>(".creator")!;
  briefToggle.addEventListener("click", () => {
    const open = brief.hidden;
    brief.hidden = !open;
    briefToggle.setAttribute("aria-expanded", String(open));
    briefToggle.textContent = open ? "Close full brief" : "Open full brief";
    if (open) overlay.dataset.briefOpen = "true";
    else delete overlay.dataset.briefOpen;
  });
  for (const help of root.querySelectorAll<HTMLButtonElement>("[data-brief-help]")) {
    help.addEventListener("click", () => {
      const key = help.dataset.briefHelp as keyof typeof STUDENT_COPY.audienceBriefDefinitions;
      const definition = STUDENT_COPY.audienceBriefDefinitions[key];
      const previous = root.querySelector<HTMLElement>("[data-brief-help-card]");
      if (previous !== null) previous.remove();
      const card = root.ownerDocument.createElement("section");
      card.className = "creator__brief-help-card";
      card.dataset.briefHelpCard = "";
      card.setAttribute("role", "dialog");
      card.setAttribute("aria-label", `About ${help.closest("dt")?.textContent?.replace("?", "").trim() ?? "this heading"}`);
      card.innerHTML = `<p>${definition}</p><button type="button">Close</button>`;
      const close = card.querySelector<HTMLButtonElement>("button")!;
      close.addEventListener("click", () => { card.remove(); help.focus(); });
      card.addEventListener("keydown", (event) => {
        if (event.key === "Escape") { event.preventDefault(); card.remove(); help.focus(); }
      });
      help.closest("div")?.append(card);
      close.focus();
    });
  }

  return {
    overlay,
    workspace: root.querySelector(".creator__workspace")!,
    library: root.querySelector(".creator__library")!,
    workspaceSeparator: root.querySelector("[data-studio-separator]")!,
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
    deleteSelected: root.querySelector('[data-canvas-delete]')!,
    deleteStatus: root.querySelector('[data-canvas-delete-status]')!,
    inspector: root.querySelector(".creator__inspector")!,
    sectionFillPanel: root.querySelector("[data-section-fill-panel]")!,
    layers: root.querySelector(".creator__layers")!,
    polite: root.querySelector('[data-live="polite"]')!,
    assertive: root.querySelector('[data-live="assertive"]')!
  };
}
