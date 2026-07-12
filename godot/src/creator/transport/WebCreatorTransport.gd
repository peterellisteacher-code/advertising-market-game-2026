extends "res://src/creator/transport/CreatorTransport.gd"

signal diagnostic(message: String)

const CONTRACT := "creator-spike@1"

var _bridge: JavaScriptObject
var _callbacks: Array[JavaScriptObject] = []
var _event_callback: Callable
var _event_bridge_callback: JavaScriptObject

func set_event_callback(callback: Callable) -> void:
    _event_callback = callback
    if _ensure_bridge():
        _register_event_callback()

func create_retained_callback(callback: Callable) -> JavaScriptObject:
    var js_callback := JavaScriptBridge.create_callback(callback)
    _callbacks.append(js_callback)
    return js_callback

func open(payload_json: String) -> String:
    return _call_bridge("open", payload_json)

func close() -> String:
    return _call_bridge("close")

func publish_probe() -> String:
    return _call_bridge("publishProbe")

func _call_bridge(method_name: String, payload_json: String = "") -> String:
    if not _ensure_bridge():
        return JSON.stringify({
            "contract": CONTRACT,
            "event": "error",
            "message": "Campaign Creator is unavailable in this browser session."
        })

    var result: Variant
    if payload_json.is_empty():
        result = _bridge.call(method_name)
    else:
        result = _bridge.call(method_name, payload_json)
    return str(result)

func _ensure_bridge() -> bool:
    if _bridge != null:
        _register_event_callback()
        return true
    _bridge = JavaScriptBridge.get_interface("AdMarketCreatorSpike")
    if _bridge == null:
        var message := "Missing browser global window.AdMarketCreatorSpike"
        push_error(message)
        diagnostic.emit(message)
        return false
    _register_event_callback()
    return true

func _register_event_callback() -> void:
    if _bridge == null or _event_bridge_callback != null or not _event_callback.is_valid():
        return
    _event_bridge_callback = create_retained_callback(_on_bridge_event)
    _bridge.call("setEventCallback", _event_bridge_callback)

func _on_bridge_event(arguments: Array) -> void:
    if arguments.is_empty():
        var message := "Creator sent an empty event"
        push_error(message)
        diagnostic.emit(message)
        return
    if _event_callback.is_valid():
        _event_callback.call(str(arguments[0]))
