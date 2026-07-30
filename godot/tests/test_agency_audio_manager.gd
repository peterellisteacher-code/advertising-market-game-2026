extends Node
class_name AdMarketAgencyAudioManagerTest

const AUDIO_SCENE_PATH := "res://src/audio/AgencyAudio.tscn"
const CAMERA_PATH := "res://assets/audio/camera-shutter.ogg"
const SWOOSH_PATH := "res://assets/audio/pitch-swoosh.ogg"
const STAMP_PATH := "res://assets/audio/portfolio-stamp.ogg"

func run() -> bool:
	assert(ResourceLoader.exists(AUDIO_SCENE_PATH))
	for asset_path in [CAMERA_PATH, SWOOSH_PATH, STAMP_PATH]:
		assert(ResourceLoader.exists(String(asset_path)))
	var packed := load(AUDIO_SCENE_PATH) as PackedScene
	assert(packed != null)
	var manager := packed.instantiate()
	var tree := Engine.get_main_loop() as SceneTree
	assert(tree != null)
	tree.root.add_child(manager)
	assert(manager.call("cue_ids") == ["camera", "swoosh", "portfolio-stamp"])
	assert(not bool(manager.call("play_cue", "unknown")))
	for path in ["%CameraCue", "%SwooshCue", "%PortfolioStampCue"]:
		var player := manager.get_node_or_null(String(path)) as AudioStreamPlayer
		assert(player != null and player.stream != null)
		assert(player.volume_db <= -6.0 and player.volume_db >= -18.0)
		assert(player.max_polyphony == 1)
	assert(bool(manager.call("play_cue", "camera")))
	assert((manager.get_node("%CameraCue") as AudioStreamPlayer).playing)
	manager.call("set_muted", true)
	assert(bool(manager.get("muted")))
	assert(not bool(manager.call("play_cue", "swoosh")))
	assert(not (manager.get_node("%CameraCue") as AudioStreamPlayer).playing)
	manager.call("set_muted", false)
	assert(bool(manager.call("play_cue", "portfolio-stamp")))
	manager.free()
	return true
