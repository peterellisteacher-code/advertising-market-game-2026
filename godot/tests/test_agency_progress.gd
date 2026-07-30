extends RefCounted
class_name AdMarketTestAgencyProgress

const AgencyProgress = preload("res://src/agency/agency_progress.gd")

func run() -> bool:
    assert(_new_progress_round_trips_completed_evidence())
    assert(_json_round_trip_preserves_integer_counters())
    assert(_invalid_role_is_rejected_atomically())
    assert(_legacy_sell_pitch_maps_to_message_objective())
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
