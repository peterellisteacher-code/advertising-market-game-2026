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

func _ready() -> void:
	_apply_sprite_state()
	_apply_role_emphasis()

func _physics_process(delta: float) -> void:
	if not input_enabled or modal_open:
		velocity = Vector2.ZERO
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
		return position
	var normalised := direction.limit_length(1.0)
	velocity = normalised * movement_speed
	if not normalised.is_zero_approx():
		_update_facing_direction(normalised)
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

func set_modal_open(open: bool) -> void:
	modal_open = open
	if open:
		velocity = Vector2.ZERO

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
	if art_director != null:
		art_director.position = Vector2(-20.0, 5.0 if art_is_foremost else -5.0)
		art_director.z_index = 3 if art_is_foremost else 1
		art_director.modulate.a = 1.0 if active_role == "art-director" else 0.82
	if strategist != null:
		strategist.position = Vector2(20.0, -5.0 if art_is_foremost else 5.0)
		strategist.z_index = 1 if art_is_foremost else 3
		strategist.modulate.a = 1.0 if active_role == "strategist" else 0.82
