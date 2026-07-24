extends RefCounted

var _last_payload := ""

func update(eyebrow: String, heading: String, clue: String, status: String) -> void:
    var payload := JSON.stringify({
        "eyebrow": eyebrow,
        "heading": heading,
        "clue": clue,
        "status": status
    })
    if payload == _last_payload:
        return
    _last_payload = payload
    if not OS.has_feature("web"):
        return
    var bridge: JavaScriptObject = JavaScriptBridge.get_interface("AdMarketGameA11y")
    if bridge != null:
        bridge.update(payload)
