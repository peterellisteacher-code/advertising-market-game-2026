extends RefCounted
class_name AdMarketTestCreatorBridge

const CreatorBridge = preload("res://src/creator/creator_bridge.gd")
const CreatorHost = preload("res://src/creator/creator_host.gd")
const CampaignDocument = preload("res://src/creator/campaign_document.gd")
const FakeCreatorTransport = preload("res://tests/fakes/fake_creator_transport.gd")

func run() -> bool:
    assert(_test_request_ids_versions_callbacks_and_replays())
    assert(_test_latest_draft_response_validation())
    assert(_test_publish_payload_and_error_envelope_validation())
    assert(_test_campaign_document_strict_strings_and_json_numbers())
    assert(_test_mission_evidence_validation())
    assert(_test_focus_restores_only_after_a_valid_close())
    return true

func _test_latest_draft_response_validation() -> bool:
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

    var found_id: String = bridge.load_latest("godot-bridge-document")
    assert(fake.request_for(found_id).get("method") == "loadLatest")
    assert(fake.request_for(found_id).get("payload") == {"documentId": "godot-bridge-document"})
    fake.resolve_success(found_id, _valid_document())
    assert(successes.back().get("method") == "loadLatest")
    assert(successes.back().get("payload").get("documentId") == "godot-bridge-document")

    var missing_id: String = bridge.load_latest("godot-bridge-document")
    fake.resolve_success(missing_id, null)
    assert(successes.back().get("request_id") == missing_id)
    assert(successes.back().get("payload") == null)

    var mismatched := _valid_document()
    mismatched["documentId"] = "different-document"
    var mismatch_id: String = bridge.load_latest("godot-bridge-document")
    fake.resolve_success(mismatch_id, mismatched)
    assert(failures.back().get("request_id") == mismatch_id)
    assert(failures.back().get("code") == "INVALID_DOCUMENT_RESPONSE")

    var malformed_id: String = bridge.load_latest("godot-bridge-document")
    fake.resolve_success(malformed_id, {"schemaVersion": 1})
    assert(failures.back().get("request_id") == malformed_id)
    assert(failures.back().get("code") == "INVALID_DOCUMENT_RESPONSE")

    var before := fake.request_count()
    assert(bridge.load_latest("").is_empty())
    assert(fake.request_count() == before)
    assert(failures.back().get("code") == "INVALID_DOCUMENT_ID")
    bridge.free()
    return true

func _test_request_ids_versions_callbacks_and_replays() -> bool:
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

    var wrong_document := document.duplicate(true)
    wrong_document["documentId"] = "other-document"
    var wrong_document_state_id := bridge.get_state()
    fake.resolve_success(wrong_document_state_id, wrong_document)
    assert(failures.back().get("request_id") == wrong_document_state_id)
    assert(failures.back().get("code") == "INVALID_DOCUMENT_RESPONSE")

    var newer_document := document.duplicate(true)
    newer_document["revision"] = 2.0
    var newer_state_id := bridge.get_state()
    fake.resolve_success(newer_state_id, newer_document)
    assert(successes.back().get("request_id") == newer_state_id)
    var stale_document := document.duplicate(true)
    stale_document["revision"] = 1.0
    var stale_state_id := bridge.get_state()
    fake.resolve_success(stale_state_id, stale_document)
    assert(failures.back().get("request_id") == stale_state_id)
    assert(failures.back().get("code") == "INVALID_DOCUMENT_RESPONSE")

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
    return true

func _test_publish_payload_and_error_envelope_validation() -> bool:
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

    var failed_open_id := bridge.open(_valid_document())
    fake.resolve_raw(failed_open_id, {
        "contract": "creator-bridge@1",
        "requestId": failed_open_id,
        "ok": false,
        "error": {"code": "OPEN_FAILED", "message": "Synthetic open failure"}
    })
    var no_active_id := bridge.publish()
    fake.resolve_success(no_active_id, _valid_publication())
    assert(failures.back().get("request_id") == no_active_id)
    assert(failures.back().get("code") == "INVALID_PUBLICATION_RESPONSE")

    var open_id := bridge.open(_valid_document())
    fake.resolve_success(open_id)
    var valid_id := bridge.publish()
    fake.resolve_success(valid_id, _valid_publication())
    assert(successes.back().get("request_id") == valid_id)
    assert(successes.back().get("method") == "publish")

    var invalid_publications: Array[Dictionary] = []
    var wrong_contract := _valid_publication()
    wrong_contract["contract"] = "published-campaign@999"
    invalid_publications.append(wrong_contract)
    var mismatched_document := _valid_publication()
    mismatched_document["documentId"] = "different-campaign"
    invalid_publications.append(mismatched_document)
    var malformed_base64 := _valid_publication()
    malformed_base64["pngBase64"] = "not base64!"
    invalid_publications.append(malformed_base64)
    var bad_png := _valid_publication()
    bad_png["pngBase64"] = "AAAA"
    invalid_publications.append(bad_png)
    var signature_only := _valid_publication()
    signature_only["pngBase64"] = Marshalls.raw_to_base64(PackedByteArray([137, 80, 78, 71, 13, 10, 26, 10]))
    invalid_publications.append(signature_only)
    var invalid_ihdr_length := _valid_publication()
    invalid_ihdr_length["pngBase64"] = _png_base64(1600, 900, 12)
    invalid_publications.append(invalid_ihdr_length)
    var invalid_ihdr_type := _valid_publication()
    invalid_ihdr_type["pngBase64"] = _png_base64(1600, 900, 13, "BAD!")
    invalid_publications.append(invalid_ihdr_type)
    var wrong_dimensions := _valid_publication()
    wrong_dimensions["pngBase64"] = _png_base64(1599, 900)
    invalid_publications.append(wrong_dimensions)
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

    var invalid_close_id := bridge.close()
    fake.resolve_raw(invalid_close_id, {
        "contract": "creator-bridge@1",
        "requestId": "wrong-close-request",
        "ok": true
    })
    var retained_identity_id := bridge.publish()
    fake.resolve_success(retained_identity_id, _valid_publication())
    assert(successes.back().get("request_id") == retained_identity_id)

    var close_id := bridge.close()
    fake.resolve_success(close_id)
    var after_close_id := bridge.publish()
    fake.resolve_success(after_close_id, _valid_publication())
    assert(failures.back().get("request_id") == after_close_id)
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
    return true

func _test_campaign_document_strict_strings_and_json_numbers() -> bool:
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
    assert(CampaignDocument.is_nonnegative_integer_number(9007199254740991))
    assert(CampaignDocument.is_nonnegative_integer_number(42.0))
    assert(not CampaignDocument.is_nonnegative_integer_number(9007199254740992))
    assert(not CampaignDocument.is_nonnegative_integer_number(9007199254740992.0))
    return true

func _test_mission_evidence_validation() -> bool:
    var document_without_field := _valid_document()
    assert(not document_without_field.has("missionEvidence"))
    assert(CampaignDocument.validate_bridge_shape(document_without_field).get("ok", false))

    var valid_entry := {
        "missionId": "audience-brief",
        "title": "Read the audience before making anything",
        "decisionId": "independence",
        "effectText": "This interpretation joins the audience's limited time, need for productivity and value of independence."
    }
    var document_with_evidence := _valid_document()
    document_with_evidence["missionEvidence"] = [valid_entry]
    var result := CampaignDocument.validate_bridge_shape(document_with_evidence)
    assert(result.get("ok", false))
    assert(result.get("value").get("missionEvidence") == [valid_entry])

    var not_array := _valid_document()
    not_array["missionEvidence"] = {}
    assert(not CampaignDocument.validate_bridge_shape(not_array).get("ok", false))

    var extra_key := _valid_document()
    var entry_with_extra_key := valid_entry.duplicate(true)
    entry_with_extra_key["extra"] = "not allowed"
    extra_key["missionEvidence"] = [entry_with_extra_key]
    assert(not CampaignDocument.validate_bridge_shape(extra_key).get("ok", false))

    var missing_key := _valid_document()
    var entry_missing_key := valid_entry.duplicate(true)
    entry_missing_key.erase("decisionId")
    missing_key["missionEvidence"] = [entry_missing_key]
    assert(not CampaignDocument.validate_bridge_shape(missing_key).get("ok", false))

    var empty_text := _valid_document()
    var entry_with_empty_text := valid_entry.duplicate(true)
    entry_with_empty_text["effectText"] = ""
    empty_text["missionEvidence"] = [entry_with_empty_text]
    assert(not CampaignDocument.validate_bridge_shape(empty_text).get("ok", false))

    var untrimmed_text := _valid_document()
    var entry_with_untrimmed_text := valid_entry.duplicate(true)
    entry_with_untrimmed_text["title"] = "  Read the audience before making anything  "
    untrimmed_text["missionEvidence"] = [entry_with_untrimmed_text]
    assert(not CampaignDocument.validate_bridge_shape(untrimmed_text).get("ok", false))

    var too_long_title := _valid_document()
    var entry_with_long_title := valid_entry.duplicate(true)
    entry_with_long_title["title"] = "x".repeat(121)
    too_long_title["missionEvidence"] = [entry_with_long_title]
    assert(not CampaignDocument.validate_bridge_shape(too_long_title).get("ok", false))

    var duplicate_mission_ids := _valid_document()
    duplicate_mission_ids["missionEvidence"] = [valid_entry, valid_entry.duplicate(true)]
    assert(not CampaignDocument.validate_bridge_shape(duplicate_mission_ids).get("ok", false))

    var too_many_entries := _valid_document()
    var entries: Array = []
    for index in range(25):
        var entry := valid_entry.duplicate(true)
        entry["missionId"] = "mission-%d" % index
        entries.append(entry)
    too_many_entries["missionEvidence"] = entries
    assert(not CampaignDocument.validate_bridge_shape(too_many_entries).get("ok", false))

    var wrong_value_type := _valid_document()
    var entry_with_wrong_type := valid_entry.duplicate(true)
    entry_with_wrong_type["decisionId"] = 7
    wrong_value_type["missionEvidence"] = [entry_with_wrong_type]
    assert(not CampaignDocument.validate_bridge_shape(wrong_value_type).get("ok", false))

    return true

func _test_focus_restores_only_after_a_valid_close() -> bool:
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
    return true

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
        "pngBase64": _png_base64(),
        "metadata": {
            "productName": "Product",
            "priceCents": 0.0,
            "brief": {},
            "evidence": {},
            "assetReferences": []
        }
    }

func _png_base64(width: int = 1600, height: int = 900, ihdr_length: int = 13, chunk_type: String = "IHDR") -> String:
    var bytes := PackedByteArray()
    bytes.resize(33)
    var signature := PackedByteArray([137, 80, 78, 71, 13, 10, 26, 10])
    for index in signature.size():
        bytes[index] = signature[index]
    _write_uint32_be(bytes, 8, ihdr_length)
    var type_bytes := chunk_type.to_ascii_buffer()
    for index in 4:
        bytes[12 + index] = type_bytes[index]
    _write_uint32_be(bytes, 16, width)
    _write_uint32_be(bytes, 20, height)
    bytes[24] = 8
    bytes[25] = 6
    return Marshalls.raw_to_base64(bytes)

func _write_uint32_be(bytes: PackedByteArray, offset: int, value: int) -> void:
    bytes[offset] = (value >> 24) & 0xff
    bytes[offset + 1] = (value >> 16) & 0xff
    bytes[offset + 2] = (value >> 8) & 0xff
    bytes[offset + 3] = value & 0xff
