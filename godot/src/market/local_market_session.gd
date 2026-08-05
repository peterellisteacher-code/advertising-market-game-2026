extends Node
class_name AdMarketLocalMarketSession

signal snapshot_received(snapshot: Dictionary)
signal artwork_received(artwork_key: String, png_bytes: PackedByteArray)
signal diagnostic(message: String)
signal purchase_completed(result: Dictionary)
signal award_completed(result: Dictionary)

const SEED_PRICE_CENTS := 4000
const OWN_ARTWORK_KEY := "practice-artwork-own"
const SEED_TEAMS := [
    {"id": "practice-team-copper", "alias": "Copper Comets"},
    {"id": "practice-team-harbour", "alias": "Harbour Sparks"},
    {"id": "practice-team-sunday", "alias": "Sunday Inventors"},
    {"id": "practice-team-orbit", "alias": "Orbit Otters"}
]
const SEED_PRODUCTS := [
    {"name": "ChillFold Esky", "tagline": "Cold storage that packs flat."},
    {"name": "Halo Habitat", "tagline": "A calmer corner for curious pets."},
    {"name": "SnapCycle", "tagline": "A city bike built for quick changes."},
    {"name": "NightNest", "tagline": "A reading light that makes space feel yours."}
]
const RIVAL_ARTWORK_PATHS := [
    "res://assets/market/rivals/cooler-master.png",
    "res://assets/market/rivals/terrarium-master.png",
    "res://assets/market/rivals/bicycle-master.png",
    "res://assets/market/rivals/lamp-master.png"
]
const RIVAL_BACKGROUNDS := [Color("#0d3d57"), Color("#23655e"), Color("#43366f"), Color("#6e3c2a")]
const RIVAL_HORIZONS := [Color("#67c7d0"), Color("#b3e0ad"), Color("#f1bd69"), Color("#f2c77e")]
const RIVAL_ACCENTS := [Color("#ffb84d"), Color("#f5cf5b"), Color("#e580d0"), Color("#83d7df")]

var _game_run: RefCounted
var _alias: String = ""
var _revision: int = 1
var _campaigns: Array[Dictionary] = []
var _artwork_bytes: Dictionary = {}

func configure(game_run: RefCounted, publication: Dictionary, alias: String) -> Dictionary:
    if (
        game_run == null
        or str(game_run.get("phase")) != "market"
        or str(game_run.get("market_mode")) != "medals"
    ):
        diagnostic.emit("Practice market is not ready")
        return {}
    var trimmed_alias := alias.strip_edges()
    if trimmed_alias.length() < 2 or trimmed_alias != alias:
        diagnostic.emit("Practice team alias is invalid")
        return {}
    var metadata_value: Variant = publication.get("metadata")
    if typeof(metadata_value) != TYPE_DICTIONARY:
        diagnostic.emit("Practice market card is invalid")
        return {}
    var metadata: Dictionary = metadata_value
    var product_name := str(metadata.get("productName", "")).strip_edges()
    var price_cents := int(metadata.get("priceCents", 0))
    var png_bytes := Marshalls.base64_to_raw(str(publication.get("pngBase64", "")))
    var image := Image.new()
    if product_name.is_empty() or price_cents <= 0 or image.load_png_from_buffer(png_bytes) != OK:
        diagnostic.emit("Practice market card is invalid")
        return {}

    _game_run = game_run
    _alias = alias
    _revision = 1
    _campaigns.clear()
    _artwork_bytes.clear()
    _artwork_bytes[OWN_ARTWORK_KEY] = png_bytes
    _campaigns.append({
        "id": "practice-campaign-own",
        "sellerTeamId": str(_game_run.get("team_id")),
        "sellerAlias": _alias,
        "status": "approved",
        "productName": product_name,
        "tagline": "Your pair's final pitch.",
        "price": price_cents,
        "artworkKey": OWN_ARTWORK_KEY
    })
    for index in SEED_TEAMS.size():
        var team: Dictionary = SEED_TEAMS[index]
        var product: Dictionary = SEED_PRODUCTS[index]
        var campaign_id := "practice-campaign-%d" % (index + 1)
        var artwork_key := "practice-artwork-%d" % (index + 1)
        _campaigns.append({
            "id": campaign_id,
            "sellerTeamId": str(team.get("id")),
            "sellerAlias": str(team.get("alias")),
            "status": "approved",
            "productName": str(product.get("name")),
            "tagline": str(product.get("tagline")),
            "price": SEED_PRICE_CENTS,
            "artworkKey": artwork_key
        })
        _artwork_bytes[artwork_key] = _seed_artwork(index)
    return snapshot()

func snapshot() -> Dictionary:
    if _game_run == null:
        return {}
    var teams: Array[Dictionary] = [{
        "id": str(_game_run.get("team_id")),
        "alias": _alias
    }]
    for team_value in SEED_TEAMS:
        teams.append(Dictionary(team_value).duplicate(true))
    var awards: Array[Dictionary] = []
    var game_awards: Array[Dictionary] = _game_run.call("awards")
    for index in game_awards.size():
        var award_record: Dictionary = game_awards[index]
        var medal := str(award_record.get("medal"))
        awards.append({
            "id": "practice-award-%s" % medal,
            "campaignId": str(award_record.get("campaignId")),
            "sellerTeamId": str(award_record.get("sellerTeamId")),
            "medal": medal,
            "awardedAt": index + 1
        })
    return {
        "roomId": "practice-room",
        "revision": _revision,
        "phase": str(_game_run.get("phase")),
        "marketMode": "medals",
        "own": {
            "teamId": str(_game_run.get("team_id")),
            "alias": _alias,
            "finished": str(_game_run.get("phase")) == "reveal"
        },
        "teams": teams,
        "campaigns": _campaigns.duplicate(true),
        "myPurchases": [],
        "myAwards": awards
    }

func award(campaign_id: String, medal: String) -> String:
    if _game_run == null:
        return ""
    var campaign := _campaign_by_id(campaign_id)
    if campaign.is_empty() or not _game_run.call(
        "award",
        campaign_id,
        str(campaign.get("sellerTeamId")),
        medal
    ):
        diagnostic.emit(str(_game_run.get("last_error")))
        return ""
    _revision += 1
    var request_id := "practice-award-%d" % _revision
    var result := {
        "campaignId": campaign_id,
        "medal": medal,
        "requestId": request_id
    }
    award_completed.emit(result.duplicate(true))
    snapshot_received.emit(snapshot())
    return request_id

func purchase(campaign_id: String, request_id: String) -> String:
    if _game_run == null or request_id.is_empty():
        return ""
    var campaign := _campaign_by_id(campaign_id)
    if campaign.is_empty() or not _game_run.call(
        "purchase",
        campaign_id,
        str(campaign.get("sellerTeamId")),
        int(campaign.get("price"))
    ):
        diagnostic.emit(str(_game_run.get("last_error")))
        return ""
    _revision += 1
    var result := {"campaignId": campaign_id, "requestId": request_id}
    purchase_completed.emit(result.duplicate(true))
    snapshot_received.emit(snapshot())
    return request_id

func finish() -> String:
    if _game_run == null or not _game_run.call("finish_market"):
        if _game_run != null:
            diagnostic.emit(str(_game_run.get("last_error")))
        return ""
    _revision += 1
    var request_id := "practice-finish-%d" % _revision
    snapshot_received.emit(snapshot())
    return request_id

func request_snapshot_silently() -> String:
    if _game_run == null:
        return ""
    var request_id := "practice-snapshot-%d" % _revision
    snapshot_received.emit(snapshot())
    return request_id

func request_artwork(artwork_key: String) -> String:
    if not _artwork_bytes.has(artwork_key):
        diagnostic.emit("Practice artwork is unavailable")
        return ""
    artwork_received.emit(artwork_key, PackedByteArray(_artwork_bytes.get(artwork_key)))
    return "practice-artwork-request-%d" % _revision

func _campaign_by_id(campaign_id: String) -> Dictionary:
    for campaign_value in _campaigns:
        var campaign: Dictionary = campaign_value
        if str(campaign.get("id")) == campaign_id:
            return campaign
    return {}

func _seed_artwork(index: int) -> PackedByteArray:
    var image := Image.create(640, 360, false, Image.FORMAT_RGBA8)
    var background: Color = RIVAL_BACKGROUNDS[index]
    var horizon: Color = RIVAL_HORIZONS[index]
    var accent: Color = RIVAL_ACCENTS[index]
    for row in range(15):
        for column in range(20):
            var ratio := clampf(float(row) / 20.0 + float(column) / 64.0, 0.0, 1.0)
            image.fill_rect(Rect2i(column * 32, row * 24, 32, 24), background.lerp(horizon, ratio))
    image.fill_rect(Rect2i(0, 0, 640, 30), Color("#111827"))
    image.fill_rect(Rect2i(0, 300, 640, 60), Color("#111827"))
    image.fill_rect(Rect2i(42, 52, 556, 12), accent)
    image.fill_rect(Rect2i(74, 272, 492, 8), accent)
    image.fill_rect(Rect2i(86, 82, 468, 174), background.lerp(Color("#f8fafc"), 0.28))
    var product_texture := ResourceLoader.load(String(RIVAL_ARTWORK_PATHS[index])) as Texture2D
    if product_texture == null:
        push_error("Practice rival artwork is unavailable")
        return PackedByteArray()
    var product := product_texture.get_image()
    if product == null or product.is_empty():
        push_error("Practice rival artwork is unavailable")
        return PackedByteArray()
    var product_size := Vector2i(260, 260)
    if index == 2:
        product_size = Vector2i(360, 220)
    product.resize(product_size.x, product_size.y, Image.INTERPOLATE_LANCZOS)
    var product_position := Vector2i(
        int((640 - product_size.x) / 2),
        int(54 + (218 - product_size.y) / 2)
    )
    image.blend_rect(product, Rect2i(Vector2i.ZERO, product_size), product_position)
    return image.save_png_to_buffer()
