extends RefCounted

const CreatorHost = preload("res://src/creator/CreatorHost.gd")
const FakeCreatorTransport = preload("res://tests/fakes/FakeCreatorTransport.gd")

func run() -> bool:
    var fake := FakeCreatorTransport.new()
    var host := CreatorHost.new()
    var game_input := Node.new()
    game_input.process_mode = Node.PROCESS_MODE_ALWAYS
    host.game_input_root = game_input
    host.set_transport(fake)

    host.close_creator()
    assert(game_input.process_mode == Node.PROCESS_MODE_ALWAYS)

    host.open_creator(_document())
    host.open_creator(_document())
    assert(fake.request_count() == 1)
    fake.resolve_success(fake.last_request_id())
    assert(host.creator_is_open)
    assert(game_input.process_mode == Node.PROCESS_MODE_DISABLED)
    fake.request_close()
    assert(fake.request_for(fake.last_request_id()).get("method") == "close")
    fake.resolve_success(fake.last_request_id())
    assert(not host.creator_is_open)
    assert(game_input.process_mode == Node.PROCESS_MODE_ALWAYS)
    host.free()
    game_input.free()
    return true

func _document() -> Dictionary:
    return {
        "schemaVersion": 1,
        "editorVersion": "0.1.0",
        "documentId": "host-document",
        "sessionId": "host-session",
        "mode": "offline",
        "revision": 0,
        "canvas": {"width": 1600, "height": 900, "background": "#fff"},
        "fabricState": {"version": "7.4.0", "objects": []},
        "drawingLayers": [],
        "product": {"name": "", "priceCents": null},
        "brief": {"purpose": "persuade"},
        "evidence": {
            "price": [], "attention": [], "interest": [], "desire": [], "action": []
        },
        "assetReferences": [],
        "updatedAt": "1970-01-01T00:00:00.000Z"
    }
