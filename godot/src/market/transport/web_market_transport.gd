extends "res://src/market/transport/market_transport.gd"
class_name AdMarketWebMarketTransport

signal diagnostic(message: String)

const CONTRACT := "market-bridge@1"
const MAX_RETAINED_REQUESTS := 32

var _bridge: JavaScriptObject
var _pending_callbacks: Dictionary = {}

func send(request_json: String, resolve: Callable, reject: Callable) -> void:
    var request_id := _request_id(request_json)
    if request_id.is_empty():
        reject.call("Live Market request is missing its requestId")
        return
    if not OS.has_feature("web"):
        resolve.call(_unavailable_response(request_id))
        return
    if _pending_callbacks.size() >= MAX_RETAINED_REQUESTS:
        reject.call("Live Market transport has too many pending requests")
        return
    if not _ensure_bridge():
        resolve.call(_unavailable_response(request_id))
        return

    var handle_member: Variant = _bridge.handle
    if not handle_member is JavaScriptObject:
        reject.call("Live Market browser global does not expose handle(requestJson)")
        return
    var promise: Variant = _bridge.handle(request_json)
    _attach_promise(request_id, promise, resolve, reject)

func _attach_promise(
    request_id: String,
    promise: Variant,
    resolve: Callable,
    reject: Callable
) -> void:
    if not _is_browser_promise(promise):
        reject.call("Live Market handle did not return a Promise")
        return
    var then_callback: JavaScriptObject = JavaScriptBridge.create_callback(func(arguments: Array) -> void:
        _resolve_promise(request_id, arguments, resolve)
    )
    var catch_callback: JavaScriptObject = JavaScriptBridge.create_callback(func(arguments: Array) -> void:
        _reject_promise(request_id, arguments, reject)
    )
    _pending_callbacks[request_id] = {
        "then": then_callback,
        "catch": catch_callback
    }
    var promise_object: JavaScriptObject = promise
    var chained: Variant = promise_object.then(then_callback)
    if _is_browser_promise(chained):
        chained.catch(catch_callback)
    else:
        promise_object.catch(catch_callback)

func _is_browser_promise(value: Variant) -> bool:
    if not value is JavaScriptObject:
        return false
    var javascript_object: JavaScriptObject = value
    return (
        javascript_object.then is JavaScriptObject
        and javascript_object.catch is JavaScriptObject
    )

func _ensure_bridge() -> bool:
    if _bridge != null:
        return true
    _bridge = JavaScriptBridge.get_interface("AdMarketRoom")
    if _bridge == null:
        diagnostic.emit("Missing browser global window.AdMarketRoom")
        return false
    return true

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
    var message := "Live Market Promise rejected"
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
            "code": "MARKET_UNAVAILABLE",
            "message": "Live Market is unavailable in this runtime."
        }
    })
