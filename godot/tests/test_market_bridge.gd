extends RefCounted
class_name AdMarketTestMarketBridge

const MarketBridge = preload("res://src/market/market_bridge.gd")
const WebMarketTransport = preload("res://src/market/transport/web_market_transport.gd")
const FakeMarketTransport = preload("res://tests/fakes/fake_market_transport.gd")
const COMMAND_A := "11111111-1111-4111-8111-111111111111"
const COMMAND_B := "22222222-2222-4222-8222-222222222222"
const COMMAND_C := "33333333-3333-4333-8333-333333333333"
const COMMAND_D := "44444444-4444-4444-8444-444444444444"

var _png_cache: Dictionary = {}

func run() -> bool:
    assert(_request_contract_and_inputs_are_strict())
    assert(_teacher_capacity_fields_are_strict())
    assert(_cohort_and_market_eligibility_fields_are_strict())
    assert(_response_envelopes_snapshots_and_replays_are_strict())
    assert(_durable_command_responses_are_strict_and_token_free())
    assert(_pending_and_completed_histories_are_bounded())
    assert(_web_transport_preserves_request_identity_and_callbacks())
    return true

func _request_contract_and_inputs_are_strict() -> bool:
    var fake := FakeMarketTransport.new()
    var bridge := MarketBridge.new()
    var failures: Array[Dictionary] = []
    bridge.request_failed.connect(func(request_id: String, code: String, message: String) -> void:
        failures.append({"requestId": request_id, "code": code, "message": message})
    )
    bridge.set_transport(fake)

    var publication := _publication()
    var max_artwork_key := "a" + "b".repeat(255)
    var max_review_note := "N".repeat(240)
    var requests := [
        [bridge.create_room(10000, "teacher-code-7"), "createRoom", {"openingWallet": 10000.0, "classroomCode": "teacher-code-7", "maxTeams": 15.0}],
        [bridge.create_room(10000, "teacher-code-7", 30), "createRoom", {"openingWallet": 10000.0, "classroomCode": "teacher-code-7", "maxTeams": 30.0}],
        [bridge.join_room("ABC-234", "Neon Narwhals"), "joinRoom", {"roomCode": "ABC-234", "alias": "Neon Narwhals"}],
        [bridge.resume_session(), "resumeSession", null],
        [bridge.get_snapshot(), "getSnapshot", null],
        [bridge.publish_campaign(publication, COMMAND_A), "publishCampaign", {"commandId": COMMAND_A, "publication": publication}],
        [bridge.purchase("campaign-a", "buy-a-1"), "purchase", {"campaignId": "campaign-a", "requestId": "buy-a-1"}],
        [bridge.award("campaign-b", "gold", COMMAND_B), "award", {"commandId": COMMAND_B, "campaignId": "campaign-b", "medal": "gold"}],
        [bridge.finish(COMMAND_B), "finish", {"commandId": COMMAND_B}],
        [bridge.review_campaign("campaign-a", 2, "approved", COMMAND_C), "reviewCampaign", {"commandId": COMMAND_C, "campaignId": "campaign-a", "submissionVersion": 2.0, "status": "approved"}],
        [bridge.review_campaign("campaign-b", 3, "returned", COMMAND_D, "Add a clearer price."), "reviewCampaign", {"commandId": COMMAND_D, "campaignId": "campaign-b", "submissionVersion": 3.0, "status": "returned", "reviewNote": "Add a clearer price."}],
        [bridge.control("openMarket", COMMAND_A), "control", {"commandId": COMMAND_A, "action": "openMarket"}],
        [bridge.control("openReveal", COMMAND_B), "control", {"commandId": COMMAND_B, "action": "openReveal"}],
        [bridge.control("closeMarket", COMMAND_C), "control", {"commandId": COMMAND_C, "action": "closeMarket"}],
        [bridge.control("removeTeam", COMMAND_D, "team-a"), "control", {"commandId": COMMAND_D, "action": "removeTeam", "teamId": "team-a"}],
        [bridge.get_artwork("artwork/campaign-a"), "getArtwork", {"artworkKey": "artwork/campaign-a"}],
        [bridge.get_artwork(max_artwork_key), "getArtwork", {"artworkKey": max_artwork_key}],
        [bridge.review_campaign("campaign-c", 4, "returned", COMMAND_A, max_review_note), "reviewCampaign", {
            "commandId": COMMAND_A,
            "campaignId": "campaign-c",
            "submissionVersion": 4.0,
            "status": "returned",
            "reviewNote": max_review_note
        }]
    ]
    var ids: Dictionary = {}
    for expected in requests:
        var request_id: String = expected[0]
        assert(not request_id.is_empty())
        assert(not ids.has(request_id))
        ids[request_id] = true
        var request := fake.request_for(request_id)
        assert(request.get("contract") == "market-bridge@1")
        assert(request.get("requestId") == request_id)
        assert(request.get("method") == expected[1])
        assert(
            request.get("payload") == expected[2],
            "Payload mismatch for %s: got %s; expected %s" % [
                expected[1], request.get("payload"), expected[2]
            ]
        )

    var before_invalid := fake.request_count()
    var invalid_publication := publication.duplicate(true)
    invalid_publication["contract"] = "published-campaign@999"
    var truncated_publication := publication.duplicate(true)
    truncated_publication["pngBase64"] = _png_header_only_base64()
    var oversized_publication := publication.duplicate(true)
    oversized_publication["pngBase64"] = _oversized_header_png_base64()
    var expanded_publication := publication.duplicate(true)
    expanded_publication["unexpected"] = true
    var expanded_metadata_publication := publication.duplicate(true)
    expanded_metadata_publication["metadata"]["unexpected"] = true
    var empty_name_publication := publication.duplicate(true)
    empty_name_publication["metadata"]["productName"] = ""
    var free_publication := publication.duplicate(true)
    free_publication["metadata"]["priceCents"] = 0
    for invalid_id in [
        bridge.create_room(0, "teacher-code-7"),
        bridge.create_room(99, "teacher-code-7"),
        bridge.create_room(1000001, "teacher-code-7"),
        bridge.create_room(9007199254740992, "teacher-code-7"),
        bridge.create_room(10000, ""),
        bridge.create_room(10000, "teacher-code-7", 2),
        bridge.create_room(10000, "teacher-code-7", 31),
        bridge.create_room(10000, "teacher-code-7", 15.0),
        bridge.join_room("ABCD", "Alias"),
        bridge.join_room("abc-234", "Alias"),
        bridge.join_room("ABC-234", "A"),
        bridge.join_room("ABC-234", "A".repeat(33)),
        bridge.join_room("ABC-234", "  "),
        bridge.publish_campaign(invalid_publication, COMMAND_A),
        bridge.publish_campaign(truncated_publication, COMMAND_A),
        bridge.publish_campaign(oversized_publication, COMMAND_A),
        bridge.publish_campaign(expanded_publication, COMMAND_A),
        bridge.publish_campaign(expanded_metadata_publication, COMMAND_A),
        bridge.publish_campaign(empty_name_publication, COMMAND_A),
        bridge.publish_campaign(free_publication, COMMAND_A),
        bridge.publish_campaign(publication, "not-a-uuid"),
        bridge.purchase("", "buy-1"),
        bridge.purchase("campaign", " buy-1 "),
        bridge.purchase("campaign/invalid", "buy-1"),
        bridge.purchase("c".repeat(65), "buy-1"),
        bridge.award("campaign-a", "platinum", COMMAND_A),
        bridge.award("campaign-a", "gold", "not-a-uuid"),
        bridge.award("campaign/invalid", "gold", COMMAND_A),
        bridge.finish("not-a-uuid"),
        bridge.review_campaign("campaign", 1, "pending", COMMAND_A),
        bridge.review_campaign("campaign", 0, "hidden", COMMAND_A),
        bridge.review_campaign("campaign", 1.5, "hidden", COMMAND_A),
        bridge.review_campaign("campaign", 1, "hidden", "not-a-uuid"),
        bridge.review_campaign("campaign", 1, "hidden", COMMAND_A, 7),
        bridge.review_campaign("campaign", 1, "hidden", COMMAND_A, ""),
        bridge.review_campaign("campaign", 1, "hidden", COMMAND_A, "N".repeat(241)),
        bridge.control("pauseMarket", COMMAND_A),
        bridge.control("removeTeam", COMMAND_A),
        bridge.control("removeTeam", COMMAND_A, "team/invalid"),
        bridge.control("openMarket", COMMAND_A, "team-a"),
        bridge.control("openMarket", "not-a-uuid"),
        bridge.get_artwork(" artwork/campaign-a "),
        bridge.get_artwork("artwork key with spaces"),
        bridge.get_artwork("a".repeat(257))
    ]:
        assert(String(invalid_id).is_empty())
        assert(failures.back().get("code") == "INVALID_REQUEST")
    assert(fake.request_count() == before_invalid)
    bridge.free()
    return true

func _teacher_capacity_fields_are_strict() -> bool:
    var fake := FakeMarketTransport.new()
    var bridge := MarketBridge.new()
    var successes: Array[Dictionary] = []
    var failures: Array[Dictionary] = []
    bridge.request_succeeded.connect(func(request_id: String, method: String, payload: Variant) -> void:
        successes.append({"requestId": request_id, "method": method, "payload": payload})
    )
    bridge.request_failed.connect(func(request_id: String, code: String, message: String) -> void:
        failures.append({"requestId": request_id, "code": code, "message": message})
    )
    bridge.set_transport(fake)

    var valid := _snapshot()
    valid["maxTeams"] = 15.0
    valid["availableSeats"] = 12.0
    var valid_id := bridge.get_snapshot()
    fake.resolve_success(valid_id, valid)
    assert(successes.size() == 1)
    assert(successes[0].get("payload").get("maxTeams") == 15.0)
    assert(successes[0].get("payload").get("availableSeats") == 12.0)

    var invalid_snapshots: Array[Dictionary] = []
    for values in [
        {"maxTeams": 2.0, "availableSeats": 0.0},
        {"maxTeams": 31.0, "availableSeats": 0.0},
        {"maxTeams": 15.5, "availableSeats": 0.0},
        {"maxTeams": 15.0, "availableSeats": -1.0},
        {"maxTeams": 15.0, "availableSeats": 16.0},
        {"maxTeams": 15.0},
        {"availableSeats": 3.0}
    ]:
        var malformed := _snapshot()
        malformed.merge(values, true)
        invalid_snapshots.append(malformed)
    for malformed in invalid_snapshots:
        var request_id := bridge.get_snapshot()
        fake.resolve_success(request_id, malformed)
        assert(failures.back().get("requestId") == request_id)
        assert(failures.back().get("code") == "INVALID_SNAPSHOT_RESPONSE")
    bridge.free()
    return true

func _cohort_and_market_eligibility_fields_are_strict() -> bool:
    var fake := FakeMarketTransport.new()
    var bridge := MarketBridge.new()
    var successes: Array[Dictionary] = []
    var failures: Array[Dictionary] = []
    bridge.request_succeeded.connect(func(request_id: String, method: String, payload: Variant) -> void:
        successes.append({"requestId": request_id, "method": method, "payload": payload})
    )
    bridge.request_failed.connect(func(request_id: String, code: String, message: String) -> void:
        failures.append({"requestId": request_id, "code": code, "message": message})
    )
    bridge.set_transport(fake)

    var valid := _snapshot()
    valid["teams"] = [{
        "id": "team-a",
        "marketEligibility": {
            "state": "frozen",
            "role": "spectator",
            "reason": "campaign-pending"
        }
    }]
    valid["cohort"] = {
        "frozen": true,
        "totalJoined": 4.0,
        "participating": 3.0,
        "spectating": 1.0,
        "buyers": 3.0,
        "sellers": 3.0,
        "requiredFinished": 3.0,
        "finishedRequired": 1.0
    }
    var valid_id := bridge.get_snapshot()
    fake.resolve_success(valid_id, valid)
    assert(successes.back().get("requestId") == valid_id)

    var invalid_eligibility := valid.duplicate(true)
    invalid_eligibility["teams"][0]["marketEligibility"]["role"] = "participant"
    var invalid_eligibility_id := bridge.get_snapshot()
    fake.resolve_success(invalid_eligibility_id, invalid_eligibility)
    assert(failures.back().get("requestId") == invalid_eligibility_id)
    assert(failures.back().get("code") == "INVALID_SNAPSHOT_RESPONSE")

    var invalid_cohort := valid.duplicate(true)
    invalid_cohort["cohort"]["unexpected"] = true
    var invalid_cohort_id := bridge.get_snapshot()
    fake.resolve_success(invalid_cohort_id, invalid_cohort)
    assert(failures.back().get("requestId") == invalid_cohort_id)
    assert(failures.back().get("code") == "INVALID_SNAPSHOT_RESPONSE")
    bridge.free()
    return true

func _web_transport_preserves_request_identity_and_callbacks() -> bool:
    var transport := WebMarketTransport.new()
    var resolved: Array[String] = []
    var rejected: Array[String] = []
    transport.send(
        JSON.stringify({
            "contract": "market-bridge@1",
            "requestId": "market-web-1",
            "method": "getSnapshot",
            "payload": null
        }),
        func(response_json: String) -> void: resolved.append(response_json),
        func(message: String) -> void: rejected.append(message)
    )
    assert(rejected.is_empty())
    assert(resolved.size() == 1)
    var unavailable: Variant = JSON.parse_string(resolved[0])
    assert(unavailable.get("contract") == "market-bridge@1")
    assert(unavailable.get("requestId") == "market-web-1")
    assert(unavailable.get("error").get("code") == "MARKET_UNAVAILABLE")

    transport.set("_pending_callbacks", {"market-promise-1": {}})
    transport.call(
        "_resolve_promise",
        "market-promise-1",
        ["promise-response"],
        func(value: String) -> void: resolved.append(value)
    )
    assert(resolved.back() == "promise-response")
    assert(Dictionary(transport.get("_pending_callbacks")).is_empty())

    transport.set("_pending_callbacks", {"market-promise-2": {}})
    transport.call(
        "_reject_promise",
        "market-promise-2",
        ["promise-rejection"],
        func(message: String) -> void: rejected.append(message)
    )
    assert(rejected.back() == "promise-rejection")
    assert(Dictionary(transport.get("_pending_callbacks")).is_empty())

    var rejection_count := rejected.size()
    transport.call(
        "_attach_promise",
        "market-promise-invalid",
        RefCounted.new(),
        func(_value: String) -> void: assert(false, "A non-Promise result must not resolve"),
        func(message: String) -> void: rejected.append(message)
    )
    assert(rejected.size() == rejection_count + 1)
    assert(rejected.back().contains("Promise"))
    assert(Dictionary(transport.get("_pending_callbacks")).is_empty())
    return true

func _response_envelopes_snapshots_and_replays_are_strict() -> bool:
    var fake := FakeMarketTransport.new()
    var bridge := MarketBridge.new()
    var successes: Array[Dictionary] = []
    var failures: Array[Dictionary] = []
    bridge.request_succeeded.connect(func(request_id: String, method: String, payload: Variant) -> void:
        successes.append({"requestId": request_id, "method": method, "payload": payload})
    )
    bridge.request_failed.connect(func(request_id: String, code: String, message: String) -> void:
        failures.append({"requestId": request_id, "code": code, "message": message})
    )
    bridge.set_transport(fake)

    var snapshot := _snapshot()
    snapshot["serverOwnedOpaqueField"] = {"kept": true}
    var terminal_resume_id: String = bridge.resume_session()
    fake.resolve_success(terminal_resume_id, null)
    assert(successes.size() == 1)
    assert(successes[0].get("method") == "resumeSession")
    assert(successes[0].get("payload") == null)

    var team_resume_id: String = bridge.resume_session()
    fake.resolve_success(team_resume_id, {
        "role": "team",
        "roomCode": "ABC-234",
        "snapshot": snapshot
    })
    assert(successes.size() == 2)
    assert(successes[1].get("method") == "resumeSession")
    assert(successes[1].get("payload").get("role") == "team")

    var invalid_resume_id: String = bridge.resume_session()
    fake.resolve_success(invalid_resume_id, {
        "role": "spectator",
        "roomCode": "ABC-234",
        "snapshot": snapshot
    })
    assert(failures.back().get("requestId") == invalid_resume_id)
    assert(failures.back().get("code") == "INVALID_ROOM_RESPONSE")

    var create_id := bridge.create_room(10000, "teacher-code-7")
    var state_id := bridge.get_snapshot()
    fake.resolve_success(state_id, snapshot)
    fake.resolve_success(create_id, {
        "role": "teacher",
        "roomCode": "ABC-234",
        "snapshot": {"anotherServerShape": true}
    })
    assert(successes.size() == 4)
    assert(successes[2].get("method") == "getSnapshot")
    assert(successes[2].get("payload").get("serverOwnedOpaqueField").get("kept"))
    assert(successes[3].get("payload").get("snapshot").get("anotherServerShape"))

    var invalid_room_id := bridge.join_room("ABC-234", "Neon Narwhals")
    fake.resolve_success(invalid_room_id, {
        "role": "pair",
        "roomCode": "ABC-234",
        "snapshot": snapshot
    })
    assert(failures.back().get("requestId") == invalid_room_id)
    assert(failures.back().get("code") == "INVALID_ROOM_RESPONSE")

    var echoed_secret_id := bridge.create_room(10000, "teacher-code-7")
    fake.resolve_success(echoed_secret_id, {
        "role": "teacher",
        "roomCode": "ABC-234",
        "snapshot": snapshot,
        "classroomCode": "teacher-code-7"
    })
    assert(failures.back().get("requestId") == echoed_secret_id)
    assert(failures.back().get("code") == "INVALID_ROOM_RESPONSE")
    assert(not JSON.stringify(successes).contains("teacher-code-7"))

    var nested_secret_id := bridge.create_room(10000, "teacher-code-7")
    fake.resolve_success(nested_secret_id, {
        "role": "teacher",
        "roomCode": "ABC-234",
        "snapshot": {
            "phase": "building",
            "serverOwned": {"classroomCode": "teacher-code-7"}
        }
    })
    assert(failures.back().get("requestId") == nested_secret_id)
    assert(failures.back().get("code") == "INVALID_ROOM_RESPONSE")
    assert(not JSON.stringify(successes).contains("teacher-code-7"))

    for invalid_snapshot in [
        "not-a-snapshot",
        {"roomCode": 7},
        {"phase": ""},
        {"revision": 1.5},
        {"campaigns": {}}
    ]:
        var invalid_snapshot_id := bridge.get_snapshot()
        fake.resolve_success(invalid_snapshot_id, invalid_snapshot)
        assert(failures.back().get("requestId") == invalid_snapshot_id)
        assert(failures.back().get("code") == "INVALID_SNAPSHOT_RESPONSE")

    var publish_id := bridge.publish_campaign(_publication(), COMMAND_A)
    fake.resolve_success(publish_id, {
        "replayed": false,
        "campaignId": "campaign-a",
        "submissionVersion": 1.0,
        "postcondition": {"kind": "publish", "campaignId": "campaign-a", "submissionVersion": 1.0},
        "snapshot": snapshot
    })
    assert(successes.back().get("method") == "publishCampaign")

    var invalid_nested_snapshot_id := bridge.purchase("campaign-a", "buy-a-2")
    fake.resolve_success(invalid_nested_snapshot_id, {"receiptId": "r-1", "snapshot": {"teams": {}}})
    assert(failures.back().get("code") == "INVALID_MARKET_RESPONSE")

    var artwork_id: String = bridge.get_artwork("artwork/campaign-a")
    fake.resolve_success(artwork_id, _artwork_payload("artwork/campaign-a"))
    assert(successes.back().get("requestId") == artwork_id)
    assert(successes.back().get("method") == "getArtwork")

    var mismatched_artwork_id: String = bridge.get_artwork("artwork/campaign-a")
    fake.resolve_success(mismatched_artwork_id, _artwork_payload("artwork/campaign-b"))
    assert(failures.back().get("requestId") == mismatched_artwork_id)
    assert(failures.back().get("code") == "INVALID_ARTWORK_RESPONSE")

    var extra_artwork_id: String = bridge.get_artwork("artwork/campaign-a")
    var extra_artwork := _artwork_payload("artwork/campaign-a")
    extra_artwork["serverHint"] = true
    fake.resolve_success(extra_artwork_id, extra_artwork)
    assert(failures.back().get("code") == "INVALID_ARTWORK_RESPONSE")

    var wrong_size_artwork_id: String = bridge.get_artwork("artwork/campaign-a")
    fake.resolve_success(wrong_size_artwork_id, {
        "artworkKey": "artwork/campaign-a",
        "pngBase64": _png_base64(1599, 900)
    })
    assert(failures.back().get("code") == "INVALID_ARTWORK_RESPONSE")

    var truncated_artwork_id: String = bridge.get_artwork("artwork/campaign-a")
    fake.resolve_success(truncated_artwork_id, {
        "artworkKey": "artwork/campaign-a",
        "pngBase64": _png_header_only_base64()
    })
    assert(failures.back().get("requestId") == truncated_artwork_id)
    assert(failures.back().get("code") == "INVALID_ARTWORK_RESPONSE")

    var wrong_contract_id := bridge.get_snapshot()
    fake.resolve_raw(wrong_contract_id, {
        "contract": "market-bridge@999",
        "requestId": wrong_contract_id,
        "ok": true,
        "payload": snapshot
    })
    assert(failures.back().get("code") == "UNSUPPORTED_CONTRACT")

    var ambiguous_success_id := bridge.get_snapshot()
    fake.resolve_raw(ambiguous_success_id, {
        "contract": "market-bridge@1",
        "requestId": ambiguous_success_id,
        "ok": true,
        "payload": snapshot,
        "error": {"code": "SHOULD_NOT_EXIST", "message": "ambiguous"}
    })
    assert(failures.back().get("requestId") == ambiguous_success_id)
    assert(failures.back().get("code") == "INVALID_RESPONSE")

    var ambiguous_failure_id := bridge.get_snapshot()
    fake.resolve_raw(ambiguous_failure_id, {
        "contract": "market-bridge@1",
        "requestId": ambiguous_failure_id,
        "ok": false,
        "payload": snapshot,
        "error": {"code": "ROOM_GONE", "message": "The room has closed"}
    })
    assert(failures.back().get("requestId") == ambiguous_failure_id)
    assert(failures.back().get("code") == "INVALID_RESPONSE")

    var expanded_error_id := bridge.get_snapshot()
    fake.resolve_raw(expanded_error_id, {
        "contract": "market-bridge@1",
        "requestId": expanded_error_id,
        "ok": false,
        "error": {
            "code": "ROOM_GONE",
            "message": "The room has closed",
            "debug": "must not cross the seam"
        }
    })
    assert(failures.back().get("requestId") == expanded_error_id)
    assert(failures.back().get("code") == "INVALID_RESPONSE")

    var rate_limited_id := bridge.get_snapshot()
    fake.resolve_raw(rate_limited_id, {
        "contract": "market-bridge@1",
        "requestId": rate_limited_id,
        "ok": false,
        "error": {
            "code": "RATE_LIMITED",
            "message": "Wait before retrying",
            "retryAfterSeconds": 17.0
        }
    })
    assert(failures.back().get("requestId") == rate_limited_id)
    assert(failures.back().get("code") == "RATE_LIMITED")

    var invalid_retry_after_id := bridge.get_snapshot()
    fake.resolve_raw(invalid_retry_after_id, {
        "contract": "market-bridge@1",
        "requestId": invalid_retry_after_id,
        "ok": false,
        "error": {
            "code": "RATE_LIMITED",
            "message": "Wait before retrying",
            "retryAfterSeconds": -1.0
        }
    })
    assert(failures.back().get("requestId") == invalid_retry_after_id)
    assert(failures.back().get("code") == "INVALID_RESPONSE")

    var mismatch_id := bridge.get_snapshot()
    fake.resolve_raw(mismatch_id, {
        "contract": "market-bridge@1",
        "requestId": "different-request",
        "ok": true,
        "payload": snapshot
    })
    assert(failures.back().get("code") == "REQUEST_ID_MISMATCH")

    var invalid_error_id := bridge.get_snapshot()
    fake.resolve_raw(invalid_error_id, {
        "contract": "market-bridge@1",
        "requestId": invalid_error_id,
        "ok": false,
        "error": {"code": "", "message": 7}
    })
    assert(failures.back().get("code") == "INVALID_RESPONSE")

    var valid_error_id := bridge.get_snapshot()
    fake.resolve_raw(valid_error_id, {
        "contract": "market-bridge@1",
        "requestId": valid_error_id,
        "ok": false,
        "error": {"code": "ROOM_GONE", "message": "The room has closed"}
    })
    assert(failures.back().get("requestId") == valid_error_id)
    assert(failures.back().get("code") == "ROOM_GONE")

    fake.repeat_response(state_id)
    assert(failures.back().get("code") == "DUPLICATE_RESPONSE")
    bridge.accept_response("missing-request", JSON.stringify({
        "contract": "market-bridge@1",
        "requestId": "missing-request",
        "ok": true,
        "payload": snapshot
    }))
    assert(failures.back().get("code") == "STALE_RESPONSE")

    var rejected_id := bridge.get_snapshot()
    fake.reject_request(rejected_id, "Synthetic network failure")
    assert(failures.back().get("requestId") == rejected_id)
    assert(failures.back().get("code") == "TRANSPORT_ERROR")
    bridge.free()
    return true

func _durable_command_responses_are_strict_and_token_free() -> bool:
    var fake := FakeMarketTransport.new()
    var bridge := MarketBridge.new()
    var successes: Array[Dictionary] = []
    var failures: Array[Dictionary] = []
    bridge.request_succeeded.connect(func(request_id: String, method: String, payload: Variant) -> void:
        successes.append({"requestId": request_id, "method": method, "payload": payload})
    )
    bridge.request_failed.connect(func(request_id: String, code: String, message: String) -> void:
        failures.append({"requestId": request_id, "code": code, "message": message})
    )
    bridge.set_transport(fake)
    var snapshot := _snapshot()

    var finish_id := bridge.finish(COMMAND_A)
    fake.resolve_success(finish_id, {
        "replayed": false,
        "postcondition": {"kind": "finish", "finishedAt": 1000.0},
        "snapshot": snapshot
    })
    assert(successes.back().get("method") == "finish")

    var review_id := bridge.review_campaign("campaign-a", 2, "approved", COMMAND_B)
    fake.resolve_success(review_id, {
        "replayed": true,
        "postcondition": {
            "kind": "review",
            "campaignId": "campaign-a",
            "submissionVersion": 2.0,
            "status": "approved"
        },
        "snapshot": snapshot
    })
    assert(successes.back().get("method") == "reviewCampaign")

    var control_id := bridge.control("openMarket", COMMAND_C)
    fake.resolve_success(control_id, {
        "replayed": false,
        "postcondition": {"kind": "control", "action": "openMarket"},
        "snapshot": snapshot
    })
    assert(successes.back().get("method") == "control")

    var remove_id := bridge.control("removeTeam", COMMAND_D, "team-b")
    fake.resolve_success(remove_id, {
        "replayed": false,
        "postcondition": {"kind": "removeTeam", "teamId": "team-b"},
        "snapshot": snapshot
    })
    assert(successes.back().get("method") == "control")

    var missing_id := bridge.finish(COMMAND_A)
    fake.resolve_success(missing_id, {"postcondition": {"kind": "finish", "finishedAt": 1000.0}, "snapshot": snapshot})
    assert(failures.back().get("requestId") == missing_id)
    assert(failures.back().get("code") == "INVALID_MARKET_RESPONSE")

    var wrong_postcondition_id := bridge.control("openReveal", COMMAND_B)
    fake.resolve_success(wrong_postcondition_id, {
        "replayed": false,
        "postcondition": {"kind": "control", "action": "closeMarket"},
        "snapshot": snapshot
    })
    assert(failures.back().get("requestId") == wrong_postcondition_id)
    assert(failures.back().get("code") == "INVALID_MARKET_RESPONSE")

    var secret_id := bridge.finish(COMMAND_C)
    var secret_snapshot := snapshot.duplicate(true)
    secret_snapshot["nested"] = {"token": "payload.signature"}
    fake.resolve_success(secret_id, {
        "replayed": false,
        "postcondition": {"kind": "finish", "finishedAt": 1000.0},
        "snapshot": secret_snapshot
    })
    assert(failures.back().get("requestId") == secret_id)
    assert(failures.back().get("code") == "INVALID_MARKET_RESPONSE")
    assert(not JSON.stringify(successes).contains("payload.signature"))

    bridge.free()
    return true

func _pending_and_completed_histories_are_bounded() -> bool:
    var pending_fake := FakeMarketTransport.new()
    var pending_bridge := MarketBridge.new()
    var pending_failures: Array[String] = []
    pending_bridge.request_failed.connect(func(_request_id: String, code: String, _message: String) -> void:
        pending_failures.append(code)
    )
    pending_bridge.set_transport(pending_fake)
    for _index in 32:
        pending_bridge.get_snapshot()
    assert(pending_bridge.pending_count() == 32)
    var overflow_id := pending_bridge.get_snapshot()
    assert(not overflow_id.is_empty())
    assert(pending_bridge.pending_count() == 32)
    assert(pending_fake.request_count() == 32)
    assert(pending_failures.back() == "TOO_MANY_PENDING")
    pending_bridge.free()

    var completed_fake := FakeMarketTransport.new()
    var completed_bridge := MarketBridge.new()
    var completed_failures: Array[String] = []
    completed_bridge.request_failed.connect(func(_request_id: String, code: String, _message: String) -> void:
        completed_failures.append(code)
    )
    completed_bridge.set_transport(completed_fake)
    var completed_ids: Array[String] = []
    for _index in 65:
        var request_id := completed_bridge.get_snapshot()
        completed_ids.append(request_id)
        completed_fake.resolve_success(request_id, {})
    completed_fake.repeat_response(completed_ids.back())
    assert(completed_failures.back() == "DUPLICATE_RESPONSE")
    completed_fake.repeat_response(completed_ids.front())
    assert(completed_failures.back() == "STALE_RESPONSE")
    completed_bridge.free()
    return true

func _snapshot() -> Dictionary:
    return {
        "roomCode": "ABC-234",
        "phase": "market",
        "revision": 3.0,
        "openingWallet": 10000.0,
        "walletCents": 8000.0,
        "teams": [],
        "campaigns": [],
        "purchases": []
    }

func _publication() -> Dictionary:
    return {
        "contract": "published-campaign@1",
        "documentId": "campaign-document",
        "revision": 2.0,
        "pngBase64": _png_base64(),
        "metadata": {
            "productName": "Orbit Bottle",
            "priceCents": 2499.0,
            "brief": {},
            "evidence": {},
            "assetReferences": []
        }
    }

func _artwork_payload(artwork_key: String) -> Dictionary:
    return {"artworkKey": artwork_key, "pngBase64": _png_base64()}

func _png_base64(width: int = 1600, height: int = 900) -> String:
    var cache_key := "%dx%d" % [width, height]
    if _png_cache.has(cache_key):
        return str(_png_cache.get(cache_key))
    var image := Image.create_empty(width, height, false, Image.FORMAT_RGBA8)
    image.fill(Color(0.16, 0.22, 0.32, 1.0))
    var encoded := Marshalls.raw_to_base64(image.save_png_to_buffer())
    assert(not encoded.is_empty())
    _png_cache[cache_key] = encoded
    return encoded

func _png_header_only_base64() -> String:
    var bytes := PackedByteArray()
    bytes.resize(33)
    var signature := PackedByteArray([137, 80, 78, 71, 13, 10, 26, 10])
    for index in signature.size():
        bytes[index] = signature[index]
    _write_uint32_be(bytes, 8, 13)
    var type_bytes := "IHDR".to_ascii_buffer()
    for index in 4:
        bytes[12 + index] = type_bytes[index]
    _write_uint32_be(bytes, 16, 1600)
    _write_uint32_be(bytes, 20, 900)
    bytes[24] = 8
    bytes[25] = 6
    return Marshalls.raw_to_base64(bytes)

func _oversized_header_png_base64() -> String:
    var bytes := PackedByteArray()
    bytes.resize(4 * 1024 * 1024 + 1)
    var signature := PackedByteArray([137, 80, 78, 71, 13, 10, 26, 10])
    for index in signature.size():
        bytes[index] = signature[index]
    _write_uint32_be(bytes, 8, 13)
    var type_bytes := "IHDR".to_ascii_buffer()
    for index in 4:
        bytes[12 + index] = type_bytes[index]
    _write_uint32_be(bytes, 16, 1600)
    _write_uint32_be(bytes, 20, 900)
    bytes[24] = 8
    bytes[25] = 6
    return Marshalls.raw_to_base64(bytes)

func _write_uint32_be(bytes: PackedByteArray, offset: int, value: int) -> void:
    bytes[offset] = (value >> 24) & 0xff
    bytes[offset + 1] = (value >> 16) & 0xff
    bytes[offset + 2] = (value >> 8) & 0xff
    bytes[offset + 3] = value & 0xff
