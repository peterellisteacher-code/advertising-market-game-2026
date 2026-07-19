extends RefCounted

const CreatorHost = preload("res://src/creator/CreatorHost.gd")
const FakeCreatorTransport = preload("res://tests/fakes/FakeCreatorTransport.gd")

func run() -> bool:
    var fake := FakeCreatorTransport.new()
    var host := CreatorHost.new()
    var game_input := Node.new()
    var received_states: Array[Dictionary] = []
    var received_latest: Array[Variant] = []
    var publications: Array[Dictionary] = []
    var diagnostics: Array[String] = []
    game_input.process_mode = Node.PROCESS_MODE_ALWAYS
    host.game_input_root = game_input
    host.set_transport(fake)
    host.creator_state_received.connect(func(document: Dictionary) -> void:
        received_states.append(document)
    )
    host.latest_draft_received.connect(func(document: Variant) -> void:
        received_latest.append(document)
    )
    host.creator_published.connect(func(publication: Dictionary) -> void:
        publications.append(publication)
    )
    host.diagnostic.connect(func(message: String) -> void:
        diagnostics.append(message)
    )

    host.close_creator()
    assert(game_input.process_mode == Node.PROCESS_MODE_ALWAYS)

    var latest_id := host.load_latest("host-document")
    assert(fake.request_for(latest_id).get("method") == "loadLatest")
    fake.resolve_success(latest_id, _document())
    assert(received_latest.size() == 1)
    assert(received_latest[0].get("documentId") == "host-document")
    var missing_id := host.load_latest("host-document")
    fake.resolve_success(missing_id, null)
    assert(received_latest.size() == 2)
    assert(received_latest[1] == null)

    var requests_before_open := fake.request_count()
    host.open_creator(_document())
    host.open_creator(_document())
    assert(fake.request_count() == requests_before_open + 1)
    fake.resolve_success(fake.last_request_id())
    assert(host.creator_is_open)
    assert(game_input.process_mode == Node.PROCESS_MODE_DISABLED)
    fake.request_close()
    assert(fake.request_for(fake.last_request_id()).get("method") == "save")
    fake.resolve_success(fake.last_request_id())
    assert(fake.request_for(fake.last_request_id()).get("method") == "getState")
    fake.resolve_success(fake.last_request_id(), _document())
    assert(received_states.size() == 1)
    assert(received_states[0].get("documentId") == "host-document")
    assert(fake.request_for(fake.last_request_id()).get("method") == "close")
    fake.resolve_success(fake.last_request_id())
    assert(not host.creator_is_open)
    assert(game_input.process_mode == Node.PROCESS_MODE_ALWAYS)

    host.open_creator(_document())
    fake.resolve_success(fake.last_request_id())
    var publish_id := host.publish_creator()
    fake.resolve_success(publish_id, _publication())
    assert(publications.size() == 1)
    assert(publications[0].get("documentId") == "host-document")

    fake.request_close()
    var failed_save_id := fake.last_request_id()
    assert(fake.request_for(failed_save_id).get("method") == "save")
    fake.reject_request(failed_save_id, "Synthetic draft failure")
    assert(host.creator_is_open)
    assert(diagnostics.back().contains("Draft kept open"))
    assert(fake.last_shown_message().contains("Draft kept open"))

    host.set_transport(null)
    fake.request_close()
    assert(host.creator_is_open)
    assert(diagnostics.back().contains("Draft kept open"))
    host.set_transport(fake)
    fake.request_close()
    assert(fake.request_for(fake.last_request_id()).get("method") == "save")
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

func _publication() -> Dictionary:
    return {
        "contract": "published-campaign@1",
        "documentId": "host-document",
        "revision": 0.0,
        "pngBase64": _png_base64(),
        "metadata": {
            "productName": "Product",
            "priceCents": 1000.0,
            "brief": {},
            "evidence": {},
            "assetReferences": []
        }
    }

func _png_base64() -> String:
    var bytes := PackedByteArray()
    bytes.resize(33)
    var signature := PackedByteArray([137, 80, 78, 71, 13, 10, 26, 10])
    for index in signature.size():
        bytes[index] = signature[index]
    _write_uint32_be(bytes, 8, 13)
    var type_bytes := "IHDR".to_ascii_buffer()
    for index in 4:
        bytes[12 + index] = type_bytes[index]
    _write_uint32_be(bytes, 16, 1600)
    _write_uint32_be(bytes, 20, 900)
    bytes[24] = 8
    bytes[25] = 6
    return Marshalls.raw_to_base64(bytes)

func _write_uint32_be(bytes: PackedByteArray, offset: int, value: int) -> void:
    bytes[offset] = (value >> 24) & 0xff
    bytes[offset + 1] = (value >> 16) & 0xff
    bytes[offset + 2] = (value >> 8) & 0xff
    bytes[offset + 3] = value & 0xff
