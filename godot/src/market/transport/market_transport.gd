extends RefCounted
class_name AdMarketMarketTransport

func send(_request_json: String, _resolve: Callable, reject: Callable) -> void:
    reject.call("Live Market transport is unavailable")
