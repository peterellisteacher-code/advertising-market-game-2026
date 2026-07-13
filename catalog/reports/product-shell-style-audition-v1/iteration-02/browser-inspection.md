# Browser inspection — iteration 02

- Inspected: 2026-07-13 (Australia/Adelaide)
- URL: `http://127.0.0.1:8897/catalog/reports/product-shell-style-audition-v1/iteration-02/contact-sheet.html`
- Browser proof viewport: 2400 × 1800 CSS pixels
- Page state: `complete`; title `Product-shell style audition`
- DOM: 12 product cards, 24 inline SVGs, 8 direct-surface shells, 4 flat-skin shells
- Main proof surface: 1800 × 928.59375 CSS pixels
- HTTP: contact sheet returned `200 OK`; the harness answered the browser's automatic `/favicon.ico` request with `204 No Content`; zero failed requests and zero responses at or above 400
- Console: zero errors and zero warnings

## Required visual checks

- **PASS — watering can recognisability:** the loop handle, broad reservoir and projecting perforated spout read as a watering can without relying on the title.
- **PASS — distinct flat-skin geometry:** can, bottle, pouch and box use visibly different curved wrap, tapered label, sealed bag and cross-fold structures.
- **PASS — aquarium customisation:** the whole glass front is available, with only restrained frame, waterline and bubble details fixed.
- **PASS — hoodie customisation:** the editor state covers the full chest and torso rather than only the pocket.
- **PASS — trainer customisation:** the athletic shoe has clear laces, sole and toe/heel structure while retaining a large blank upper.
- **PASS — pet-shop category and space:** the storefront reads as retail and leaves a generous fascia and two broad windows for student additions.
- **PASS — editor guides:** selected views use subtle solid corner guides; clean and mapped product previews are guide-free.
- **PASS — lighting, contrast and clipping:** top-left highlights remain consistent, silhouettes retain thumbnail contrast, and no product or card clips accidentally.
- **PASS — deliberately unfinished shells:** no words, logos, price tags, slogans or finished persuasive content appear in any shell.

All twelve cards are visible in a four-by-three grid. Each card shows both the clean/mapped product view and the editor-selected/editable-skin view. Labels remain legible, selection markers stay subtle, product silhouettes are distinct, and no card overlaps another.

## Captured evidence

- File: `contact-sheet.png`
- Format: PNG
- Dimensions: 1800 × 929 pixels
- Bytes: 153873
- SHA-256: `3ec2da9ed73ecf336cbddcd78b0edd21945f63b30a798d83bde8f5291d022bdb`

The in-app browser's native screenshot route scaled and clipped the rightmost column. The final proof was therefore captured from the same local URL and rendered DOM with the Playwright browser surface, using an element-level screenshot of `main` at CSS scale. The test harness supplied the otherwise absent favicon as an empty 204 response so browser-generated noise could not mask real network failures. No source or generated catalogue file was changed to obtain the proof.
