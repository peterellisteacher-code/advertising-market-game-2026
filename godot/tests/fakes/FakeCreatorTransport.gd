extends "res://src/creator/transport/CreatorTransport.gd"

const CONTRACT := "creator-spike@1"

var last_method := ""
var last_payload := ""
var open_calls := 0
var event_callback: Callable

func set_event_callback(callback: Callable) -> void:
    event_callback = callback

func request_close() -> void:
    event_callback.call(JSON.stringify({"contract": CONTRACT, "event": "closeRequested"}))

func open(payload_json: String) -> String:
    open_calls += 1
    last_method = "open"
    last_payload = payload_json
    return JSON.stringify({"contract": CONTRACT, "event": "opened"})

func close() -> String:
    last_method = "close"
    return JSON.stringify({"contract": CONTRACT, "event": "closed"})

func publish_probe() -> String:
    last_method = "publishProbe"
    return JSON.stringify({
        "contract": CONTRACT,
        "event": "published",
        "png": "data:image/png;base64,probe"
    })
