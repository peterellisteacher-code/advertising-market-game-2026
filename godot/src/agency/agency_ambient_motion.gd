extends Node2D
class_name AdMarketAgencyAmbientMotion

var reduced_motion_enabled: bool = false
var _elapsed: float = 0.0
var _pulse_amount: float = 0.0

func _ready() -> void:
	_apply_status_lights()

func _process(delta: float) -> void:
	advance_ambient_motion(delta)

func set_reduced_motion_enabled(enabled: bool) -> void:
	reduced_motion_enabled = enabled
	if enabled:
		_elapsed = 0.0
		_pulse_amount = 0.0
	_apply_status_lights()

func advance_ambient_motion(delta: float) -> void:
	if reduced_motion_enabled:
		_apply_status_lights()
		return
	_elapsed += maxf(delta, 0.0)
	_pulse_amount = (sin(_elapsed * TAU * 0.7) + 1.0) * 0.5
	_apply_status_lights()

func pulse_amount() -> float:
	return _pulse_amount

func _apply_status_lights() -> void:
	for status_light in _status_lights():
		status_light.modulate.a = 0.48 + _pulse_amount * 0.44

func _status_lights() -> Array[Polygon2D]:
	var lights: Array[Polygon2D] = []
	for child in get_children():
		if child is Polygon2D:
			lights.append(child as Polygon2D)
	return lights
