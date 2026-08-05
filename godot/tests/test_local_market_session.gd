extends RefCounted
class_name AdMarketTestLocalMarketSession

const GameRun = preload("res://src/game/game_run.gd")
const LocalMarketSession = preload("res://src/market/local_market_session.gd")

func run() -> bool:
    assert(_practice_market_awards_three_medals_and_reveals())
    return true

func _practice_market_awards_three_medals_and_reveals() -> bool:
    var game_run := GameRun.new()
    assert(game_run.begin("Pixel Pioneers", "local-session", "local-team"))
    for _level in 3:
        assert(game_run.mark_current_level_ready())
        assert(game_run.advance_level())
    assert(game_run.open_medal_market())

    var session := LocalMarketSession.new()
    var snapshots: Array[Dictionary] = []
    var artwork: Dictionary = {}
    var awards: Array[Dictionary] = []
    session.snapshot_received.connect(func(snapshot: Dictionary) -> void:
        snapshots.append(snapshot.duplicate(true))
    )
    session.artwork_received.connect(func(key: String, bytes: PackedByteArray) -> void:
        artwork[key] = bytes
    )
    session.award_completed.connect(func(result: Dictionary) -> void:
        awards.append(result.duplicate(true))
    )

    var initial: Dictionary = session.configure(
        game_run,
        _publication(),
        "Pixel Pioneers"
    )
    assert(initial.get("phase") == "market")
    assert(initial.get("marketMode") == "medals")
    assert(not Dictionary(initial.get("own")).has("wallet"))
    assert(not Dictionary(initial.get("own")).has("spent"))
    assert(Array(initial.get("myPurchases")).is_empty())
    assert(Array(initial.get("myAwards")).is_empty())
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
    _assert_rival_artwork_compositions(session, rivals, artwork)

    var own_key := str(Dictionary(initial.get("campaigns")[0]).get("artworkKey"))
    var rival_key := str(rivals[0].get("artworkKey"))
    assert(not session.request_artwork(own_key).is_empty())
    assert(not session.request_artwork(rival_key).is_empty())
    assert(artwork.has(own_key))
    assert(artwork.has(rival_key))
    assert(_is_png(artwork.get(own_key)))
    assert(_is_png(artwork.get(rival_key)))

    assert(not session.award(str(rivals[0].get("id")), "gold").is_empty())
    assert(not session.award(str(rivals[1].get("id")), "silver").is_empty())
    assert(not session.award(str(rivals[2].get("id")), "bronze").is_empty())
    assert(not snapshots.is_empty())
    var awarded: Dictionary = snapshots.back()
    assert(Array(awarded.get("myAwards")).size() == 3)
    assert(awards.size() == 3)
    assert(awards[0].get("medal") == "gold")
    assert(awards[1].get("medal") == "silver")
    assert(awards[2].get("medal") == "bronze")

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

func _assert_rival_artwork_compositions(
    session: AdMarketLocalMarketSession,
    rivals: Array[Dictionary],
    artwork: Dictionary
) -> void:
    var signatures: Dictionary = {}
    for rival in rivals:
        var artwork_key := str(rival.get("artworkKey"))
        assert(not session.request_artwork(artwork_key).is_empty())
        var bytes := artwork.get(artwork_key) as PackedByteArray
        var image := Image.new()
        assert(image.load_png_from_buffer(bytes) == OK)
        assert(image.get_width() == 640)
        assert(image.get_height() == 360)
        assert(_distinct_colour_count(image) >= 24)
        assert(image.get_pixel(320, 180) != image.get_pixel(8, 180))
        signatures[bytes.sha256_text()] = true
    assert(signatures.size() == 4)

func _distinct_colour_count(image: Image) -> int:
    var colours: Dictionary = {}
    for y in range(24, image.get_height(), 24):
        for x in range(24, image.get_width(), 24):
            colours[image.get_pixel(x, y).to_html()] = true
    return colours.size()
