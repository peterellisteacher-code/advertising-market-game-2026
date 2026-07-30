extends RefCounted
class_name AdMarketTestRunProgressStore

const WebRunProgressStore = preload("res://src/game/web_run_progress_store.gd")
const AgencyProgress = preload("res://src/agency/agency_progress.gd")

func run() -> bool:
    var envelope := _envelope()
    assert(WebRunProgressStore.validated_envelope(envelope) == envelope)

    var wrong_contract := envelope.duplicate(true)
    wrong_contract["contract"] = "live-run-progress@999"
    assert(WebRunProgressStore.validated_envelope(wrong_contract).is_empty())

    var expanded := envelope.duplicate(true)
    expanded["unexpected"] = true
    assert(WebRunProgressStore.validated_envelope(expanded).is_empty())

    var oversized := envelope.duplicate(true)
    oversized["roomId"] = "r".repeat(WebRunProgressStore.MAX_PROGRESS_BYTES)
    assert(WebRunProgressStore.validated_envelope(oversized).is_empty())
    return true

func _envelope() -> Dictionary:
    return {
        "contract": "live-run-progress@1",
        "roomCode": "ABC-234",
        "roomId": "room-a",
        "teamId": "team-a",
        "sessionId": "room-session-team-a",
        "documentId": "room-room-a-team-team-a-campaign",
        "documentRevision": 3,
        "pitch": {
            "contract": "pitch-run@2",
            "phase": "sell",
            "teamAlias": "Signal Foxes",
            "sessionId": "room-session-team-a",
            "teamId": "team-a",
            "readyLevels": ["invent"],
            "agency": AgencyProgress.from_legacy_pitch("sell", ["invent"])
        },
        "levelLocked": false
    }
