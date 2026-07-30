extends Node
class_name AdMarketAgencyAudioManager

const CUE_IDS: Array[String] = ["camera", "swoosh", "portfolio-stamp"]

@export var muted: bool = false

@onready var _players: Dictionary = {
	"camera": %CameraCue,
	"swoosh": %SwooshCue,
	"portfolio-stamp": %PortfolioStampCue,
}

func _ready() -> void:
	if muted:
		_stop_all()

func cue_ids() -> Array[String]:
	return CUE_IDS.duplicate()

func play_cue(cue_id: String) -> bool:
	if muted:
		return false
	var player := _players.get(cue_id) as AudioStreamPlayer
	if player == null or player.stream == null:
		return false
	player.stop()
	player.play()
	return true

func set_muted(enabled: bool) -> void:
	muted = enabled
	if muted:
		_stop_all()

func _stop_all() -> void:
	for value in _players.values():
		var player := value as AudioStreamPlayer
		if player != null:
			player.stop()