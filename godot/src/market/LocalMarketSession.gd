extends Node

signal snapshot_received(snapshot: Dictionary)
signal artwork_received(artwork_key: String, png_bytes: PackedByteArray)
signal diagnostic(message: String)
signal purchase_completed(result: Dictionary)
signal control_completed(action: String, result: Dictionary)
signal campaign_published(result: Dictionary)

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

var _game_run: RefCounted
var _alias := ""
var _revision := 1
var _campaigns: Array[Dictionary] = []
var _artwork_bytes: Dictionary = {}

func configure(game_run: RefCounted, publication: Dictionary, alias: String) -> Dictionary:
    if game_run == null or str(game_run.get("phase")) != "market":
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
    var receipts: Array[Dictionary] = []
    var purchases: Array[Dictionary] = _game_run.call("purchases")
    for index in purchases.size():
        var purchase: Dictionary = purchases[index]
        receipts.append({
            "id": "practice-receipt-%d" % (index + 1),
            "campaignId": str(purchase.get("campaignId")),
            "sellerTeamId": str(purchase.get("sellerTeamId")),
            "price": int(purchase.get("priceCents")),
            "purchasedAt": index + 1
        })
    return {
        "roomId": "practice-room",
        "revision": _revision,
        "phase": str(_game_run.get("phase")),
        "own": {
            "teamId": str(_game_run.get("team_id")),
            "alias": _alias,
            "wallet": int(_game_run.get("wallet_cents")),
            "spent": int(_game_run.call("spent_cents")),
            "finished": str(_game_run.get("phase")) == "reveal"
        },
        "teams": teams,
        "campaigns": _campaigns.duplicate(true),
        "myPurchases": receipts
    }

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
    if _game_run == null or not _game_run.call("finish_shopping"):
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
    var backgrounds := [Color("#f4ead6"), Color("#dceee8"), Color("#e6e4f4"), Color("#f7e0d3")]
    var accents := [Color("#b63a15"), Color("#0b6e99"), Color("#5b4b8a"), Color("#c45a24")]
    var darks := [Color("#17212b"), Color("#173c3b"), Color("#25213d"), Color("#3d291f")]
    var image := Image.create(640, 360, false, Image.FORMAT_RGBA8)
    image.fill(backgrounds[index])
    image.fill_rect(Rect2i(0, 0, 640, 34), accents[index])
    image.fill_rect(Rect2i(54, 282, 532, 18), darks[index])
    image.fill_rect(Rect2i(76, 312, 330, 10), accents[index])
    if index == 0:
        image.fill_rect(Rect2i(176, 116, 288, 142), Color("#fffaf0"))
        image.fill_rect(Rect2i(160, 92, 320, 38), darks[index])
        image.fill_rect(Rect2i(210, 68, 220, 18), accents[index])
    elif index == 1:
        image.fill_rect(Rect2i(202, 112, 236, 146), Color("#fffaf0"))
        image.fill_rect(Rect2i(222, 84, 196, 38), darks[index])
        image.fill_rect(Rect2i(238, 146, 72, 72), accents[index])
        image.fill_rect(Rect2i(330, 146, 72, 72), accents[index])
    elif index == 2:
        image.fill_rect(Rect2i(154, 164, 332, 48), accents[index])
        image.fill_rect(Rect2i(244, 110, 152, 54), Color("#fffaf0"))
        image.fill_rect(Rect2i(204, 222, 64, 36), darks[index])
        image.fill_rect(Rect2i(372, 222, 64, 36), darks[index])
    else:
        image.fill_rect(Rect2i(292, 138, 56, 120), darks[index])
        image.fill_rect(Rect2i(206, 104, 228, 62), Color("#fffaf0"))
        image.fill_rect(Rect2i(236, 74, 168, 32), accents[index])
    return image.save_png_to_buffer()
