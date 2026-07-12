extends RefCounted

const CreatorHost = preload("res://src/creator/CreatorHost.gd")
const FakeCreatorTransport = preload("res://tests/fakes/FakeCreatorTransport.gd")

func run() -> bool:
    var fake := FakeCreatorTransport.new()
    var host := CreatorHost.new()
    host.set_transport(fake)
    host.open_creator({"contract": "creator-spike@1"})
    assert(fake.last_method == "open")
    assert(host.creator_is_open)
    host.request_publish_probe()
    assert(fake.last_method == "publishProbe")
    fake.request_close()
    assert(fake.last_method == "close")
    assert(not host.creator_is_open)
    return true
