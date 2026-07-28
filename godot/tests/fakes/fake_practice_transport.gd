extends RefCounted
class_name AdMarketFakePracticeTransport

const CONTRACT := "practice-run@1"

var _requests: Array[Dictionary] = []
var _history: Dictionary = {}
var _last_responses: Dictionary = {}

func send(request_json: String, resolve: Callable, reject: Callable) -> void:
    var decoded: Variant = JSON.parse_string(request_json)
    assert(typeof(decoded) == TYPE_DICTIONARY)
    var request: Dictionary = decoded
    var request_id := String(request.get("requestId", ""))
    assert(not request_id.is_empty() and not _history.has(request_id))
    _requests.append(request.duplicate(true))
    _history[request_id] = {"resolve": resolve, "reject": reject}

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
    var resolve: Callable = Dictionary(_history.get(request_id)).get("resolve")
    resolve.call(response_json)

func reject_request(request_id: String, message: String) -> void:
    assert(_history.has(request_id))
    var reject: Callable = Dictionary(_history.get(request_id)).get("reject")
    reject.call(message)

func repeat_response(request_id: String) -> void:
    assert(_history.has(request_id) and _last_responses.has(request_id))
    var resolve: Callable = Dictionary(_history.get(request_id)).get("resolve")
    resolve.call(String(_last_responses.get(request_id)))

func request_for(request_id: String) -> Dictionary:
    for request in _requests:
        if request.get("requestId") == request_id:
            return request.duplicate(true)
    return {}

func request_count() -> int:
    return _requests.size()
