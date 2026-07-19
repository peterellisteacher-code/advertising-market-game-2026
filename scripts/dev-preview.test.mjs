import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const previewUrl = new URL("../index.html", import.meta.url);

test("the Vite preview supplies the locked shell and opens an offline Creator document", async () => {
  const html = await readFile(previewUrl, "utf8");

  assert.match(
    html,
    /<main\s+aria-label="Advertising Market Game"\s+hidden\s+inert\s+aria-hidden="true">/u
  );
  assert.match(html, /<canvas\s+id="canvas"\s+tabindex="-1"/u);
  assert.match(
    html,
    /data-offline-catalogue-url="\/catalog\/generated\/offline-core-v1\/catalog\.json"/u
  );
  assert.match(
    html,
    /data-logo-icon-catalogue-url="\/catalog\/generated\/logo-icons-v1-reviewed\/catalog\.json"/u
  );
  assert.match(html, /createBlankCampaignDocument/u);
  assert.match(html, /await import\("\/web\/src\/main\.ts"\)/u);
  assert.match(html, /window\.AdMarketCreator\.handle/u);
  assert.doesNotMatch(html, /AdMarketAccount\.requireAccess/u);
});
