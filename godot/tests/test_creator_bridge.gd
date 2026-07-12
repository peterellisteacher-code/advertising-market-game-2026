extends RefCounted

const CreatorBridge = preload("res://src/creator/CreatorBridge.gd")
const CreatorHost = preload("res://src/creator/CreatorHost.gd")
const CampaignDocument = preload("res://src/creator/CampaignDocument.gd")
const FakeCreatorTransport = preload("res://tests/fakes/FakeCreatorTransport.gd")

func run() -> bool:
    _test_request_ids_versions_callbacks_and_replays()
    _test_publish_payload_and_error_envelope_validation()
    _test_campaign_document_strict_strings_and_json_numbers()
    _test_focus_restores_only_after_a_valid_close()
    return true

func _test_request_ids_versions_callbacks_and_replays() -> void:
    var fake := FakeCreatorTransport.new()
    var bridge := CreatorBridge.new()
    var successes: Array[Dictionary] = []
    var failures: Array[Dictionary] = []
    bridge.request_succeeded.connect(func(request_id: String, method: String, payload: Variant) -> void:
        successes.append({"request_id": request_id, "method": method, "payload": payload})
    )
    bridge.request_failed.connect(func(request_id: String, code: String, message: String) -> void:
        failures.append({"request_id": request_id, "code": code, "message": message})
    )
    bridge.set_transport(fake)

    var document := _valid_document()
    var open_id := bridge.open(document)
    var state_id := bridge.get_state()
    assert(not open_id.is_empty())
    assert(not state_id.is_empty())
    assert(open_id != state_id)
    assert(fake.request_ids() == [open_id, state_id])
    assert(fake.request_for(open_id).get("contract") == "creator-bridge@1")

    fake.resolve_success(state_id, document)
    fake.resolve_success(open_id)
    assert(successes.size() == 2)
    assert(successes[0].get("request_id") == state_id)
    assert(successes[0].get("method") == "getState")
    assert(successes[1].get("request_id") == open_id)
    assert(successes[1].get("method") == "open")

    var invalid_state_id := bridge.get_state()
    fake.resolve_success(invalid_state_id, {"schemaVersion": 1})
    assert(failures.back().get("code") == "INVALID_DOCUMENT_RESPONSE")

    fake.repeat_response(open_id)
    assert(failures.back().get("code") == "DUPLICATE_RESPONSE")

    var bad_version_id := bridge.save()
    fake.resolve_raw(bad_version_id, {
        "contract": "creator-bridge@999",
        "requestId": bad_version_id,
        "ok": true
    })
    assert(failures.back().get("code") == "UNSUPPORTED_CONTRACT")

    bridge.accept_response("missing-request", JSON.stringify({
        "contract": "creator-bridge@1",
        "requestId": "missing-request",
        "ok": true
    }))
    assert(failures.back().get("code") == "STALE_RESPONSE")

    var mismatched_id := bridge.publish()
    fake.resolve_raw(mismatched_id, {
        "contract": "creator-bridge@1",
        "requestId": "some-other-request",
        "ok": true
    })
    assert(failures.back().get("code") == "REQUEST_ID_MISMATCH")

    var before_invalid := fake.request_count()
    assert(bridge.open({"schemaVersion": 1}).is_empty())
    assert(fake.request_count() == before_invalid)
    assert(failures.back().get("code") == "INVALID_DOCUMENT")
    bridge.free()

func _test_publish_payload_and_error_envelope_validation() -> void:
    var fake := FakeCreatorTransport.new()
    var bridge := CreatorBridge.new()
    var successes: Array[Dictionary] = []
    var failures: Array[Dictionary] = []
    bridge.request_succeeded.connect(func(request_id: String, method: String, payload: Variant) -> void:
        successes.append({"request_id": request_id, "method": method, "payload": payload})
    )
    bridge.request_failed.connect(func(request_id: String, code: String, message: String) -> void:
        failures.append({"request_id": request_id, "code": code, "message": message})
    )
    bridge.set_transport(fake)

    var valid_id := bridge.publish()
    fake.resolve_success(valid_id, _valid_publication())
    assert(successes.back().get("request_id") == valid_id)
    assert(successes.back().get("method") == "publish")

    var invalid_publications: Array[Dictionary] = []
    var wrong_contract := _valid_publication()
    wrong_contract["contract"] = "published-campaign@999"
    invalid_publications.append(wrong_contract)
    var malformed_base64 := _valid_publication()
    malformed_base64["pngBase64"] = "not base64!"
    invalid_publications.append(malformed_base64)
    var bad_png := _valid_publication()
    bad_png["pngBase64"] = "AAAA"
    invalid_publications.append(bad_png)
    var malformed_metadata := _valid_publication()
    malformed_metadata["metadata"] = {
        "productName": "Product",
        "priceCents": 19.5,
        "brief": {},
        "evidence": {},
        "assetReferences": []
    }
    invalid_publications.append(malformed_metadata)
    for publication in invalid_publications:
        var request_id := bridge.publish()
        fake.resolve_success(request_id, publication)
        assert(failures.back().get("request_id") == request_id)
        assert(failures.back().get("code") == "INVALID_PUBLICATION_RESPONSE")

    var invalid_errors := [
        {"code": "", "message": "Failure"},
        {"code": 7, "message": "Failure"},
        {"code": "SAVE_FAILED", "message": ""},
        {"code": "SAVE_FAILED", "message": 7}
    ]
    for invalid_error in invalid_errors:
        var request_id := bridge.save()
        fake.resolve_raw(request_id, {
            "contract": "creator-bridge@1",
            "requestId": request_id,
            "ok": false,
            "error": invalid_error
        })
        assert(failures.back().get("request_id") == request_id)
        assert(failures.back().get("code") == "INVALID_RESPONSE")
    bridge.free()

func _test_campaign_document_strict_strings_and_json_numbers() -> void:
    var room_document := _valid_document()
    room_document["mode"] = "room"
    room_document["roomId"] = 7
    room_document["teamId"] = "team-a"
    assert(not CampaignDocument.validate_bridge_shape(room_document).get("ok", false))
    room_document["roomId"] = "room-a"
    room_document["teamId"] = 9
    assert(not CampaignDocument.validate_bridge_shape(room_document).get("ok", false))

    var parsed: Variant = JSON.parse_string(JSON.stringify(_valid_document()))
    parsed["revision"] = 3.0
    parsed["canvas"]["width"] = 1600.0
    parsed["canvas"]["height"] = 900.0
    assert(CampaignDocument.validate_bridge_shape(parsed).get("ok", false))

func _test_focus_restores_only_after_a_valid_close() -> void:
    var fake := FakeCreatorTransport.new()
    var host := CreatorHost.new()
    var game_input := Node.new()
    game_input.process_mode = Node.PROCESS_MODE_ALWAYS
    var focus_restores := [0]
    host.focus_restore_requested.connect(func() -> void:
        focus_restores[0] += 1
    )
    host.game_input_root = game_input
    host.set_transport(fake)

    host.open_creator(_valid_document())
    var open_id := fake.last_request_id()
    fake.resolve_success(open_id)
    assert(host.creator_is_open)
    assert(game_input.process_mode == Node.PROCESS_MODE_DISABLED)

    host.close_creator()
    var invalid_close_id := fake.last_request_id()
    fake.resolve_raw(invalid_close_id, {
        "contract": "creator-bridge@1",
        "requestId": "wrong-close-id",
        "ok": true
    })
    assert(host.creator_is_open)
    assert(game_input.process_mode == Node.PROCESS_MODE_DISABLED)
    assert(focus_restores[0] == 0)

    host.close_creator()
    var close_id := fake.last_request_id()
    fake.resolve_success(close_id)
    assert(not host.creator_is_open)
    assert(game_input.process_mode == Node.PROCESS_MODE_ALWAYS)
    assert(focus_restores[0] == 1)
    host.free()
    game_input.free()

func _valid_document() -> Dictionary:
    return {
        "schemaVersion": 1,
        "editorVersion": "0.1.0",
        "documentId": "godot-bridge-document",
        "sessionId": "godot-bridge-session",
        "mode": "offline",
        "revision": 0,
        "canvas": {"width": 1600, "height": 900, "background": "#ffffff"},
        "fabricState": {"version": "7.4.0", "objects": []},
        "drawingLayers": [],
        "product": {"name": "", "priceCents": null},
        "brief": {
            "targetAudienceId": "",
            "contextId": "",
            "purpose": "persuade",
            "audienceNeeds": [],
            "audienceValues": [],
            "intendedEffects": [],
            "techniques": []
        },
        "evidence": {
            "price": [], "attention": [], "interest": [], "desire": [], "action": []
        },
        "assetReferences": [],
        "updatedAt": "1970-01-01T00:00:00.000Z"
    }

func _valid_publication() -> Dictionary:
    return {
        "contract": "published-campaign@1",
        "documentId": "godot-bridge-document",
        "revision": 3.0,
        "pngBase64": "iVBORw0KGgo=",
        "metadata": {
            "productName": "Product",
            "priceCents": 0.0,
            "brief": {},
            "evidence": {},
            "assetReferences": []
        }
    }
