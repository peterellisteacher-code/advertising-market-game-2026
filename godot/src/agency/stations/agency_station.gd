extends Area2D
class_name AdMarketAgencyStation

signal requested(station_id: String)

const VALID_ROLES := ["art-director", "strategist"]

@export var station_id: String = "reception"
@export var room_title: String = "Reception"
@export var owner_role: String = "strategist"
@export_multiline var owner_action: String = "Read the client request and identify the decision the audience needs to make."
@export_multiline var partner_holding_action: String = "Listen for missing audience details and keep the campaign goal visible."
@export_multiline var shared_evidence: String = "Both partners can explain who the advertisement is for and what response it should produce."

var pair_in_range: bool = false
var highlighted: bool = false

func _ready() -> void:
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)
	_update_visuals()

func configure(record: Dictionary) -> bool:
	var next_station_id := String(record.get("id", ""))
	var next_owner_role := String(record.get("ownerRole", ""))
	if next_station_id.is_empty() or not VALID_ROLES.has(next_owner_role):
		return false
	station_id = next_station_id
	room_title = String(record.get("title", room_title))
	owner_role = next_owner_role
	owner_action = String(record.get("ownerAction", owner_action))
	partner_holding_action = String(record.get("holdingAction", partner_holding_action))
	shared_evidence = String(record.get("sharedEvidence", shared_evidence))
	_update_visuals()
	return true

func request_if_available() -> bool:
	if not pair_in_range:
		return false
	requested.emit(station_id)
	return true

func select_direct() -> void:
	requested.emit(station_id)

func set_highlighted(value: bool) -> void:
	highlighted = value
	_update_visuals()

func responsibility_summary() -> String:
	var owner_name := "Art Director" if owner_role == "art-director" else "Strategist"
	var partner_name := "Strategist" if owner_role == "art-director" else "Art Director"
	return (
		"%s leads: %s\n%s holding action: %s\nAgree before completing: %s"
		% [owner_name, owner_action, partner_name, partner_holding_action, shared_evidence]
	)

func _on_body_entered(body: Node) -> void:
	if body is AdMarketAgencyPair:
		pair_in_range = true
		set_highlighted(true)

func _on_body_exited(body: Node) -> void:
	if body is AdMarketAgencyPair:
		pair_in_range = false
		set_highlighted(false)

func _update_visuals() -> void:
	var room_label := get_node_or_null("%RoomLabel") as Label
	var role_badge := get_node_or_null("%OwnerRoleBadge") as Label
	var glow := get_node_or_null("%Glow") as Polygon2D
	var icon := get_node_or_null("%InteractionIcon") as Sprite2D
	if room_label != null:
		room_label.text = room_title
		room_label.visible = highlighted
	if role_badge != null:
		role_badge.text = "ART DIRECTOR" if owner_role == "art-director" else "STRATEGIST"
		role_badge.modulate = Color("ff6f61") if owner_role == "art-director" else Color("26c6b8")
		role_badge.visible = highlighted
	if glow != null:
		glow.modulate.a = 0.92 if highlighted else 0.55
		glow.scale = Vector2.ONE * (1.12 if highlighted else 1.0)
	if icon != null:
		icon.modulate = Color.WHITE if highlighted else Color(0.92, 0.95, 1.0, 0.88)