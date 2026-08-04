extends RefCounted
class_name AdMarketAgencyProgress

const CONTRACT := "agency-run@1"
const MAX_SNAPSHOT_BYTES := 16384
const MAX_EVIDENCE_TEXT_LENGTH := 400
const ROLES := ["art-director", "strategist"]
const STATIONS := [
    "reception",
    "client-briefing",
    "strategy-room",
    "art-studio",
    "copy-room",
    "production-studio",
    "media-desk",
    "sound-booth",
    "pitch-theatre"
]
const REQUIRED_MISSIONS := [
    "audience-brief",
    "salience",
    "reading-path",
    "contrast",
    "framing",
    "aida",
    "claim-proof"
]
const SIDEQUESTS := [
    "thirty-second-rescue",
    "colour-clinic",
    "crop-lab",
    "headline-surgery",
    "media-match"
]
const SNAPSHOT_KEYS := [
    "contract",
    "currentObjectiveId",
    "currentStationId",
    "activeRole",
    "completedMissionIds",
    "completedSidequestIds",
    "evidenceByMission",
    "handoffCount",
    "guideTucked",
    "orientationAcknowledged",
    "audioSettings",
    "pitchSettings",
    "started"
]
const OBJECTIVE_AFTER_MISSION := {
    "audience-brief": "build-product",
    "salience": "direct-attention",
    "reading-path": "shape-message",
    "contrast": "set-campaign-tone",
    "framing": "focus-image",
    "aida": "prove-value",
    "claim-proof": "polish-campaign"
}
const LEGACY_OBJECTIVE_BY_PHASE := {
    "invent": "build-product",
    "sell": "shape-message",
    "irresistible": "polish-campaign",
    "publish-check": "prepare-pitch"
}
const LEGACY_STATION_BY_PHASE := {
    "invent": "art-studio",
    "sell": "strategy-room",
    "irresistible": "production-studio",
    "publish-check": "pitch-theatre"
}
const LEGACY_MISSIONS_BEFORE_PHASE := {
    "invent": [],
    "sell": ["audience-brief", "salience", "reading-path"],
    "irresistible": [
        "audience-brief",
        "salience",
        "reading-path",
        "contrast",
        "framing",
        "aida"
    ],
    "publish-check": [
        "audience-brief",
        "salience",
        "reading-path",
        "contrast",
        "framing",
        "aida",
        "claim-proof"
    ]
}

var current_objective_id: String = "meet-client"
var current_station_id: String = "reception"
var active_role: String = "art-director"
var completed_mission_ids: Array[String] = []
var completed_sidequest_ids: Array[String] = []
var evidence_by_mission: Dictionary = {}
var handoff_count: int = 0
var guide_tucked: bool = false
var orientation_acknowledged: bool = false
var audio_settings: Dictionary = {
    "enabled": true,
    "musicEnabled": true,
    "sfxEnabled": true,
    "masterVolume": 0.7
}
var pitch_settings: Dictionary = {
    "formatId": "billboard",
    "animationId": "reveal"
}
var started: bool = false
var last_error: String = ""

func begin() -> bool:
    if started:
        return _fail("The agency work has already started")
    started = true
    return _succeed()

func travel_to(station_id: String) -> bool:
    if not started:
        return _fail("Start the agency work before travelling")
    if not STATIONS.has(station_id):
        return _fail("That agency room is unavailable")
    current_station_id = station_id
    return _succeed()

func handoff_to(role: String) -> bool:
    if not started:
        return _fail("Start the agency work before changing roles")
    if not ROLES.has(role):
        return _fail("Choose Art Director or Strategist")
    if active_role == role:
        return _fail("That partner already has control")
    active_role = role
    handoff_count += 1
    return _succeed()

func complete_mission(mission_id: String, evidence: Dictionary) -> bool:
    if not started:
        return _fail("Start the agency work before completing a task")
    if not REQUIRED_MISSIONS.has(mission_id):
        return _fail("That required task is unavailable")
    if completed_mission_ids.has(mission_id):
        return _fail("That required task is already complete")
    if not _valid_evidence_record(evidence):
        return _fail("Task evidence must include a decision and an audience effect")
    completed_mission_ids.append(mission_id)
    evidence_by_mission[mission_id] = evidence.duplicate(true)
    current_objective_id = String(OBJECTIVE_AFTER_MISSION.get(
        mission_id,
        current_objective_id
    ))
    return _succeed()

func complete_sidequest(sidequest_id: String) -> bool:
    if not started:
        return _fail("Start the agency work before completing optional practice")
    if not SIDEQUESTS.has(sidequest_id):
        return _fail("That optional practice is unavailable")
    if completed_sidequest_ids.has(sidequest_id):
        return _fail("That optional practice is already complete")
    completed_sidequest_ids.append(sidequest_id)
    return _succeed()

func snapshot() -> Dictionary:
    return {
        "contract": CONTRACT,
        "currentObjectiveId": current_objective_id,
        "currentStationId": current_station_id,
        "activeRole": active_role,
        "completedMissionIds": completed_mission_ids.duplicate(),
        "completedSidequestIds": completed_sidequest_ids.duplicate(),
        "evidenceByMission": evidence_by_mission.duplicate(true),
        "handoffCount": handoff_count,
        "guideTucked": guide_tucked,
        "orientationAcknowledged": orientation_acknowledged,
        "audioSettings": audio_settings.duplicate(true),
        "pitchSettings": pitch_settings.duplicate(true),
        "started": started
    }

func restore_snapshot(value: Variant) -> bool:
    var validated := _validated_snapshot(value)
    if validated.is_empty():
        return _fail("Saved agency progress is invalid")

    current_objective_id = String(validated.get("currentObjectiveId"))
    current_station_id = String(validated.get("currentStationId"))
    active_role = String(validated.get("activeRole"))
    completed_mission_ids.assign(validated.get("completedMissionIds"))
    completed_sidequest_ids.assign(validated.get("completedSidequestIds"))
    evidence_by_mission = Dictionary(validated.get("evidenceByMission")).duplicate(true)
    handoff_count = int(validated.get("handoffCount"))
    guide_tucked = bool(validated.get("guideTucked"))
    orientation_acknowledged = bool(validated.get("orientationAcknowledged"))
    audio_settings = Dictionary(validated.get("audioSettings")).duplicate(true)
    pitch_settings = Dictionary(validated.get("pitchSettings")).duplicate(true)
    started = bool(validated.get("started"))
    return _succeed()

static func from_legacy_pitch(phase: String, ready_levels: Array) -> Dictionary:
    if not LEGACY_OBJECTIVE_BY_PHASE.has(phase):
        return {}
    var progress := new()
    progress.started = true
    progress.current_objective_id = String(LEGACY_OBJECTIVE_BY_PHASE.get(phase))
    progress.current_station_id = String(LEGACY_STATION_BY_PHASE.get(phase))
    progress.completed_mission_ids.assign(LEGACY_MISSIONS_BEFORE_PHASE.get(phase, []))

    var phase_index := ["invent", "sell", "irresistible"].find(phase)
    if phase_index >= 0 and ready_levels.has(phase):
        var through_current: Array[String] = []
        match phase:
            "invent":
                through_current.assign(["audience-brief", "salience", "reading-path"])
            "sell":
                through_current.assign([
                    "audience-brief",
                    "salience",
                    "reading-path",
                    "contrast",
                    "framing",
                    "aida"
                ])
            "irresistible":
                through_current.assign(REQUIRED_MISSIONS)
        progress.completed_mission_ids = through_current
    return progress.snapshot()

func _validated_snapshot(value: Variant) -> Dictionary:
    if typeof(value) != TYPE_DICTIONARY:
        return {}
    var candidate: Dictionary = value
    if candidate.size() != SNAPSHOT_KEYS.size():
        return {}
    for key in SNAPSHOT_KEYS:
        if not candidate.has(key):
            return {}
    if candidate.get("contract") != CONTRACT:
        return {}
    if not _valid_text(candidate.get("currentObjectiveId"), 1, 80):
        return {}
    if typeof(candidate.get("currentStationId")) != TYPE_STRING:
        return {}
    if not STATIONS.has(String(candidate.get("currentStationId"))):
        return {}
    if typeof(candidate.get("activeRole")) != TYPE_STRING:
        return {}
    if not ROLES.has(String(candidate.get("activeRole"))):
        return {}
    if not _valid_ordered_subset(candidate.get("completedMissionIds"), REQUIRED_MISSIONS):
        return {}
    if not _valid_ordered_subset(candidate.get("completedSidequestIds"), SIDEQUESTS):
        return {}
    if not _valid_evidence_map(
        candidate.get("evidenceByMission"),
        candidate.get("completedMissionIds")
    ):
        return {}
    var handoff_value: Variant = candidate.get("handoffCount")
    if typeof(handoff_value) != TYPE_INT and typeof(handoff_value) != TYPE_FLOAT:
        return {}
    var handoff_number := float(handoff_value)
    if (
        not is_finite(handoff_number)
        or handoff_number != floor(handoff_number)
        or handoff_number < 0.0
        or handoff_number > 10000.0
    ):
        return {}
    for boolean_key in ["guideTucked", "orientationAcknowledged", "started"]:
        if typeof(candidate.get(boolean_key)) != TYPE_BOOL:
            return {}
    if not _valid_audio_settings(candidate.get("audioSettings")):
        return {}
    if not _valid_pitch_settings(candidate.get("pitchSettings")):
        return {}
    if JSON.stringify(candidate).to_utf8_buffer().size() > MAX_SNAPSHOT_BYTES:
        return {}
    return candidate.duplicate(true)

func _valid_ordered_subset(value: Variant, allowed: Array) -> bool:
    if typeof(value) != TYPE_ARRAY:
        return false
    var items: Array = value
    if items.size() > allowed.size():
        return false
    var last_index := -1
    for item in items:
        if typeof(item) != TYPE_STRING:
            return false
        var item_index := allowed.find(String(item))
        if item_index <= last_index:
            return false
        last_index = item_index
    return true

func _valid_evidence_map(value: Variant, completed_value: Variant) -> bool:
    if typeof(value) != TYPE_DICTIONARY or typeof(completed_value) != TYPE_ARRAY:
        return false
    var evidence_map: Dictionary = value
    var completed: Array = completed_value
    for mission_id in evidence_map:
        if typeof(mission_id) != TYPE_STRING or not completed.has(mission_id):
            return false
        if typeof(evidence_map.get(mission_id)) != TYPE_DICTIONARY:
            return false
        if not _valid_evidence_record(Dictionary(evidence_map.get(mission_id))):
            return false
    return true

func _valid_evidence_record(value: Dictionary) -> bool:
    if value.size() != 2 or not value.has("decision") or not value.has("effect"):
        return false
    return (
        _valid_text(value.get("decision"), 1, MAX_EVIDENCE_TEXT_LENGTH)
        and _valid_text(value.get("effect"), 30, MAX_EVIDENCE_TEXT_LENGTH)
    )

func _valid_audio_settings(value: Variant) -> bool:
    if typeof(value) != TYPE_DICTIONARY:
        return false
    var settings: Dictionary = value
    var keys := ["enabled", "musicEnabled", "sfxEnabled", "masterVolume"]
    if settings.size() != keys.size():
        return false
    for key in keys:
        if not settings.has(key):
            return false
    for key in ["enabled", "musicEnabled", "sfxEnabled"]:
        if typeof(settings.get(key)) != TYPE_BOOL:
            return false
    var volume_value: Variant = settings.get("masterVolume")
    if typeof(volume_value) != TYPE_FLOAT and typeof(volume_value) != TYPE_INT:
        return false
    var volume := float(volume_value)
    return is_finite(volume) and volume >= 0.0 and volume <= 1.0

func _valid_pitch_settings(value: Variant) -> bool:
    if typeof(value) != TYPE_DICTIONARY:
        return false
    var settings: Dictionary = value
    if settings.size() != 2 or not settings.has("formatId") or not settings.has("animationId"):
        return false
    if typeof(settings.get("formatId")) != TYPE_STRING:
        return false
    if typeof(settings.get("animationId")) != TYPE_STRING:
        return false
    return (
        ["billboard", "magazine", "vertical-screen"].has(String(settings.get("formatId")))
        and ["immediate", "reveal", "slide", "spotlight", "sequence"].has(
            String(settings.get("animationId"))
        )
    )

func _valid_text(value: Variant, minimum: int, maximum: int) -> bool:
    if typeof(value) != TYPE_STRING:
        return false
    var text := String(value)
    return (
        text == text.strip_edges()
        and text.length() >= minimum
        and text.length() <= maximum
    )

func _fail(message: String) -> bool:
    last_error = message
    return false

func _succeed() -> bool:
    last_error = ""
    return true
