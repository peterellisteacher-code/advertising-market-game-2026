import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const godotBridgeDocuments = [
  "godot/src/creator/campaign_document.gd",
  "godot/src/main/main.gd",
  "godot/tests/test_creator_bridge.gd",
  "godot/tests/test_creator_host.gd"
];

function recoveryProgram(shell) {
  const start = shell.indexOf('const GAME_ACCESS_RECOVERY_KEY =');
  const end = shell.indexOf('const engine = new Engine(', start);
  assert.ok(start >= 0, "recovery program start must remain identifiable");
  assert.ok(end > start, "recovery program end must remain identifiable");
  return shell.slice(start, end);
}

function recoveryHarness(program, options = {}) {
  const storage = options.storage ?? new Map();
  const replacements = [];
  const timers = [];
  const microtasks = [];
  let reloads = 0;
  const location = {
    href: options.href ?? "https://example.test/game?teacher=1#play",
    reload() {
      reloads += 1;
    }
  };
  const history = {
    replaceState(_state, _title, next) {
      replacements.push(next);
      location.href = new URL(next, location.href).href;
    }
  };
  const document = { activeElement: null };
  function element(tagName) {
    const listeners = new Map();
    return {
      tagName: tagName.toUpperCase(),
      attributes: new Map(),
      children: [],
      className: "",
      textContent: "",
      type: "",
      addEventListener(name, listener) {
        listeners.set(name, listener);
      },
      append(...children) {
        this.children.push(...children);
      },
      click() {
        listeners.get("click")?.();
      },
      focus() {
        document.activeElement = this;
      },
      getAttribute(name) {
        return this.attributes.get(name) ?? null;
      },
      setAttribute(name, value) {
        this.attributes.set(name, value);
      }
    };
  }
  const gateRoot = {
    children: [],
    className: "",
    hidden: true,
    replaceChildren(...children) {
      this.children = children;
    }
  };
  document.createElement = element;
  document.getElementById = (id) => id === "account-gate-root" ? gateRoot : null;
  const sessionStorage = options.storageDenied ? {
    getItem() { throw new Error("storage denied"); },
    setItem() { throw new Error("storage denied"); },
    removeItem() { throw new Error("storage denied"); }
  } : {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); }
  };
  const window = {
    AdMarketGameAccess: options.existingController,
    history,
    location,
    setTimeout(callback, delay) {
      timers.push({ callback, delay });
      return timers.length;
    }
  };
  vm.runInNewContext(program, {
    URL,
    document,
    queueMicrotask(callback) { microtasks.push(callback); },
    sessionStorage,
    window
  });
  return {
    document,
    gateRoot,
    location,
    microtasks,
    reloadCount: () => reloads,
    replacements,
    storage,
    timers,
    window
  };
}

test("game run keeps one indentation style after student-copy edits", async () => {
  const gameRun = await readFile(
    new URL("godot/src/game/game_run.gd", root),
    "utf8"
  );
  assert.doesNotMatch(gameRun, /^\t/m, "game_run.gd uses spaces and must not mix tab indentation");
});

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
    new URL("godot/src/creator/campaign_document.gd", root),
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
    readFile(new URL("godot/src/practice/practice_bridge.gd", root), "utf8"),
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
    new URL("godot/src/creator/creator_host.gd", root),
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
    readFile(new URL("godot/src/main/main.gd", root), "utf8"),
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
  assert.match(shell, /AdMarketGameAccess\.reportStartupFailure\("timeout"\)/);
  assert.match(shell, /AdMarketGameAccess\.reportStartupFailure\("engine"\)/);
  assert.match(shell, /if\s*\(\s*!window\.AdMarketGameAccess\s*\)/);
  assert.match(shell, /sessionStorage\.getItem\(GAME_ACCESS_RECOVERY_KEY\)/);
  assert.match(shell, /const GAME_ACCESS_RECOVERY_QUERY\s*=/);
  assert.match(shell, /url\.searchParams\.set\(GAME_ACCESS_RECOVERY_QUERY, "1"\)/);
  assert.match(shell, /url\.searchParams\.delete\(GAME_ACCESS_RECOVERY_QUERY\)/);
  assert.match(shell, /window\.history\.replaceState/);
  assert.match(shell, /window\.location\.reload\(\)/);
  assert.match(shell, /window\.AdMarketGameAccess\s*=\s*Object\.freeze\(\{/);
  assert.match(shell, /console\.error\("\[AdMarket game startup failed\]", \{ reason \}\)/);
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
    assert.match(block, /theme_override_styles\/focus = SubResource\("[^"]+"\)/);
  }
  assert.doesNotMatch(scene, /\[node name="(?:InventChip|SellChip|IrresistibleChip)" type="Button"/);
});

test("the fallback game-access controller reloads once then exposes an accessible retry boundary", async () => {
  const shell = await readFile(
    new URL("godot/web/godot_shell.html", root),
    "utf8"
  );
  const program = recoveryProgram(shell);

  const deniedFirstLoad = recoveryHarness(program, { storageDenied: true });
  await assert.rejects(
    deniedFirstLoad.window.AdMarketGameAccess.requireAccess(),
    /controller unavailable/i
  );
  deniedFirstLoad.window.AdMarketGameAccess.reportStartupFailure("engine");
  assert.equal(deniedFirstLoad.replacements.length, 1);
  const deniedRecoveryUrl = new URL(deniedFirstLoad.location.href);
  assert.equal(deniedRecoveryUrl.searchParams.get("gameAccessRecovery"), "1");
  assert.equal(deniedRecoveryUrl.searchParams.get("teacher"), "1");
  assert.equal(deniedRecoveryUrl.hash, "#play");
  assert.equal(deniedFirstLoad.timers.length, 1, "first failure schedules one reload");
  assert.equal(deniedFirstLoad.timers[0].delay, 250);
  deniedFirstLoad.window.AdMarketGameAccess.reportStartupFailure("timeout");
  assert.equal(deniedFirstLoad.timers.length, 1, "duplicate failures share the pending reload");
  assert.equal(
    deniedFirstLoad.gateRoot.children.length,
    0,
    "a duplicate failure must not expose the terminal boundary before the recovery reload"
  );
  deniedFirstLoad.timers[0].callback();
  assert.equal(deniedFirstLoad.reloadCount(), 1);

  const deniedSecondLoad = recoveryHarness(program, {
    href: deniedFirstLoad.location.href,
    storageDenied: true
  });
  deniedSecondLoad.window.AdMarketGameAccess.reportStartupFailure("engine");
  assert.equal(deniedSecondLoad.timers.length, 0, "second failure must not reload-loop");
  assert.equal(deniedSecondLoad.gateRoot.hidden, false);
  assert.equal(deniedSecondLoad.gateRoot.className, "account-access");
  assert.equal(deniedSecondLoad.gateRoot.children.length, 1);
  const panel = deniedSecondLoad.gateRoot.children[0];
  assert.equal(panel.className, "account-access__card");
  assert.equal(panel.getAttribute("role"), null, "the interactive section is not an alert");
  const [, message, retry] = panel.children;
  assert.equal(message.getAttribute("role"), "alert");
  assert.equal(retry.textContent, "Reload game");
  assert.equal(deniedSecondLoad.microtasks.length, 1);
  deniedSecondLoad.microtasks[0]();
  assert.equal(deniedSecondLoad.document.activeElement, retry);
  retry.click();
  assert.equal(deniedSecondLoad.reloadCount(), 1);

  const storage = new Map();
  const storedFirstLoad = recoveryHarness(program, { storage });
  storedFirstLoad.window.AdMarketGameAccess.reportStartupFailure("timeout");
  assert.equal(storage.get("admarket-game-access-recovery"), "1");
  assert.equal(storedFirstLoad.timers.length, 1);
  const storedSecondLoad = recoveryHarness(program, { storage });
  storedSecondLoad.window.AdMarketGameAccess.reportStartupFailure("timeout");
  assert.equal(storedSecondLoad.timers.length, 0);
  assert.equal(storedSecondLoad.gateRoot.children.length, 1);

  storage.set("admarket-game-access-recovery", "1");
  const liveController = Object.freeze({ requireAccess() {} });
  const recovered = recoveryHarness(program, {
    existingController: liveController,
    href: "https://example.test/game?teacher=1&gameAccessRecovery=1#play",
    storage
  });
  assert.equal(recovered.window.AdMarketGameAccess, liveController);
  assert.equal(storage.has("admarket-game-access-recovery"), false);
  assert.equal(new URL(recovered.location.href).searchParams.has("gameAccessRecovery"), false);
  assert.equal(new URL(recovered.location.href).searchParams.get("teacher"), "1");
  assert.equal(new URL(recovered.location.href).hash, "#play");

  const deniedRecovered = recoveryHarness(program, {
    existingController: liveController,
    href: "https://example.test/game?teacher=1&gameAccessRecovery=1#play",
    storageDenied: true
  });
  assert.equal(deniedRecovered.window.AdMarketGameAccess, liveController);
  assert.equal(new URL(deniedRecovered.location.href).searchParams.has("gameAccessRecovery"), false);
  assert.equal(new URL(deniedRecovered.location.href).searchParams.get("teacher"), "1");
  assert.equal(new URL(deniedRecovered.location.href).hash, "#play");
});

test("the browser reduced-motion preference reaches both Godot motion surfaces", async () => {
  const [shell, mirror, main] = await Promise.all([
    readFile(new URL("godot/web/godot_shell.html", root), "utf8"),
    readFile(new URL("godot/src/main/game_accessibility_mirror.gd", root), "utf8"),
    readFile(new URL("godot/src/main/main.gd", root), "utf8")
  ]);

  assert.match(shell, /matchMedia\(["']\(prefers-reduced-motion:\s*reduce\)["']\)/);
  assert.match(shell, /addEventListener\(["']change["']/);
  assert.match(shell, /reducedMotion\(\)/);
  assert.match(shell, /watchReducedMotion\(callback\)/);
  assert.match(mirror, /JavaScriptBridge\.create_callback/);
  assert.match(mirror, /bridge\.watchReducedMotion\(_reduced_motion_callback\)/);
  assert.match(main, /reduced_motion_changed\.connect\(_on_reduced_motion_changed\)/);
  assert.match(main, /agency_world\.set_reduced_motion_enabled\(enabled\)/);
  assert.match(main, /pitch_theatre\.set_reduced_motion_enabled\(enabled\)/);
});

test("the deployed game shell locks gameplay to the viewport without trapping the teacher dashboard", async () => {
  const shell = await readFile(
    new URL("godot/web/godot_shell.html", root),
    "utf8"
  );

  assert.match(shell, /<html lang="en-AU">/);
  assert.match(shell, /body:not\(:has\(\[data-admarket-route="teacher-dashboard"\]\)\)/);
  assert.match(shell, /height:\s*100dvh/);
  assert.match(shell, /overflow:\s*hidden/);
  assert.match(shell, /class="game-skip-link"[^>]*href="#canvas"/);
  // The canvas must be a block box sized from CSS. Left unstyled it is an inline
  // element laid out from its width and height attributes, which Godot writes in
  // device pixels, so any display above 100% scaling overflows the viewport.
  assert.match(shell, /#canvas\s*\{[^}]*display:\s*block/);
  assert.match(shell, /#canvas\s*\{[^}]*width:\s*100%/);
  assert.match(shell, /#canvas\s*\{[^}]*height:\s*100%/);
  assert.match(shell, /body\s*>\s*main\s*\{[^}]*height:\s*100%/);
  assert.match(shell, /--space-2:\s*\.65rem/);
  assert.match(shell, /--space-3:\s*\.85rem/);
  assert.match(shell, /padding:\s*var\(--space-2\) var\(--space-3\)/);
  assert.doesNotMatch(shell, /--game-skip-link-padding/);
  assert.match(shell, /\.game-skip-link:focus/);
});

test("room join failures keep their typed code until Main chooses student copy", async () => {
  const [host, main] = await Promise.all([
    readFile(new URL("godot/src/market/market_host.gd", root), "utf8"),
    readFile(new URL("godot/src/main/main.gd", root), "utf8")
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
    new URL("godot/src/market/market_bridge.gd", root),
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

test("published campaigns use the isolated pitch theatre before the market gate", async () => {
  const [scene, main, theatre, decoder] = await Promise.all([
    readFile(new URL("godot/src/main/Main.tscn", root), "utf8"),
    readFile(new URL("godot/src/main/main.gd", root), "utf8"),
    readFile(new URL("godot/src/presentation/pitch_theatre.gd", root), "utf8"),
    readFile(new URL("godot/src/presentation/campaign_image_decoder.gd", root), "utf8")
  ]);

  assert.match(scene, /res:\/\/src\/presentation\/PitchTheatre\.tscn/);
  assert.match(scene, /\[node name="PitchTheatre"[^\]]*parent="\."/);
  assert.match(main, /@onready var pitch_theatre: AdMarketPitchTheatre = %PitchTheatre/);
  assert.match(
    main,
    /pitch_theatre\.present\(publication, progress, agency_world\.reduced_motion_enabled\)/
  );
  assert.match(main, /func _complete_pitch_when_ready\(\) -> void:/);
  assert.match(main, /not _pitch_finished or not _pitch_market_ready/);
  assert.match(theatre, /_assign_exact_texture\(decoded\)/);
  assert.match(decoder, /const PUBLICATION_CONTRACT := "published-campaign@1"/);
  assert.match(decoder, /const CANVAS_WIDTH := 1600/);
  assert.match(decoder, /const CANVAS_HEIGHT := 900/);
  assert.match(
    decoder,
    /image\.get_width\(\) != CANVAS_WIDTH or image\.get_height\(\) != CANVAS_HEIGHT/
  );

  for (const source of [main, theatre, decoder]) {
    assert.doesNotMatch(source, /window\.AdMarketAccount|pairIdentity|account\/session/);
  }
});

test("agency ambience, music and rewards use the documented CC0 audio cues", async () => {
  const [mainScene, main, audioScene, audioManager, provenance] = await Promise.all([
    readFile(new URL("godot/src/main/Main.tscn", root), "utf8"),
    readFile(new URL("godot/src/main/main.gd", root), "utf8"),
    readFile(new URL("godot/src/audio/AgencyAudio.tscn", root), "utf8"),
    readFile(new URL("godot/src/audio/agency_audio_manager.gd", root), "utf8"),
    readFile(new URL("godot/assets/audio/ASSET-SOURCES.md", root), "utf8")
  ]);

  assert.match(mainScene, /res:\/\/src\/audio\/AgencyAudio\.tscn/);
  assert.match(mainScene, /\[node name="AgencyAudio"[^\]]*parent="\."/);
  assert.match(main, /@onready var agency_audio: AdMarketAgencyAudioManager = %AgencyAudio/);
  assert.match(main, /pitch_theatre\.sound_requested\.connect\(_on_pitch_sound_requested\)/);
  assert.match(main, /func _on_pitch_sound_requested\(cue_id: String\) -> void:\s+agency_audio\.play_sfx\(cue_id\)/);
  assert.match(main, /agency_audio\.play_cue\("portfolio-stamp"\)/);

  for (const cue of [
    ["camera", "camera-shutter.ogg"],
    ["swoosh", "pitch-swoosh.ogg"],
    ["portfolio-stamp", "portfolio-stamp.ogg"],
    ["office", "office-loop.ogg"],
    ["pitch", "pitch-loop.ogg"],
    ["ui-confirm", "ui-confirm.ogg"],
    ["ui-move", "ui-move.ogg"]
  ]) {
    const [cueId, fileName] = cue;
    assert.match(audioManager, new RegExp(`"${cueId}"`));
    assert.match(audioScene, new RegExp(`res://assets/audio/${fileName.replace(".", "\\.")}`));
    assert.match(provenance, new RegExp(`\\\`${fileName.replace(".", "\\.")}\\\``));
  }

  assert.match(provenance, /All seven sounds are distributed under Creative Commons Zero \(CC0\)/);
  for (const sourceHash of [
    "029dfcb981fdf375fb0ae4657962b3d470e1a073932c3d3aefb15d3d9ba38670",
    "2d55b26f918a4d8042e2c97a4db81392757195f5aaac9039f5ec2c557b6f11f2",
    "946fc23a63d535d693eb31b2eabb80c8c28d6351e2186b344ceb71b2cb1d5eb6"
  ]) {
    assert.match(provenance, new RegExp(sourceHash));
  }
});

test("agency world travel keeps every room reachable without redundant role labels", async () => {
  const [world, worldScene, stationScene, pairScene] = await Promise.all([
    readFile(new URL("godot/src/agency/agency_world.gd", root), "utf8"),
    readFile(new URL("godot/src/agency/AgencyWorld.tscn", root), "utf8"),
    readFile(new URL("godot/src/agency/stations/AgencyStation.tscn", root), "utf8"),
    readFile(new URL("godot/src/agency/player/AgencyPair.tscn", root), "utf8")
  ]);

  const stationIds = [
    "reception",
    "client-briefing",
    "strategy-room",
    "art-studio",
    "copy-room",
    "production-studio",
    "media-desk",
    "sound-booth",
    "pitch-theatre"
  ];
  const arrivalOffsets = world.match(/const STATION_ARRIVAL_OFFSETS := \{([\s\S]*?)\n\}/)?.[1] ?? "";
  for (const stationId of stationIds) {
    assert.match(arrivalOffsets, new RegExp(`"${stationId}":\\s*Vector2\\(`));
  }
  assert.match(world, /const NEAR_STATION_DISTANCE := 92\.0/);
  assert.match(arrivalOffsets, /"client-briefing":\s*Vector2\(0\.0,\s*90\.0\)/);
  assert.match(worldScene, /\[sub_resource type="RectangleShape2D" id="RectangleShape2D_client_briefing"\]\s*size = Vector2\(112, 118\)/);
  assert.match(worldScene, /\[node name="ClientBriefingFixture" type="CollisionShape2D" parent="WorldBounds"/);

  assert.match(stationScene, /\[node name="RoomLabel" type="Label" parent="\."/);
  assert.match(stationScene, /theme_override_styles\/normal = SubResource\("StyleBoxFlat_room_label"\)/);
  assert.match(stationScene, /theme_override_font_sizes\/font_size = 16/);
  assert.doesNotMatch(stationScene, /OwnerRoleBadge/);
  assert.doesNotMatch(pairScene, /(?:ArtDirectorLabel|StrategistLabel)/);
  assert.match(world, /tab\.text = "Open %s" % String\(record\.get\("title"/);
});

test("missionEvidence parity: the Godot bridge validates it and the web schema declares it optional", async () => {
  const [campaignDocumentGd, campaignDocumentTs] = await Promise.all([
    readFile(new URL("godot/src/creator/campaign_document.gd", root), "utf8"),
    readFile(new URL("web/src/domain/campaign-document.ts", root), "utf8")
  ]);

  assert.match(campaignDocumentGd, /if document\.has\("missionEvidence"\):/);
  assert.match(campaignDocumentGd, /static func _valid_mission_evidence\(value: Variant\) -> bool:/);
  assert.match(campaignDocumentGd, /const MAX_MISSION_EVIDENCE_ENTRIES\s*:=\s*24\b/);
  assert.match(
    campaignDocumentGd,
    /const MISSION_EVIDENCE_KEYS\s*:=\s*\["missionId",\s*"title",\s*"decisionId",\s*"effectText"\]/
  );

  assert.match(
    campaignDocumentTs,
    /const missionEvidenceEntry = z\.object\(\{[\s\S]*?missionId:\s*z\.string\(\)[\s\S]*?title:\s*z\.string\(\)[\s\S]*?decisionId:\s*z\.string\(\)[\s\S]*?effectText:\s*z\.string\(\)[\s\S]*?\}\)\.strict\(\)/
  );
  assert.match(campaignDocumentTs, /const missionEvidence = z\.array\(missionEvidenceEntry\)\.max\(24\)/);
  assert.match(campaignDocumentTs, /missionEvidence:\s*missionEvidence\.optional\(\)/);
});

test("every station's proximity position matches the station node placed in the scene", async () => {
  const [world, worldScene] = await Promise.all([
    readFile(new URL("godot/src/agency/agency_world.gd", root), "utf8"),
    readFile(new URL("godot/src/agency/AgencyWorld.tscn", root), "utf8")
  ]);

  // STATION_DATA drives _station_position(), which gates the near-station check,
  // the interaction test and the nearest-station search. The Stations nodes draw
  // the marker the pair actually sees. When the two drift apart the hotspot sits
  // away from its icon, so they are asserted equal here rather than maintained
  // by hand in two places.
  const nodeNames = new Map(
    [...world.matchAll(/"([a-z-]+)":\s*"([A-Za-z]+)",/g)]
      .map((entry) => [entry[1], entry[2]])
  );

  const scriptPositions = new Map(
    [...world.matchAll(
      /"id":\s*"([a-z-]+)",[\s\S]{0,240}?"position":\s*Vector2\(([-\d.]+),\s*([-\d.]+)\)/g
    )].map((entry) => [entry[1], [Number(entry[2]), Number(entry[3])]])
  );

  const scenePositions = new Map(
    [...worldScene.matchAll(
      /\[node name="([A-Za-z]+)" parent="Stations"[^\]]*\]\s*\nposition = Vector2\(([-\d.]+),\s*([-\d.]+)\)/g
    )].map((entry) => [entry[1], [Number(entry[2]), Number(entry[3])]])
  );

  assert.ok(scriptPositions.size >= 9, `expected 9+ stations, got ${scriptPositions.size}`);
  assert.equal(scenePositions.size, scriptPositions.size);

  for (const [stationId, [sx, sy]] of scriptPositions) {
    const nodeName = nodeNames.get(stationId);
    assert.ok(nodeName, `station ${stationId} has no node name`);
    const placed = scenePositions.get(nodeName);
    assert.ok(placed, `station node ${nodeName} is missing from AgencyWorld.tscn`);
    assert.ok(
      Math.hypot(placed[0] - sx, placed[1] - sy) < 0.5,
      `${stationId}: script position (${sx}, ${sy}) does not match scene node ` +
        `${nodeName} at (${placed[0]}, ${placed[1]})`
    );
  }
});
