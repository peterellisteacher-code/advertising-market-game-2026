extends RefCounted

var _last_payload := ""

func update(
    eyebrow: String,
    heading: String,
    current_instruction: String,
    completion_status: String,
    focused_control: String,
    keyboard_hint: String
) -> void:
    var status_parts := PackedStringArray()
    for part in [
        completion_status,
        ("Selected control: %s." % focused_control)
        if not focused_control.strip_edges().is_empty()
        else "",
        keyboard_hint
    ]:
        var cleaned := String(part).strip_edges()
        if not cleaned.is_empty():
            status_parts.append(cleaned)
    var composed_status := " ".join(status_parts)
    var payload := JSON.stringify({
        "eyebrow": eyebrow,
        "heading": heading,
        "clue": current_instruction,
        "status": composed_status,
        "currentInstruction": current_instruction,
        "completionStatus": completion_status,
        "focusedControl": focused_control,
        "keyboardHint": keyboard_hint
    })
    if payload == _last_payload:
        return
    _last_payload = payload
    if not OS.has_feature("web"):
        return
    var bridge: JavaScriptObject = JavaScriptBridge.get_interface("AdMarketGameA11y")
    if bridge != null:
        bridge.update(payload)
