extends CharacterBody2D
class_name AdMarketAgencyPair

signal interaction_requested

const VALID_ROLES := ["art-director", "strategist"]
const DEFAULT_BOUNDS := Rect2(28.0, 104.0, 1224.0, 668.0)

@export var movement_speed: float = 210.0
@export var movement_bounds: Rect2 = DEFAULT_BOUNDS

var input_enabled: bool = true
var modal_open: bool = false
var active_role: String = "art-director"
var station_owner_role: String = "strategist"
var nearest_station_id: String = "reception"
var facing_direction: String = "front"
var _reduced_motion_enabled: bool = false
var _auto_travelling: bool = false
var _visual_motion_state: String = "idle"
var _visual_time: float = 0.0
var _art_director_base_position := Vector2(-20.0, -5.0)
var _strategist_base_position := Vector2(20.0, 5.0)
var _art_director_base_scale := Vector2.ONE
var _strategist_base_scale := Vector2.ONE
var _sprite_bases_captured: bool = false

func _ready() -> void:
	_capture_sprite_bases()
	_apply_sprite_state()
	_apply_role_emphasis()
	_apply_visual_motion()

func _process(delta: float) -> void:
	advance_visual_motion(delta)

func _physics_process(delta: float) -> void:
	if not input_enabled or modal_open:
		velocity = Vector2.ZERO
		set_visual_motion_state("walking" if _auto_travelling and not modal_open else "idle")
		return
	var keyboard_vector := Input.get_vector(
		"move_left",
		"move_right",
		"move_up",
		"move_down"
	)
	move_vector(keyboard_vector, delta)
	if Input.is_action_just_pressed("interact"):
		interaction_requested.emit()

func move_vector(direction: Vector2, delta: float = 0.0) -> Vector2:
	if not input_enabled or modal_open:
		velocity = Vector2.ZERO
		set_visual_motion_state("idle")
		return position
	var normalised := direction.limit_length(1.0)
	velocity = normalised * movement_speed
	if not normalised.is_zero_approx():
		_update_facing_direction(normalised)
		set_visual_motion_state("walking")
	else:
		set_visual_motion_state("idle")
	if is_inside_tree():
		move_and_slide()
	elif delta > 0.0:
		position += velocity * delta
	position = Vector2(
		clampf(position.x, movement_bounds.position.x, movement_bounds.end.x),
		clampf(position.y, movement_bounds.position.y, movement_bounds.end.y)
	)
	return position

func set_input_enabled(enabled: bool) -> void:
	input_enabled = enabled
	if not enabled:
		velocity = Vector2.ZERO
		if not _auto_travelling:
			set_visual_motion_state("idle")

func set_modal_open(open: bool) -> void:
	modal_open = open
	if open:
		velocity = Vector2.ZERO
		end_auto_travel()
		set_visual_motion_state("idle")

func set_reduced_motion_enabled(enabled: bool) -> void:
	_reduced_motion_enabled = enabled
	if enabled:
		end_auto_travel()
		_visual_motion_state = "idle"
		_visual_time = 0.0
	_apply_visual_motion()

func set_visual_motion_state(state: String) -> void:
	_visual_motion_state = "walking" if state == "walking" and not _reduced_motion_enabled else "idle"
	_apply_visual_motion()

func visual_motion_state() -> String:
	return _visual_motion_state

func begin_auto_travel(direction: Vector2) -> void:
	_auto_travelling = true
	update_auto_travel_direction(direction)

func update_auto_travel_direction(direction: Vector2) -> void:
	if direction.is_zero_approx():
		return
	_auto_travelling = true
	_update_facing_direction(direction)
	set_visual_motion_state("walking")

func end_auto_travel() -> void:
	_auto_travelling = false
	set_visual_motion_state("idle")

func is_auto_travelling() -> bool:
	return _auto_travelling

func advance_visual_motion(delta: float) -> void:
	if _reduced_motion_enabled:
		_apply_visual_motion()
		return
	_visual_time += maxf(delta, 0.0)
	_apply_visual_motion()

func sprite_transforms_are_neutral() -> bool:
	var art_director := get_node_or_null("%ArtDirectorSprite") as AnimatedSprite2D
	var strategist := get_node_or_null("%StrategistSprite") as AnimatedSprite2D
	return (
		art_director != null
		and strategist != null
		and art_director.position.is_equal_approx(_art_director_base_position)
		and strategist.position.is_equal_approx(_strategist_base_position)
		and is_zero_approx(art_director.rotation)
		and is_zero_approx(strategist.rotation)
		and art_director.scale.is_equal_approx(_art_director_base_scale)
		and strategist.scale.is_equal_approx(_strategist_base_scale)
	)

func set_active_role(role: String) -> bool:
	if not VALID_ROLES.has(role):
		return false
	active_role = role
	_apply_role_emphasis()
	return true

func emphasise_station_owner(role: String) -> bool:
	if not VALID_ROLES.has(role):
		return false
	station_owner_role = role
	_apply_role_emphasis()
	return true

func set_nearest_station(station_id: String) -> void:
	nearest_station_id = station_id

func _update_facing_direction(direction: Vector2) -> void:
	if absf(direction.x) > absf(direction.y):
		facing_direction = "right" if direction.x > 0.0 else "left"
	else:
		facing_direction = "front" if direction.y > 0.0 else "back"
	_apply_sprite_state()

func _apply_sprite_state() -> void:
	var art_director := get_node_or_null("%ArtDirectorSprite") as AnimatedSprite2D
	var strategist := get_node_or_null("%StrategistSprite") as AnimatedSprite2D
	if art_director != null and art_director.sprite_frames != null:
		art_director.play("art-%s" % facing_direction)
	if strategist != null and strategist.sprite_frames != null:
		strategist.play("strategy-%s" % facing_direction)

func _apply_role_emphasis() -> void:
	var art_director := get_node_or_null("%ArtDirectorSprite") as AnimatedSprite2D
	var strategist := get_node_or_null("%StrategistSprite") as AnimatedSprite2D
	var art_is_foremost := station_owner_role == "art-director"
	_art_director_base_position = Vector2(-20.0, 5.0 if art_is_foremost else -5.0)
	_strategist_base_position = Vector2(20.0, -5.0 if art_is_foremost else 5.0)
	if art_director != null:
		art_director.position = _art_director_base_position
		art_director.z_index = 3 if art_is_foremost else 1
		art_director.modulate.a = 1.0 if active_role == "art-director" else 0.82
	if strategist != null:
		strategist.position = _strategist_base_position
		strategist.z_index = 1 if art_is_foremost else 3
		strategist.modulate.a = 1.0 if active_role == "strategist" else 0.82
	_apply_visual_motion()

func _apply_visual_motion() -> void:
	var art_director := get_node_or_null("%ArtDirectorSprite") as AnimatedSprite2D
	var strategist := get_node_or_null("%StrategistSprite") as AnimatedSprite2D
	if art_director == null or strategist == null:
		return
	_capture_sprite_bases()
	var bob := 0.0
	var lean := 0.0
	if not _reduced_motion_enabled:
		var frequency := 3.6 if _visual_motion_state == "walking" else 1.8
		var amplitude := 2.5 if _visual_motion_state == "walking" else 1.0
		bob = sin(_visual_time * frequency * TAU) * amplitude
		if _visual_motion_state == "walking":
			lean = _walking_lean()
	art_director.position = _art_director_base_position + Vector2(0.0, bob)
	strategist.position = _strategist_base_position + Vector2(0.0, -bob)
	art_director.rotation = lean
	strategist.rotation = lean * 0.78
	art_director.scale = _art_director_base_scale
	strategist.scale = _strategist_base_scale
	# The sheet carries a real walk cycle, so the frames may only advance while the
	# pair is walking. Reduced motion holds the standing pose for the same reason it
	# suppresses the bob.
	var walking := _visual_motion_state == "walking" and not _reduced_motion_enabled
	for sprite: AnimatedSprite2D in [art_director, strategist]:
		if walking and not sprite.is_playing():
			sprite.play()
		elif not walking and sprite.is_playing():
			sprite.stop()

func _capture_sprite_bases() -> void:
	if _sprite_bases_captured:
		return
	var art_director := get_node_or_null("%ArtDirectorSprite") as AnimatedSprite2D
	var strategist := get_node_or_null("%StrategistSprite") as AnimatedSprite2D
	if art_director == null or strategist == null:
		return
	_art_director_base_scale = art_director.scale
	_strategist_base_scale = strategist.scale
	_sprite_bases_captured = true

func _walking_lean() -> float:
	if facing_direction == "left":
		return -0.055
	if facing_direction == "right":
		return 0.055
	return 0.018 if facing_direction == "back" else -0.018
