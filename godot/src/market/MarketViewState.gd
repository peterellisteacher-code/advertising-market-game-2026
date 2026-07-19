extends RefCounted

const MAX_SAFE_INTEGER := 9007199254740991
const MAX_TEAMS := 30
const MAX_CAMPAIGNS := 30
const MAX_PURCHASES := 900
const MAX_WALLET_CENTS := 1000000
const MAX_PRICE_CENTS := 1000000000000
const PHASES := ["building", "market", "reveal", "closed"]
const CAMPAIGN_STATUSES := ["pending", "approved", "returned", "hidden"]
const MARKET_ELIGIBILITY_STATES := ["building", "frozen"]
const MARKET_ELIGIBILITY_ROLES := ["buyer-seller", "buyer", "seller", "spectator"]
const MARKET_ELIGIBILITY_REASONS := [
    "approved-campaign",
    "no-campaign",
    "campaign-pending",
    "campaign-returned",
    "campaign-hidden",
    "not-in-cohort",
    "legacy-cohort"
]
const ASCII_ALPHANUMERIC := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
const MARKET_ID_SUFFIX := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._:-"
const ARTWORK_KEY_SUFFIX := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._:/-"
const INVALID_RESULT := {
    "ok": false,
    "diagnostic": {
        "code": "INVALID_MARKET_SNAPSHOT",
        "message": "Live Market data could not be displayed safely."
    }
}

func derive(snapshot_value: Variant) -> Dictionary:
    if typeof(snapshot_value) != TYPE_DICTIONARY:
        return _invalid()
    var snapshot: Dictionary = snapshot_value
    var is_team := snapshot.has("own")
    var is_teacher := snapshot.has("controls") or snapshot.has("openingWalletCents")
    if is_team == is_teacher:
        return _invalid()
    var state := _derive_team(snapshot) if is_team else _derive_teacher(snapshot)
    if state.is_empty():
        return _invalid()
    return {
        "ok": true,
        "role": "team" if is_team else "teacher",
        "state": state
    }

func _derive_team(snapshot: Dictionary) -> Dictionary:
    if not _valid_snapshot_header(snapshot, false):
        return {}
    if typeof(snapshot.get("own")) != TYPE_DICTIONARY:
        return {}
    var own: Dictionary = snapshot.get("own")
    if (
        not _is_market_id(own.get("teamId"))
        or not _is_safe_string(own.get("alias"), 32, 2)
        or not _is_nonnegative_integer(own.get("wallet"), MAX_WALLET_CENTS)
        or not _is_nonnegative_integer(own.get("spent"), MAX_WALLET_CENTS)
        or typeof(own.get("finished")) != TYPE_BOOL
    ):
        return {}
    var wallet := int(own.get("wallet"))
    var spent := int(own.get("spent"))
    var opening_wallet := wallet + spent
    if opening_wallet < 100 or opening_wallet > MAX_WALLET_CENTS:
        return {}
    var eligibility := _normalise_market_eligibility(own, str(snapshot.get("phase")))
    if eligibility.is_empty():
        return {}
    var eligible_buyer := str(eligibility.get("role")) in ["buyer-seller", "buyer"]

    var teams_result := _normalise_team_summaries(snapshot.get("teams"), str(own.get("teamId")))
    if not teams_result.get("ok", false):
        return {}
    var team_ids: Dictionary = teams_result.get("ids")
    if not team_ids.has(str(own.get("teamId"))):
        return {}
    var team_aliases: Dictionary = teams_result.get("aliases")
    if team_aliases.get(str(own.get("teamId"))) != str(own.get("alias")):
        return {}

    var purchases_result := _normalise_purchases(
        snapshot.get("myPurchases"),
        team_ids,
        str(own.get("teamId"))
    )
    if not purchases_result.get("ok", false):
        return {}
    if int(purchases_result.get("spentTotal")) != spent:
        return {}
    var bought_campaigns: Dictionary = purchases_result.get("campaignIds")
    var purchased_sellers: Dictionary = purchases_result.get("sellerIds")
    var purchase_sellers_by_campaign: Dictionary = purchases_result.get("sellerByCampaign")
    var purchase_prices_by_campaign: Dictionary = purchases_result.get("priceByCampaign")

    if typeof(snapshot.get("campaigns")) != TYPE_ARRAY:
        return {}
    var campaigns: Array = snapshot.get("campaigns")
    if campaigns.size() > MAX_CAMPAIGNS:
        return {}
    var campaign_ids: Dictionary = {}
    var cards: Array[Dictionary] = []
    var status_counts := {"waiting": 0, "approved": 0, "returned": 0, "hidden": 0}
    var has_affordable_option := false
    for campaign_value in campaigns:
        var card := _normalise_team_campaign(
            campaign_value,
            str(own.get("teamId")),
            team_aliases,
            bought_campaigns,
            wallet,
            str(snapshot.get("phase")),
            bool(own.get("finished")),
            eligible_buyer
        )
        if card.is_empty() or campaign_ids.has(str(card.get("id"))):
            return {}
        if card.get("isBought") and (
            purchase_sellers_by_campaign.get(str(card.get("id"))) != card.get("sellerTeamId")
            or int(purchase_prices_by_campaign.get(str(card.get("id")), -1)) != int(card.get("priceCents"))
            or card.get("status") != "approved"
            or card.get("isOwn")
        ):
            return {}
        campaign_ids[str(card.get("id"))] = true
        cards.append(card)
        var status_key := str(card.get("displayStatus"))
        if status_key == "live":
            status_counts["approved"] = int(status_counts.get("approved")) + 1
        else:
            status_counts[status_key] = int(status_counts.get(status_key, 0)) + 1
        if (
            card.get("status") == "approved"
            and not card.get("isOwn")
            and not card.get("isBought")
            and card.get("isAffordable")
        ):
            has_affordable_option = true

    var spent_enough := spent * 100 >= opening_wallet * 80
    var has_two_sellers := purchased_sellers.size() >= 2
    var no_affordable_purchase_remains := not has_affordable_option
    var already_finished := bool(own.get("finished"))
    var locally_ready := (
        str(snapshot.get("phase")) == "market"
        and eligible_buyer
        and not already_finished
        and has_two_sellers
        and (spent_enough or no_affordable_purchase_remains)
    )
    return {
        "roomId": str(snapshot.get("roomId")),
        "revision": int(snapshot.get("revision")),
        "phase": str(snapshot.get("phase")),
        "marketEligibility": eligibility,
        "own": {
            "teamId": str(own.get("teamId")),
            "alias": str(own.get("alias")),
            "finished": already_finished
        },
        "teams": teams_result.get("teams"),
        "cards": cards,
        "money": {
            "walletCents": wallet,
            "spentCents": spent,
            "openingWalletCents": opening_wallet,
            "walletPercentRemaining": float(wallet) * 100.0 / float(opening_wallet),
            "spentPercent": float(spent) * 100.0 / float(opening_wallet)
        },
        "purchaseSummary": {
            "purchaseCount": int(purchases_result.get("count")),
            "distinctSellerCount": purchased_sellers.size()
        },
        "finishReadiness": {
            "serverAuthoritative": true,
            "hasTwoSellers": has_two_sellers,
            "spentEnough": spent_enough,
            "noAffordablePurchaseRemains": no_affordable_purchase_remains,
            "alreadyFinished": already_finished,
            "eligibleBuyer": eligible_buyer,
            "locallyReady": locally_ready
        },
        "statusCounts": status_counts
    }

func _derive_teacher(snapshot: Dictionary) -> Dictionary:
    if (
        not _valid_snapshot_header(snapshot, true)
        or not _is_positive_integer(snapshot.get("openingWalletCents"), MAX_WALLET_CENTS)
    ):
        return {}
    var teams_result := _normalise_teacher_teams(snapshot.get("teams"))
    if not teams_result.get("ok", false):
        return {}
    var team_aliases: Dictionary = teams_result.get("aliases")
    if typeof(snapshot.get("campaigns")) != TYPE_ARRAY:
        return {}
    var campaigns: Array = snapshot.get("campaigns")
    if campaigns.size() > MAX_CAMPAIGNS:
        return {}
    var moderation := {
        "waiting": [],
        "approved": [],
        "returned": [],
        "hidden": []
    }
    var campaign_ids: Dictionary = {}
    for campaign_value in campaigns:
        var campaign := _normalise_teacher_campaign(campaign_value, team_aliases)
        if campaign.is_empty() or campaign_ids.has(str(campaign.get("id"))):
            return {}
        campaign_ids[str(campaign.get("id"))] = true
        var group_key := "waiting" if campaign.get("status") == "pending" else str(campaign.get("status"))
        var group: Array = moderation.get(group_key)
        group.append(campaign)

    if typeof(snapshot.get("controls")) != TYPE_DICTIONARY:
        return {}
    var source_controls: Dictionary = snapshot.get("controls")
    for control_key in ["canOpenMarket", "canOpenReveal", "canCloseMarket"]:
        if typeof(source_controls.get(control_key)) != TYPE_BOOL:
            return {}
    var controls := {
        "canOpenMarket": bool(source_controls.get("canOpenMarket")),
        "canOpenReveal": bool(source_controls.get("canOpenReveal")),
        "canCloseMarket": bool(source_controls.get("canCloseMarket"))
    }

    var reveal_result := _derive_teacher_reveal(snapshot, team_aliases)
    if not reveal_result.get("ok", false):
        return {}
    var team_count: int = Array(teams_result.get("teams")).size()
    var capacity := _derive_teacher_capacity(snapshot, team_count)
    if not capacity.get("ok", false):
        return {}
    var finished_count := int(teams_result.get("finishedCount"))
    var waiting_count: int = Array(moderation.get("waiting")).size()
    var approved_count: int = Array(moderation.get("approved")).size()
    moderation["counts"] = {
        "waiting": waiting_count,
        "approved": approved_count,
        "returned": Array(moderation.get("returned")).size(),
        "hidden": Array(moderation.get("hidden")).size(),
        "total": campaigns.size()
    }
    var readiness := {
        "teamCount": team_count,
        "finishedCount": finished_count,
        "unfinishedCount": team_count - finished_count,
        "pendingReviewCount": waiting_count,
        "approvedCampaignCount": approved_count,
        "allTeamsFinished": team_count > 0 and team_count == finished_count
    }
    var cohort: Dictionary = {}
    if snapshot.has("cohort"):
        cohort = _normalise_cohort(snapshot.get("cohort"), team_count)
        if cohort.is_empty():
            return {}
        readiness["participatingCount"] = int(cohort.get("participating"))
        readiness["spectatingCount"] = int(cohort.get("spectating"))
        readiness["requiredFinishedCount"] = int(cohort.get("requiredFinished"))
        readiness["finishedRequiredCount"] = int(cohort.get("finishedRequired"))
        readiness["allRequiredFinished"] = (
            int(cohort.get("requiredFinished")) > 0
            and int(cohort.get("requiredFinished")) == int(cohort.get("finishedRequired"))
        )
    var state := {
        "roomCode": str(snapshot.get("roomCode")),
        "roomId": str(snapshot.get("roomId")),
        "revision": int(snapshot.get("revision")),
        "phase": str(snapshot.get("phase")),
        "openingWalletCents": int(snapshot.get("openingWalletCents")),
        "capacity": capacity.get("value"),
        "teams": teams_result.get("teams"),
        "moderation": moderation,
        "readiness": readiness,
        "controls": controls,
        "reveal": reveal_result.get("reveal")
    }
    if not cohort.is_empty():
        state["cohort"] = cohort
    return state

func _derive_teacher_capacity(snapshot: Dictionary, team_count: int) -> Dictionary:
    var has_max_teams := snapshot.has("maxTeams")
    var has_available_seats := snapshot.has("availableSeats")
    if has_max_teams != has_available_seats:
        return {}
    if not has_max_teams:
        return {
            "ok": true,
            "value": {"known": false, "maxTeams": 0, "availableSeats": 0}
        }
    if (
        not _is_nonnegative_integer(snapshot.get("maxTeams"), 30)
        or int(snapshot.get("maxTeams")) < 3
        or not _is_nonnegative_integer(snapshot.get("availableSeats"), 30)
    ):
        return {}
    var max_teams := int(snapshot.get("maxTeams"))
    var available_seats := int(snapshot.get("availableSeats"))
    if available_seats > max_teams or team_count + available_seats != max_teams:
        return {}
    return {
        "ok": true,
        "value": {
            "known": true,
            "maxTeams": max_teams,
            "availableSeats": available_seats
        }
    }

func _valid_snapshot_header(snapshot: Dictionary, require_room_code: bool) -> bool:
    if (
        not _is_market_id(snapshot.get("roomId"))
        or not _is_nonnegative_integer(snapshot.get("revision"), MAX_SAFE_INTEGER)
        or typeof(snapshot.get("phase")) != TYPE_STRING
        or not PHASES.has(str(snapshot.get("phase")))
    ):
        return false
    return not require_room_code or _is_room_code(snapshot.get("roomCode"))

func _normalise_team_summaries(value: Variant, own_team_id: String) -> Dictionary:
    if typeof(value) != TYPE_ARRAY:
        return {}
    var teams: Array = value
    if teams.is_empty() or teams.size() > MAX_TEAMS:
        return {}
    var ids: Dictionary = {}
    var aliases: Dictionary = {}
    var normalised: Array[Dictionary] = []
    for team_value in teams:
        if typeof(team_value) != TYPE_DICTIONARY:
            return {}
        var team: Dictionary = team_value
        if (
            not _is_market_id(team.get("id"))
            or not _is_safe_string(team.get("alias"), 32, 2)
            or ids.has(str(team.get("id")))
        ):
            return {}
        ids[str(team.get("id"))] = true
        aliases[str(team.get("id"))] = str(team.get("alias"))
        normalised.append({"id": str(team.get("id")), "alias": str(team.get("alias"))})
    if not ids.has(own_team_id):
        return {}
    return {"ok": true, "ids": ids, "aliases": aliases, "teams": normalised}

func _normalise_teacher_teams(value: Variant) -> Dictionary:
    if typeof(value) != TYPE_ARRAY:
        return {}
    var teams: Array = value
    if teams.size() > MAX_TEAMS:
        return {}
    var ids: Dictionary = {}
    var aliases: Dictionary = {}
    var normalised: Array[Dictionary] = []
    var finished_count := 0
    for team_value in teams:
        if typeof(team_value) != TYPE_DICTIONARY:
            return {}
        var team: Dictionary = team_value
        if (
            not _is_market_id(team.get("id"))
            or not _is_safe_string(team.get("alias"), 32, 2)
            or not _is_positive_integer(team.get("joinedAt"), MAX_SAFE_INTEGER)
            or typeof(team.get("finished")) != TYPE_BOOL
            or ids.has(str(team.get("id")))
        ):
            return {}
        ids[str(team.get("id"))] = true
        aliases[str(team.get("id"))] = str(team.get("alias"))
        var finished := bool(team.get("finished"))
        if finished:
            finished_count += 1
        normalised.append({
            "id": str(team.get("id")),
            "alias": str(team.get("alias")),
            "joinedAt": int(team.get("joinedAt")),
            "finished": finished
        })
    return {
        "ok": true,
        "ids": ids,
        "aliases": aliases,
        "teams": normalised,
        "finishedCount": finished_count
    }

func _normalise_purchases(
    value: Variant,
    team_ids: Dictionary,
    own_team_id: String
) -> Dictionary:
    if typeof(value) != TYPE_ARRAY:
        return {}
    var purchases: Array = value
    if purchases.size() > MAX_PURCHASES:
        return {}
    var receipt_ids: Dictionary = {}
    var campaign_ids: Dictionary = {}
    var seller_ids: Dictionary = {}
    var seller_by_campaign: Dictionary = {}
    var price_by_campaign: Dictionary = {}
    var spent_total := 0
    for purchase_value in purchases:
        if typeof(purchase_value) != TYPE_DICTIONARY:
            return {}
        var purchase: Dictionary = purchase_value
        if (
            not _is_market_id(purchase.get("id"))
            or not _is_market_id(purchase.get("campaignId"))
            or not _is_market_id(purchase.get("sellerTeamId"))
            or not team_ids.has(str(purchase.get("sellerTeamId")))
            or str(purchase.get("sellerTeamId")) == own_team_id
            or not _is_positive_integer(purchase.get("price"), MAX_PRICE_CENTS)
            or not _is_positive_integer(purchase.get("purchasedAt"), MAX_SAFE_INTEGER)
            or receipt_ids.has(str(purchase.get("id")))
            or campaign_ids.has(str(purchase.get("campaignId")))
        ):
            return {}
        receipt_ids[str(purchase.get("id"))] = true
        campaign_ids[str(purchase.get("campaignId"))] = true
        seller_ids[str(purchase.get("sellerTeamId"))] = true
        seller_by_campaign[str(purchase.get("campaignId"))] = str(purchase.get("sellerTeamId"))
        price_by_campaign[str(purchase.get("campaignId"))] = int(purchase.get("price"))
        spent_total += int(purchase.get("price"))
        if spent_total > MAX_WALLET_CENTS:
            return {}
    return {
        "ok": true,
        "count": purchases.size(),
        "campaignIds": campaign_ids,
        "sellerIds": seller_ids,
        "sellerByCampaign": seller_by_campaign,
        "priceByCampaign": price_by_campaign,
        "spentTotal": spent_total
    }

func _normalise_market_eligibility(own: Dictionary, phase: String) -> Dictionary:
    if not own.has("marketEligibility"):
        return {
            "state": "building" if phase == "building" else "frozen",
            "role": "buyer-seller",
            "reason": "legacy-cohort"
        }
    if typeof(own.get("marketEligibility")) != TYPE_DICTIONARY:
        return {}
    var source: Dictionary = own.get("marketEligibility")
    if not _has_exact_keys(source, ["state", "role", "reason"]):
        return {}
    if (
        typeof(source.get("state")) != TYPE_STRING
        or not MARKET_ELIGIBILITY_STATES.has(str(source.get("state")))
        or typeof(source.get("role")) != TYPE_STRING
        or not MARKET_ELIGIBILITY_ROLES.has(str(source.get("role")))
        or typeof(source.get("reason")) != TYPE_STRING
        or not MARKET_ELIGIBILITY_REASONS.has(str(source.get("reason")))
    ):
        return {}
    return {
        "state": str(source.get("state")),
        "role": str(source.get("role")),
        "reason": str(source.get("reason"))
    }

func _normalise_cohort(value: Variant, team_count: int) -> Dictionary:
    if typeof(value) != TYPE_DICTIONARY:
        return {}
    var source: Dictionary = value
    var count_keys := [
        "totalJoined",
        "participating",
        "spectating",
        "buyers",
        "sellers",
        "requiredFinished",
        "finishedRequired"
    ]
    var expected_keys := ["frozen"] + count_keys
    if not _has_exact_keys(source, expected_keys) or typeof(source.get("frozen")) != TYPE_BOOL:
        return {}
    for key in count_keys:
        if not _is_nonnegative_integer(source.get(key), MAX_TEAMS):
            return {}
    var total_joined := int(source.get("totalJoined"))
    var participating := int(source.get("participating"))
    var spectating := int(source.get("spectating"))
    var buyers := int(source.get("buyers"))
    var sellers := int(source.get("sellers"))
    var required_finished := int(source.get("requiredFinished"))
    var finished_required := int(source.get("finishedRequired"))
    var frozen := bool(source.get("frozen"))
    if (
        total_joined != team_count
        or participating + spectating != total_joined
        or buyers > participating
        or sellers > participating
        or required_finished > buyers
        or finished_required > required_finished
        or (frozen and required_finished != buyers)
        or (not frozen and (required_finished != 0 or finished_required != 0))
    ):
        return {}
    return {
        "frozen": frozen,
        "totalJoined": total_joined,
        "participating": participating,
        "spectating": spectating,
        "buyers": buyers,
        "sellers": sellers,
        "requiredFinished": required_finished,
        "finishedRequired": finished_required
    }

func _normalise_team_campaign(
    value: Variant,
    own_team_id: String,
    team_aliases: Dictionary,
    bought_campaigns: Dictionary,
    wallet: int,
    phase: String,
    finished: bool,
    eligible_buyer: bool
) -> Dictionary:
    if typeof(value) != TYPE_DICTIONARY:
        return {}
    var campaign: Dictionary = value
    if (
        not _is_market_id(campaign.get("id"))
        or not _is_market_id(campaign.get("sellerTeamId"))
        or not team_aliases.has(str(campaign.get("sellerTeamId")))
        or not _is_safe_string(campaign.get("sellerAlias"), 32, 2)
        or team_aliases.get(str(campaign.get("sellerTeamId"))) != str(campaign.get("sellerAlias"))
        or typeof(campaign.get("status")) != TYPE_STRING
        or not CAMPAIGN_STATUSES.has(str(campaign.get("status")))
        or not _is_safe_string(campaign.get("productName"), 80)
        or not _is_positive_integer(campaign.get("price"), MAX_PRICE_CENTS)
        or not _is_artwork_key(campaign.get("artworkKey"))
    ):
        return {}
    for optional_key in ["tagline", "reviewNote"]:
        var maximum := 160 if optional_key == "tagline" else 240
        if campaign.has(optional_key) and not _is_safe_string(campaign.get(optional_key), maximum):
            return {}
    var is_own := str(campaign.get("sellerTeamId")) == own_team_id
    var status := str(campaign.get("status"))
    if not is_own and status != "approved":
        return {}
    var price := int(campaign.get("price"))
    var is_bought := bought_campaigns.has(str(campaign.get("id")))
    var is_affordable := price <= wallet
    var card := {
        "id": str(campaign.get("id")),
        "sellerTeamId": str(campaign.get("sellerTeamId")),
        "sellerAlias": str(campaign.get("sellerAlias")),
        "status": status,
        "displayStatus": _display_status(status),
        "productName": str(campaign.get("productName")),
        "priceCents": price,
        "artworkKey": str(campaign.get("artworkKey")),
        "isOwn": is_own,
        "isBought": is_bought,
        "isAffordable": is_affordable,
        "canBuy": (
            phase == "market"
            and eligible_buyer
            and not finished
            and status == "approved"
            and not is_own
            and not is_bought
            and is_affordable
        )
    }
    for optional_key in ["tagline", "reviewNote"]:
        if campaign.has(optional_key):
            card[optional_key] = str(campaign.get(optional_key))
    return card

func _normalise_teacher_campaign(value: Variant, team_aliases: Dictionary) -> Dictionary:
    if typeof(value) != TYPE_DICTIONARY:
        return {}
    var campaign: Dictionary = value
    if (
        not _is_market_id(campaign.get("id"))
        or not _is_market_id(campaign.get("sellerTeamId"))
        or not team_aliases.has(str(campaign.get("sellerTeamId")))
        or not _is_safe_string(campaign.get("sellerAlias"), 32, 2)
        or team_aliases.get(str(campaign.get("sellerTeamId"))) != str(campaign.get("sellerAlias"))
        or typeof(campaign.get("status")) != TYPE_STRING
        or not CAMPAIGN_STATUSES.has(str(campaign.get("status")))
        or not _is_safe_string(campaign.get("productName"), 80)
        or not _is_positive_integer(campaign.get("priceCents"), MAX_PRICE_CENTS)
        or not _is_artwork_key(campaign.get("artworkKey"))
    ):
        return {}
    for optional_key in ["tagline", "reviewNote"]:
        var maximum := 160 if optional_key == "tagline" else 240
        if campaign.has(optional_key) and not _is_safe_string(campaign.get(optional_key), maximum):
            return {}
    var normalised := {
        "id": str(campaign.get("id")),
        "sellerTeamId": str(campaign.get("sellerTeamId")),
        "sellerAlias": str(campaign.get("sellerAlias")),
        "status": str(campaign.get("status")),
        "displayStatus": _display_status(str(campaign.get("status"))),
        "productName": str(campaign.get("productName")),
        "priceCents": int(campaign.get("priceCents")),
        "artworkKey": str(campaign.get("artworkKey"))
    }
    for optional_key in ["tagline", "reviewNote"]:
        if campaign.has(optional_key):
            normalised[optional_key] = str(campaign.get(optional_key))
    return normalised

func _derive_teacher_reveal(snapshot: Dictionary, team_aliases: Dictionary) -> Dictionary:
    var hidden := {"visible": false, "topThree": []}
    var phase := str(snapshot.get("phase"))
    if phase not in ["reveal", "closed"] or not snapshot.has("reveal"):
        return {"ok": true, "reveal": hidden}
    if typeof(snapshot.get("reveal")) != TYPE_DICTIONARY:
        return {}
    var source_reveal: Dictionary = snapshot.get("reveal")
    if typeof(source_reveal.get("standings")) != TYPE_ARRAY:
        return {}
    var standings: Array = source_reveal.get("standings")
    if standings.size() > MAX_TEAMS:
        return {}
    var standing_team_ids: Dictionary = {}
    var top_three: Array[Dictionary] = []
    for index in standings.size():
        var standing_value: Variant = standings[index]
        if typeof(standing_value) != TYPE_DICTIONARY:
            return {}
        var standing: Dictionary = standing_value
        if (
            not _is_positive_integer(standing.get("rank"), MAX_TEAMS)
            or int(standing.get("rank")) != index + 1
            or not _is_market_id(standing.get("teamId"))
            or not team_aliases.has(str(standing.get("teamId")))
            or not _is_safe_string(standing.get("alias"), 32, 2)
            or team_aliases.get(str(standing.get("teamId"))) != str(standing.get("alias"))
            or not _is_nonnegative_integer(standing.get("revenue"), MAX_SAFE_INTEGER)
            or not _is_nonnegative_integer(standing.get("sales"), MAX_PURCHASES)
            or standing_team_ids.has(str(standing.get("teamId")))
        ):
            return {}
        standing_team_ids[str(standing.get("teamId"))] = true
        if index < 3:
            top_three.append({
                "place": index + 1,
                "teamId": str(standing.get("teamId")),
                "alias": str(standing.get("alias")),
                "revenueCents": int(standing.get("revenue")),
                "sales": int(standing.get("sales"))
            })
    if standing_team_ids.size() != team_aliases.size():
        return {}
    return {"ok": true, "reveal": {"visible": true, "topThree": top_three}}

func _display_status(status: String) -> String:
    if status == "pending":
        return "waiting"
    if status == "approved":
        return "live"
    return status

func _is_safe_string(value: Variant, max_length: int, min_length: int = 1) -> bool:
    if typeof(value) != TYPE_STRING:
        return false
    var text := str(value)
    return (
        text.length() >= min_length
        and text.length() <= max_length
        and text == text.strip_edges()
        and not _has_control_characters(text)
    )

func _has_exact_keys(value: Dictionary, expected_keys: Array) -> bool:
    if value.size() != expected_keys.size():
        return false
    for key in expected_keys:
        if not value.has(key):
            return false
    return true

func _has_control_characters(value: String) -> bool:
    for character in value:
        var code := character.unicode_at(0)
        if code < 32 or (code >= 127 and code <= 159) or code == 8232 or code == 8233:
            return true
    return false

func _is_nonnegative_integer(value: Variant, maximum: int) -> bool:
    if typeof(value) == TYPE_INT:
        return int(value) >= 0 and int(value) <= maximum
    if typeof(value) != TYPE_FLOAT:
        return false
    var number := float(value)
    return is_finite(number) and number >= 0.0 and number <= maximum and number == floor(number)

func _is_positive_integer(value: Variant, maximum: int) -> bool:
    return _is_nonnegative_integer(value, maximum) and float(value) >= 1.0

func _is_market_id(value: Variant) -> bool:
    return _is_ascii_token(value, 64, MARKET_ID_SUFFIX)

func _is_artwork_key(value: Variant) -> bool:
    return _is_ascii_token(value, 256, ARTWORK_KEY_SUFFIX)

func _is_ascii_token(value: Variant, max_length: int, suffix_characters: String) -> bool:
    if typeof(value) != TYPE_STRING:
        return false
    var token := str(value)
    if token.is_empty() or token.length() > max_length:
        return false
    if not ASCII_ALPHANUMERIC.contains(token[0]):
        return false
    for index in range(1, token.length()):
        if not suffix_characters.contains(token[index]):
            return false
    return true

func _is_room_code(value: Variant) -> bool:
    if typeof(value) != TYPE_STRING:
        return false
    var room_code := str(value)
    if room_code.length() != 7 or room_code[3] != "-":
        return false
    var alphabet := "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
    for index in [0, 1, 2, 4, 5, 6]:
        if not alphabet.contains(room_code[index]):
            return false
    return true

func _invalid() -> Dictionary:
    return INVALID_RESULT.duplicate(true)
