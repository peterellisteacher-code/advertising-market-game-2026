extends RefCounted

const PracticeBridge = preload("res://src/practice/PracticeBridge.gd")
const WebPracticeTransport = preload("res://src/practice/transport/WebPracticeTransport.gd")
const FakePracticeTransport = preload("res://tests/fakes/FakePracticeTransport.gd")

func run() -> bool:
    assert(_requests_and_recovery_are_strict())
    assert(_response_identity_and_order_are_strict())
    assert(_web_transport_preserves_request_identity())
    return true

func _requests_and_recovery_are_strict() -> bool:
    var fake := FakePracticeTransport.new()
    var bridge := PracticeBridge.new()
    var successes: Array[Dictionary] = []
    var failures: Array[Dictionary] = []
    bridge.request_succeeded.connect(func(request_id: String, method: String, payload: Variant) -> void:
        successes.append({"requestId": request_id, "method": method, "payload": payload})
    )
    bridge.request_failed.connect(func(request_id: String, code: String, message: String) -> void:
        failures.append({"requestId": request_id, "code": code, "message": message})
    )
    bridge.set_transport(fake)

    var resume_id := bridge.resume()
    assert(fake.request_for(resume_id).get("method") == "resume")
    assert(fake.request_for(resume_id).get("payload") == null)
    fake.resolve_success(resume_id, null)
    assert(successes.back().get("payload") == null)

    var begin_id := bridge.begin("Neon Narwhals", "operation-begin-1")
    assert(fake.request_for(begin_id).get("payload") == {
        "teamAlias": "Neon Narwhals",
        "operationId": "operation-begin-1"
    })
    var recovery := _recovery()
    recovery["checkpoint"]["operationId"] = "operation-begin-1"
    fake.resolve_success(begin_id, recovery)
    assert(successes.size() == 2, JSON.stringify(failures))
    assert(successes.back().get("payload").get("checkpoint").get("runId") == "run-0123456789")
    assert(successes.back().get("payload").get("document").get("documentId") == "practice-document-0123456789")

    var invalid_role_guide_id := bridge.resume()
    var invalid_role_guide := _recovery()
    invalid_role_guide["document"]["gameplay"]["pair"]["roleGuideAcknowledged"] = "yes"
    fake.resolve_success(invalid_role_guide_id, invalid_role_guide)
    assert(failures.back().get("code") == "INVALID_RECOVERY_RESPONSE")

    var before := fake.request_count()
    for invalid_id in [
        bridge.begin("A", "operation-begin-2"),
        bridge.begin(" Team ", "operation-begin-3"),
        bridge.begin("N".repeat(33), "operation-begin-4"),
        bridge.begin("Neon Narwhals", "bad operation"),
        bridge.set_level_lock({}, true, "operation-lock-1"),
        bridge.advance(_token(recovery), "invent", "operation-advance-1"),
        bridge.advance(_token(recovery), "unknown", "operation-advance-2")
    ]:
        assert(String(invalid_id).is_empty())
        assert(failures.back().get("code") == "INVALID_REQUEST")
    assert(fake.request_count() == before)
    bridge.free()
    return true

func _response_identity_and_order_are_strict() -> bool:
    var fake := FakePracticeTransport.new()
    var bridge := PracticeBridge.new()
    var successes: Array[Dictionary] = []
    var failures: Array[Dictionary] = []
    bridge.request_succeeded.connect(func(request_id: String, method: String, payload: Variant) -> void:
        successes.append({"requestId": request_id, "method": method, "payload": payload})
    )
    bridge.request_failed.connect(func(request_id: String, code: String, message: String) -> void:
        failures.append({"requestId": request_id, "code": code, "message": message})
    )
    bridge.set_transport(fake)
    var current := _recovery()
    var token := _token(current)

    var lock_id := bridge.set_level_lock(token, true, "operation-lock-1")
    var locked := current.duplicate(true)
    locked["checkpoint"]["levelLocked"] = true
    locked["checkpoint"]["sequence"] = 4.0
    locked["checkpoint"]["documentRevision"] = 8.0
    locked["checkpoint"]["operationId"] = "operation-lock-1"
    locked["document"]["revision"] = 8.0
    fake.resolve_success(lock_id, locked)
    assert(successes.back().get("requestId") == lock_id)

    var advance_token := _token(locked)
    var advance_id := bridge.advance(advance_token, "sell", "operation-advance-1")
    var advanced := locked.duplicate(true)
    advanced["checkpoint"]["stage"] = "sell"
    advanced["checkpoint"]["levelLocked"] = false
    advanced["checkpoint"]["sequence"] = 5.0
    advanced["checkpoint"]["documentRevision"] = 9.0
    advanced["checkpoint"]["operationId"] = "operation-advance-1"
    advanced["document"]["gameplay"]["stage"] = "sell"
    advanced["document"]["revision"] = 9.0
    fake.resolve_success(advance_id, advanced)
    assert(successes.back().get("requestId") == advance_id)

    var mismatch_id := bridge.set_level_lock(_token(advanced), true, "operation-lock-2")
    var mismatched := advanced.duplicate(true)
    mismatched["checkpoint"]["runId"] = "another-run"
    mismatched["checkpoint"]["sequence"] = 6.0
    mismatched["checkpoint"]["levelLocked"] = true
    mismatched["checkpoint"]["operationId"] = "operation-lock-2"
    fake.resolve_success(mismatch_id, mismatched)
    assert(failures.back().get("requestId") == mismatch_id)
    assert(failures.back().get("code") == "INVALID_RECOVERY_RESPONSE")

    var malformed_id := bridge.resume()
    fake.resolve_success(malformed_id, {"checkpoint": {}, "document": {}})
    assert(failures.back().get("code") == "INVALID_RECOVERY_RESPONSE")

    fake.repeat_response(lock_id)
    assert(failures.back().get("code") == "DUPLICATE_RESPONSE")
    bridge.accept_response("missing", JSON.stringify({
        "contract": "practice-run@1",
        "requestId": "missing",
        "ok": true,
        "payload": null
    }))
    assert(failures.back().get("code") == "STALE_RESPONSE")
    bridge.free()
    return true

func _web_transport_preserves_request_identity() -> bool:
    var transport := WebPracticeTransport.new()
    var resolved: Array[String] = []
    transport.send(JSON.stringify({
        "contract": "practice-run@1",
        "requestId": "practice-web-1",
        "method": "resume",
        "payload": null
    }), func(value: String) -> void: resolved.append(value), func(_message: String) -> void: assert(false))
    assert(resolved.size() == 1)
    var response: Variant = JSON.parse_string(resolved[0])
    assert(response.get("requestId") == "practice-web-1")
    assert(response.get("error").get("code") == "PRACTICE_UNAVAILABLE")
    return true

func _token(recovery: Dictionary) -> Dictionary:
    var checkpoint: Dictionary = recovery.get("checkpoint")
    return {
        "runId": checkpoint.get("runId"),
        "documentId": checkpoint.get("documentId"),
        "documentRevision": checkpoint.get("documentRevision"),
        "sequence": checkpoint.get("sequence"),
        "stage": checkpoint.get("stage")
    }

func _recovery() -> Dictionary:
    return {
        "checkpoint": {
            "contract": "local-practice-checkpoint@1",
            "runId": "run-0123456789",
            "documentId": "practice-document-0123456789",
            "sessionId": "practice-session-0123456789",
            "teamId": "practice-team-0123456789",
            "teamAlias": "Neon Narwhals",
            "documentRevision": 7.0,
            "documentHash": "a".repeat(64),
            "stage": "invent",
            "levelLocked": false,
            "sequence": 3.0,
            "operationId": "operation-save-3",
            "savedAt": "2026-07-17T04:00:00.000Z"
        },
        "document": _document()
    }

func _document() -> Dictionary:
    return {
        "schemaVersion": 1,
        "editorVersion": "0.1.0",
        "documentId": "practice-document-0123456789",
        "sessionId": "practice-session-0123456789",
        "teamId": "practice-team-0123456789",
        "mode": "offline",
        "revision": 7.0,
        "canvas": {"width": 1600, "height": 900, "background": "#fff"},
        "fabricState": {"version": "7.4.0", "objects": []},
        "drawingLayers": [],
        "product": {"name": "Glow Cup", "priceCents": null},
        "brief": {"purpose": "persuade"},
        "gameplay": {
            "stage": "invent",
            "pair": {
                "activeRole": "strategist",
                "handoffCount": 1.0,
                "artDirectorActions": 1.0,
                "strategistActions": 1.0,
                "roleGuideAcknowledged": true
            }
        },
        "evidence": {
            "price": [], "attention": [], "interest": [], "desire": [], "action": []
        },
        "assetReferences": [],
        "updatedAt": "2026-07-17T04:00:00.000Z"
    }
