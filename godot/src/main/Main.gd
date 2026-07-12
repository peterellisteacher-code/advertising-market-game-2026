extends Control

const WebCreatorTransport = preload("res://src/creator/transport/WebCreatorTransport.gd")

@onready var creator_host: Node = %CreatorHost
@onready var launch_button: Button = %LaunchCreator
@onready var status: Label = %Status

func _ready() -> void:
    var web_transport := WebCreatorTransport.new()
    web_transport.diagnostic.connect(_show_diagnostic)
    creator_host.set_transport(web_transport)
    creator_host.game_input_root = %GameInput
    creator_host.launch_button = launch_button
    creator_host.diagnostic.connect(_show_diagnostic)
    launch_button.pressed.connect(_open_creator)
    launch_button.grab_focus()

func _open_creator() -> void:
    creator_host.open_creator({"contract": "creator-spike@1"})
    if not creator_host.creator_is_open:
        return
    var response: Dictionary = creator_host.request_publish_probe()
    var png := str(response.get("png", ""))
    if png.begins_with("data:image/png;base64,") and png.length() > 22:
        status.text = "Creator open · game input paused · image bridge ready (%d bytes)" % png.length()
    else:
        _show_diagnostic("Creator image bridge returned no PNG")

func _show_diagnostic(message: String) -> void:
    status.text = message
