import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const godotBridgeDocuments = [
  "godot/src/creator/CampaignDocument.gd",
  "godot/src/main/Main.gd",
  "godot/tests/test_creator_bridge.gd",
  "godot/tests/test_creator_host.gd"
];

test("every Godot bridge document uses the canonical 1600 by 900 canvas", async () => {
  const sources = await Promise.all(godotBridgeDocuments.map(async (path) => ({
    path,
    source: await readFile(new URL(path, root), "utf8")
  })));

  for (const { path, source } of sources) {
    assert.doesNotMatch(source, /\b(?:960|540)\b/, `${path} contains a stale canvas dimension`);
  }

  const campaignDocument = sources[0].source;
  assert.match(campaignDocument, /const CANVAS_WIDTH\s*:=\s*1600\b/);
  assert.match(campaignDocument, /const CANVAS_HEIGHT\s*:=\s*900\b/);

  for (const { path, source } of sources.slice(1)) {
    assert.match(
      source,
      /"canvas"\s*:\s*\{\s*"width"\s*:\s*1600\s*,\s*"height"\s*:\s*900\b/,
      `${path} must fixture the canonical canvas`
    );
  }
});

test("Godot JSON integer validation uses the JavaScript safe-integer ceiling", async () => {
  const campaignDocument = await readFile(
    new URL("godot/src/creator/CampaignDocument.gd", root),
    "utf8"
  );
  const bridgeTests = await readFile(
    new URL("godot/tests/test_creator_bridge.gd", root),
    "utf8"
  );

  assert.match(campaignDocument, /const MAX_SAFE_INTEGER\s*:=\s*9007199254740991\b/);
  assert.match(campaignDocument, /number\s*<=\s*MAX_SAFE_INTEGER/);
  assert.match(bridgeTests, /9007199254740992\.0/);
});
