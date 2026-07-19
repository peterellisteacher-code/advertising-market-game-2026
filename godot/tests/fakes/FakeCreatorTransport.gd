extends "res://src/creator/transport/CreatorTransport.gd"

const CONTRACT := "creator-bridge@1"

var _requests: Array[Dictionary] = []
var _pending: Dictionary = {}
var _history: Dictionary = {}
var _last_responses: Dictionary = {}
var _close_requested_callback: Callable
var _shown_messages: Array[String] = []

func set_close_requested_callback(callback: Callable) -> void:
    _close_requested_callback = callback

func request_close() -> void:
    if _close_requested_callback.is_valid():
        _close_requested_callback.call()

func show_message(message: String) -> void:
    _shown_messages.append(message)

func last_shown_message() -> String:
    return "" if _shown_messages.is_empty() else _shown_messages.back()

func send(request_json: String, resolve: Callable, reject: Callable) -> void:
    var decoded: Variant = JSON.parse_string(request_json)
    if typeof(decoded) != TYPE_DICTIONARY:
        reject.call("Fake transport received invalid request JSON")
        return
    var request: Dictionary = decoded
    var request_id := str(request.get("requestId", ""))
    if request_id.is_empty() or _history.has(request_id):
        reject.call("Fake transport received a duplicate or missing requestId")
        return
    _requests.append(request.duplicate(true))
    var callbacks := {"resolve": resolve, "reject": reject}
    _pending[request_id] = callbacks
    _history[request_id] = callbacks

func resolve_success(request_id: String, payload: Variant = null) -> void:
    var response := {"contract": CONTRACT, "requestId": request_id, "ok": true}
    if payload != null:
        response["payload"] = payload
    resolve_raw(request_id, response)

func resolve_raw(request_id: String, response: Dictionary) -> void:
    assert(_history.has(request_id))
    var response_json := JSON.stringify(response)
    _last_responses[request_id] = response_json
    _pending.erase(request_id)
    var callbacks: Dictionary = _history.get(request_id)
    var resolve: Callable = callbacks.get("resolve")
    resolve.call(response_json)

func repeat_response(request_id: String) -> void:
    assert(_history.has(request_id) and _last_responses.has(request_id))
    var callbacks: Dictionary = _history.get(request_id)
    var resolve: Callable = callbacks.get("resolve")
    resolve.call(str(_last_responses.get(request_id)))

func reject_request(request_id: String, message: String) -> void:
    assert(_history.has(request_id))
    _pending.erase(request_id)
    var callbacks: Dictionary = _history.get(request_id)
    var reject: Callable = callbacks.get("reject")
    reject.call(message)

func request_ids() -> Array[String]:
    var ids: Array[String] = []
    for request in _requests:
        ids.append(str(request.get("requestId")))
    return ids

func request_for(request_id: String) -> Dictionary:
    for request in _requests:
        if request.get("requestId") == request_id:
            return request.duplicate(true)
    return {}

func request_count() -> int:
    return _requests.size()

func last_request_id() -> String:
    if _requests.is_empty():
        return ""
    return str(_requests.back().get("requestId"))
