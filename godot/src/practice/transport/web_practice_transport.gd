extends RefCounted
class_name AdMarketWebPracticeTransport

signal diagnostic(message: String)

const CONTRACT := "practice-run@1"
const MAX_RETAINED_REQUESTS := 32

var _bridge: JavaScriptObject
var _pending_callbacks: Dictionary = {}

func send(request_json: String, resolve: Callable, reject: Callable) -> void:
    var request_id := _request_id(request_json)
    if not OS.has_feature("web"):
        resolve.call(_unavailable_response(request_id))
        return
    if _pending_callbacks.size() >= MAX_RETAINED_REQUESTS:
        reject.call("Practice recovery transport has too many pending requests")
        return
    if not _ensure_bridge():
        resolve.call(_unavailable_response(request_id))
        return
    var promise: JavaScriptObject = _bridge.handle(request_json)
    if promise == null:
        reject.call("Practice recovery handle did not return a Promise")
        return
    var then_callback := JavaScriptBridge.create_callback(func(arguments: Array) -> void:
        _resolve_promise(request_id, arguments, resolve)
    )
    var catch_callback := JavaScriptBridge.create_callback(func(arguments: Array) -> void:
        _reject_promise(request_id, arguments, reject)
    )
    _pending_callbacks[request_id] = {"then": then_callback, "catch": catch_callback}
    var chained: JavaScriptObject = promise.then(then_callback)
    if chained != null:
        chained.catch(catch_callback)
    else:
        promise.catch(catch_callback)

func _ensure_bridge() -> bool:
    if _bridge != null:
        return true
    _bridge = JavaScriptBridge.get_interface("AdMarketPractice")
    if _bridge == null:
        diagnostic.emit("Missing browser global window.AdMarketPractice")
        return false
    return true

func _resolve_promise(request_id: String, arguments: Array, resolve: Callable) -> void:
    if not _pending_callbacks.has(request_id):
        return
    _pending_callbacks.erase(request_id)
    resolve.call("" if arguments.is_empty() else String(arguments[0]))

func _reject_promise(request_id: String, arguments: Array, reject: Callable) -> void:
    if not _pending_callbacks.has(request_id):
        return
    _pending_callbacks.erase(request_id)
    var message := "Practice recovery Promise rejected"
    if not arguments.is_empty() and typeof(arguments[0]) == TYPE_STRING:
        message = String(arguments[0])
    reject.call(message)

func _request_id(request_json: String) -> String:
    var decoded: Variant = JSON.parse_string(request_json)
    return String(decoded.get("requestId", "")) if typeof(decoded) == TYPE_DICTIONARY else ""

func _unavailable_response(request_id: String) -> String:
    return JSON.stringify({
        "contract": CONTRACT,
        "requestId": request_id,
        "ok": false,
        "error": {
            "code": "PRACTICE_UNAVAILABLE",
            "message": "Practice recovery is unavailable in this runtime."
        }
    })

