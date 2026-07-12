extends RefCounted

func set_close_requested_callback(_callback: Callable) -> void:
    pass

func send(_request_json: String, _resolve: Callable, reject: Callable) -> void:
    reject.call("Campaign Creator transport is unavailable")
