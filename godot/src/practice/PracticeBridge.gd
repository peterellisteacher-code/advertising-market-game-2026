extends Node

signal request_succeeded(request_id: String, method: String, payload: Variant)
signal request_failed(request_id: String, code: String, message: String)
signal diagnostic(message: String)

const CampaignDocument = preload("res://src/creator/CampaignDocument.gd")
const CONTRACT := "practice-run@1"
const CHECKPOINT_CONTRACT := "local-practice-checkpoint@1"
const STAGES := ["invent", "sell", "irresistible", "publish-check"]
const MAX_PENDING := 32
const MAX_COMPLETED := 64
const MAX_COUNTER := 1000000

var transport: RefCounted
var _next_request_number := 1
var _pending: Dictionary = {}
var _completed: Dictionary = {}
var _completed_order: Array[String] = []

func set_transport(value: RefCounted) -> void:
    transport = value

func resume() -> String:
    return _send("resume", null)

func begin(team_alias: Variant, operation_id: Variant) -> String:
    if not _is_alias(team_alias):
        return _reject_input("teamAlias must be a trimmed string of 2 to 32 characters")
    if not _is_id(operation_id, 128):
        return _reject_input("operationId is invalid")
    return _send("begin", {
        "teamAlias": String(team_alias),
        "operationId": String(operation_id)
    }, {"operationId": String(operation_id)})

func set_level_lock(token: Variant, level_locked: Variant, operation_id: Variant) -> String:
    var validated := _validate_token(token)
    if not validated.get("ok", false):
        return _reject_input(String(validated.get("message", "checkpoint token is invalid")))
    if typeof(level_locked) != TYPE_BOOL:
        return _reject_input("levelLocked must be a boolean")
    if not _is_id(operation_id, 128):
        return _reject_input("operationId is invalid")
    var value: Dictionary = validated.get("value")
    return _send("setLock", {
        "checkpoint": value,
        "levelLocked": level_locked,
        "operationId": String(operation_id)
    }, {
        "checkpoint": value,
        "levelLocked": level_locked,
        "operationId": String(operation_id)
    })

func advance(token: Variant, next_stage: Variant, operation_id: Variant) -> String:
    var validated := _validate_token(token)
    if not validated.get("ok", false):
        return _reject_input(String(validated.get("message", "checkpoint token is invalid")))
    if typeof(next_stage) != TYPE_STRING or not STAGES.has(String(next_stage)):
        return _reject_input("nextStage is invalid")
    var value: Dictionary = validated.get("value")
    var stage_index := STAGES.find(String(value.get("stage")))
    if stage_index < 0 or stage_index + 1 >= STAGES.size() or STAGES[stage_index + 1] != String(next_stage):
        return _reject_input("nextStage must be the next pitch stage")
    if not _is_id(operation_id, 128):
        return _reject_input("operationId is invalid")
    return _send("advance", {
        "checkpoint": value,
        "nextStage": String(next_stage),
        "operationId": String(operation_id)
    }, {
        "checkpoint": value,
        "nextStage": String(next_stage),
        "operationId": String(operation_id)
    })

func pending_count() -> int:
    return _pending.size()

func _send(method: String, payload: Variant, context: Dictionary = {}) -> String:
    var request_id := _new_request_id()
    if _pending.size() >= MAX_PENDING:
        _remember_completed(request_id)
        _fail(request_id, "TOO_MANY_PENDING", "Too many practice recovery requests are pending")
        return request_id
    if transport == null:
        _remember_completed(request_id)
        _fail(request_id, "PRACTICE_UNAVAILABLE", "Practice recovery transport is unavailable")
        return request_id
    var request_context := context.duplicate(true)
    request_context["method"] = method
    _pending[request_id] = request_context
    var request_json := JSON.stringify({
        "contract": CONTRACT,
        "requestId": request_id,
        "method": method,
        "payload": payload
    })
    transport.send(
        request_json,
        func(response_json: String) -> void: accept_response(request_id, response_json),
        func(message: String) -> void: accept_transport_error(request_id, message)
    )
    return request_id

func accept_response(expected_request_id: String, response_json: String) -> void:
    if _completed.has(expected_request_id):
        _fail(expected_request_id, "DUPLICATE_RESPONSE", "Practice recovery returned a duplicate response")
        return
    if not _pending.has(expected_request_id):
        _fail(expected_request_id, "STALE_RESPONSE", "Practice recovery returned a stale response")
        return
    var decoded: Variant = JSON.parse_string(response_json)
    if typeof(decoded) != TYPE_DICTIONARY:
        _finish_failure(expected_request_id, "INVALID_RESPONSE", "Practice response must be a JSON object")
        return
    var response: Dictionary = decoded
    if response.get("contract") != CONTRACT:
        _finish_failure(expected_request_id, "UNSUPPORTED_CONTRACT", "Practice response contract is unsupported")
        return
    if response.get("requestId") != expected_request_id:
        _finish_failure(expected_request_id, "REQUEST_ID_MISMATCH", "Practice response requestId did not match")
        return
    if typeof(response.get("ok")) != TYPE_BOOL:
        _finish_failure(expected_request_id, "INVALID_RESPONSE", "Practice response ok must be a boolean")
        return
    var expected_keys := ["contract", "requestId", "ok", "payload"] if response.get("ok") else ["contract", "requestId", "ok", "error"]
    if not _has_exact_keys(response, expected_keys):
        _finish_failure(expected_request_id, "INVALID_RESPONSE", "Practice response envelope is not exact")
        return
    var context: Dictionary = _pending.get(expected_request_id)
    var method := String(context.get("method", ""))
    if method.is_empty():
        _finish_failure(expected_request_id, "INVALID_RESPONSE", "Practice request context is invalid")
        return
    if response.get("ok") == true:
        var payload: Variant = response.get("payload")
        if method == "resume" and payload == null:
            _complete(expected_request_id)
            request_succeeded.emit(expected_request_id, method, null)
            return
        var recovery := _validate_recovery(payload)
        if not recovery.get("ok", false):
            _finish_failure(expected_request_id, "INVALID_RECOVERY_RESPONSE", String(recovery.get("message", "Practice recovery is invalid")))
            return
        var value: Dictionary = recovery.get("value")
        var context_check := _validate_response_context(method, value, context)
        if not context_check.get("ok", false):
            _finish_failure(expected_request_id, "INVALID_RECOVERY_RESPONSE", String(context_check.get("message", "Practice recovery does not match the request")))
            return
        _complete(expected_request_id)
        request_succeeded.emit(expected_request_id, method, value)
        return
    var error: Variant = response.get("error")
    if typeof(error) != TYPE_DICTIONARY or not _has_exact_keys(error, ["code", "message"]):
        _finish_failure(expected_request_id, "INVALID_RESPONSE", "Practice error response is invalid")
        return
    if typeof(error.get("code")) != TYPE_STRING or String(error.get("code")).is_empty() or typeof(error.get("message")) != TYPE_STRING or String(error.get("message")).is_empty():
        _finish_failure(expected_request_id, "INVALID_RESPONSE", "Practice error code and message must be non-empty strings")
        return
    _complete(expected_request_id)
    _fail(expected_request_id, String(error.get("code")), String(error.get("message")))

func accept_transport_error(expected_request_id: String, message: String) -> void:
    if _completed.has(expected_request_id):
        _fail(expected_request_id, "DUPLICATE_RESPONSE", "Practice recovery returned a duplicate transport result")
        return
    if not _pending.has(expected_request_id):
        _fail(expected_request_id, "STALE_RESPONSE", "Practice recovery returned a stale transport result")
        return
    _finish_failure(expected_request_id, "TRANSPORT_ERROR", message)

func _validate_response_context(method: String, recovery: Dictionary, context: Dictionary) -> Dictionary:
    if method == "resume":
        return {"ok": true}
    var checkpoint: Dictionary = recovery.get("checkpoint")
    if method == "begin":
        if checkpoint.get("operationId") != context.get("operationId"):
            return _invalid("Begin operationId did not match")
        return {"ok": true}
    var expected: Dictionary = context.get("checkpoint")
    for key in ["runId", "documentId"]:
        if checkpoint.get(key) != expected.get(key):
            return _invalid("Recovery %s did not match the request" % key)
    if checkpoint.get("operationId") != context.get("operationId"):
        return _invalid("Recovery operationId did not match")
    if int(checkpoint.get("sequence")) != int(expected.get("sequence")) + 1:
        return _invalid("Recovery sequence did not advance exactly once")
    if method == "setLock":
        if int(checkpoint.get("documentRevision")) != int(expected.get("documentRevision")) + 1:
            return _invalid("Lock did not create exactly one campaign revision")
        if checkpoint.get("stage") != expected.get("stage"):
            return _invalid("Lock changed the pitch stage")
        if checkpoint.get("levelLocked") != context.get("levelLocked"):
            return _invalid("Lock result did not match the request")
    elif method == "advance":
        if int(checkpoint.get("documentRevision")) != int(expected.get("documentRevision")) + 1:
            return _invalid("Advance did not create exactly one campaign revision")
        if checkpoint.get("stage") != context.get("nextStage") or checkpoint.get("levelLocked") != false:
            return _invalid("Advance returned the wrong stage or lock state")
    return {"ok": true}

func _validate_recovery(value: Variant) -> Dictionary:
    if typeof(value) != TYPE_DICTIONARY or not _has_exact_keys(value, ["checkpoint", "document"]):
        return _invalid("Recovery must contain exactly checkpoint and document")
    var checkpoint_value: Variant = value.get("checkpoint")
    if typeof(checkpoint_value) != TYPE_DICTIONARY:
        return _invalid("Recovery checkpoint must be a dictionary")
    var checkpoint: Dictionary = checkpoint_value
    var checkpoint_keys := [
        "contract", "runId", "documentId", "sessionId", "teamId", "teamAlias",
        "documentRevision", "documentHash", "stage", "levelLocked", "sequence",
        "operationId", "savedAt"
    ]
    if not _has_exact_keys(checkpoint, checkpoint_keys) or checkpoint.get("contract") != CHECKPOINT_CONTRACT:
        return _invalid("Recovery checkpoint contract or fields are invalid")
    for key in ["runId", "documentId", "sessionId", "teamId", "operationId"]:
        if not _is_id(checkpoint.get(key), 128):
            return _invalid("Recovery checkpoint %s is invalid" % key)
    if not _is_alias(checkpoint.get("teamAlias")):
        return _invalid("Recovery team alias is invalid")
    if not CampaignDocument.is_nonnegative_integer_number(checkpoint.get("documentRevision")) or not CampaignDocument.is_nonnegative_integer_number(checkpoint.get("sequence")):
        return _invalid("Recovery revision and sequence must be non-negative integers")
    if not _is_hash(checkpoint.get("documentHash")):
        return _invalid("Recovery document hash is invalid")
    if typeof(checkpoint.get("stage")) != TYPE_STRING or not STAGES.has(String(checkpoint.get("stage"))):
        return _invalid("Recovery stage is invalid")
    if typeof(checkpoint.get("levelLocked")) != TYPE_BOOL:
        return _invalid("Recovery levelLocked must be a boolean")
    if checkpoint.get("stage") == "publish-check" and checkpoint.get("levelLocked") == true:
        return _invalid("Publish check cannot be level-locked")
    var saved_at: Variant = checkpoint.get("savedAt")
    if typeof(saved_at) != TYPE_STRING or String(saved_at).length() < 20 or String(saved_at).length() > 40 or not String(saved_at).ends_with("Z"):
        return _invalid("Recovery savedAt is invalid")
    var document_check := CampaignDocument.validate_bridge_shape(value.get("document"))
    if not document_check.get("ok", false):
        return _invalid(String(document_check.get("message", "Recovery campaign is invalid")))
    var document: Dictionary = document_check.get("value")
    if document.get("mode") != "offline":
        return _invalid("Recovery campaign must be offline")
    for pair in [["documentId", "documentId"], ["sessionId", "sessionId"], ["teamId", "teamId"], ["revision", "documentRevision"]]:
        if document.get(pair[0]) != checkpoint.get(pair[1]):
            return _invalid("Recovery campaign identity or revision does not match its checkpoint")
    var gameplay_value: Variant = document.get("gameplay")
    if typeof(gameplay_value) != TYPE_DICTIONARY or not _has_exact_keys(gameplay_value, ["stage", "pair"]):
        return _invalid("Recovery gameplay is invalid")
    var gameplay: Dictionary = gameplay_value
    if gameplay.get("stage") != checkpoint.get("stage"):
        return _invalid("Recovery campaign stage does not match its checkpoint")
    var pair_check := _validate_pair(gameplay.get("pair"))
    if not pair_check.get("ok", false):
        return pair_check
    return {"ok": true, "value": {"checkpoint": checkpoint.duplicate(true), "document": document}}

func _validate_pair(value: Variant) -> Dictionary:
    if typeof(value) != TYPE_DICTIONARY or not _has_exact_keys(value, ["activeRole", "handoffCount", "artDirectorActions", "strategistActions", "roleGuideAcknowledged"]):
        return _invalid("Recovery pair state is invalid")
    if not ["art-director", "strategist"].has(String(value.get("activeRole", ""))):
        return _invalid("Recovery active pair role is invalid")
    for key in ["handoffCount", "artDirectorActions", "strategistActions"]:
        if not CampaignDocument.is_nonnegative_integer_number(value.get(key)) or int(value.get(key)) > MAX_COUNTER:
            return _invalid("Recovery pair counter is invalid")
    if typeof(value.get("roleGuideAcknowledged")) != TYPE_BOOL:
        return _invalid("Recovery role-guide acknowledgement is invalid")
    return {"ok": true}

func _validate_token(value: Variant) -> Dictionary:
    var keys := ["runId", "documentId", "documentRevision", "sequence", "stage"]
    if typeof(value) != TYPE_DICTIONARY or not _has_exact_keys(value, keys):
        return _invalid("checkpoint token is invalid")
    for key in ["runId", "documentId"]:
        if not _is_id(value.get(key), 128):
            return _invalid("checkpoint token %s is invalid" % key)
    for key in ["documentRevision", "sequence"]:
        if not CampaignDocument.is_nonnegative_integer_number(value.get(key)):
            return _invalid("checkpoint token %s is invalid" % key)
    if typeof(value.get("stage")) != TYPE_STRING or not STAGES.has(String(value.get("stage"))):
        return _invalid("checkpoint token stage is invalid")
    return {"ok": true, "value": Dictionary(value).duplicate(true)}

func _has_exact_keys(value: Dictionary, expected: Array) -> bool:
    if value.size() != expected.size():
        return false
    for key in expected:
        if not value.has(key):
            return false
    return true

func _is_alias(value: Variant) -> bool:
    return typeof(value) == TYPE_STRING and String(value) == String(value).strip_edges() and String(value).length() >= 2 and String(value).length() <= 32

func _is_id(value: Variant, maximum: int) -> bool:
    if typeof(value) != TYPE_STRING or String(value).is_empty() or String(value).length() > maximum:
        return false
    var text := String(value)
    for index in text.length():
        var code := text.unicode_at(index)
        var allowed := (code >= 48 and code <= 57) or (code >= 65 and code <= 90) or (code >= 97 and code <= 122) or ". _:-".replace(" ", "").contains(String.chr(code))
        if not allowed:
            return false
    return true

func _is_hash(value: Variant) -> bool:
    if typeof(value) != TYPE_STRING or String(value).length() != 64:
        return false
    for character in String(value):
        if not "0123456789abcdef".contains(character):
            return false
    return true

func _reject_input(message: String) -> String:
    _fail("", "INVALID_REQUEST", message)
    return ""

func _finish_failure(request_id: String, code: String, message: String) -> void:
    _complete(request_id)
    _fail(request_id, code, message)

func _complete(request_id: String) -> void:
    _pending.erase(request_id)
    _remember_completed(request_id)

func _remember_completed(request_id: String) -> void:
    _completed[request_id] = true
    _completed_order.append(request_id)
    while _completed_order.size() > MAX_COMPLETED:
        _completed.erase(_completed_order.pop_front())

func _new_request_id() -> String:
    var request_id := "practice-%d" % _next_request_number
    _next_request_number += 1
    return request_id

func _fail(request_id: String, code: String, message: String) -> void:
    diagnostic.emit("%s: %s" % [code, message])
    request_failed.emit(request_id, code, message)

func _invalid(message: String) -> Dictionary:
    return {"ok": false, "message": message}
