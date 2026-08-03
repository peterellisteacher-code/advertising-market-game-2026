import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const [
  mainScript,
  mainScene,
  marketScript,
  marketScene,
  projectSettings,
  accessibilityMirror,
  marketHost,
  agencyGuideScript,
  agencyGuideScene,
  agencyHudScript,
  agencyHudScene,
  missionPanelScript,
  missionPanelScene,
  missionCatalogScript,
  agencyWorldScript,
  agencyWorldScene
] = await Promise.all([
  readFile(new URL("../godot/src/main/main.gd", import.meta.url), "utf8"),
  readFile(new URL("../godot/src/main/Main.tscn", import.meta.url), "utf8"),
  readFile(new URL("../godot/src/market/ui/market_screen.gd", import.meta.url), "utf8"),
  readFile(new URL("../godot/src/market/ui/MarketScreen.tscn", import.meta.url), "utf8"),
  readFile(new URL("../godot/project.godot", import.meta.url), "utf8"),
  readFile(new URL("../godot/src/main/game_accessibility_mirror.gd", import.meta.url), "utf8"),
  readFile(new URL("../godot/src/market/market_host.gd", import.meta.url), "utf8"),
  readFile(new URL("../godot/src/agency/ui/agency_guide_drawer.gd", import.meta.url), "utf8"),
  readFile(new URL("../godot/src/agency/ui/AgencyGuideDrawer.tscn", import.meta.url), "utf8"),
  readFile(new URL("../godot/src/agency/ui/agency_hud.gd", import.meta.url), "utf8"),
  readFile(new URL("../godot/src/agency/ui/AgencyHud.tscn", import.meta.url), "utf8"),
  readFile(new URL("../godot/src/agency/missions/agency_mission_panel.gd", import.meta.url), "utf8"),
  readFile(new URL("../godot/src/agency/missions/AgencyMissionPanel.tscn", import.meta.url), "utf8"),
  readFile(new URL("../godot/src/agency/agency_mission_catalog.gd", import.meta.url), "utf8"),
  readFile(new URL("../godot/src/agency/agency_world.gd", import.meta.url), "utf8"),
  readFile(new URL("../godot/src/agency/AgencyWorld.tscn", import.meta.url), "utf8")
]);

test("agency quick start presents one action at a time and can be resumed", () => {
  for (const nodeName of [
    "OrientationAction",
    "OrientationItemOneLabel",
    "OrientationItemTwoLabel",
    "OrientationItemThreeLabel",
    "MinimiseOrientation",
    "ResumeOrientation"
  ]) {
    assert.ok(agencyGuideScene.includes(`name="${nodeName}"`), `missing ${nodeName}`);
  }
  assert.match(agencyGuideScript, /func minimise_orientation\(\) -> void:/);
  assert.match(agencyGuideScript, /func resume_orientation\(\) -> void:/);
  assert.match(
    agencyGuideScript,
    /func minimise_orientation\(\) -> void:[\s\S]*?set_tucked\(true\)[\s\S]*?_set_orientation_visible\(false\)/,
    "minimising must tuck the guide before exposing the quick-start resume control"
  );
  assert.ok(agencyGuideScript.includes("Continue quick start"));
  assert.match(
    agencyGuideScript,
    /orientation_acknowledged = true[\s\S]*?direct_travel_requested\.emit\("client-briefing"\)/
  );
  assert.doesNotMatch(agencyGuideScript, /portfolio stamps|Gold, Silver and Bronze/);
});

test("agency quick start keeps its actions inside a 1280 by 800 game view", () => {
  const panelBlock = agencyGuideScene.match(
    /\[node name="OrientationPanel"[\s\S]*?(?=\n\[node name="OrientationMargin")/
  )?.[0] ?? "";
  const itemsBlock = agencyGuideScene.match(
    /\[node name="OrientationItems"[\s\S]*?(?=\n\[node name="OrientationItemOne")/
  )?.[0] ?? "";
  assert.match(panelBlock, /custom_minimum_size = Vector2\(860, 520\)/);
  assert.match(panelBlock, /offset_top = -260\.0/);
  assert.match(panelBlock, /offset_bottom = 260\.0/);
  assert.match(itemsBlock, /size_flags_vertical = 1/);
});

test("agency floor renders above the main shell background", () => {
  const floorBlock = agencyWorldScene.match(
    /\[node name="AgencyFloor"[\s\S]*?(?=\n\[node name="WorldCamera")/
  )?.[0] ?? "";
  assert.match(floorBlock, /z_index = 0/);
  assert.doesNotMatch(floorBlock, /z_index = -/);
});

test("agency volume label avoids runtime percent-format errors", () => {
  assert.ok(agencyGuideScript.includes('"Overall volume: " + str('));
  assert.doesNotMatch(agencyGuideScript, /"Overall volume: %d%%"\s*%/);
});

test("agency quick start does not format unique-node paths as percent strings", () => {
  assert.ok(agencyGuideScript.includes('"%OrientationItem" + suffix'));
  assert.ok(agencyGuideScript.includes('"%OrientationItem" + suffix + "Label"'));
  assert.ok(agencyGuideScript.includes('"%OrientationItem" + suffix + "Text"'));
  assert.doesNotMatch(agencyGuideScript, /"%OrientationItem%s(?:Label|Text)?"\s*%\s*suffix/);
});

test("agency HUD and station card can be tucked without hiding the next action", () => {
  assert.match(agencyHudScript, /func set_compact\(compact: bool\) -> void:/);
  assert.match(agencyHudScript, /func is_compact\(\) -> bool:/);
  assert.ok(agencyHudScene.includes('name="HudTuckToggle"'));
  assert.ok(agencyHudScene.includes('text = "Show campaign details"'));
  for (const nodeName of [
    "StationDetailsToggle",
    "StationPanelTuck",
    "StationPanelTab"
  ]) {
    assert.ok(agencyWorldScene.includes(`name="${nodeName}"`), `missing ${nodeName}`);
  }
  assert.match(
    agencyWorldScript,
    /func _set_station_panel_tucked\(tucked: bool\) -> void:/
  );
  assert.match(
    agencyWorldScript,
    /func _set_station_details_visible\(visible: bool\) -> void:/
  );
});

test("agency mission keeps evidence and a direct role handover beside clickable answers", () => {
  assert.ok(missionCatalogScript.includes('"referenceFacts"'));
  for (const nodeName of [
    "MissionStep",
    "ReferenceCard",
    "ReferenceLabel",
    "ReferenceToggle",
    "RoleDetailsToggle",
    "RoleDefinitionLabel",
    "RoleHandoffButton"
  ]) {
    assert.ok(missionPanelScene.includes(`name="${nodeName}"`), `missing ${nodeName}`);
  }
  assert.match(missionPanelScript, /signal role_handoff_requested\(role: String\)/);
  assert.ok(missionPanelScript.includes("Click one answer"));
  assert.ok(missionPanelScript.includes("Both partners use the same controls"));
  assert.ok(missionPanelScript.includes("Strategist decides audience, purpose, product and message"));
  assert.ok(missionPanelScript.includes("Art Director decides visual design and execution"));
  assert.ok(missionPanelScript.includes("Hide audience brief"));
  assert.match(missionPanelScript, /func show_handoff_error\(\) -> void:/);
  assert.doesNotMatch(
    missionPanelScript,
    /Close this panel first\. Then hand control/
  );
  assert.match(agencyWorldScript, /func _on_mission_role_handoff_requested\(role: String\) -> void:/);
});

test("game shell uses the full 16:10 school MacBook viewport", () => {
  assert.match(projectSettings, /window\/size\/viewport_width=1280/);
  assert.match(projectSettings, /window\/size\/viewport_height=800/);
  assert.match(mainScene, /name="MainMargin"[\s\S]*?offset_top = 96\.0[\s\S]*?offset_bottom = -24\.0/);
});

test("final review uses a compact checklist without repeating completed level progress", () => {
  assert.match(
    mainScene,
    /name="ReviewChecks" type="GridContainer"[\s\S]*?columns = 2/
  );
  for (const reviewName of [
    "ReviewAudience",
    "ReviewValue",
    "ReviewAida",
    "ReviewVisual",
    "ReviewClaim"
  ]) {
    assert.match(
      mainScene,
      new RegExp(
        `name="${reviewName}" type="CheckBox" parent="MainMargin/GameInput/RunPanel/RunContent/FinalReview/ReviewContent/ReviewChecks"`
      )
    );
  }
  assert.match(mainScript, /level_progress\.visible = phase != "publish-check"/);
});

test("brand row reserves the account-control area without covering permanent instructions", () => {
  assert.match(
    mainScene,
    /name="AccountClearance" type="Control" parent="MainMargin\/GameInput\/BrandRow"[\s\S]*?custom_minimum_size = Vector2\(420, 0\)/
  );
});

test("student lobby keeps teacher controls behind explicit disclosure", () => {
  assert.match(mainScene, /name="TeacherSetupToggle"[\s\S]*?text = "Teacher setup"/);
  assert.match(mainScene, /name="HostArea"[\s\S]*?unique_name_in_owner = true[\s\S]*?visible = false/);
  assert.match(mainScript, /teacher_setup_toggle\.pressed\.connect\(_toggle_teacher_setup\)/);
  assert.match(mainScene, /text = "PAIR PLAY  •  ONE MACBOOK"/);
});

test("student lobby makes local practice the immediate route and keeps one game identity", () => {
  assert.match(mainScene, /text = "AD MARKET \/\/ GAME"/);
  assert.match(
    mainScene,
    /text = "First you will invent a product, then you will create an advertisement for it\."/
  );
  assert.doesNotMatch(mainScene, /Invent it\. Advertise it\. Judge the market\./);
  assert.match(
    mainScene,
    /name="JoinLiveMarket"[\s\S]*?theme_override_styles\/normal = SubResource\("Style_secondary"\)/
  );
  assert.match(
    mainScene,
    /name="StartRun"[\s\S]*?theme_override_styles\/normal = SubResource\("Style_primary"\)/
  );
  assert.match(mainScene, /text = "Pair alias \(practice or live room\)"/);
  assert.match(marketScene, /text = "AD MARKET \/\/ MEDAL GALLERY"/);
  assert.doesNotMatch(
    mainScript,
    /func _begin_startup\(\) -> void:[\s\S]*?start_button\.disabled = true[\s\S]*?market_host\.resume_session\(\)/
  );
});

test("run screen reveals one concrete next requirement at a time", () => {
  for (const instruction of [
    "Next: build a product in the studio.",
    "Next: add a product name.",
    "Next: choose an audience signal.",
    "Next: swap roles once.",
    "Next: link one choice to Attention.",
    "Next: add a price.",
    "Next: choose and lock a market route.",
    "Next: add a proof point to the market route."
  ]) {
    assert.ok(mainScript.includes(instruction), `missing progressive instruction: ${instruction}`);
  }
  assert.match(mainScript, /level_clue\.text = readiness_clue/);
  assert.doesNotMatch(mainScript, /before the buzzer/i);
});

test("instructions and final review remain explicit in the game shell", () => {
  assert.match(mainScene, /name="ReviewInstructions"[\s\S]*?text = "Review all instructions"/);
  assert.match(mainScene, /name="InstructionsDialog"[\s\S]*?title = "Advertising campaign instructions"/);
  for (const text of [
    "Audience and product",
    "Product and advertisement",
    "Advertisement and credible offer",
    "Final judgement",
    "Overall conclusion",
    "The product and message suit the audience brief.",
    "The product value and visible price are clear.",
    "Attention, Interest, Desire and Action are all visible.",
    "The visual technique supports the message.",
    "The main claim is clear and supported by a proof point."
  ]) {
    assert.ok(mainScene.includes(text), `missing permanent instruction or final-review text: ${text}`);
  }
  assert.match(
    mainScript,
    /var complete := _final_review_complete\(\)[\s\S]*?publish_campaign\.disabled = not complete/
  );
  for (const reviewName of [
    "ReviewAudience",
    "ReviewValue",
    "ReviewAida",
    "ReviewVisual",
    "ReviewClaim"
  ]) {
    const review = mainScene.match(
      new RegExp(`name="${reviewName}"[\\s\\S]*?(?=\\n\\[node name=)`)
    )?.[0] ?? "";
    assert.match(review, /theme_override_colors\/font_color = Color\(0\.0901961, 0\.129412, 0\.168627, 1\)/);
    assert.match(review, /theme_override_colors\/font_pressed_color = Color\(0\.0901961, 0\.129412, 0\.168627, 1\)/);
    assert.match(review, /theme_override_colors\/font_hover_color = Color\(0\.0901961, 0\.129412, 0\.168627, 1\)/);
  }
});

test("the full linked argument and role guide remain available throughout pair play", () => {
  assert.match(mainScene, /name="ReviewInstructions"[\s\S]*?text = "Review all instructions"/);
  assert.match(mainScene, /name="RoleGuide"[\s\S]*?text = "Role guide"/);
  assert.match(mainScene, /name="RoleGuideDialog"[\s\S]*?title = "Pair role guide"/);
  for (const copy of [
    "Both partners can use the same tools that are available in the current level",
    "The roles do not unlock different buttons",
    "Art Director is responsible for what the advertisement looks like",
    "Strategist is responsible for what the advertisement says",
    "The active role tells you whose turn should make the next change",
    "Context is the situation the audience is in",
    "A premise is a reason",
    "Audience and product",
    "Product and advertisement",
    "Advertisement and credible offer",
    "Final judgement",
    "Overall conclusion"
  ]) {
    assert.ok(mainScene.includes(copy), `missing permanent guide copy: ${copy}`);
  }
  assert.match(mainScript, /role_guide\.pressed\.connect\(_show_role_guide\)/);
  assert.match(mainScript, /func _restore_dialog_focus\(\) -> void:/);
});

test("market completion has one explicit, keyboard-ordered transition", () => {
  const nodeBlock = (name) => mainScene.match(
    new RegExp(`\\[node name="${name}"[^\\]]*\\]([\\s\\S]*?)(?=\\n\\[node |\\s*$)`)
  )?.[0] ?? "";
  const focusSequence = [
    ["ReviewAudience", "../ReviewValue"],
    ["ReviewValue", "../ReviewAida"],
    ["ReviewAida", "../ReviewVisual"],
    ["ReviewVisual", "../ReviewClaim"],
    ["ReviewClaim", "../../../../ActionRow/PublishCampaign"],
    ["PublishCampaign", "../EnterMarket"]
  ];
  for (const [name, next] of focusSequence) {
    assert.match(
      nodeBlock(name),
      new RegExp(`focus_next = NodePath\\("${next.replaceAll("/", "\\/")}"\\)`),
      `${name} must lead to ${next}`
    );
  }
  assert.match(nodeBlock("EnterMarket"), /text = "Enter market"/);
  assert.match(nodeBlock("EnterMarket"), /visible = false/);
  assert.match(mainScript, /enter_market\.pressed\.connect\(_enter_market\)/);
  assert.match(mainScript, /func _apply_market_completion\(snapshot: Dictionary\) -> bool:/);
  assert.match(
    mainScript,
    /if _game_run\.phase != "publish-check":[\s\S]*?return _game_run\.phase in \["market", "reveal"\]/
  );
  assert.match(
    mainScript,
    /func _finish_resumed_team[\s\S]*?_apply_market_completion\(_latest_market_snapshot\)[\s\S]*?market_screen\.show\(\)/
  );
  assert.match(mainScript, /_room_campaign_submitted[\s\S]*?_show_market_entry_gate\(\)/);
});

test("typed room and polling failures have distinct student copy", () => {
  const expected = new Map([
    ["INVALID_ROOM_CODE", "Enter the room code in the format ABC-234."],
    ["ROOM_NOT_FOUND", "That room could not be found. Check the code and try again."],
    ["ROOM_UNAVAILABLE", "That room is not available. Ask your teacher what to do next."],
    ["CONNECTION_TIMEOUT", "The connection took too long. Check the network and try again."],
    ["CONNECTION_UNAVAILABLE", "The market could not be reached. Check the network and try again."],
    ["RATE_LIMITED", "Too many requests were sent. Wait briefly, then try again."],
    ["SESSION_EXPIRED", "This market session has ended. Rejoin the room to continue."]
  ]);
  for (const [code, copy] of expected) {
    assert.ok(mainScript.includes(`"${code}": "${copy}"`), `missing ${code} copy`);
  }
  assert.match(mainScript, /func _student_market_error\(code: String\) -> String:/);
  assert.match(marketHost, /signal market_request_failed\(code: String, message: String\)/);
  assert.match(marketHost, /market_request_failed\.emit\(code, message\)/);
  assert.match(marketScript, /func _on_market_request_failed\(code: String, _message: String\) -> void:/);
  assert.doesNotMatch(
    mainScript,
    /The live room could not update\. Check the room code or connection/
  );
});

test("the accessibility mirror carries instruction, completion, focus and keyboard context", () => {
  for (const key of [
    "currentInstruction",
    "completionStatus",
    "focusedControl",
    "keyboardHint"
  ]) {
    assert.ok(accessibilityMirror.includes(`"${key}"`), `missing mirror field ${key}`);
  }
  assert.match(mainScript, /@onready var keyboard_hint: Label = %KeyboardHint/);
  assert.match(mainScript, /func _focused_control_label\(\) -> String:/);
  assert.match(mainScript, /_focused_control_label\(\),\s*keyboard_hint\.text/);
  assert.match(marketScript, /func accessibility_state\(\) -> Dictionary:/);
});

test("new medal rooms never show purchase-era market instructions", () => {
  for (const instruction of [
    "Market card live. Browse the gallery and award Gold, Silver and Bronze.",
    "Your ad is live. Award the medals.",
    "Score every other ad, then award one Gold, one Silver and one Bronze to three different ads."
  ]) {
    assert.ok(mainScript.includes(instruction), `missing medal-market instruction: ${instruction}`);
  }
  assert.doesNotMatch(mainScript, /Browse the stalls and spend your budget\./);
  assert.doesNotMatch(mainScript, /Your stall is open\. Shop the room\./);
  assert.doesNotMatch(mainScript, /Spend at least \$80 across products/);
});

test("medal gallery requires a complete local five-criterion scorecard", () => {
  for (const criterion of [
    '["audience", "Audience fit"]',
    '["value", "Product value and price"]',
    '["aida", "AIDA"]',
    '["visual", "Visual technique"]',
    '["claim", "Credible claim"]'
  ]) {
    assert.ok(marketScript.includes(criterion), `missing gallery criterion: ${criterion}`);
  }
  assert.match(marketScript, /var _scorecards: Dictionary = \{\}/);
  assert.match(marketScript, /OptionButton\.new\(\)/);
  assert.ok(marketScript.includes("Score: %d / 10"));
  assert.ok(marketScript.includes("Score every other advertisement before submitting the medals."));
  assert.match(marketScript, /_all_awardable_scorecards_complete/);
});
