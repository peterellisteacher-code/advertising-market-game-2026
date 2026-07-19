extends RefCounted

const STORAGE_KEY := "ad-market-local-progress@1"
const CONTRACT := "live-run-progress@1"
const MAX_PROGRESS_BYTES := 16384

func load() -> Dictionary:
    if not OS.has_feature("web"):
        return {}
    var storage: JavaScriptObject = JavaScriptBridge.get_interface("localStorage")
    if storage == null:
        return {}
    var raw: Variant = storage.getItem(STORAGE_KEY)
    if typeof(raw) != TYPE_STRING:
        return {}
    var encoded := String(raw)
    if encoded.is_empty() or encoded.to_utf8_buffer().size() > MAX_PROGRESS_BYTES:
        return {}
    var decoded: Variant = JSON.parse_string(encoded)
    return validated_envelope(decoded)

func save(value: Dictionary) -> bool:
    var validated := validated_envelope(value)
    if validated.is_empty():
        return false
    var encoded := JSON.stringify(validated)
    if not OS.has_feature("web"):
        return false
    var storage: JavaScriptObject = JavaScriptBridge.get_interface("localStorage")
    if storage == null:
        return false
    storage.setItem(STORAGE_KEY, encoded)
    return true

static func validated_envelope(value: Variant) -> Dictionary:
    if typeof(value) != TYPE_DICTIONARY:
        return {}
    var envelope: Dictionary = value
    var keys := [
        "contract", "roomCode", "roomId", "teamId", "sessionId",
        "documentId", "documentRevision", "pitch", "levelLocked"
    ]
    if envelope.size() != keys.size():
        return {}
    for key in keys:
        if not envelope.has(key):
            return {}
    if envelope.get("contract") != CONTRACT:
        return {}
    for key in ["roomCode", "roomId", "teamId", "sessionId", "documentId"]:
        if typeof(envelope.get(key)) != TYPE_STRING or String(envelope.get(key)).is_empty():
            return {}
    if not _is_nonnegative_integer_number(envelope.get("documentRevision")):
        return {}
    if typeof(envelope.get("pitch")) != TYPE_DICTIONARY:
        return {}
    if typeof(envelope.get("levelLocked")) != TYPE_BOOL:
        return {}
    if JSON.stringify(envelope).to_utf8_buffer().size() > MAX_PROGRESS_BYTES:
        return {}
    return envelope.duplicate(true)

static func _is_nonnegative_integer_number(value: Variant) -> bool:
    if typeof(value) == TYPE_INT:
        return int(value) >= 0 and int(value) <= 9007199254740991
    if typeof(value) != TYPE_FLOAT:
        return false
    var number := float(value)
    return (
        is_finite(number)
        and number >= 0.0
        and number <= 9007199254740991.0
        and number == floor(number)
    )
