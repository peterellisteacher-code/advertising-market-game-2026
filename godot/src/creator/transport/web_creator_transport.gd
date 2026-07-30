extends "res://src/creator/transport/creator_transport.gd"
class_name AdMarketWebCreatorTransport

signal diagnostic(message: String)

const CONTRACT := "creator-bridge@1"
const RETURN_TO_GAME_EVENT := "ad-market-creator:return-to-game"
const MAX_RETAINED_REQUESTS := 32

var _bridge: JavaScriptObject
var _window: JavaScriptObject
var _pending_callbacks: Dictionary = {}
var _close_requested_callback: Callable
var _close_event_callback: JavaScriptObject

func set_close_requested_callback(callback: Callable) -> void:
    _close_requested_callback = callback
    _register_close_listener()

func show_message(message: String) -> void:
    if not OS.has_feature("web") or not _ensure_bridge():
        return
    _bridge.showMessage(message)

func send(request_json: String, resolve: Callable, reject: Callable) -> void:
    var request_id := _request_id(request_json)
    if not OS.has_feature("web"):
        resolve.call(_unavailable_response(request_id))
        return
    if _pending_callbacks.size() >= MAX_RETAINED_REQUESTS:
        reject.call("Campaign Creator transport has too many pending requests")
        return
    if not _ensure_bridge():
        resolve.call(_unavailable_response(request_id))
        return

    var promise: JavaScriptObject = _bridge.handle(request_json)
    if promise == null:
        reject.call("Campaign Creator handle did not return a Promise")
        return
    var then_callback := JavaScriptBridge.create_callback(func(arguments: Array) -> void:
        _resolve_promise(request_id, arguments, resolve)
    )
    var catch_callback := JavaScriptBridge.create_callback(func(arguments: Array) -> void:
        _reject_promise(request_id, arguments, reject)
    )
    _pending_callbacks[request_id] = {
        "then": then_callback,
        "catch": catch_callback
    }
    var chained: JavaScriptObject = promise.then(then_callback)
    if chained != null:
        chained.catch(catch_callback)
    else:
        promise.catch(catch_callback)

func _ensure_bridge() -> bool:
    if _bridge != null:
        _register_close_listener()
        return true
    _bridge = JavaScriptBridge.get_interface("AdMarketCreator")
    if _bridge == null:
        diagnostic.emit("Missing browser global window.AdMarketCreator")
        return false
    _register_close_listener()
    return true

func _register_close_listener() -> void:
    if not OS.has_feature("web") or _close_event_callback != null or not _close_requested_callback.is_valid():
        return
    _window = JavaScriptBridge.get_interface("window")
    if _window == null:
        diagnostic.emit("Missing browser window interface")
        return
    _close_event_callback = JavaScriptBridge.create_callback(func(_arguments: Array) -> void:
        if _close_requested_callback.is_valid():
            _close_requested_callback.call()
    )
    _window.addEventListener(RETURN_TO_GAME_EVENT, _close_event_callback)

func _resolve_promise(request_id: String, arguments: Array, resolve: Callable) -> void:
    if not _pending_callbacks.has(request_id):
        return
    _pending_callbacks.erase(request_id)
    if arguments.is_empty():
        resolve.call("")
        return
    resolve.call(str(arguments[0]))

func _reject_promise(request_id: String, arguments: Array, reject: Callable) -> void:
    if not _pending_callbacks.has(request_id):
        return
    _pending_callbacks.erase(request_id)
    var message := "Campaign Creator Promise rejected"
    if not arguments.is_empty() and typeof(arguments[0]) == TYPE_STRING:
        message = str(arguments[0])
    reject.call(message)

func _request_id(request_json: String) -> String:
    var decoded: Variant = JSON.parse_string(request_json)
    if typeof(decoded) == TYPE_DICTIONARY and typeof(decoded.get("requestId")) == TYPE_STRING:
        return str(decoded.get("requestId"))
    return ""

func _unavailable_response(request_id: String) -> String:
    return JSON.stringify({
        "contract": CONTRACT,
        "requestId": request_id,
        "ok": false,
        "error": {
            "code": "CREATOR_UNAVAILABLE",
            "message": "Campaign Creator is unavailable in this runtime."
        }
    })
