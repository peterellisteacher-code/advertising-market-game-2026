extends Node

signal diagnostic(message: String)
signal focus_restore_requested
signal creator_opened
signal creator_closed
signal creator_state_received(document: Dictionary)
signal latest_draft_received(document: Variant)
signal creator_published(publication: Dictionary)

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
var _save_before_close_request_id := ""
var _awaiting_save_before_close := false
var _state_before_close_request_id := ""
var _awaiting_state_before_close := false

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

func load_latest(document_id: String) -> String:
    _ensure_bridge()
    return bridge.load_latest(document_id)

func save_creator() -> String:
    _ensure_bridge()
    return bridge.save()

func publish_creator() -> String:
    _ensure_bridge()
    return bridge.publish()

func close_creator() -> String:
    _ensure_bridge()
    if not creator_is_open or _closing or _close_sequence_is_active():
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
    bridge.close_requested.connect(_on_close_requested)

func _on_request_succeeded(request_id: String, method: String, payload: Variant) -> void:
    if method == "open" and _opening:
        _opening = false
        _set_creator_open(true)
        creator_opened.emit()
    elif method == "close" and _closing:
        _closing = false
        _set_creator_open(false)
        creator_closed.emit()
    elif method == "save" and (
        _awaiting_save_before_close
        or request_id == _save_before_close_request_id
    ):
        _awaiting_save_before_close = false
        _save_before_close_request_id = ""
        _request_state_before_close()
    elif method == "loadLatest":
        latest_draft_received.emit(payload.duplicate(true) if typeof(payload) == TYPE_DICTIONARY else null)
    elif method == "getState" and typeof(payload) == TYPE_DICTIONARY:
        creator_state_received.emit(Dictionary(payload).duplicate(true))
        if _awaiting_state_before_close or request_id == _state_before_close_request_id:
            _awaiting_state_before_close = false
            _state_before_close_request_id = ""
            close_creator()
    elif method == "publish" and typeof(payload) == TYPE_DICTIONARY:
        creator_published.emit(Dictionary(payload).duplicate(true))

func _on_request_failed(request_id: String, _code: String, message: String) -> void:
    if _awaiting_save_before_close or request_id == _save_before_close_request_id:
        _awaiting_save_before_close = false
        _save_before_close_request_id = ""
        _report("Draft kept open because it could not be saved. Try again.")
        return
    if _awaiting_state_before_close or request_id == _state_before_close_request_id:
        _awaiting_state_before_close = false
        _state_before_close_request_id = ""
        _report("Draft kept open because its saved state could not be returned. Try again.")
        return
    _opening = false
    _closing = false
    _report(message)

func _on_close_requested() -> void:
    if not creator_is_open or _closing or _close_sequence_is_active():
        return
    _awaiting_save_before_close = true
    var request_id := save_creator()
    if not _awaiting_save_before_close:
        return
    _awaiting_save_before_close = false
    if request_id.is_empty():
        _report("Draft kept open because it could not be saved")
        return
    _save_before_close_request_id = request_id

func _request_state_before_close() -> void:
    _awaiting_state_before_close = true
    var request_id := request_state()
    if not _awaiting_state_before_close:
        return
    _awaiting_state_before_close = false
    if request_id.is_empty():
        _report("Draft kept open because its latest state could not be requested")
        return
    _state_before_close_request_id = request_id

func _close_sequence_is_active() -> bool:
    return (
        _awaiting_save_before_close
        or not _save_before_close_request_id.is_empty()
        or _awaiting_state_before_close
        or not _state_before_close_request_id.is_empty()
    )

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
    if creator_is_open and transport != null and transport.has_method("show_message"):
        transport.show_message(message)
