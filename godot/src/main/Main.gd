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
    creator_host.creator_opened.connect(_on_creator_opened)
    creator_host.creator_closed.connect(_on_creator_closed)
    launch_button.pressed.connect(_open_creator)
    launch_button.grab_focus()

func _open_creator() -> void:
    status.text = "Opening Campaign Creator…"
    creator_host.open_creator(_blank_campaign_document())

func _on_creator_opened() -> void:
    status.text = "Campaign Creator open · game input paused"

func _on_creator_closed() -> void:
    status.text = "Game ready"

func _show_diagnostic(message: String) -> void:
    status.text = message

func _blank_campaign_document() -> Dictionary:
    return {
        "schemaVersion": 1,
        "editorVersion": "0.1.0",
        "documentId": "classroom-campaign",
        "sessionId": "local-session",
        "mode": "offline",
        "revision": 0,
        "canvas": {"width": 1600, "height": 900, "background": "#ffffff"},
        "fabricState": {"version": "7.4.0", "objects": []},
        "drawingLayers": [],
        "product": {"name": "", "priceCents": null},
        "brief": {
            "targetAudienceId": "",
            "contextId": "",
            "purpose": "persuade",
            "audienceNeeds": [],
            "audienceValues": [],
            "intendedEffects": [],
            "techniques": []
        },
        "evidence": {
            "price": [],
            "attention": [],
            "interest": [],
            "desire": [],
            "action": []
        },
        "assetReferences": [],
        "updatedAt": "1970-01-01T00:00:00.000Z"
    }
