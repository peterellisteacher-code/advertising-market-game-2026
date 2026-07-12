extends Node

signal diagnostic(message: String)
signal focus_restore_requested
signal creator_opened
signal creator_closed

const CreatorBridge = preload("res://src/creator/CreatorBridge.gd")

@export var game_input_root_path: NodePath
@export var launch_button_path: NodePath

var transport: RefCounted
var bridge: Node
var game_input_root: Node
var launch_button: Control
var creator_is_open := false
var _previous_process_mode := Node.PROCESS_MODE_INHERIT
var _opening := false
var _closing := false

func set_transport(value: RefCounted) -> void:
    transport = value
    _ensure_bridge()
    bridge.set_transport(value)

func _ready() -> void:
    _ensure_bridge()
    if not game_input_root_path.is_empty():
        game_input_root = get_node_or_null(game_input_root_path)
    if not launch_button_path.is_empty():
        launch_button = get_node_or_null(launch_button_path) as Control

func open_creator(document: Dictionary) -> String:
    _ensure_bridge()
    if creator_is_open or _opening:
        return ""
    _opening = true
    var request_id: String = bridge.open(document)
    if request_id.is_empty():
        _opening = false
    return request_id

func request_state() -> String:
    _ensure_bridge()
    return bridge.get_state()

func save_creator() -> String:
    _ensure_bridge()
    return bridge.save()

func publish_creator() -> String:
    _ensure_bridge()
    return bridge.publish()

func close_creator() -> String:
    _ensure_bridge()
    if not creator_is_open or _closing:
        return ""
    _closing = true
    return bridge.close()

func _ensure_bridge() -> void:
    if bridge != null:
        return
    bridge = CreatorBridge.new()
    add_child(bridge)
    bridge.request_succeeded.connect(_on_request_succeeded)
    bridge.request_failed.connect(_on_request_failed)
    bridge.close_requested.connect(close_creator)

func _on_request_succeeded(_request_id: String, method: String, _payload: Variant) -> void:
    if method == "open" and _opening:
        _opening = false
        _set_creator_open(true)
        creator_opened.emit()
    elif method == "close" and _closing:
        _closing = false
        _set_creator_open(false)
        creator_closed.emit()

func _on_request_failed(_request_id: String, code: String, message: String) -> void:
    _opening = false
    _closing = false
    _report("%s: %s" % [code, message])

func _set_creator_open(open: bool) -> void:
    if creator_is_open == open:
        return
    creator_is_open = open
    if game_input_root != null:
        if open:
            _previous_process_mode = game_input_root.process_mode
            game_input_root.process_mode = Node.PROCESS_MODE_DISABLED
        else:
            game_input_root.process_mode = _previous_process_mode
    if not open:
        focus_restore_requested.emit()
        if launch_button != null and launch_button.is_inside_tree():
            launch_button.grab_focus()

func _report(message: String) -> void:
    diagnostic.emit(message)
