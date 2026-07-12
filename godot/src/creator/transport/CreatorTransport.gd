extends RefCounted

func set_event_callback(_callback: Callable) -> void:
    push_error("CreatorTransport.set_event_callback must be implemented")

func open(_payload_json: String) -> String:
    push_error("CreatorTransport.open must be implemented")
    return ""

func close() -> String:
    push_error("CreatorTransport.close must be implemented")
    return ""

func publish_probe() -> String:
    push_error("CreatorTransport.publish_probe must be implemented")
    return ""
