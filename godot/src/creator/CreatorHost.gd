extends Node

signal diagnostic(message: String)

const CONTRACT := "creator-spike@1"

@export var game_input_root_path: NodePath
@export var launch_button_path: NodePath

var transport: RefCounted
var game_input_root: Node
var launch_button: Control
var creator_is_open := false
var _previous_process_mode := Node.PROCESS_MODE_INHERIT

func set_transport(value: RefCounted) -> void:
    transport = value
    if transport != null and transport.has_method("set_event_callback"):
        transport.set_event_callback(_on_transport_event)

func _ready() -> void:
    if not game_input_root_path.is_empty():
        game_input_root = get_node_or_null(game_input_root_path)
    if not launch_button_path.is_empty():
        launch_button = get_node_or_null(launch_button_path) as Control

func open_creator(payload: Dictionary) -> void:
    if transport == null:
        _report("Creator transport is not configured")
        return
    var response := _decode_response(transport.open(JSON.stringify(payload)))
    if response.get("event", "") == "opened":
        _set_creator_open(true)
    elif response.get("event", "") == "error":
        _report(str(response.get("message", "Campaign Creator could not open")))

func request_publish_probe() -> Dictionary:
    if transport == null:
        _report("Creator transport is not configured")
        return {}
    return _decode_response(transport.publish_probe())

func close_creator() -> void:
    if transport == null:
        _report("Creator transport is not configured")
        return
    var response := _decode_response(transport.close())
    if response.get("event", "") == "closed":
        _set_creator_open(false)

func _decode_response(response_json: String) -> Dictionary:
    var decoded: Variant = JSON.parse_string(response_json)
    if typeof(decoded) != TYPE_DICTIONARY:
        _report("Creator returned invalid JSON")
        return {}
    var response: Dictionary = decoded
    if response.get("contract", "") != CONTRACT:
        _report("Creator returned an unsupported contract")
        return {}
    return response

func _on_transport_event(event_json: String) -> void:
    var event := _decode_response(event_json)
    if event.get("event", "") == "closeRequested":
        close_creator()

func _set_creator_open(open: bool) -> void:
    creator_is_open = open
    if game_input_root != null:
        if open:
            _previous_process_mode = game_input_root.process_mode
            game_input_root.process_mode = Node.PROCESS_MODE_DISABLED
        else:
            game_input_root.process_mode = _previous_process_mode
    if not open and launch_button != null and launch_button.is_inside_tree():
        launch_button.grab_focus()

func _report(message: String) -> void:
    push_error(message)
    diagnostic.emit(message)
