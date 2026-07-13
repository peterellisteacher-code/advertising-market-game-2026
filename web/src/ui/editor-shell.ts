export interface EditorShell {
  overlay: HTMLElement;
  library: HTMLElement;
  productBuilder: HTMLElement;
  productShellSelect: HTMLSelectElement;
  productShellPreview: HTMLImageElement;
  productShellAdd: HTMLButtonElement;
  productShellStatus: HTMLElement;
  librarySearch: HTMLInputElement;
  livePhotos: HTMLInputElement;
  libraryStatus: HTMLElement;
  libraryResults: HTMLElement;
  canvasRegion: HTMLElement;
  canvas: HTMLCanvasElement;
  inspector: HTMLElement;
  layers: HTMLElement;
  polite: HTMLElement;
  assertive: HTMLElement;
}

const AIDA = ["Price", "Attention", "Interest", "Desire", "Action"];

export function createEditorShell(root: HTMLElement): EditorShell {
  root.innerHTML = `
    <section class="creator" aria-label="Campaign creator">
      <header class="creator__topbar">
        <input aria-label="Product name" maxlength="48">
        <button type="button" data-command="undo">Undo</button>
        <button type="button" data-command="redo">Redo</button>
        <button type="button" data-command="return">Return to game</button>
      </header>
      <nav role="tablist" aria-label="Campaign checklist">
        ${AIDA.map((label, index) => `<button type="button" role="tab" aria-selected="${index === 0}" data-slot="${label.toLowerCase()}">${label}</button>`).join("")}
      </nav>
      <aside class="creator__library" aria-label="Asset library">
        <section class="creator__product-builder" role="region" aria-label="Product builder">
          <h2>Build your product</h2>
          <label>Product shell
            <select aria-label="Product shell" data-product-shell-select disabled></select>
          </label>
          <img data-product-shell-preview alt="">
          <button type="button" data-add-product-shell disabled>Add product shell</button>
          <p role="status" data-product-shell-status>Product shells loading</p>
        </section>
        <label>Search assets <input type="search" aria-label="Search assets"></label>
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
    productShellSelect: root.querySelector('[data-product-shell-select]')!,
    productShellPreview: root.querySelector('[data-product-shell-preview]')!,
    productShellAdd: root.querySelector('[data-add-product-shell]')!,
    productShellStatus: root.querySelector('[data-product-shell-status]')!,
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
