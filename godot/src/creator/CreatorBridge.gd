extends Node

signal request_succeeded(request_id: String, method: String, payload: Variant)
signal request_failed(request_id: String, code: String, message: String)
signal close_requested
signal diagnostic(message: String)

const CampaignDocument = preload("res://src/creator/CampaignDocument.gd")
const CONTRACT := "creator-bridge@1"
const PUBLISHED_CONTRACT := "published-campaign@1"
const PNG_SIGNATURE := [137, 80, 78, 71, 13, 10, 26, 10]
const MAX_PENDING := 32
const MAX_COMPLETED := 64

var transport: RefCounted
var _next_request_number := 1
var _pending: Dictionary = {}
var _completed: Dictionary = {}
var _completed_order: Array[String] = []

func set_transport(value: RefCounted) -> void:
    transport = value
    if transport != null and transport.has_method("set_close_requested_callback"):
        transport.set_close_requested_callback(_on_close_requested)

func open(document: Dictionary) -> String:
    var validated := CampaignDocument.validate_bridge_shape(document)
    if not validated.get("ok", false):
        _fail("", "INVALID_DOCUMENT", str(validated.get("message", "Invalid campaign document")))
        return ""
    return _send("open", validated.get("value"))

func get_state() -> String:
    return _send("getState", null)

func save() -> String:
    return _send("save", null)

func publish() -> String:
    return _send("publish", null)

func close() -> String:
    return _send("close", null)

func pending_count() -> int:
    return _pending.size()

func _send(method: String, payload: Variant) -> String:
    var request_id := _new_request_id()
    if _pending.size() >= MAX_PENDING:
        _remember_completed(request_id)
        _fail(request_id, "TOO_MANY_PENDING", "Too many Campaign Creator requests are pending")
        return request_id
    if transport == null:
        _remember_completed(request_id)
        _fail(request_id, "CREATOR_UNAVAILABLE", "Campaign Creator transport is unavailable")
        return request_id

    _pending[request_id] = method
    var request_json := JSON.stringify({
        "contract": CONTRACT,
        "requestId": request_id,
        "method": method,
        "payload": payload
    })
    var resolve := func(response_json: String) -> void:
        accept_response(request_id, response_json)
    var reject := func(message: String) -> void:
        accept_transport_error(request_id, message)
    transport.send(request_json, resolve, reject)
    return request_id

func accept_response(expected_request_id: String, response_json: String) -> void:
    if _completed.has(expected_request_id):
        _fail(expected_request_id, "DUPLICATE_RESPONSE", "Creator returned a duplicate response")
        return
    if not _pending.has(expected_request_id):
        _fail(expected_request_id, "STALE_RESPONSE", "Creator returned a stale response")
        return

    var decoded: Variant = JSON.parse_string(response_json)
    if typeof(decoded) != TYPE_DICTIONARY:
        _finish_failure(expected_request_id, "INVALID_RESPONSE", "Creator response must be a JSON object")
        return
    var response: Dictionary = decoded
    if response.get("contract") != CONTRACT:
        _finish_failure(expected_request_id, "UNSUPPORTED_CONTRACT", "Creator returned an unsupported contract")
        return
    if response.get("requestId") != expected_request_id:
        _finish_failure(expected_request_id, "REQUEST_ID_MISMATCH", "Creator response requestId did not match")
        return
    if typeof(response.get("ok")) != TYPE_BOOL:
        _finish_failure(expected_request_id, "INVALID_RESPONSE", "Creator response ok must be a boolean")
        return

    var method := str(_pending.get(expected_request_id))
    var payload: Variant = response.get("payload")
    if response.get("ok") == true:
        if method == "getState":
            var validated := CampaignDocument.validate_bridge_shape(payload)
            if not validated.get("ok", false):
                _finish_failure(
                    expected_request_id,
                    "INVALID_DOCUMENT_RESPONSE",
                    str(validated.get("message", "Creator returned an invalid campaign document"))
                )
                return
            payload = validated.get("value")
        elif method == "publish":
            var publication := _validate_publication(payload)
            if not publication.get("ok", false):
                _finish_failure(
                    expected_request_id,
                    "INVALID_PUBLICATION_RESPONSE",
                    str(publication.get("message", "Creator returned an invalid publication"))
                )
                return
            payload = publication.get("value")
        _complete(expected_request_id)
        request_succeeded.emit(expected_request_id, method, payload)
        return
    var error: Variant = response.get("error")
    if typeof(error) != TYPE_DICTIONARY:
        _finish_failure(expected_request_id, "INVALID_RESPONSE", "Creator error response must include an error object")
        return
    if typeof(error.get("code")) != TYPE_STRING or String(error.get("code")).is_empty():
        _finish_failure(expected_request_id, "INVALID_RESPONSE", "Creator error code must be a non-empty string")
        return
    if typeof(error.get("message")) != TYPE_STRING or String(error.get("message")).is_empty():
        _finish_failure(expected_request_id, "INVALID_RESPONSE", "Creator error message must be a non-empty string")
        return
    _complete(expected_request_id)
    _fail(
        expected_request_id,
        String(error.get("code")),
        String(error.get("message"))
    )

func _validate_publication(value: Variant) -> Dictionary:
    if typeof(value) != TYPE_DICTIONARY:
        return {"ok": false, "message": "Published campaign must be a dictionary"}
    var publication: Dictionary = value
    if publication.get("contract") != PUBLISHED_CONTRACT:
        return {"ok": false, "message": "Published campaign contract is unsupported"}
    if typeof(publication.get("documentId")) != TYPE_STRING or String(publication.get("documentId")).is_empty():
        return {"ok": false, "message": "Published campaign documentId must be a non-empty string"}
    if not CampaignDocument.is_nonnegative_integer_number(publication.get("revision")):
        return {"ok": false, "message": "Published campaign revision must be a non-negative integer"}

    var encoded: Variant = publication.get("pngBase64")
    if typeof(encoded) != TYPE_STRING or String(encoded).is_empty():
        return {"ok": false, "message": "Published campaign PNG must be non-empty canonical base64"}
    var png_bytes := Marshalls.base64_to_raw(String(encoded))
    if png_bytes.is_empty() or Marshalls.raw_to_base64(png_bytes) != String(encoded):
        return {"ok": false, "message": "Published campaign PNG must be non-empty canonical base64"}
    if png_bytes.size() < PNG_SIGNATURE.size():
        return {"ok": false, "message": "Published campaign PNG signature is invalid"}
    for index in PNG_SIGNATURE.size():
        if png_bytes[index] != PNG_SIGNATURE[index]:
            return {"ok": false, "message": "Published campaign PNG signature is invalid"}

    var metadata: Variant = publication.get("metadata")
    if typeof(metadata) != TYPE_DICTIONARY:
        return {"ok": false, "message": "Published campaign metadata must be a dictionary"}
    if typeof(metadata.get("productName")) != TYPE_STRING:
        return {"ok": false, "message": "Published campaign productName must be a string"}
    if not CampaignDocument.is_nonnegative_integer_number(metadata.get("priceCents")):
        return {"ok": false, "message": "Published campaign priceCents must be a non-negative integer"}
    if typeof(metadata.get("brief")) != TYPE_DICTIONARY:
        return {"ok": false, "message": "Published campaign brief must be a dictionary"}
    if typeof(metadata.get("evidence")) != TYPE_DICTIONARY:
        return {"ok": false, "message": "Published campaign evidence must be a dictionary"}
    if typeof(metadata.get("assetReferences")) != TYPE_ARRAY:
        return {"ok": false, "message": "Published campaign assetReferences must be an array"}
    return {"ok": true, "value": publication.duplicate(true)}

func accept_transport_error(expected_request_id: String, message: String) -> void:
    if _completed.has(expected_request_id):
        _fail(expected_request_id, "DUPLICATE_RESPONSE", "Creator returned a duplicate transport result")
        return
    if not _pending.has(expected_request_id):
        _fail(expected_request_id, "STALE_RESPONSE", "Creator returned a stale transport result")
        return
    _finish_failure(expected_request_id, "TRANSPORT_ERROR", message)

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
    var request_id := "creator-%d" % _next_request_number
    _next_request_number += 1
    return request_id

func _on_close_requested() -> void:
    close_requested.emit()

func _fail(request_id: String, code: String, message: String) -> void:
    diagnostic.emit("%s: %s" % [code, message])
    request_failed.emit(request_id, code, message)
