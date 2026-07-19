extends RefCounted

const CONTRACT := "practice-run@1"
const CHECKPOINT_CONTRACT := "local-practice-checkpoint@1"
const STAGES := ["invent", "sell", "irresistible", "publish-check"]

var document_provider: Callable
var _active: Variant = null
var _adopt_sequence := 0

func send(request_json: String, resolve: Callable, _reject: Callable) -> void:
    var decoded: Variant = JSON.parse_string(request_json)
    assert(typeof(decoded) == TYPE_DICTIONARY)
    var request: Dictionary = decoded
    var request_id := String(request.get("requestId", ""))
    var method := String(request.get("method", ""))
    var payload: Variant = request.get("payload")
    if method == "resume":
        _adopt_provider_document()
        _resolve(resolve, request_id, _active)
        return
    assert(typeof(payload) == TYPE_DICTIONARY)
    var input: Dictionary = payload
    if method == "begin":
        var operation_id := String(input.get("operationId"))
        var suffix := operation_id.replace(":", "-").replace(".", "-")
        var document := _provider_document()
        document["documentId"] = "practice-document-%s" % suffix
        document["sessionId"] = "practice-session-%s" % suffix
        document["teamId"] = "practice-team-%s" % suffix
        document["mode"] = "offline"
        document["revision"] = 0
        document["gameplay"]["stage"] = "invent"
        _active = _recovery(
            document,
            "practice-run-%s" % suffix,
            String(input.get("teamAlias")),
            false,
            0,
            operation_id
        )
        _resolve(resolve, request_id, _active)
        return
    var token: Dictionary = input.get("checkpoint")
    assert(_active != null)
    var current: Dictionary = _provider_document()
    current["revision"] = int(token.get("documentRevision")) + 1
    var stage := String(token.get("stage"))
    var locked := false
    if method == "setLock":
        locked = bool(input.get("levelLocked"))
    elif method == "advance":
        stage = String(input.get("nextStage"))
        assert(STAGES.has(stage))
    else:
        assert(false, "Unexpected practice method")
    current["gameplay"]["stage"] = stage
    var prior_checkpoint: Dictionary = Dictionary(_active).get("checkpoint")
    _active = _recovery(
        current,
        String(token.get("runId")),
        String(prior_checkpoint.get("teamAlias")),
        locked,
        int(token.get("sequence")) + 1,
        String(input.get("operationId"))
    )
    _resolve(resolve, request_id, _active)

func _adopt_provider_document() -> void:
    if _active == null:
        return
    var current := _provider_document()
    var checkpoint: Dictionary = Dictionary(_active).get("checkpoint")
    if (
        current.get("documentId") != checkpoint.get("documentId")
        or current.get("sessionId") != checkpoint.get("sessionId")
        or current.get("teamId") != checkpoint.get("teamId")
    ):
        return
    _adopt_sequence += 1
    _active = _recovery(
        current,
        String(checkpoint.get("runId")),
        String(checkpoint.get("teamAlias")),
        false,
        int(checkpoint.get("sequence")) + 1,
        "fake-adopt-%d" % _adopt_sequence
    )

func _provider_document() -> Dictionary:
    assert(document_provider.is_valid())
    var value: Variant = document_provider.call()
    assert(typeof(value) == TYPE_DICTIONARY)
    return Dictionary(value).duplicate(true)

func _recovery(
    document: Dictionary,
    run_id: String,
    alias: String,
    locked: bool,
    sequence: int,
    operation_id: String
) -> Dictionary:
    var checkpoint := {
        "contract": CHECKPOINT_CONTRACT,
        "runId": run_id,
        "documentId": String(document.get("documentId")),
        "sessionId": String(document.get("sessionId")),
        "teamId": String(document.get("teamId")),
        "teamAlias": alias,
        "documentRevision": int(document.get("revision")),
        "documentHash": "a".repeat(64),
        "stage": String(document.get("gameplay").get("stage")),
        "levelLocked": locked,
        "sequence": sequence,
        "operationId": operation_id,
        "savedAt": "2026-07-17T05:00:00.000Z"
    }
    return {"checkpoint": checkpoint, "document": document.duplicate(true)}

func _resolve(resolve: Callable, request_id: String, payload: Variant) -> void:
    resolve.call(JSON.stringify({
        "contract": CONTRACT,
        "requestId": request_id,
        "ok": true,
        "payload": payload
    }))
