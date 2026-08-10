extends RefCounted
class_name AdMarketTestAgencyProgress

const AgencyProgress = preload("res://src/agency/agency_progress.gd")

func run() -> bool:
    assert(_new_progress_round_trips_completed_evidence())
    assert(_json_round_trip_preserves_integer_counters())
    assert(_invalid_role_is_rejected_atomically())
    assert(_legacy_sell_pitch_maps_to_message_objective())
    assert(_canonical_completion_sets_next_objective())
    assert(_out_of_order_completions_keep_snapshot_canonical())
    return true

func _new_progress_round_trips_completed_evidence() -> bool:
    var progress := AgencyProgress.new()
    assert(progress.begin())
    assert(progress.current_objective_id == "meet-client")
    assert(progress.travel_to("strategy-room"))
    assert(progress.handoff_to("strategist"))
    assert(progress.complete_mission("audience-brief", {
        "decision": "independence",
        "effect": "The offer supports the audience's wish to control the hour after school."
    }))

    var snapshot: Dictionary = progress.snapshot()
    assert(snapshot.get("contract") == "agency-run@1")
    var restored := AgencyProgress.new()
    assert(restored.restore_snapshot(snapshot))
    assert(restored.snapshot() == snapshot)
    return true

func _json_round_trip_preserves_integer_counters() -> bool:
    var progress := AgencyProgress.new()
    assert(progress.begin())
    assert(progress.handoff_to("strategist"))
    var decoded: Variant = JSON.parse_string(JSON.stringify(progress.snapshot()))
    assert(typeof(decoded) == TYPE_DICTIONARY)
    var restored := AgencyProgress.new()
    assert(restored.restore_snapshot(decoded))
    assert(restored.handoff_count == 1)
    return true

func _invalid_role_is_rejected_atomically() -> bool:
    var progress := AgencyProgress.new()
    assert(progress.begin())
    var before: Dictionary = progress.snapshot()
    var invalid: Dictionary = before.duplicate(true)
    invalid["activeRole"] = "chief-disruption-officer"
    assert(not progress.restore_snapshot(invalid))
    assert(progress.snapshot() == before)
    return true

func _legacy_sell_pitch_maps_to_message_objective() -> bool:
    var migrated: Dictionary = AgencyProgress.from_legacy_pitch("sell", ["invent"])
    assert(migrated.get("currentObjectiveId") == "shape-message")
    assert(Array(migrated.get("completedMissionIds")).has("audience-brief"))
    return true

func _canonical_completion_sets_next_objective() -> bool:
    var progress := AgencyProgress.new()
    assert(progress.begin())
    var expected_after: Array[Dictionary] = [
        {"mission": "audience-brief", "objective": "build-product"},
        {"mission": "salience", "objective": "direct-attention"},
        {"mission": "reading-path", "objective": "set-campaign-tone"},
        {"mission": "contrast", "objective": "focus-image"},
        {"mission": "framing", "objective": "shape-message"},
        {"mission": "aida", "objective": "prove-value"},
        {"mission": "claim-proof", "objective": "polish-campaign"},
    ]
    for step: Dictionary in expected_after:
        var mission_id := String(step.get("mission"))
        assert(progress.complete_mission(mission_id, {
            "decision": "decision-%s" % mission_id,
            "effect": "This recorded decision changes the audience's response to the advertisement.",
        }))
        assert(progress.current_objective_id == String(step.get("objective")))
    return true

func _out_of_order_completions_keep_snapshot_canonical() -> bool:
    var progress := AgencyProgress.new()
    assert(progress.begin())
    var completion_order: Array[String] = [
        "audience-brief",
        "framing",
        "aida",
        "claim-proof",
        "salience",
        "reading-path",
        "contrast",
    ]
    for mission_id: String in completion_order:
        assert(progress.complete_mission(mission_id, {
            "decision": "decision-%s" % mission_id,
            "effect": "This recorded decision changes the audience's response to the advertisement.",
        }))
    for sidequest_id: String in [
        "thirty-second-rescue",
        "crop-lab",
        "colour-clinic",
        "headline-surgery",
        "media-match",
    ]:
        assert(progress.complete_sidequest(sidequest_id))

    var snapshot: Dictionary = progress.snapshot()
    assert(snapshot.get("completedMissionIds") == AgencyProgress.REQUIRED_MISSIONS)
    assert(snapshot.get("completedSidequestIds") == AgencyProgress.SIDEQUESTS)
    var restored := AgencyProgress.new()
    assert(restored.restore_snapshot(snapshot))
    assert(restored.snapshot() == snapshot)
    return true
