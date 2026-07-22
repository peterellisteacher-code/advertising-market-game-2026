import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const [mainScript, mainScene, marketScene] = await Promise.all([
  readFile(new URL("../godot/src/main/Main.gd", import.meta.url), "utf8"),
  readFile(new URL("../godot/src/main/Main.tscn", import.meta.url), "utf8"),
  readFile(new URL("../godot/src/market/ui/MarketScreen.tscn", import.meta.url), "utf8")
]);

test("student lobby keeps teacher controls behind explicit disclosure", () => {
  assert.match(mainScene, /name="TeacherSetupToggle"[\s\S]*?text = "Teacher setup"/);
  assert.match(mainScene, /name="HostArea"[\s\S]*?unique_name_in_owner = true[\s\S]*?visible = false/);
  assert.match(mainScript, /teacher_setup_toggle\.pressed\.connect\(_toggle_teacher_setup\)/);
  assert.match(mainScene, /text = "PAIR PLAY  •  ONE MACBOOK"/);
});

test("student lobby makes local practice the immediate route and keeps one game identity", () => {
  assert.match(mainScene, /text = "AD MARKET \/\/ GAME"/);
  assert.match(mainScene, /text = "Invent it\. Advertise it\. Judge the market\."/);
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
    "Next: choose and lock a market route."
  ]) {
    assert.ok(mainScript.includes(instruction), `missing progressive instruction: ${instruction}`);
  }
  assert.match(mainScript, /level_clue\.text = readiness_clue/);
  assert.doesNotMatch(mainScript, /before the buzzer/i);
});

test("new medal rooms never show purchase-era market instructions", () => {
  for (const instruction of [
    "Market card live. Browse the gallery and award Gold, Silver and Bronze.",
    "Your ad is live. Award the medals.",
    "Score every other ad, then award one Gold, one Silver and one Bronze to different ads."
  ]) {
    assert.ok(mainScript.includes(instruction), `missing medal-market instruction: ${instruction}`);
  }
  assert.doesNotMatch(mainScript, /Browse the stalls and spend your budget\./);
  assert.doesNotMatch(mainScript, /Your stall is open\. Shop the room\./);
  assert.doesNotMatch(mainScript, /Spend at least \$80 across products/);
});
