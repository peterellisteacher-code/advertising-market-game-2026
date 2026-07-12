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

    host.open_creator({"contract": "creator-spike@1"})
    host.open_creator({"contract": "creator-spike@1"})
    assert(fake.last_method == "open")
    assert(fake.open_calls == 1)
    assert(host.creator_is_open)
    assert(game_input.process_mode == Node.PROCESS_MODE_DISABLED)
    host.request_publish_probe()
    assert(fake.last_method == "publishProbe")
    fake.request_close()
    assert(fake.last_method == "close")
    assert(not host.creator_is_open)
    assert(game_input.process_mode == Node.PROCESS_MODE_ALWAYS)
    host.free()
    game_input.free()
    return true
