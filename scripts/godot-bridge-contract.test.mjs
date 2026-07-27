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

test("the practice bridge accepts and validates the persisted role-guide flag", async () => {
  const [practiceBridge, bridgeTests, campaignDocument] = await Promise.all([
    readFile(new URL("godot/src/practice/PracticeBridge.gd", root), "utf8"),
    readFile(new URL("godot/tests/test_practice_bridge.gd", root), "utf8"),
    readFile(new URL("web/src/domain/campaign-document.ts", root), "utf8")
  ]);

  assert.match(campaignDocument, /roleGuideAcknowledged:\s*z\.boolean\(\)/);
  assert.match(
    practiceBridge,
    /_has_exact_keys\(value,\s*\[[^\]]*"roleGuideAcknowledged"[^\]]*\]\)/
  );
  assert.match(
    practiceBridge,
    /typeof\(value\.get\("roleGuideAcknowledged"\)\)\s*!=\s*TYPE_BOOL/
  );
  assert.match(bridgeTests, /"roleGuideAcknowledged":\s*true/);
});

test("CreatorHost never prefixes student diagnostics with internal bridge codes or raw close errors", async () => {
  const creatorHost = await readFile(
    new URL("godot/src/creator/CreatorHost.gd", root),
    "utf8"
  );

  assert.doesNotMatch(creatorHost, /_report\("%s:\s*%s"\s*%\s*\[code,\s*message\]\)/);
  assert.doesNotMatch(creatorHost, /could not be saved \(%s\)"\s*%\s*\[code,\s*message\]/);
  assert.doesNotMatch(creatorHost, /could not be returned \(%s\)"\s*%\s*\[code,\s*message\]/);
  assert.match(
    creatorHost,
    /_report\("Draft kept open because it could not be saved\. Try again\."\)/
  );
});

test("the Godot shell mirrors current instructions semantically without pretending to be an editor", async () => {
  const [shell, main, scene] = await Promise.all([
    readFile(new URL("godot/web/godot_shell.html", root), "utf8"),
    readFile(new URL("godot/src/main/Main.gd", root), "utf8"),
    readFile(new URL("godot/src/main/Main.tscn", root), "utf8")
  ]);

  assert.match(shell, /<section id="game-a11y"[^>]*aria-live="polite"[^>]*>/);
  for (const id of ["game-a11y-eyebrow", "game-a11y-heading", "game-a11y-clue", "game-a11y-status"]) {
    assert.match(shell, new RegExp(`id="${id}"`));
  }
  assert.match(shell, /window\.AdMarketGameA11y\s*=\s*Object\.freeze/);
  assert.match(shell, /\.textContent\s*=/);
  assert.doesNotMatch(shell, /game-a11y[^]*?\.innerHTML\s*=/);
  assert.doesNotMatch(shell, /status\.textContent\s*=\s*`Unable to start:\s*\$\{error\.message\}`/);
  assert.match(shell, /status\.textContent\s*=\s*"The game could not start\. Reload the page and try again\."/);
  assert.match(shell, /console\.error\(error\)/);
  assert.match(main, /GameAccessibilityMirror\.new\(\)/);
  assert.match(main, /func _process\(_delta: float\) -> void:/);
  assert.match(
    scene,
    /text = "First you will invent a product, then you will create an advertisement for it\."/
  );
  assert.match(
    scene,
    /text = "Press Tab to move between controls\. Press Enter or Space to use the selected control\."/
  );

  const buttonBlocks = [...scene.matchAll(
    /\[node name="[^"]+" type="Button"[^\]]*\]([\s\S]*?)(?=\n\[node |\s*$)/g
  )];
  assert.ok(buttonBlocks.length >= 7, "Main scene should retain its real interactive buttons");
  for (const [, block] of buttonBlocks) {
    assert.match(block, /theme_override_styles\/focus = SubResource\("Style_focus"\)/);
  }
  assert.doesNotMatch(scene, /\[node name="(?:InventChip|SellChip|IrresistibleChip)" type="Button"/);
});

test("room join failures keep their typed code until Main chooses student copy", async () => {
  const [host, main] = await Promise.all([
    readFile(new URL("godot/src/market/MarketHost.gd", root), "utf8"),
    readFile(new URL("godot/src/main/Main.gd", root), "utf8")
  ]);

  assert.match(host, /signal room_join_failed\(code: String, message: String\)/);
  assert.match(
    host,
    /context\.get\("method"\) == "joinRoom"[\s\S]*?room_join_failed\.emit\(code, message\)[\s\S]*?return/
  );
  assert.match(main, /market_host\.room_join_failed\.connect\(_on_room_join_failed\)/);
  assert.match(main, /func _on_room_join_failed\(code: String, _message: String\) -> void:/);
  assert.match(
    main,
    /_student_market_error\(\s*"INVALID_ROOM_CODE" if code == "INVALID_REQUEST" else code\s*\)/
  );
  assert.match(
    main,
    /"ROOM_NOT_FOUND": "That room could not be found\. Check the code and try again\."/
  );
  assert.match(
    main,
    /"CONNECTION_UNAVAILABLE": "The market could not be reached\. Check the network and try again\."/
  );
});

test("the Godot bridge accepts only the optional bounded retry-after field", async () => {
  const bridge = await readFile(
    new URL("godot/src/market/MarketBridge.gd", root),
    "utf8"
  );

  assert.match(
    bridge,
    /var allowed_error_keys := \["code", "message", "retryAfterSeconds"\]/
  );
  assert.match(
    bridge,
    /error\.has\("retryAfterSeconds"\)[\s\S]*?_is_nonnegative_integer_number\(error\.get\("retryAfterSeconds"\)\)/
  );
  assert.doesNotMatch(bridge, /allowed_error_keys[\s\S]{0,240}"debug"/);
});
