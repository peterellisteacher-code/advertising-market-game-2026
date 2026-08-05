extends RefCounted
class_name AdMarketGameAccessibilityMirror

signal reduced_motion_changed(enabled: bool)

var _last_payload: String = ""
var _reduced_motion_enabled: bool = false
var _reduced_motion_callback: JavaScriptObject

func bind_reduced_motion() -> void:
    if not OS.has_feature("web"):
        return
    var bridge: JavaScriptObject = JavaScriptBridge.get_interface("AdMarketGameA11y")
    if bridge == null:
        return
    _set_reduced_motion_enabled(bool(bridge.reducedMotion()))
    if _reduced_motion_callback == null:
        _reduced_motion_callback = JavaScriptBridge.create_callback(
            func(arguments: Array) -> void:
                if not arguments.is_empty():
                    _set_reduced_motion_enabled(bool(arguments[0]))
        )
    bridge.watchReducedMotion(_reduced_motion_callback)

func reduced_motion_enabled() -> bool:
    return _reduced_motion_enabled

func _set_reduced_motion_enabled(enabled: bool) -> void:
    if enabled == _reduced_motion_enabled:
        return
    _reduced_motion_enabled = enabled
    reduced_motion_changed.emit(enabled)

func update(
    eyebrow: String,
    heading: String,
    current_instruction: String,
    completion_status: String,
    focused_control: String,
    keyboard_hint: String
) -> void:
    var status_parts: PackedStringArray = PackedStringArray()
    for part in [
        completion_status,
        ("Selected control: %s." % focused_control)
        if not focused_control.strip_edges().is_empty()
        else "",
        keyboard_hint
    ]:
        var cleaned: String = String(part).strip_edges()
        if not cleaned.is_empty():
            status_parts.append(cleaned)
    var composed_status: String = " ".join(status_parts)
    var payload: String = JSON.stringify({
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
