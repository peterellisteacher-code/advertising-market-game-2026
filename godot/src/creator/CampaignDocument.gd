extends RefCounted

const SCHEMA_VERSION := 1
const CANVAS_WIDTH := 960
const CANVAS_HEIGHT := 540

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
        if str(document.get("roomId", "")).is_empty() or str(document.get("teamId", "")).is_empty():
            return _invalid("Room campaign documents require roomId and teamId")
    if typeof(document.get("revision")) != TYPE_INT or int(document.get("revision")) < 0:
        return _invalid("Campaign document revision must be a non-negative integer")

    var canvas: Variant = document.get("canvas")
    if typeof(canvas) != TYPE_DICTIONARY:
        return _invalid("Campaign document canvas must be a dictionary")
    if canvas.get("width") != CANVAS_WIDTH or canvas.get("height") != CANVAS_HEIGHT:
        return _invalid("Campaign document canvas must be 960 by 540")
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
    return {"ok": true, "value": document.duplicate(true)}

static func _invalid(message: String) -> Dictionary:
    return {"ok": false, "message": message}
