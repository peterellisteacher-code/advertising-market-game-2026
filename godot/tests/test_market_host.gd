extends RefCounted

const MarketHost = preload("res://src/market/MarketHost.gd")
const FakeMarketTransport = preload("res://tests/fakes/FakeMarketTransport.gd")

var _cached_png_base64 := ""

func run() -> bool:
    assert(_durable_command_intents_retry_until_postconditions_are_observed())
    assert(_resume_distinguishes_terminal_transient_and_current_success())
    assert(_room_intent_supersession_is_monotonic())
    assert(_snapshot_requires_an_integer_revision())
    assert(_snapshot_revisions_do_not_regress_within_a_room_generation())
    var fake := FakeMarketTransport.new()
    var host := MarketHost.new()
    var game_input := Node.new()
    var unmounted_focus_target := Control.new()
    var snapshots: Array[Dictionary] = []
    var reveals: Array[Dictionary] = []
    var controls: Array[Dictionary] = []
    var publications: Array[Dictionary] = []
    var purchases: Array[Dictionary] = []
    var awards: Array[Dictionary] = []
    var rooms_created: Array[Dictionary] = []
    var rooms_joined: Array[Dictionary] = []
    var artwork_events: Array[Dictionary] = []
    var snapshot_signal_modes: Array[int] = []
    var diagnostics: Array[String] = []
    var focus_restores := [0]
    game_input.process_mode = Node.PROCESS_MODE_ALWAYS
    host.game_input_root = game_input
    host.return_focus_control = unmounted_focus_target
    host.set_transport(fake)
    host.snapshot_received.connect(func(snapshot: Dictionary) -> void:
        snapshots.append(snapshot)
        snapshot_signal_modes.append(game_input.process_mode)
    )
    host.room_created.connect(func(wrapper: Dictionary) -> void: rooms_created.append(wrapper))
    host.room_joined.connect(func(wrapper: Dictionary) -> void: rooms_joined.append(wrapper))
    host.reveal_received.connect(func(reveal: Dictionary) -> void: reveals.append(reveal))
    host.control_completed.connect(func(action: String, result: Dictionary) -> void:
        controls.append({"action": action, "result": result})
    )
    host.campaign_published.connect(func(result: Dictionary) -> void: publications.append(result))
    host.purchase_completed.connect(func(result: Dictionary) -> void: purchases.append(result))
    host.award_completed.connect(func(result: Dictionary) -> void: awards.append(result))
    host.artwork_received.connect(func(artwork_key: String, png_bytes: PackedByteArray) -> void:
        artwork_events.append({"artworkKey": artwork_key, "pngBytes": png_bytes})
    )
    host.diagnostic.connect(func(message: String) -> void: diagnostics.append(message))
    host.focus_restore_requested.connect(func() -> void: focus_restores[0] += 1)

    var snapshot := _snapshot()
    var create_id := host.create_room(10000, "teacher-code-7", 18)
    assert(game_input.process_mode == Node.PROCESS_MODE_DISABLED)
    assert(fake.request_for(create_id).get("payload").get("maxTeams") == 18.0)
    fake.resolve_success(create_id, {
        "role": "teacher",
        "roomCode": "ABC-234",
        "snapshot": snapshot
    })
    assert(rooms_created.size() == 1)
    assert(snapshots.size() == 1)
    assert(snapshots[0].get("phase") == "market")
    assert(snapshot_signal_modes.back() == Node.PROCESS_MODE_ALWAYS)
    assert(game_input.process_mode == Node.PROCESS_MODE_ALWAYS)
    assert(focus_restores[0] == 1)

    var join_id := host.join_room("ABC-234", "Signal Foxes")
    fake.resolve_success(join_id, {
        "role": "team",
        "roomCode": "ABC-234",
        "snapshot": snapshot
    })
    assert(rooms_joined.size() == 1)
    assert(snapshots.size() == 2)
    assert(snapshot_signal_modes.back() == Node.PROCESS_MODE_ALWAYS)

    var focus_before_background_snapshot: int = focus_restores[0]
    var requests_before_background_snapshot := fake.request_count()
    var background_snapshot_id: String = host.request_snapshot_silently()
    var duplicate_background_snapshot_id: String = host.request_snapshot_silently()
    assert(duplicate_background_snapshot_id == background_snapshot_id)
    assert(fake.request_count() == requests_before_background_snapshot + 1)
    assert(game_input.process_mode == Node.PROCESS_MODE_ALWAYS)
    fake.resolve_success(background_snapshot_id, snapshot)
    assert(game_input.process_mode == Node.PROCESS_MODE_ALWAYS)
    assert(focus_restores[0] == focus_before_background_snapshot)
    var next_background_snapshot_id: String = host.request_snapshot_silently()
    assert(next_background_snapshot_id != background_snapshot_id)
    fake.resolve_success(next_background_snapshot_id, snapshot)
    assert(focus_restores[0] == focus_before_background_snapshot)

    var snapshot_id := host.request_snapshot()
    var purchase_id := host.purchase("campaign-b", "buy-b-1")
    assert(game_input.process_mode == Node.PROCESS_MODE_DISABLED)
    fake.resolve_success(snapshot_id, snapshot)
    assert(game_input.process_mode == Node.PROCESS_MODE_DISABLED)
    fake.resolve_success(purchase_id, {"receiptId": "receipt-1", "snapshot": snapshot})
    assert(purchases.size() == 1)
    assert(game_input.process_mode == Node.PROCESS_MODE_ALWAYS)
    assert(focus_restores[0] == 3)

    var award_id := host.award("campaign-c", "gold")
    assert(fake.request_for(award_id).get("method") == "award")
    assert(fake.request_for(award_id).get("payload").get("campaignId") == "campaign-c")
    assert(fake.request_for(award_id).get("payload").get("medal") == "gold")
    fake.resolve_success(award_id, {
        "postcondition": {"kind": "award", "campaignId": "campaign-c", "medal": "gold"},
        "snapshot": snapshot
    })
    assert(awards.size() == 1)

    var before_artwork_requests := fake.request_count()
    var focus_before_artwork: int = focus_restores[0]
    var artwork_id: String = host.request_artwork("artwork/campaign-a")
    var duplicate_artwork_id: String = host.request_artwork("artwork/campaign-a")
    assert(game_input.process_mode == Node.PROCESS_MODE_ALWAYS)
    assert(duplicate_artwork_id == artwork_id)
    assert(fake.request_count() == before_artwork_requests + 1)
    fake.resolve_success(artwork_id, {
        "artworkKey": "artwork/campaign-a",
        "pngBase64": _png_base64()
    })
    assert(artwork_events.size() == 1)
    assert(artwork_events[0].get("artworkKey") == "artwork/campaign-a")
    assert(focus_restores[0] == focus_before_artwork)
    var artwork_bytes: PackedByteArray = artwork_events[0].get("pngBytes")
    assert(artwork_bytes.slice(0, 8) == PackedByteArray([137, 80, 78, 71, 13, 10, 26, 10]))
    var cached_artwork_id: String = host.request_artwork("artwork/campaign-a")
    assert(cached_artwork_id == artwork_id)
    assert(fake.request_count() == before_artwork_requests + 1)
    assert(artwork_events.size() == 2)

    var old_room_pending_id := host.request_artwork("artwork/pending-room")
    var switch_room_id := host.join_room("EFG-567", "Signal Foxes")
    fake.resolve_success(switch_room_id, {
        "role": "team",
        "roomCode": "EFG-567",
        "snapshot": snapshot
    })
    var new_room_pending_id := host.request_artwork("artwork/pending-room")
    assert(new_room_pending_id != old_room_pending_id)
    var artwork_events_before_stale := artwork_events.size()
    fake.resolve_success(old_room_pending_id, {
        "artworkKey": "artwork/pending-room",
        "pngBase64": _png_base64()
    })
    assert(artwork_events.size() == artwork_events_before_stale)
    fake.resolve_success(new_room_pending_id, {
        "artworkKey": "artwork/pending-room",
        "pngBase64": _png_base64()
    })
    assert(artwork_events.size() == artwork_events_before_stale + 1)
    var before_cross_room_artwork := fake.request_count()
    var cross_room_artwork_id := host.request_artwork("artwork/campaign-a")
    assert(fake.request_count() == before_cross_room_artwork + 1)
    fake.resolve_success(cross_room_artwork_id, {
        "artworkKey": "artwork/campaign-a",
        "pngBase64": _png_base64()
    })

    var failed_artwork_id := host.request_artwork("artwork/retry-me")
    fake.reject_request(failed_artwork_id, "Synthetic artwork failure")
    var retried_artwork_id := host.request_artwork("artwork/retry-me")
    assert(retried_artwork_id != failed_artwork_id)
    fake.resolve_success(retried_artwork_id, {
        "artworkKey": "artwork/retry-me",
        "pngBase64": _png_base64()
    })

    for index in 17:
        var cache_key := "artwork/cache-%d" % index
        var cache_id := host.request_artwork(cache_key)
        fake.resolve_success(cache_id, {
            "artworkKey": cache_key,
            "pngBase64": _png_base64()
        })
    var before_evicted_retry := fake.request_count()
    var evicted_retry_id := host.request_artwork("artwork/cache-0")
    assert(fake.request_count() == before_evicted_retry + 1)
    fake.resolve_success(evicted_retry_id, {
        "artworkKey": "artwork/cache-0",
        "pngBase64": _png_base64()
    })

    var publish_id := host.publish_campaign(_publication())
    var publish_command_id := str(fake.request_for(publish_id).get("payload").get("commandId"))
    assert(_is_uuid(publish_command_id))
    var publish_snapshot := snapshot.duplicate(true)
    publish_snapshot["revision"] = 2.0
    publish_snapshot["campaigns"] = [{"id": "campaign-a", "submissionVersion": 1.0, "status": "pending"}]
    fake.resolve_success(publish_id, {
        "replayed": false,
        "campaignId": "campaign-a",
        "submissionVersion": 1.0,
        "postcondition": {"kind": "publish", "campaignId": "campaign-a", "submissionVersion": 1.0},
        "snapshot": publish_snapshot
    })
    assert(publications.size() == 1)

    var reveal_count_before_finish := reveals.size()
    var finish_id := host.finish()
    var finish_snapshot := snapshot.duplicate(true)
    finish_snapshot["revision"] = 3.0
    finish_snapshot["own"] = {"finished": true}
    fake.resolve_success(finish_id, {
        "replayed": false,
        "postcondition": {"kind": "finish", "finishedAt": 1000.0},
        "snapshot": finish_snapshot
    })
    assert(reveals.size() == reveal_count_before_finish)

    var review_id := host.review_campaign("campaign-a", 1, "approved")
    var review_snapshot := snapshot.duplicate(true)
    review_snapshot["revision"] = 4.0
    review_snapshot["campaigns"] = [{"id": "campaign-a", "submissionVersion": 1.0, "status": "approved"}]
    fake.resolve_success(review_id, {
        "replayed": false,
        "postcondition": {"kind": "review", "campaignId": "campaign-a", "submissionVersion": 1.0, "status": "approved"},
        "snapshot": review_snapshot
    })
    assert(controls.back().get("action") == "reviewCampaign")

    var reveal_snapshot := snapshot.duplicate(true)
    reveal_snapshot["phase"] = "reveal"
    reveal_snapshot["reveal"] = {
        "standings": [{"rank": 1.0, "teamId": "team-a", "alias": "Signal Foxes", "revenue": 8000.0, "sales": 2.0}]
    }
    var control_id := host.control("openReveal")
    reveal_snapshot["revision"] = 5.0
    fake.resolve_success(control_id, {
        "replayed": false,
        "postcondition": {"kind": "control", "action": "openReveal"},
        "snapshot": reveal_snapshot
    })
    assert(controls.back().get("action") == "openReveal")
    assert(reveals.size() == reveal_count_before_finish + 1)
    assert(reveals.back().get("standings").size() == 1)

    var remove_id := host.control("removeTeam", "team-b")
    var remove_payload: Dictionary = fake.request_for(remove_id).get("payload")
    assert(remove_payload.get("action") == "removeTeam")
    assert(remove_payload.get("teamId") == "team-b")
    assert(_is_uuid(remove_payload.get("commandId")))
    var remove_snapshot := snapshot.duplicate(true)
    remove_snapshot["revision"] = 6.0
    fake.resolve_success(remove_id, {
        "replayed": false,
        "postcondition": {"kind": "removeTeam", "teamId": "team-b"},
        "snapshot": remove_snapshot
    })
    assert(controls.back().get("action") == "removeTeam")

    var failed_id := host.control("closeMarket")
    assert(game_input.process_mode == Node.PROCESS_MODE_DISABLED)
    fake.reject_request(failed_id, "Synthetic market failure")
    assert(game_input.process_mode == Node.PROCESS_MODE_ALWAYS)
    assert(diagnostics.back().contains("TRANSPORT_ERROR"))

    host.set_transport(null)
    var unavailable_id := host.request_snapshot()
    assert(not unavailable_id.is_empty())
    assert(game_input.process_mode == Node.PROCESS_MODE_ALWAYS)
    assert(diagnostics.back().contains("MARKET_UNAVAILABLE"))

    var before_invalid_focus: int = focus_restores[0]
    assert(host.join_room("", "Alias").is_empty())
    assert(game_input.process_mode == Node.PROCESS_MODE_ALWAYS)
    assert(focus_restores[0] == before_invalid_focus + 1)
    assert(diagnostics.back().contains("INVALID_REQUEST"))

    var synchronous_fake := FakeMarketTransport.new()
    var reentrant_fake := FakeMarketTransport.new()
    var reentrant_request_id := [""]
    var reentrancy_armed := [true]
    synchronous_fake.reject_next_send_synchronously("Synchronous boundary failure")
    host.set_transport(synchronous_fake)
    host.diagnostic.connect(func(message: String) -> void:
        if reentrancy_armed[0] and message.contains("Synchronous boundary failure"):
            reentrancy_armed[0] = false
            host.set_transport(reentrant_fake)
            reentrant_request_id[0] = host.request_snapshot()
    )
    host.request_snapshot()
    assert(not String(reentrant_request_id[0]).is_empty())
    assert(game_input.process_mode == Node.PROCESS_MODE_DISABLED)
    reentrant_fake.resolve_success(String(reentrant_request_id[0]), snapshot)
    assert(game_input.process_mode == Node.PROCESS_MODE_ALWAYS)

    host.free()
    game_input.free()
    unmounted_focus_target.free()
    return true

func _durable_command_intents_retry_until_postconditions_are_observed() -> bool:
    var fake := FakeMarketTransport.new()
    var host := MarketHost.new()
    var publications: Array[Dictionary] = []
    host.set_transport(fake)
    host.campaign_published.connect(func(result: Dictionary) -> void: publications.append(result))

    var publication_a := _publication()
    var publish_a := host.publish_campaign(publication_a)
    var publish_command_a := _command_id(fake, publish_a)
    assert(_is_uuid(publish_command_a))
    fake.reject_request(publish_a, "Synthetic timeout")
    var publish_retry := host.publish_campaign(publication_a)
    assert(_command_id(fake, publish_retry) == publish_command_a)

    var publication_b := publication_a.duplicate(true)
    publication_b["metadata"]["productName"] = "Changed Bottle"
    var publish_b := host.publish_campaign(publication_b)
    var publish_command_b := _command_id(fake, publish_b)
    assert(publish_command_b != publish_command_a)

    var stale_publish_snapshot := _snapshot()
    stale_publish_snapshot["revision"] = 2.0
    stale_publish_snapshot["campaigns"] = [{"id": "campaign-a", "submissionVersion": 1.0, "status": "pending"}]
    fake.resolve_success(publish_retry, {
        "replayed": false,
        "campaignId": "campaign-a",
        "submissionVersion": 1.0,
        "postcondition": {"kind": "publish", "campaignId": "campaign-a", "submissionVersion": 1.0},
        "snapshot": stale_publish_snapshot
    })
    assert(publications.is_empty())

    var publish_snapshot := stale_publish_snapshot.duplicate(true)
    publish_snapshot["revision"] = 3.0
    publish_snapshot["campaigns"] = [{"id": "campaign-a", "submissionVersion": 2.0, "status": "pending"}]
    fake.resolve_success(publish_b, {
        "replayed": false,
        "campaignId": "campaign-a",
        "submissionVersion": 2.0,
        "postcondition": {"kind": "publish", "campaignId": "campaign-a", "submissionVersion": 2.0},
        "snapshot": publish_snapshot
    })
    assert(publications.size() == 1)
    var publish_after_observed := host.publish_campaign(publication_b)
    assert(_command_id(fake, publish_after_observed) != publish_command_b)

    var finish_a := host.finish()
    var finish_command_a := _command_id(fake, finish_a)
    fake.reject_request(finish_a, "Synthetic timeout")
    var finish_retry := host.finish()
    assert(_command_id(fake, finish_retry) == finish_command_a)
    var finish_snapshot_request := host.request_snapshot()
    var finish_snapshot := _snapshot()
    finish_snapshot["revision"] = 4.0
    finish_snapshot["own"] = {"finished": true}
    fake.resolve_success(finish_snapshot_request, finish_snapshot)
    var finish_after_observed := host.finish()
    assert(_command_id(fake, finish_after_observed) != finish_command_a)

    var review_a := host.review_campaign("campaign-a", 2, "approved")
    var review_command_a := _command_id(fake, review_a)
    assert(fake.request_for(review_a).get("payload").get("submissionVersion") == 2.0)
    fake.reject_request(review_a, "Synthetic timeout")
    var review_retry := host.review_campaign("campaign-a", 2, "approved")
    assert(_command_id(fake, review_retry) == review_command_a)
    var review_new_version := host.review_campaign("campaign-a", 3, "approved")
    var review_command_b := _command_id(fake, review_new_version)
    assert(review_command_b != review_command_a)
    assert(fake.request_for(review_new_version).get("payload").get("submissionVersion") == 3.0)
    var review_snapshot_request := host.request_snapshot()
    var review_snapshot := _snapshot()
    review_snapshot["revision"] = 5.0
    review_snapshot["phase"] = "building"
    review_snapshot["campaigns"] = [{
        "id": "campaign-a",
        "submissionVersion": 3.0,
        "status": "approved"
    }]
    fake.resolve_success(review_snapshot_request, review_snapshot)
    var review_after_observed := host.review_campaign("campaign-a", 3, "approved")
    assert(_command_id(fake, review_after_observed) != review_command_b)

    var control_a := host.control("openMarket")
    var control_command_a := _command_id(fake, control_a)
    fake.reject_request(control_a, "Synthetic timeout")
    var control_retry := host.control("openMarket")
    assert(_command_id(fake, control_retry) == control_command_a)
    var control_snapshot_request := host.request_snapshot()
    var control_snapshot := _snapshot()
    control_snapshot["revision"] = 6.0
    control_snapshot["phase"] = "market"
    fake.resolve_success(control_snapshot_request, control_snapshot)
    var control_after_observed := host.control("openMarket")
    assert(_command_id(fake, control_after_observed) != control_command_a)

    var remove_a := host.control("removeTeam", "team-b")
    var remove_command_a := _command_id(fake, remove_a)
    fake.reject_request(remove_a, "Synthetic timeout")
    var remove_retry := host.control("removeTeam", "team-b")
    assert(_command_id(fake, remove_retry) == remove_command_a)
    var remove_snapshot_request := host.request_snapshot()
    var remove_snapshot := _snapshot()
    remove_snapshot["revision"] = 7.0
    remove_snapshot["teams"] = [{"id": "team-a"}]
    fake.resolve_success(remove_snapshot_request, remove_snapshot)
    var remove_after_observed := host.control("removeTeam", "team-b")
    assert(_command_id(fake, remove_after_observed) != remove_command_a)

    var invalid_control := host.control("openReveal")
    var invalid_command := _command_id(fake, invalid_control)
    fake.resolve_raw(invalid_control, {
        "contract": "market-bridge@1",
        "requestId": invalid_control,
        "ok": false,
        "error": {"code": "INVALID_REQUEST", "message": "INVALID_REQUEST"}
    })
    var after_terminal := host.control("openReveal")
    assert(_command_id(fake, after_terminal) != invalid_command)

    host.free()
    return true

func _command_id(fake: RefCounted, request_id: String) -> String:
    var request: Dictionary = fake.call("request_for", request_id)
    var payload: Dictionary = request.get("payload", {})
    return str(payload.get("commandId", ""))

func _is_uuid(value: Variant) -> bool:
    if typeof(value) != TYPE_STRING:
        return false
    var parts := str(value).split("-")
    if parts.size() != 5:
        return false
    var expected_lengths := [8, 4, 4, 4, 12]
    for index in parts.size():
        if parts[index].length() != expected_lengths[index]:
            return false
    var compact := str(value).replace("-", "")
    if compact.length() != 32:
        return false
    for character in compact:
        if not "0123456789abcdef".contains(character):
            return false
    return compact[12] == "4" and "89ab".contains(compact[16])

func _resume_distinguishes_terminal_transient_and_current_success() -> bool:
    var fake := FakeMarketTransport.new()
    fake.auto_resume_none = false
    var host := MarketHost.new()
    var resumed: Array[Variant] = []
    var resume_failures: Array[Dictionary] = []
    var joined: Array[Dictionary] = []
    var snapshots: Array[Dictionary] = []
    var diagnostics: Array[String] = []
    host.set_transport(fake)
    host.room_resumed.connect(func(value: Variant) -> void: resumed.append(value))
    host.room_resume_failed.connect(func(code: String, message: String) -> void:
        resume_failures.append({"code": code, "message": message})
    )
    host.room_joined.connect(func(value: Dictionary) -> void: joined.append(value))
    host.snapshot_received.connect(func(value: Dictionary) -> void: snapshots.append(value))
    host.diagnostic.connect(func(value: String) -> void: diagnostics.append(value))

    var terminal_id: String = host.resume_session()
    assert(fake.request_for(terminal_id).get("method") == "resumeSession")
    assert(fake.request_for(terminal_id).get("payload") == null)
    fake.resolve_success(terminal_id, null)
    assert(resumed == [null])
    assert(snapshots.is_empty())

    var active_id: String = host.resume_session()
    var active_snapshot := _snapshot()
    active_snapshot["revision"] = 5.0
    fake.resolve_success(active_id, {
        "role": "team",
        "roomCode": "ABC-234",
        "snapshot": active_snapshot
    })
    assert(resumed.size() == 2)
    assert(resumed.back().get("role") == "team")
    assert(snapshots == [active_snapshot])
    var regressing_snapshot_id := host.request_snapshot()
    var regressing_snapshot := active_snapshot.duplicate(true)
    regressing_snapshot["revision"] = 4.0
    fake.resolve_success(regressing_snapshot_id, regressing_snapshot)
    assert(snapshots == [active_snapshot])

    var stale_resume_id: String = host.resume_session()
    var join_id: String = host.join_room("BBB-333", "Current Pair")
    fake.resolve_success(stale_resume_id, null)
    assert(resumed.size() == 2)
    var joined_snapshot := _snapshot()
    joined_snapshot["revision"] = 1.0
    fake.resolve_success(join_id, {
        "role": "team",
        "roomCode": "BBB-333",
        "snapshot": joined_snapshot
    })
    assert(joined.size() == 1)

    var transient_id: String = host.resume_session()
    fake.reject_request(transient_id, "Synthetic resume timeout")
    assert(resume_failures.size() == 1)
    assert(resume_failures[0].get("code") == "TRANSPORT_ERROR")
    assert(diagnostics.back().contains("TRANSPORT_ERROR"))

    host.free()
    return true

func _room_intent_supersession_is_monotonic() -> bool:
    var fake := FakeMarketTransport.new()
    var host := MarketHost.new()
    host.set_transport(fake)
    var rooms_created: Array[Dictionary] = []
    var rooms_joined: Array[Dictionary] = []
    var snapshots: Array[Dictionary] = []
    var diagnostics: Array[String] = []
    host.room_created.connect(func(value: Dictionary) -> void: rooms_created.append(value))
    host.room_joined.connect(func(value: Dictionary) -> void: rooms_joined.append(value))
    host.snapshot_received.connect(func(value: Dictionary) -> void: snapshots.append(value))
    host.diagnostic.connect(func(value: String) -> void: diagnostics.append(value))

    var join_a := host.join_room("AAA-222", "Alpha Pair")
    var join_b := host.join_room("BBB-333", "Beta Pair")
    var snapshot_a := _snapshot()
    snapshot_a["roomCode"] = "AAA-222"
    var snapshot_b := _snapshot()
    snapshot_b["roomCode"] = "BBB-333"
    fake.resolve_success(join_a, {
        "role": "team",
        "roomCode": "AAA-222",
        "snapshot": snapshot_a
    })
    assert(rooms_joined.is_empty())
    assert(snapshots.is_empty())
    fake.resolve_success(join_b, {
        "role": "team",
        "roomCode": "BBB-333",
        "snapshot": snapshot_b
    })
    assert(rooms_joined.size() == 1)
    assert(String(rooms_joined[0].get("roomCode")) == "BBB-333")
    assert(snapshots == [snapshot_b])

    var stale_create := host.create_room(10000, "teacher-code-old", 15)
    var replacement_join := host.join_room("CCC-444", "Current Pair")
    var current_snapshot := _snapshot()
    current_snapshot["roomCode"] = "CCC-444"
    fake.resolve_success(replacement_join, {
        "role": "team",
        "roomCode": "CCC-444",
        "snapshot": current_snapshot
    })
    var current_snapshot_request := host.request_snapshot()
    fake.resolve_success(stale_create, {
        "role": "teacher",
        "roomCode": "DDD-555",
        "snapshot": snapshot_a
    })
    assert(rooms_created.is_empty())
    assert(rooms_joined.size() == 2)
    assert(snapshots.size() == 2)
    assert(snapshots.back() == current_snapshot)
    var refreshed_current_snapshot := current_snapshot.duplicate(true)
    refreshed_current_snapshot["revision"] = 2.0
    fake.resolve_success(current_snapshot_request, refreshed_current_snapshot)
    assert(snapshots.size() == 3)
    assert(snapshots.back() == refreshed_current_snapshot)

    var abandoned_join := host.join_room("EEE-666", "Abandoned Pair")
    host.invalidate_room_intent()
    fake.reject_request(abandoned_join, "Late transport failure")
    assert(diagnostics.is_empty())
    var current_join := host.join_room("FFF-777", "Current Pair")
    fake.reject_request(current_join, "Current transport failure")
    assert(diagnostics.size() == 1)
    assert(diagnostics[0].contains("TRANSPORT_ERROR"))

    host.free()
    return true

func _snapshot_requires_an_integer_revision() -> bool:
    var fake := FakeMarketTransport.new()
    var host := MarketHost.new()
    var snapshots: Array[Dictionary] = []
    host.set_transport(fake)
    host.snapshot_received.connect(func(value: Dictionary) -> void: snapshots.append(value))

    var join_id := host.join_room("AAA-222", "Alpha Pair")
    var snapshot_without_revision := _snapshot()
    snapshot_without_revision.erase("revision")
    fake.resolve_success(join_id, {
        "role": "team",
        "roomCode": "AAA-222",
        "snapshot": snapshot_without_revision
    })
    assert(snapshots.is_empty())

    host.free()
    return true

func _snapshot_revisions_do_not_regress_within_a_room_generation() -> bool:
    var fake := FakeMarketTransport.new()
    var host := MarketHost.new()
    var snapshots: Array[Dictionary] = []
    host.set_transport(fake)
    host.snapshot_received.connect(func(value: Dictionary) -> void: snapshots.append(value))

    var join_id := host.join_room("AAA-222", "Alpha Pair")
    var joined_snapshot := _snapshot()
    joined_snapshot["revision"] = 5.0
    fake.resolve_success(join_id, {
        "role": "team",
        "roomCode": "AAA-222",
        "snapshot": joined_snapshot
    })
    assert(snapshots == [joined_snapshot])

    var newest_snapshot_request := host.request_snapshot()
    var delayed_snapshot_request := host.request_snapshot()
    var newest_snapshot := joined_snapshot.duplicate(true)
    newest_snapshot["revision"] = 8.0
    fake.resolve_success(newest_snapshot_request, newest_snapshot)
    assert(snapshots.back() == newest_snapshot)
    var delayed_snapshot := joined_snapshot.duplicate(true)
    delayed_snapshot["revision"] = 7.0
    fake.resolve_success(delayed_snapshot_request, delayed_snapshot)
    assert(snapshots.size() == 2)

    var same_revision_request := host.request_snapshot()
    var same_revision_snapshot := newest_snapshot.duplicate(true)
    same_revision_snapshot["phase"] = "reveal"
    fake.resolve_success(same_revision_request, same_revision_snapshot)
    assert(snapshots.size() == 3)
    assert(snapshots.back() == same_revision_snapshot)

    var purchase_id := host.purchase("campaign-a", "purchase-a")
    var mutation_snapshot := same_revision_snapshot.duplicate(true)
    mutation_snapshot["revision"] = 9.0
    fake.resolve_success(purchase_id, {"receiptId": "receipt-a", "snapshot": mutation_snapshot})
    assert(snapshots.size() == 4)
    assert(snapshots.back() == mutation_snapshot)

    var stale_mutation_poll := host.request_snapshot()
    fake.resolve_success(stale_mutation_poll, same_revision_snapshot)
    assert(snapshots.size() == 4)

    var before_disconnect_poll := host.request_snapshot()
    var before_disconnect_purchase := host.purchase("campaign-a", "purchase-b")
    host.set_transport(null)
    host.set_transport(fake)
    var disconnected_snapshot := mutation_snapshot.duplicate(true)
    disconnected_snapshot["revision"] = 10.0
    fake.resolve_success(before_disconnect_poll, disconnected_snapshot)
    var disconnected_mutation_snapshot := mutation_snapshot.duplicate(true)
    disconnected_mutation_snapshot["revision"] = 11.0
    fake.resolve_success(before_disconnect_purchase, {
        "receiptId": "receipt-b",
        "snapshot": disconnected_mutation_snapshot
    })
    assert(snapshots.size() == 4)

    var reconnect_snapshot_request := host.request_snapshot()
    var reconnect_snapshot := _snapshot()
    reconnect_snapshot["roomCode"] = "BBB-333"
    reconnect_snapshot["revision"] = 1.0
    fake.resolve_success(reconnect_snapshot_request, reconnect_snapshot)
    assert(snapshots.size() == 5)
    assert(snapshots.back() == reconnect_snapshot)

    host.free()
    return true

func _snapshot() -> Dictionary:
    return {
        "roomCode": "ABC-234",
        "phase": "market",
        "revision": 1.0,
        "teams": [],
        "campaigns": []
    }

func _publication() -> Dictionary:
    return {
        "contract": "published-campaign@1",
        "documentId": "campaign-document",
        "revision": 1.0,
        "pngBase64": _png_base64(),
        "metadata": {
            "productName": "Orbit Bottle",
            "priceCents": 2499.0,
            "brief": {},
            "evidence": {},
            "assetReferences": []
        }
    }

func _png_base64() -> String:
    if not _cached_png_base64.is_empty():
        return _cached_png_base64
    var image := Image.create_empty(1600, 900, false, Image.FORMAT_RGBA8)
    image.fill(Color(0.16, 0.22, 0.32, 1.0))
    _cached_png_base64 = Marshalls.raw_to_base64(image.save_png_to_buffer())
    assert(not _cached_png_base64.is_empty())
    return _cached_png_base64
