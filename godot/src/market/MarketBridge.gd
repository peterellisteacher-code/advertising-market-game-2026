extends Node

signal request_succeeded(request_id: String, method: String, payload: Variant)
signal request_failed(request_id: String, code: String, message: String)
signal diagnostic(message: String)

const CONTRACT := "market-bridge@1"
const PUBLISHED_CONTRACT := "published-campaign@1"
const PNG_SIGNATURE := [137, 80, 78, 71, 13, 10, 26, 10]
const PNG_IHDR := [73, 72, 68, 82]
const PNG_IDAT := [73, 68, 65, 84]
const PNG_IEND := [73, 69, 78, 68]
const PNG_WIDTH := 1600
const PNG_HEIGHT := 900
const MAX_PENDING := 32
const MAX_COMPLETED := 64
const MAX_SAFE_INTEGER := 9007199254740991
const MAX_ARTWORK_BYTES := 4 * 1024 * 1024
const MAX_ARTWORK_BASE64_CHARS := 5592408
const MIN_OPENING_WALLET := 100
const MAX_OPENING_WALLET := 1000000
const MAX_PRICE_CENTS := 1000000000000
const MAX_ASSET_REFERENCES := 10000
const ROOM_CODE_ALPHABET := "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
const ASCII_ALPHANUMERIC := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
const HEXADECIMAL := "0123456789abcdefABCDEF"
const MARKET_ID_SUFFIX := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._:-"
const ARTWORK_KEY_SUFFIX := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._:/-"
const REVIEW_STATUSES := ["approved", "returned", "hidden"]
const CONTROL_ACTIONS := ["openMarket", "openReveal", "closeMarket", "removeTeam"]

var transport: RefCounted
var _next_request_number := 1
var _pending: Dictionary = {}
var _completed: Dictionary = {}
var _completed_order: Array[String] = []

func set_transport(value: RefCounted) -> void:
    transport = value

func create_room(
    opening_wallet: Variant,
    classroom_code: Variant,
    max_teams: Variant = 15
) -> String:
    if (
        typeof(opening_wallet) != TYPE_INT
        or int(opening_wallet) < MIN_OPENING_WALLET
        or int(opening_wallet) > MAX_OPENING_WALLET
    ):
        return _reject_input("openingWallet must be an integer from 100 to 1000000")
    if not _is_safe_string(classroom_code, 128):
        return _reject_input("classroomCode must be a trimmed non-empty string")
    if typeof(max_teams) != TYPE_INT or int(max_teams) < 3 or int(max_teams) > 30:
        return _reject_input("maxTeams must be an integer from 3 to 30")
    return _send("createRoom", {
        "openingWallet": int(opening_wallet),
        "classroomCode": str(classroom_code),
        "maxTeams": int(max_teams)
    })

func join_room(room_code: Variant, alias: Variant) -> String:
    if not _is_room_code(room_code):
        return _reject_input("roomCode must match the Live Market room-code format")
    if not _is_safe_string(alias, 32) or str(alias).length() < 2:
        return _reject_input("alias must be a trimmed string of 2 to 32 characters")
    return _send("joinRoom", {"roomCode": str(room_code), "alias": str(alias)})

func resume_session() -> String:
    return _send("resumeSession", null)

func get_snapshot() -> String:
    return _send("getSnapshot", null)

func publish_campaign(publication: Variant, command_id: Variant) -> String:
    var validated := _validate_publication(publication)
    if not validated.get("ok", false):
        return _reject_input(str(validated.get("message", "publication is invalid")))
    if not _is_uuid(command_id):
        return _reject_input("commandId must be a UUID")
    return _send(
        "publishCampaign",
        {"commandId": str(command_id), "publication": validated.get("value")},
        {"commandId": str(command_id)}
    )

func purchase(campaign_id: Variant, purchase_request_id: Variant) -> String:
    if not _is_market_id(campaign_id):
        return _reject_input("campaignId is invalid")
    if not _is_market_id(purchase_request_id):
        return _reject_input("purchase requestId is invalid")
    return _send("purchase", {
        "campaignId": str(campaign_id),
        "requestId": str(purchase_request_id)
    })

func finish(command_id: Variant) -> String:
    if not _is_uuid(command_id):
        return _reject_input("commandId must be a UUID")
    return _send("finish", {"commandId": str(command_id)}, {"commandId": str(command_id)})

func review_campaign(
    campaign_id: Variant,
    submission_version: Variant,
    status: Variant,
    command_id: Variant,
    review_note: Variant = null
) -> String:
    if not _is_market_id(campaign_id):
        return _reject_input("campaignId is invalid")
    if not _is_positive_integer_number(submission_version):
        return _reject_input("submissionVersion must be a positive integer")
    if typeof(status) != TYPE_STRING or not REVIEW_STATUSES.has(str(status)):
        return _reject_input("review status must be approved, returned, or hidden")
    if not _is_uuid(command_id):
        return _reject_input("commandId must be a UUID")
    if review_note != null and not _is_safe_string(review_note, 240):
        return _reject_input("reviewNote must be a trimmed string of 1 to 240 characters")
    var payload := {
        "commandId": str(command_id),
        "campaignId": str(campaign_id),
        "submissionVersion": int(submission_version),
        "status": str(status)
    }
    if review_note != null:
        payload["reviewNote"] = str(review_note)
    return _send("reviewCampaign", payload, {
        "commandId": str(command_id),
        "campaignId": str(campaign_id),
        "submissionVersion": int(submission_version),
        "status": str(status)
    })

func control(action: Variant, command_id: Variant, team_id: Variant = null) -> String:
    if typeof(action) != TYPE_STRING or not CONTROL_ACTIONS.has(str(action)):
        return _reject_input("control action is unsupported")
    if not _is_uuid(command_id):
        return _reject_input("commandId must be a UUID")
    if str(action) == "removeTeam":
        if not _is_market_id(team_id):
            return _reject_input("removeTeam requires a valid teamId")
        return _send("control", {
            "commandId": str(command_id),
            "action": "removeTeam",
            "teamId": str(team_id)
        }, {
            "commandId": str(command_id),
            "action": "removeTeam",
            "teamId": str(team_id)
        })
    if team_id != null:
        return _reject_input("teamId is only valid for removeTeam")
    return _send("control", {
        "commandId": str(command_id),
        "action": str(action)
    }, {"commandId": str(command_id), "action": str(action)})

func get_artwork(artwork_key: Variant) -> String:
    if not _is_artwork_key(artwork_key):
        return _reject_input("artworkKey is invalid")
    var key := str(artwork_key)
    return _send("getArtwork", {"artworkKey": key}, {"artworkKey": key})

func pending_count() -> int:
    return _pending.size()

func has_pending(request_id: String) -> bool:
    return _pending.has(request_id)

func _send(method: String, payload: Variant, request_context: Dictionary = {}) -> String:
    var request_id := _new_request_id()
    if _pending.size() >= MAX_PENDING:
        _remember_completed(request_id)
        _fail(request_id, "TOO_MANY_PENDING", "Too many Live Market requests are pending")
        return request_id
    if transport == null:
        _remember_completed(request_id)
        _fail(request_id, "MARKET_UNAVAILABLE", "Live Market transport is unavailable")
        return request_id

    var context := request_context.duplicate(true)
    context["method"] = method
    _pending[request_id] = context
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
        _fail(expected_request_id, "DUPLICATE_RESPONSE", "Live Market returned a duplicate response")
        return
    if not _pending.has(expected_request_id):
        _fail(expected_request_id, "STALE_RESPONSE", "Live Market returned a stale response")
        return

    var decoded: Variant = JSON.parse_string(response_json)
    if typeof(decoded) != TYPE_DICTIONARY:
        _finish_failure(expected_request_id, "INVALID_RESPONSE", "Live Market response must be a JSON object")
        return
    var response: Dictionary = decoded
    if response.get("contract") != CONTRACT:
        _finish_failure(expected_request_id, "UNSUPPORTED_CONTRACT", "Live Market returned an unsupported contract")
        return
    if response.get("requestId") != expected_request_id:
        _finish_failure(expected_request_id, "REQUEST_ID_MISMATCH", "Live Market response requestId did not match")
        return
    if typeof(response.get("ok")) != TYPE_BOOL:
        _finish_failure(expected_request_id, "INVALID_RESPONSE", "Live Market response ok must be a boolean")
        return
    var expected_response_keys := (
        ["contract", "requestId", "ok", "payload"]
        if response.get("ok") == true
        else ["contract", "requestId", "ok", "error"]
    )
    if not _has_exact_dictionary_keys(response, expected_response_keys):
        _finish_failure(
            expected_request_id,
            "INVALID_RESPONSE",
            "Live Market response envelope contains unexpected or missing fields"
        )
        return

    var context_value: Variant = _pending.get(expected_request_id)
    if typeof(context_value) != TYPE_DICTIONARY:
        _finish_failure(expected_request_id, "INVALID_RESPONSE", "Live Market request context is invalid")
        return
    var method_value: Variant = context_value.get("method")
    if typeof(method_value) != TYPE_STRING or str(method_value).is_empty():
        _finish_failure(expected_request_id, "INVALID_RESPONSE", "Live Market request method context is invalid")
        return
    var method := str(method_value)
    if response.get("ok") == true:
        var validated := _validate_success_payload(method, response.get("payload"), context_value)
        if not validated.get("ok", false):
            _finish_failure(
                expected_request_id,
                str(validated.get("code", "INVALID_MARKET_RESPONSE")),
                str(validated.get("message", "Live Market returned an invalid payload"))
            )
            return
        _complete(expected_request_id)
        request_succeeded.emit(expected_request_id, method, validated.get("value"))
        return

    var error: Variant = response.get("error")
    if typeof(error) != TYPE_DICTIONARY:
        _finish_failure(expected_request_id, "INVALID_RESPONSE", "Live Market error response must include an error object")
        return
    if not _has_exact_dictionary_keys(error, ["code", "message"]):
        _finish_failure(expected_request_id, "INVALID_RESPONSE", "Live Market error contains unexpected or missing fields")
        return
    if typeof(error.get("code")) != TYPE_STRING or str(error.get("code")).is_empty():
        _finish_failure(expected_request_id, "INVALID_RESPONSE", "Live Market error code must be a non-empty string")
        return
    if typeof(error.get("message")) != TYPE_STRING or str(error.get("message")).is_empty():
        _finish_failure(expected_request_id, "INVALID_RESPONSE", "Live Market error message must be a non-empty string")
        return
    _complete(expected_request_id)
    _fail(expected_request_id, str(error.get("code")), str(error.get("message")))

func accept_transport_error(expected_request_id: String, message: String) -> void:
    if _completed.has(expected_request_id):
        _fail(expected_request_id, "DUPLICATE_RESPONSE", "Live Market returned a duplicate transport result")
        return
    if not _pending.has(expected_request_id):
        _fail(expected_request_id, "STALE_RESPONSE", "Live Market returned a stale transport result")
        return
    _finish_failure(expected_request_id, "TRANSPORT_ERROR", message)

func _validate_success_payload(
    method: String,
    payload: Variant,
    request_context: Dictionary
) -> Dictionary:
    if method in ["createRoom", "joinRoom"]:
        return _validate_room_result(payload, method)
    if method == "resumeSession":
        if payload == null:
            return {"ok": true, "value": null}
        return _validate_room_result(payload, method)
    if method == "getSnapshot":
        var snapshot := _validate_snapshot(payload)
        if not snapshot.get("ok", false):
            return {
                "ok": false,
                "code": "INVALID_SNAPSHOT_RESPONSE",
                "message": snapshot.get("message", "Live Market snapshot is invalid")
            }
        return snapshot
    if method == "getArtwork":
        return _validate_artwork(payload, str(request_context.get("artworkKey", "")))
    if method in ["publishCampaign", "finish", "reviewCampaign", "control"]:
        return _validate_command_result(method, payload, request_context)
    return _validate_market_result(payload)

func _validate_command_result(
    method: String,
    value: Variant,
    request_context: Dictionary
) -> Dictionary:
    if typeof(value) != TYPE_DICTIONARY:
        return _invalid_market_result("Durable command result must be a dictionary")
    if _contains_sensitive_key(value):
        return _invalid_market_result("Durable command result contains a sensitive field")
    var result: Dictionary = value.duplicate(true)
    var expected_keys := (
        ["replayed", "campaignId", "submissionVersion", "postcondition", "snapshot"]
        if method == "publishCampaign"
        else ["replayed", "postcondition", "snapshot"]
    )
    if not _has_exact_dictionary_keys(result, expected_keys):
        return _invalid_market_result("Durable command result contains unexpected or missing fields")
    if typeof(result.get("replayed")) != TYPE_BOOL:
        return _invalid_market_result("Durable command replayed must be a boolean")
    var snapshot := _validate_snapshot(result.get("snapshot"))
    if not snapshot.get("ok", false):
        return _invalid_market_result(str(snapshot.get("message", "Durable command snapshot is invalid")))
    result["snapshot"] = snapshot.get("value")
    var postcondition_value: Variant = result.get("postcondition")
    if typeof(postcondition_value) != TYPE_DICTIONARY:
        return _invalid_market_result("Durable command postcondition must be a dictionary")
    var postcondition: Dictionary = postcondition_value

    if method == "publishCampaign":
        if not _is_market_id(result.get("campaignId")):
            return _invalid_market_result("Publish campaignId is invalid")
        if not _is_positive_integer_number(result.get("submissionVersion")):
            return _invalid_market_result("Publish submissionVersion must be a positive integer")
        if not _has_exact_dictionary_keys(
            postcondition,
            ["kind", "campaignId", "submissionVersion"]
        ):
            return _invalid_market_result("Publish postcondition contains unexpected or missing fields")
        if (
            postcondition.get("kind") != "publish"
            or postcondition.get("campaignId") != result.get("campaignId")
            or not _same_integer(
                postcondition.get("submissionVersion"),
                result.get("submissionVersion")
            )
        ):
            return _invalid_market_result("Publish postcondition does not match the result")
    elif method == "finish":
        if not _has_exact_dictionary_keys(postcondition, ["kind", "finishedAt"]):
            return _invalid_market_result("Finish postcondition contains unexpected or missing fields")
        if (
            postcondition.get("kind") != "finish"
            or not _is_nonnegative_integer_number(postcondition.get("finishedAt"))
        ):
            return _invalid_market_result("Finish postcondition is invalid")
    elif method == "reviewCampaign":
        if not _has_exact_dictionary_keys(
            postcondition,
            ["kind", "campaignId", "submissionVersion", "status"]
        ):
            return _invalid_market_result("Review postcondition contains unexpected or missing fields")
        if (
            postcondition.get("kind") != "review"
            or postcondition.get("campaignId") != request_context.get("campaignId")
            or not _same_integer(
                postcondition.get("submissionVersion"),
                request_context.get("submissionVersion")
            )
            or postcondition.get("status") != request_context.get("status")
        ):
            return _invalid_market_result("Review postcondition does not match the command")
    else:
        var expected_action := str(request_context.get("action", ""))
        if expected_action == "removeTeam":
            if not _has_exact_dictionary_keys(postcondition, ["kind", "teamId"]):
                return _invalid_market_result("Remove-team postcondition contains unexpected or missing fields")
            if (
                postcondition.get("kind") != "removeTeam"
                or postcondition.get("teamId") != request_context.get("teamId")
            ):
                return _invalid_market_result("Remove-team postcondition does not match the command")
        else:
            if not _has_exact_dictionary_keys(postcondition, ["kind", "action"]):
                return _invalid_market_result("Control postcondition contains unexpected or missing fields")
            if (
                postcondition.get("kind") != "control"
                or postcondition.get("action") != expected_action
            ):
                return _invalid_market_result("Control postcondition does not match the command")
    return {"ok": true, "value": result}

func _invalid_market_result(message: String) -> Dictionary:
    return {"ok": false, "code": "INVALID_MARKET_RESPONSE", "message": message}

func _validate_room_result(value: Variant, method: String) -> Dictionary:
    if typeof(value) != TYPE_DICTIONARY:
        return {
            "ok": false,
            "code": "INVALID_ROOM_RESPONSE",
            "message": "Room result must be a dictionary"
        }
    if _contains_dictionary_key(value, "classroomCode"):
        return {
            "ok": false,
            "code": "INVALID_ROOM_RESPONSE",
            "message": "Room result must not expose classroomCode"
        }
    if not _has_exact_dictionary_keys(value, ["role", "roomCode", "snapshot"]):
        return {
            "ok": false,
            "code": "INVALID_ROOM_RESPONSE",
            "message": "Room result must contain exactly role, roomCode, and snapshot"
        }
    var result: Dictionary = value.duplicate(true)
    var expected_roles := (
        ["teacher", "team"]
        if method == "resumeSession"
        else ["teacher"] if method == "createRoom" else ["team"]
    )
    if not expected_roles.has(result.get("role")):
        return {
            "ok": false,
            "code": "INVALID_ROOM_RESPONSE",
            "message": "Room result role does not match the requested operation"
        }
    if not _is_room_code(result.get("roomCode")):
        return {
            "ok": false,
            "code": "INVALID_ROOM_RESPONSE",
            "message": "Room result roomCode is invalid"
        }
    var snapshot := _validate_snapshot(result.get("snapshot"))
    if not snapshot.get("ok", false):
        return {
            "ok": false,
            "code": "INVALID_ROOM_RESPONSE",
            "message": snapshot.get("message", "Room result snapshot is invalid")
        }
    result["snapshot"] = snapshot.get("value")
    return {"ok": true, "value": result}

func _validate_artwork(value: Variant, expected_artwork_key: String) -> Dictionary:
    if typeof(value) != TYPE_DICTIONARY:
        return _invalid_artwork("Artwork result must be a dictionary")
    var artwork: Dictionary = value
    if artwork.size() != 2 or not artwork.has("artworkKey") or not artwork.has("pngBase64"):
        return _invalid_artwork("Artwork result must contain only artworkKey and pngBase64")
    if not _is_artwork_key(artwork.get("artworkKey")):
        return _invalid_artwork("Artwork result artworkKey is invalid")
    if expected_artwork_key.is_empty() or str(artwork.get("artworkKey")) != expected_artwork_key:
        return _invalid_artwork("Artwork result artworkKey did not match the request")
    var png_validation := _validate_artwork_png(artwork.get("pngBase64"))
    if not png_validation.get("ok", false):
        return _invalid_artwork(str(png_validation.get("message", "Artwork PNG is invalid")))
    return {"ok": true, "value": artwork.duplicate(true)}

func _validate_artwork_png(encoded: Variant) -> Dictionary:
    return _validate_png_base64(encoded, "Artwork")

func _validate_png_base64(encoded: Variant, label: String) -> Dictionary:
    if typeof(encoded) != TYPE_STRING or str(encoded).is_empty():
        return {"ok": false, "message": "%s PNG must be non-empty canonical base64" % label}
    if str(encoded).length() > MAX_ARTWORK_BASE64_CHARS:
        return {"ok": false, "message": "%s PNG exceeds the safe encoded size" % label}
    var png_bytes := Marshalls.base64_to_raw(str(encoded))
    if png_bytes.is_empty() or Marshalls.raw_to_base64(png_bytes) != str(encoded):
        return {"ok": false, "message": "%s PNG must be non-empty canonical base64" % label}
    if png_bytes.size() > MAX_ARTWORK_BYTES:
        return {"ok": false, "message": "%s PNG exceeds the safe decoded size" % label}
    if png_bytes.size() < 33:
        return {"ok": false, "message": "%s PNG header is truncated" % label}
    for index in PNG_SIGNATURE.size():
        if png_bytes[index] != PNG_SIGNATURE[index]:
            return {"ok": false, "message": "%s PNG signature is invalid" % label}
    if _read_uint32_be(png_bytes, 8) != 13:
        return {"ok": false, "message": "%s PNG IHDR length is invalid" % label}
    for index in PNG_IHDR.size():
        if png_bytes[12 + index] != PNG_IHDR[index]:
            return {"ok": false, "message": "%s PNG IHDR type is invalid" % label}
    if _read_uint32_be(png_bytes, 16) != PNG_WIDTH or _read_uint32_be(png_bytes, 20) != PNG_HEIGHT:
        return {"ok": false, "message": "%s PNG must be 1600 by 900 pixels" % label}
    if not _has_required_png_chunks(png_bytes):
        return {"ok": false, "message": "%s PNG data is corrupt or incomplete" % label}
    var image := Image.new()
    if image.load_png_from_buffer(png_bytes) != OK:
        return {"ok": false, "message": "%s PNG data is corrupt or incomplete" % label}
    if image.get_width() != PNG_WIDTH or image.get_height() != PNG_HEIGHT:
        return {"ok": false, "message": "%s PNG must decode to 1600 by 900 pixels" % label}
    return {"ok": true}

func _invalid_artwork(message: String) -> Dictionary:
    return {"ok": false, "code": "INVALID_ARTWORK_RESPONSE", "message": message}

func _validate_snapshot(value: Variant) -> Dictionary:
    if typeof(value) != TYPE_DICTIONARY:
        return {"ok": false, "message": "Live Market snapshot must be a dictionary"}
    if _contains_sensitive_key(value):
        return {"ok": false, "message": "Live Market snapshot contains a sensitive field"}
    var snapshot: Dictionary = value.duplicate(true)
    if snapshot.has("roomCode") and not _is_room_code(snapshot.get("roomCode")):
        return {"ok": false, "message": "Snapshot roomCode is invalid"}
    if snapshot.has("phase") and (
        typeof(snapshot.get("phase")) != TYPE_STRING
        or not ["building", "market", "reveal", "closed"].has(str(snapshot.get("phase")))
    ):
        return {"ok": false, "message": "Snapshot phase is invalid"}
    for key in ["revision", "openingWallet", "walletCents", "spentCents"]:
        if snapshot.has(key) and not _is_nonnegative_integer_number(snapshot.get(key)):
            return {"ok": false, "message": "Snapshot %s must be a non-negative integer" % key}
    for key in ["teams", "campaigns", "purchases", "receipts", "rankings"]:
        if snapshot.has(key) and typeof(snapshot.get(key)) != TYPE_ARRAY:
            return {"ok": false, "message": "Snapshot %s must be an array" % key}
    var has_max_teams := snapshot.has("maxTeams")
    var has_available_seats := snapshot.has("availableSeats")
    if has_max_teams != has_available_seats:
        return {"ok": false, "message": "Snapshot capacity fields must appear together"}
    if has_max_teams:
        if (
            not _is_nonnegative_integer_number(snapshot.get("maxTeams"))
            or float(snapshot.get("maxTeams")) < 3.0
            or float(snapshot.get("maxTeams")) > 30.0
        ):
            return {"ok": false, "message": "Snapshot maxTeams must be an integer from 3 to 30"}
        if (
            not _is_nonnegative_integer_number(snapshot.get("availableSeats"))
            or float(snapshot.get("availableSeats")) > float(snapshot.get("maxTeams"))
        ):
            return {"ok": false, "message": "Snapshot availableSeats is outside the room capacity"}
    if snapshot.has("own"):
        if typeof(snapshot.get("own")) != TYPE_DICTIONARY:
            return {"ok": false, "message": "Snapshot own must be a dictionary"}
        var own: Dictionary = snapshot.get("own")
        if own.has("marketEligibility"):
            var own_eligibility := _validate_market_eligibility(own.get("marketEligibility"))
            if not own_eligibility.get("ok", false):
                return own_eligibility
    if snapshot.has("teams"):
        for team_value in snapshot.get("teams"):
            if typeof(team_value) != TYPE_DICTIONARY:
                return {"ok": false, "message": "Snapshot teams must contain dictionaries"}
            var team: Dictionary = team_value
            if team.has("marketEligibility"):
                var team_eligibility := _validate_market_eligibility(team.get("marketEligibility"))
                if not team_eligibility.get("ok", false):
                    return team_eligibility
    if snapshot.has("cohort"):
        var cohort_validation := _validate_cohort(snapshot.get("cohort"))
        if not cohort_validation.get("ok", false):
            return cohort_validation
    return {"ok": true, "value": snapshot}

func _validate_market_eligibility(value: Variant) -> Dictionary:
    if typeof(value) != TYPE_DICTIONARY:
        return {"ok": false, "message": "Snapshot marketEligibility must be a dictionary"}
    var eligibility: Dictionary = value
    if not _has_exact_dictionary_keys(eligibility, ["state", "role", "reason"]):
        return {"ok": false, "message": "Snapshot marketEligibility contains unexpected or missing fields"}
    if not ["building", "frozen"].has(eligibility.get("state")):
        return {"ok": false, "message": "Snapshot marketEligibility state is invalid"}
    if not ["buyer-seller", "buyer", "seller", "spectator"].has(eligibility.get("role")):
        return {"ok": false, "message": "Snapshot marketEligibility role is invalid"}
    if not [
        "approved-campaign",
        "no-campaign",
        "campaign-pending",
        "campaign-returned",
        "campaign-hidden",
        "not-in-cohort",
        "legacy-cohort"
    ].has(eligibility.get("reason")):
        return {"ok": false, "message": "Snapshot marketEligibility reason is invalid"}
    return {"ok": true}

func _validate_cohort(value: Variant) -> Dictionary:
    if typeof(value) != TYPE_DICTIONARY:
        return {"ok": false, "message": "Snapshot cohort must be a dictionary"}
    var cohort: Dictionary = value
    if not _has_exact_dictionary_keys(cohort, [
        "frozen",
        "totalJoined",
        "participating",
        "spectating",
        "buyers",
        "sellers",
        "requiredFinished",
        "finishedRequired"
    ]):
        return {"ok": false, "message": "Snapshot cohort contains unexpected or missing fields"}
    if typeof(cohort.get("frozen")) != TYPE_BOOL:
        return {"ok": false, "message": "Snapshot cohort frozen must be a boolean"}
    for key in [
        "totalJoined",
        "participating",
        "spectating",
        "buyers",
        "sellers",
        "requiredFinished",
        "finishedRequired"
    ]:
        if not _is_nonnegative_integer_number(cohort.get(key)):
            return {"ok": false, "message": "Snapshot cohort %s must be a non-negative integer" % key}
    return {"ok": true}

func _validate_market_result(value: Variant) -> Dictionary:
    if typeof(value) != TYPE_DICTIONARY:
        return {
            "ok": false,
            "code": "INVALID_MARKET_RESPONSE",
            "message": "Live Market result must be a dictionary"
        }
    var result: Dictionary = value.duplicate(true)
    if result.has("snapshot"):
        var snapshot := _validate_snapshot(result.get("snapshot"))
        if not snapshot.get("ok", false):
            return {
                "ok": false,
                "code": "INVALID_MARKET_RESPONSE",
                "message": snapshot.get("message", "Live Market result snapshot is invalid")
            }
        result["snapshot"] = snapshot.get("value")
    for key in ["campaignId", "receiptId", "status", "phase"]:
        if result.has(key) and (typeof(result.get(key)) != TYPE_STRING or str(result.get(key)).is_empty()):
            return {
                "ok": false,
                "code": "INVALID_MARKET_RESPONSE",
                "message": "Live Market result %s must be a non-empty string" % key
            }
    return {"ok": true, "value": result}

func _validate_publication(value: Variant) -> Dictionary:
    if typeof(value) != TYPE_DICTIONARY:
        return {"ok": false, "message": "publication must be a dictionary"}
    var publication: Dictionary = value
    if not _has_exact_dictionary_keys(
        publication,
        ["contract", "documentId", "revision", "pngBase64", "metadata"]
    ):
        return {"ok": false, "message": "publication contains unexpected or missing fields"}
    if publication.get("contract") != PUBLISHED_CONTRACT:
        return {"ok": false, "message": "publication contract is unsupported"}
    if not _is_safe_string(publication.get("documentId"), 256):
        return {"ok": false, "message": "publication documentId must be a trimmed non-empty string"}
    if not _is_nonnegative_integer_number(publication.get("revision")):
        return {"ok": false, "message": "publication revision must be a non-negative integer"}

    var png_validation := _validate_png_base64(publication.get("pngBase64"), "publication")
    if not png_validation.get("ok", false):
        return {"ok": false, "message": png_validation.get("message", "publication PNG is invalid")}

    var metadata: Variant = publication.get("metadata")
    if typeof(metadata) != TYPE_DICTIONARY:
        return {"ok": false, "message": "publication metadata must be a dictionary"}
    if not _has_exact_dictionary_keys(
        metadata,
        ["productName", "priceCents", "brief", "evidence", "assetReferences"]
    ):
        return {"ok": false, "message": "publication metadata contains unexpected or missing fields"}
    if not _is_safe_string(metadata.get("productName"), 80):
        return {"ok": false, "message": "publication productName must be a trimmed non-empty string"}
    if (
        not _is_nonnegative_integer_number(metadata.get("priceCents"))
        or float(metadata.get("priceCents")) < 1.0
        or float(metadata.get("priceCents")) > MAX_PRICE_CENTS
    ):
        return {"ok": false, "message": "publication priceCents is outside the allowed range"}
    for key in ["brief", "evidence"]:
        if typeof(metadata.get(key)) != TYPE_DICTIONARY:
            return {"ok": false, "message": "publication %s must be a dictionary" % key}
    if (
        typeof(metadata.get("assetReferences")) != TYPE_ARRAY
        or Array(metadata.get("assetReferences")).size() > MAX_ASSET_REFERENCES
    ):
        return {"ok": false, "message": "publication assetReferences must be an array"}
    for reference in metadata.get("assetReferences"):
        if typeof(reference) != TYPE_DICTIONARY:
            return {"ok": false, "message": "publication assetReferences must contain dictionaries"}
    return {"ok": true, "value": publication.duplicate(true)}

func _is_safe_string(value: Variant, max_length: int) -> bool:
    if typeof(value) != TYPE_STRING:
        return false
    var string_value := str(value)
    return (
        not string_value.is_empty()
        and string_value == string_value.strip_edges()
        and string_value.length() <= max_length
    )

func _is_room_code(value: Variant) -> bool:
    if typeof(value) != TYPE_STRING:
        return false
    var room_code := str(value)
    if room_code.length() != 7 or room_code[3] != "-":
        return false
    for index in [0, 1, 2, 4, 5, 6]:
        if not ROOM_CODE_ALPHABET.contains(room_code[index]):
            return false
    return true

func _is_market_id(value: Variant) -> bool:
    return _is_ascii_token(value, 64, MARKET_ID_SUFFIX)

func _is_uuid(value: Variant) -> bool:
    if typeof(value) != TYPE_STRING:
        return false
    var uuid := str(value)
    if uuid.length() != 36:
        return false
    for index in uuid.length():
        if [8, 13, 18, 23].has(index):
            if uuid[index] != "-":
                return false
        elif not HEXADECIMAL.contains(uuid[index]):
            return false
    return "12345678".contains(uuid[14]) and "89abAB".contains(uuid[19])

func _is_artwork_key(value: Variant) -> bool:
    return _is_ascii_token(value, 256, ARTWORK_KEY_SUFFIX)

func _is_ascii_token(value: Variant, max_length: int, suffix_characters: String) -> bool:
    if typeof(value) != TYPE_STRING:
        return false
    var token := str(value)
    if token.is_empty() or token.length() > max_length:
        return false
    if not ASCII_ALPHANUMERIC.contains(token[0]):
        return false
    for index in range(1, token.length()):
        if not suffix_characters.contains(token[index]):
            return false
    return true

func _is_nonnegative_integer_number(value: Variant) -> bool:
    if typeof(value) == TYPE_INT:
        return int(value) >= 0 and int(value) <= MAX_SAFE_INTEGER
    if typeof(value) != TYPE_FLOAT:
        return false
    var number := float(value)
    return is_finite(number) and number >= 0.0 and number <= MAX_SAFE_INTEGER and number == floor(number)

func _is_positive_integer_number(value: Variant) -> bool:
    return _is_nonnegative_integer_number(value) and float(value) >= 1.0

func _same_integer(first: Variant, second: Variant) -> bool:
    return (
        _is_nonnegative_integer_number(first)
        and _is_nonnegative_integer_number(second)
        and int(first) == int(second)
    )

func _contains_sensitive_key(value: Variant) -> bool:
    var pending: Array = [value]
    while not pending.is_empty():
        var current: Variant = pending.pop_back()
        if typeof(current) == TYPE_DICTIONARY:
            var dictionary: Dictionary = current
            for key in dictionary:
                if typeof(key) == TYPE_STRING:
                    var lowered := str(key).to_lower()
                    if (
                        lowered.contains("session")
                        or lowered.contains("token")
                        or lowered.contains("authorization")
                        or lowered.contains("cookie")
                    ):
                        return true
                pending.append(dictionary.get(key))
        elif typeof(current) == TYPE_ARRAY:
            pending.append_array(current)
    return false

func _contains_dictionary_key(value: Variant, target_key: String) -> bool:
    var pending: Array = [value]
    while not pending.is_empty():
        var current: Variant = pending.pop_back()
        if typeof(current) == TYPE_DICTIONARY:
            var dictionary: Dictionary = current
            for key in dictionary:
                if typeof(key) == TYPE_STRING and str(key) == target_key:
                    return true
                pending.append(dictionary.get(key))
        elif typeof(current) == TYPE_ARRAY:
            pending.append_array(current)
    return false

func _has_exact_dictionary_keys(dictionary: Dictionary, expected_keys: Array) -> bool:
    if dictionary.size() != expected_keys.size():
        return false
    for key in expected_keys:
        if not dictionary.has(key):
            return false
    return true

func _read_uint32_be(bytes: PackedByteArray, offset: int) -> int:
    return (
        (int(bytes[offset]) << 24)
        | (int(bytes[offset + 1]) << 16)
        | (int(bytes[offset + 2]) << 8)
        | int(bytes[offset + 3])
    )

func _has_required_png_chunks(bytes: PackedByteArray) -> bool:
    var offset := 8
    var saw_ihdr := false
    var saw_idat := false
    while offset + 12 <= bytes.size():
        var data_length := _read_uint32_be(bytes, offset)
        if data_length < 0 or data_length > bytes.size() - offset - 12:
            return false
        var chunk_type_offset := offset + 4
        if _bytes_match(bytes, chunk_type_offset, PNG_IHDR):
            if saw_ihdr or offset != 8 or data_length != 13:
                return false
            saw_ihdr = true
        elif _bytes_match(bytes, chunk_type_offset, PNG_IDAT):
            if not saw_ihdr:
                return false
            saw_idat = true
        elif _bytes_match(bytes, chunk_type_offset, PNG_IEND):
            return (
                saw_ihdr
                and saw_idat
                and data_length == 0
                and offset + 12 == bytes.size()
            )
        offset += data_length + 12
    return false

func _bytes_match(bytes: PackedByteArray, offset: int, expected: Array) -> bool:
    if offset < 0 or offset + expected.size() > bytes.size():
        return false
    for index in expected.size():
        if bytes[offset + index] != expected[index]:
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
    var request_id := "market-%d" % _next_request_number
    _next_request_number += 1
    return request_id

func _fail(request_id: String, code: String, message: String) -> void:
    diagnostic.emit("%s: %s" % [code, message])
    request_failed.emit(request_id, code, message)
