extends RefCounted

const GameRun = preload("res://src/game/GameRun.gd")
const LocalMarketSession = preload("res://src/market/LocalMarketSession.gd")

func run() -> bool:
    assert(_practice_market_shops_two_stalls_and_reveals())
    return true

func _practice_market_shops_two_stalls_and_reveals() -> bool:
    var game_run := GameRun.new()
    assert(game_run.begin("Pixel Pioneers", "local-session", "local-team"))
    for _level in 3:
        assert(game_run.mark_current_level_ready())
        assert(game_run.advance_level())
    assert(game_run.open_market(10000))

    var session := LocalMarketSession.new()
    var snapshots: Array[Dictionary] = []
    var artwork: Dictionary = {}
    session.snapshot_received.connect(func(snapshot: Dictionary) -> void:
        snapshots.append(snapshot.duplicate(true))
    )
    session.artwork_received.connect(func(key: String, bytes: PackedByteArray) -> void:
        artwork[key] = bytes
    )

    var initial: Dictionary = session.configure(
        game_run,
        _publication(),
        "Pixel Pioneers"
    )
    assert(initial.get("phase") == "market")
    assert(initial.get("own").get("wallet") == 10000)
    assert(Array(initial.get("teams")).size() == 5)
    assert(Array(initial.get("campaigns")).size() == 5)
    var rivals: Array[Dictionary] = []
    for campaign_value in initial.get("campaigns"):
        var campaign: Dictionary = campaign_value
        if str(campaign.get("sellerTeamId")) != "local-team":
            rivals.append(campaign)
    assert(rivals.size() == 4)
    for rival in rivals:
        assert(rival.get("status") == "approved")
        assert(rival.get("price") == 4000)

    var own_key := str(Dictionary(initial.get("campaigns")[0]).get("artworkKey"))
    var rival_key := str(rivals[0].get("artworkKey"))
    assert(not session.request_artwork(own_key).is_empty())
    assert(not session.request_artwork(rival_key).is_empty())
    assert(artwork.has(own_key))
    assert(artwork.has(rival_key))
    assert(_is_png(artwork.get(own_key)))
    assert(_is_png(artwork.get(rival_key)))

    assert(not session.purchase(str(rivals[0].get("id")), "buy-one").is_empty())
    assert(game_run.wallet_cents == 6000)
    assert(not session.purchase(str(rivals[1].get("id")), "buy-two").is_empty())
    assert(game_run.wallet_cents == 2000)
    assert(not snapshots.is_empty())
    var shopped: Dictionary = snapshots.back()
    assert(shopped.get("own").get("spent") == 8000)
    assert(Array(shopped.get("myPurchases")).size() == 2)

    assert(not session.finish().is_empty())
    assert(game_run.phase == "reveal")
    var revealed: Dictionary = snapshots.back()
    assert(revealed.get("phase") == "reveal")
    assert(revealed.get("own").get("finished") == true)
    return true

func _publication() -> Dictionary:
    var image := Image.create(16, 9, false, Image.FORMAT_RGBA8)
    image.fill(Color("#f4ead6"))
    return {
        "contract": "published-campaign@1",
        "documentId": "classroom-campaign",
        "revision": 1,
        "pngBase64": Marshalls.raw_to_base64(image.save_png_to_buffer()),
        "metadata": {
            "productName": "Orbit Sip",
            "priceCents": 900
        }
    }

func _is_png(value: Variant) -> bool:
    if typeof(value) != TYPE_PACKED_BYTE_ARRAY:
        return false
    var image := Image.new()
    return image.load_png_from_buffer(value) == OK
