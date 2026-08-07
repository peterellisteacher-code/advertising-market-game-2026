extends RefCounted
class_name AdMarketCampaignDocument

const SCHEMA_VERSION := 1
const CANVAS_WIDTH := 1600
const CANVAS_HEIGHT := 900
const MAX_SAFE_INTEGER := 9007199254740991
const MAX_MISSION_EVIDENCE_ENTRIES := 24
const MISSION_EVIDENCE_KEYS := ["missionId", "title", "decisionId", "effectText"]

# This is deliberately a bridge-shape check. The TypeScript Zod schema remains
# authoritative for the complete campaign document and its nested editor data.
static func validate_bridge_shape(value: Variant) -> Dictionary:
    if typeof(value) != TYPE_DICTIONARY:
        return _invalid("Campaign document must be a dictionary")
    var document: Dictionary = value
    if document.get("schemaVersion") != SCHEMA_VERSION:
        return _invalid("Campaign document schemaVersion must be 1")
    for key in ["editorVersion", "documentId", "sessionId", "updatedAt"]:
        if typeof(document.get(key)) != TYPE_STRING or str(document.get(key)).is_empty():
            return _invalid("Campaign document %s must be a non-empty string" % key)
    var mode := str(document.get("mode", ""))
    if mode != "offline" and mode != "room":
        return _invalid("Campaign document mode must be offline or room")
    if mode == "room":
        if typeof(document.get("roomId")) != TYPE_STRING or String(document.get("roomId")).is_empty():
            return _invalid("Room campaign documents require roomId and teamId")
        if typeof(document.get("teamId")) != TYPE_STRING or String(document.get("teamId")).is_empty():
            return _invalid("Room campaign documents require roomId and teamId")
    if not is_nonnegative_integer_number(document.get("revision")):
        return _invalid("Campaign document revision must be a non-negative integer")

    var canvas: Variant = document.get("canvas")
    if typeof(canvas) != TYPE_DICTIONARY:
        return _invalid("Campaign document canvas must be a dictionary")
    if canvas.get("width") != CANVAS_WIDTH or canvas.get("height") != CANVAS_HEIGHT:
        return _invalid("Campaign document canvas must be 1600 by 900")
    if typeof(canvas.get("background")) != TYPE_STRING:
        return _invalid("Campaign document canvas background must be a string")

    for key in ["fabricState", "product", "brief", "evidence"]:
        if typeof(document.get(key)) != TYPE_DICTIONARY:
            return _invalid("Campaign document %s must be a dictionary" % key)
    for key in ["drawingLayers", "assetReferences"]:
        if typeof(document.get(key)) != TYPE_ARRAY:
            return _invalid("Campaign document %s must be an array" % key)
    var fabric_state: Dictionary = document.get("fabricState")
    if typeof(fabric_state.get("version")) != TYPE_STRING or typeof(fabric_state.get("objects")) != TYPE_ARRAY:
        return _invalid("Campaign document fabricState must include version and objects")
    var brief: Dictionary = document.get("brief")
    if brief.get("purpose") != "persuade":
        return _invalid("Campaign document purpose must be persuade")
    for slot in ["price", "attention", "interest", "desire", "action"]:
        var evidence: Dictionary = document.get("evidence")
        if typeof(evidence.get(slot)) != TYPE_ARRAY:
            return _invalid("Campaign document evidence.%s must be an array" % slot)

    if document.has("missionEvidence"):
        if not _valid_mission_evidence(document.get("missionEvidence")):
            return _invalid("Campaign document missionEvidence is invalid")

    return {"ok": true, "value": document.duplicate(true)}

static func _valid_mission_evidence(value: Variant) -> bool:
    if typeof(value) != TYPE_ARRAY:
        return false
    var entries: Array = value
    if entries.size() > MAX_MISSION_EVIDENCE_ENTRIES:
        return false
    var seen_mission_ids: Dictionary = {}
    for entry_value in entries:
        if typeof(entry_value) != TYPE_DICTIONARY:
            return false
        var entry: Dictionary = entry_value
        if entry.size() != MISSION_EVIDENCE_KEYS.size():
            return false
        for key in MISSION_EVIDENCE_KEYS:
            if not entry.has(key):
                return false
        if not _valid_mission_evidence_text(entry.get("missionId"), 1, 100):
            return false
        if not _valid_mission_evidence_text(entry.get("title"), 1, 120):
            return false
        if not _valid_mission_evidence_text(entry.get("decisionId"), 1, 100):
            return false
        if not _valid_mission_evidence_text(entry.get("effectText"), 1, 400):
            return false
        var mission_id := String(entry.get("missionId"))
        if seen_mission_ids.has(mission_id):
            return false
        seen_mission_ids[mission_id] = true
    return true

static func _valid_mission_evidence_text(value: Variant, minimum: int, maximum: int) -> bool:
    if typeof(value) != TYPE_STRING:
        return false
    var text := String(value)
    return text == text.strip_edges() and text.length() >= minimum and text.length() <= maximum

static func is_nonnegative_integer_number(value: Variant) -> bool:
    if typeof(value) == TYPE_INT:
        var integer := int(value)
        return integer >= 0 and integer <= MAX_SAFE_INTEGER
    if typeof(value) != TYPE_FLOAT:
        return false
    var number := float(value)
    return is_finite(number) and number >= 0.0 and number <= MAX_SAFE_INTEGER and number == floor(number)

static func _invalid(message: String) -> Dictionary:
    return {"ok": false, "message": message}
