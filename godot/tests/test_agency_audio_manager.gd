extends Node
class_name AdMarketAgencyAudioManagerTest

const AUDIO_SCENE_PATH := "res://src/audio/AgencyAudio.tscn"
const OFFICE_LOOP_PATH := "res://assets/audio/office-loop.ogg"
const PITCH_LOOP_PATH := "res://assets/audio/pitch-loop.ogg"
const UI_CONFIRM_PATH := "res://assets/audio/ui-confirm.ogg"
const UI_MOVE_PATH := "res://assets/audio/ui-move.ogg"
const CAMERA_PATH := "res://assets/audio/camera-shutter.ogg"
const SWOOSH_PATH := "res://assets/audio/pitch-swoosh.ogg"
const STAMP_PATH := "res://assets/audio/portfolio-stamp.ogg"

func run() -> bool:
	assert(ResourceLoader.exists(AUDIO_SCENE_PATH))
	for asset_path in [
		OFFICE_LOOP_PATH,
		PITCH_LOOP_PATH,
		UI_CONFIRM_PATH,
		UI_MOVE_PATH,
		CAMERA_PATH,
		SWOOSH_PATH,
		STAMP_PATH,
	]:
		assert(ResourceLoader.exists(String(asset_path)))
	var packed := load(AUDIO_SCENE_PATH) as PackedScene
	assert(packed != null)
	var manager := packed.instantiate()
	var tree := Engine.get_main_loop() as SceneTree
	assert(tree != null)
	tree.root.add_child(manager)
	assert(manager.call("cue_ids") == ["camera", "swoosh", "portfolio-stamp", "ui-confirm", "ui-move"])
	assert(not bool(manager.call("play_sfx", "unknown")))
	manager.call("set_enabled", false)
	assert(not bool(manager.call("play_sfx", "ui-confirm")))
	manager.call("set_enabled", true)
	manager.call("set_music_enabled", true)
	assert(not bool(manager.call("play_music", "office")))
	manager.call("confirm_user_gesture")
	assert(bool(manager.call("play_music", "office")))
	assert((manager.get_node("%OfficeLoop") as AudioStreamPlayer).playing)
	manager.call("set_reading_active", true)
	assert(float(manager.call("current_music_gain_db")) <= -18.0)
	manager.call("set_reading_active", false)
	assert(float(manager.call("current_music_gain_db")) > -18.0)
	manager.call("set_master_volume", 0.0)
	assert(float(manager.call("current_master_gain_db")) <= -70.0)
	manager.call("set_master_volume", 0.7)
	manager.call("set_sfx_enabled", true)
	assert(bool(manager.call("play_sfx", "camera")))
	manager.call("set_sfx_enabled", false)
	assert(not bool(manager.call("play_sfx", "swoosh")))
	manager.call("stop_all")
	for path in [
		"%OfficeLoop",
		"%PitchLoop",
		"%CameraCue",
		"%SwooshCue",
		"%PortfolioStampCue",
		"%UiConfirmCue",
		"%UiMoveCue",
	]:
		var player := manager.get_node_or_null(String(path)) as AudioStreamPlayer
		assert(player != null and player.stream != null)
		assert(not player.playing)
	manager.free()
	return true