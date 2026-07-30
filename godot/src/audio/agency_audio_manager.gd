extends Node
class_name AdMarketAgencyAudioManager

const CUE_IDS: Array[String] = [
	"camera",
	"swoosh",
	"portfolio-stamp",
	"ui-confirm",
	"ui-move",
]
const MUSIC_BUS := "AgencyMusic"
const AMBIENCE_BUS := "AgencyAmbience"
const SFX_BUS := "AgencySfx"
const READING_DUCK_DB := -18.0
const SILENT_DB := -80.0
const CUE_INTERVAL_MSEC := 120

@export var muted: bool = false

var enabled: bool = true
var music_enabled: bool = true
var sfx_enabled: bool = true
var master_volume: float = 0.7
var reading_active: bool = false
var user_gesture_confirmed: bool = false
var _last_cue_msec: Dictionary = {}

@onready var _music_players: Dictionary = {
	"office": %OfficeLoop,
	"pitch": %PitchLoop,
}
@onready var _sfx_players: Dictionary = {
	"camera": %CameraCue,
	"swoosh": %SwooshCue,
	"portfolio-stamp": %PortfolioStampCue,
	"ui-confirm": %UiConfirmCue,
	"ui-move": %UiMoveCue,
}

func _ready() -> void:
	_ensure_audio_bus(MUSIC_BUS)
	_ensure_audio_bus(AMBIENCE_BUS)
	_ensure_audio_bus(SFX_BUS)
	_assign_audio_buses()
	_configure_loop_streams()
	if muted:
		enabled = false
	_apply_bus_gains()
	if not enabled:
		stop_all()

func cue_ids() -> Array[String]:
	return CUE_IDS.duplicate()

func confirm_user_gesture() -> void:
	user_gesture_confirmed = true

func set_enabled(value: bool) -> void:
	enabled = value
	muted = not value
	_apply_bus_gains()
	if not enabled:
		stop_all()

func set_music_enabled(value: bool) -> void:
	music_enabled = value
	_apply_bus_gains()
	if not music_enabled:
		_stop_players(_music_players)

func set_sfx_enabled(value: bool) -> void:
	sfx_enabled = value
	_apply_bus_gains()
	if not sfx_enabled:
		_stop_players(_sfx_players)

func set_master_volume(value: float) -> void:
	master_volume = clampf(value, 0.0, 1.0)
	_apply_bus_gains()

func set_reading_active(value: bool) -> void:
	reading_active = value
	_apply_bus_gains()

func apply_settings(value: Dictionary) -> void:
	set_enabled(bool(value.get("enabled", true)))
	set_music_enabled(bool(value.get("musicEnabled", true)))
	set_sfx_enabled(bool(value.get("sfxEnabled", true)))
	set_master_volume(float(value.get("masterVolume", 0.7)))

func settings() -> Dictionary:
	return {
		"enabled": enabled,
		"musicEnabled": music_enabled,
		"sfxEnabled": sfx_enabled,
		"masterVolume": master_volume,
	}

func play_ambience(ambience_id: String = "office") -> bool:
	if ambience_id != "office":
		return false
	return _play_loop(ambience_id)

func play_music(music_id: String) -> bool:
	return _play_loop(music_id)

func play_sfx(cue_id: String) -> bool:
	if not enabled or not sfx_enabled:
		return false
	var player := _sfx_players.get(cue_id) as AudioStreamPlayer
	if player == null or player.stream == null:
		return false
	var now_msec := Time.get_ticks_msec()
	if _last_cue_msec.has(cue_id):
		var elapsed := now_msec - int(_last_cue_msec.get(cue_id, 0))
		if elapsed < CUE_INTERVAL_MSEC:
			return false
	_last_cue_msec[cue_id] = now_msec
	user_gesture_confirmed = true
	player.stop()
	player.play()
	return true

func play_cue(cue_id: String) -> bool:
	return play_sfx(cue_id)

func set_muted(value: bool) -> void:
	set_enabled(not value)

func current_music_gain_db() -> float:
	return _bus_gain_db(MUSIC_BUS)

func current_master_gain_db() -> float:
	if not enabled or master_volume <= 0.0:
		return SILENT_DB
	return linear_to_db(master_volume)

func stop_all() -> void:
	_stop_players(_music_players)
	_stop_players(_sfx_players)

func _play_loop(loop_id: String) -> bool:
	if not enabled or not music_enabled or not user_gesture_confirmed:
		return false
	var player := _music_players.get(loop_id) as AudioStreamPlayer
	if player == null or player.stream == null:
		return false
	for value in _music_players.values():
		var other := value as AudioStreamPlayer
		if other != null and other != player:
			other.stop()
	if not player.playing:
		player.play()
	return true

func _assign_audio_buses() -> void:
	var office := _music_players.get("office") as AudioStreamPlayer
	var pitch := _music_players.get("pitch") as AudioStreamPlayer
	if office != null:
		office.bus = AMBIENCE_BUS
	if pitch != null:
		pitch.bus = MUSIC_BUS
	for value in _sfx_players.values():
		var player := value as AudioStreamPlayer
		if player != null:
			player.bus = SFX_BUS

func _configure_loop_streams() -> void:
	for value in _music_players.values():
		var player := value as AudioStreamPlayer
		if player == null:
			continue
		var ogg_stream := player.stream as AudioStreamOggVorbis
		if ogg_stream != null:
			ogg_stream.loop = true

func _ensure_audio_bus(bus_name: String) -> void:
	if AudioServer.get_bus_index(bus_name) >= 0:
		return
	AudioServer.add_bus()
	AudioServer.set_bus_name(AudioServer.bus_count - 1, bus_name)

func _apply_bus_gains() -> void:
	var master_gain := current_master_gain_db()
	var music_gain := master_gain
	if reading_active and master_gain > SILENT_DB:
		music_gain += READING_DUCK_DB
	if not enabled or not music_enabled:
		music_gain = SILENT_DB
	var sfx_gain := master_gain
	if not enabled or not sfx_enabled:
		sfx_gain = SILENT_DB
	_set_bus_gain(MUSIC_BUS, music_gain)
	_set_bus_gain(AMBIENCE_BUS, music_gain)
	_set_bus_gain(SFX_BUS, sfx_gain)

func _set_bus_gain(bus_name: String, gain_db: float) -> void:
	var bus_index := AudioServer.get_bus_index(bus_name)
	if bus_index >= 0:
		AudioServer.set_bus_volume_db(bus_index, gain_db)

func _bus_gain_db(bus_name: String) -> float:
	var bus_index := AudioServer.get_bus_index(bus_name)
	if bus_index < 0:
		return SILENT_DB
	return AudioServer.get_bus_volume_db(bus_index)

func _stop_players(players: Dictionary) -> void:
	for value in players.values():
		var player := value as AudioStreamPlayer
		if player != null:
			player.stop()