extends "res://src/market/transport/MarketTransport.gd"

const CONTRACT := "market-bridge@1"

var _requests: Array[Dictionary] = []
var _pending: Dictionary = {}
var _history: Dictionary = {}
var _last_responses: Dictionary = {}
var _next_synchronous_rejection := ""
var auto_resume_none := false

func send(request_json: String, resolve: Callable, reject: Callable) -> void:
    var decoded: Variant = JSON.parse_string(request_json)
    if typeof(decoded) != TYPE_DICTIONARY:
        reject.call("Fake market transport received invalid request JSON")
        return
    var request: Dictionary = decoded
    var request_id := str(request.get("requestId", ""))
    if request_id.is_empty() or _history.has(request_id):
        reject.call("Fake market transport received a duplicate or missing requestId")
        return
    _requests.append(request.duplicate(true))
    var callbacks := {"resolve": resolve, "reject": reject}
    _pending[request_id] = callbacks
    _history[request_id] = callbacks
    if auto_resume_none and request.get("method") == "resumeSession":
        resolve_success(request_id, null)
        return
    if not _next_synchronous_rejection.is_empty():
        var message := _next_synchronous_rejection
        _next_synchronous_rejection = ""
        _pending.erase(request_id)
        reject.call(message)

func reject_next_send_synchronously(message: String) -> void:
    assert(not message.is_empty())
    _next_synchronous_rejection = message

func resolve_success(request_id: String, payload: Variant) -> void:
    resolve_raw(request_id, {
        "contract": CONTRACT,
        "requestId": request_id,
        "ok": true,
        "payload": payload
    })

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
