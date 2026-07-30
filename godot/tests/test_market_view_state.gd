extends RefCounted
class_name AdMarketTestMarketViewState

const MarketViewState = preload("res://src/market/market_view_state.gd")

func run() -> bool:
    assert(_team_snapshot_derives_render_ready_cards_and_readiness())
    assert(_medal_team_snapshot_keeps_price_as_evidence_and_requires_all_three_awards())
    assert(_team_finish_readiness_handles_no_affordable_option_and_finished_state())
    assert(_team_market_eligibility_controls_spectator_actions())
    assert(_team_snapshot_tolerates_a_purchased_campaign_becoming_hidden())
    assert(_teacher_snapshot_derives_moderation_readiness_controls_and_podium())
    assert(_teacher_medal_snapshot_derives_points_podium_without_wallet_fields())
    assert(_teacher_cohort_counts_track_required_teams_not_spectators())
    assert(_teacher_snapshot_never_exposes_live_rankings())
    assert(_malformed_current_shapes_are_rejected_without_echoing_data())
    assert(_malformed_snapshots_fail_with_one_stable_diagnostic())
    return true

func _medal_team_snapshot_keeps_price_as_evidence_and_requires_all_three_awards() -> bool:
    var source := _medal_team_snapshot()
    var result: Dictionary = MarketViewState.new().derive(source)
    assert(result.get("ok") == true)
    var state: Dictionary = result.get("state")
    assert(state.get("marketMode") == "medals")
    assert(not state.has("money"))
    assert(not state.has("purchaseSummary"))
    assert(state.get("awardSummary").get("complete") == true)
    assert(state.get("awardSummary").get("awardCount") == 3)
    assert(state.get("finishReadiness").get("locallyReady") == true)
    var cards: Array = state.get("cards")
    assert(cards[1].get("priceCents") == 900000)
    assert(cards[1].get("awardedMedal") == "gold")
    assert(cards[2].get("awardedMedal") == "silver")
    assert(cards[3].get("awardedMedal") == "bronze")
    assert(cards[0].get("canAward") == false)

    source["myAwards"].pop_back()
    result = MarketViewState.new().derive(source)
    assert(result.get("ok") == true)
    assert(result.get("state").get("awardSummary").get("complete") == false)
    assert(result.get("state").get("finishReadiness").get("locallyReady") == false)

    source = _medal_team_snapshot()
    source["myAwards"][2]["medal"] = "silver"
    assert(MarketViewState.new().derive(source) == _invalid_result())
    return true

func _teacher_medal_snapshot_derives_points_podium_without_wallet_fields() -> bool:
    var source := _teacher_snapshot()
    source["marketMode"] = "medals"
    source.erase("openingWalletCents")
    source["awardCount"] = 12.0
    source["reveal"]["standings"] = [
        _medal_standing(1, "team-b", "Pixel Pirates", 9, 3, 0, 0),
        _medal_standing(2, "team-a", "Signal Foxes", 7, 1, 2, 0),
        _medal_standing(3, "team-c", "Neon Narwhals", 5, 0, 2, 1),
        _medal_standing(4, "team-d", "Fourth Finish", 3, 0, 0, 3)
    ]
    var result: Dictionary = MarketViewState.new().derive(source)
    assert(result.get("ok") == true)
    var state: Dictionary = result.get("state")
    assert(state.get("marketMode") == "medals")
    assert(state.get("awardCount") == 12)
    assert(not state.has("openingWalletCents"))
    assert(state.get("reveal").get("topThree")[0] == {
        "place": 1,
        "teamId": "team-b",
        "alias": "Pixel Pirates",
        "points": 9,
        "gold": 3,
        "silver": 0,
        "bronze": 0
    })
    return true

func _team_snapshot_derives_render_ready_cards_and_readiness() -> bool:
    var source := _team_snapshot()
    var result: Dictionary = MarketViewState.new().derive(source)
    assert(result.get("ok") == true)
    assert(result.get("role") == "team")
    var state: Dictionary = result.get("state")
    assert(state.get("roomId") == "room-team")
    assert(state.get("revision") == 7)
    assert(state.get("phase") == "market")

    var cards: Array = state.get("cards")
    assert(cards.map(func(card: Dictionary) -> String: return str(card.get("id"))) == [
        "campaign-own-waiting",
        "campaign-bought-b",
        "campaign-bought-c",
        "campaign-affordable",
        "campaign-own-returned",
        "campaign-own-hidden"
    ])
    assert(cards[0].get("isOwn") and not cards[0].get("canBuy"))
    assert(cards[0].get("displayStatus") == "waiting")
    assert(cards[1].get("isBought") and not cards[1].get("canBuy"))
    assert(cards[2].get("isBought") and not cards[2].get("isAffordable"))
    assert(cards[3].get("isAffordable") and cards[3].get("canBuy"))
    assert(cards[4].get("displayStatus") == "returned")
    assert(cards[5].get("displayStatus") == "hidden")

    var money: Dictionary = state.get("money")
    assert(money == {
        "walletCents": 2000,
        "spentCents": 8000,
        "openingWalletCents": 10000,
        "walletPercentRemaining": 20.0,
        "spentPercent": 80.0
    })
    assert(state.get("purchaseSummary") == {
        "purchaseCount": 2,
        "distinctSellerCount": 2
    })
    var readiness: Dictionary = state.get("finishReadiness")
    assert(readiness.get("serverAuthoritative") == true)
    assert(readiness.get("hasTwoSellers") == true)
    assert(readiness.get("spentEnough") == true)
    assert(readiness.get("noAffordablePurchaseRemains") == false)
    assert(readiness.get("alreadyFinished") == false)
    assert(readiness.get("eligibleBuyer") == true)
    assert(readiness.get("locallyReady") == true)
    assert(state.get("marketEligibility") == {
        "state": "frozen",
        "role": "buyer-seller",
        "reason": "legacy-cohort"
    })
    assert(state.get("statusCounts") == {
        "waiting": 1,
        "approved": 3,
        "returned": 1,
        "hidden": 1
    })
    assert(source.get("campaigns")[0].get("price") == 1000.0)
    assert(not source.get("campaigns")[0].has("priceCents"))
    return true

func _malformed_snapshots_fail_with_one_stable_diagnostic() -> bool:
    var view_state := MarketViewState.new()
    var expected := _invalid_result()
    for malformed in [
        null,
        [],
        {},
        {"own": {"alias": "PRIVATE-ALIAS-SHOULD-NOT-ECHO"}},
        {"controls": {}, "openingWalletCents": "not-money"}
    ]:
        var result: Dictionary = view_state.derive(malformed)
        assert(result == expected)
        assert(not JSON.stringify(result).contains("PRIVATE-ALIAS-SHOULD-NOT-ECHO"))
    return true

func _team_finish_readiness_handles_no_affordable_option_and_finished_state() -> bool:
    var source := _team_snapshot()
    source["own"]["wallet"] = 9000.0
    source["own"]["spent"] = 1000.0
    source["campaigns"][1]["price"] = 400.0
    source["campaigns"][2]["price"] = 600.0
    source["campaigns"][3]["price"] = 9500.0
    source["myPurchases"][0]["price"] = 400.0
    source["myPurchases"][1]["price"] = 600.0
    var result: Dictionary = MarketViewState.new().derive(source)
    assert(result.get("ok") == true)
    var readiness: Dictionary = result.get("state").get("finishReadiness")
    assert(readiness.get("spentEnough") == false)
    assert(readiness.get("noAffordablePurchaseRemains") == true)
    assert(readiness.get("hasTwoSellers") == true)
    assert(readiness.get("locallyReady") == true)

    source["own"]["finished"] = true
    result = MarketViewState.new().derive(source)
    assert(result.get("ok") == true)
    readiness = result.get("state").get("finishReadiness")
    assert(readiness.get("alreadyFinished") == true)
    assert(readiness.get("locallyReady") == false)
    for card in result.get("state").get("cards"):
        assert(card.get("canBuy") == false)
    return true

func _team_market_eligibility_controls_spectator_actions() -> bool:
    var source := _team_snapshot()
    source["own"]["marketEligibility"] = {
        "state": "frozen",
        "role": "spectator",
        "reason": "not-in-cohort"
    }
    var result: Dictionary = MarketViewState.new().derive(source)
    assert(result.get("ok") == true)
    var state: Dictionary = result.get("state")
    assert(state.get("marketEligibility") == source.get("own").get("marketEligibility"))
    assert(state.get("finishReadiness").get("eligibleBuyer") == false)
    assert(state.get("finishReadiness").get("locallyReady") == false)
    for card in state.get("cards"):
        assert(card.get("canBuy") == false)

    source["own"]["marketEligibility"]["extra"] = "PRIVATE"
    result = MarketViewState.new().derive(source)
    assert(result == _invalid_result())
    assert(not JSON.stringify(result).contains("PRIVATE"))
    return true

func _team_snapshot_tolerates_a_purchased_campaign_becoming_hidden() -> bool:
    var source := _team_snapshot()
    source["campaigns"].remove_at(1)
    var result: Dictionary = MarketViewState.new().derive(source)
    assert(result.get("ok") == true)
    assert(result.get("state").get("purchaseSummary") == {
        "purchaseCount": 2,
        "distinctSellerCount": 2
    })
    assert(not _ids(result.get("state").get("cards")).has("campaign-bought-b"))
    return true

func _malformed_current_shapes_are_rejected_without_echoing_data() -> bool:
    var malformed_team_alias := _team_snapshot()
    malformed_team_alias["campaigns"][1]["sellerAlias"] = "PRIVATE-MISMATCH"
    var malformed_purchase := _team_snapshot()
    malformed_purchase["myPurchases"][0]["sellerTeamId"] = "team-d"
    var malformed_spent := _team_snapshot()
    malformed_spent["own"]["spent"] = 7999.0
    var malformed_teacher_campaign := _teacher_snapshot()
    malformed_teacher_campaign["campaigns"][0]["priceCents"] = "PRIVATE-PRICE"
    var malformed_reveal := _teacher_snapshot()
    malformed_reveal["reveal"]["standings"][0]["teamId"] = "private-unknown-team"
    var malformed_capacity := _teacher_snapshot()
    malformed_capacity["availableSeats"] = 31.0
    for malformed in [
        malformed_team_alias,
        malformed_purchase,
        malformed_spent,
        malformed_teacher_campaign,
        malformed_reveal,
        malformed_capacity
    ]:
        var result: Dictionary = MarketViewState.new().derive(malformed)
        assert(result == _invalid_result())
        assert(not JSON.stringify(result).contains("PRIVATE"))
        assert(not JSON.stringify(result).contains("private-unknown-team"))
    return true

func _teacher_snapshot_derives_moderation_readiness_controls_and_podium() -> bool:
    var source := _teacher_snapshot()
    var result: Dictionary = MarketViewState.new().derive(source)
    assert(result.get("ok") == true)
    assert(result.get("role") == "teacher")
    var state: Dictionary = result.get("state")
    assert(state.get("roomCode") == "ABC-234")
    assert(state.get("roomId") == "room-teacher")
    assert(state.get("revision") == 9)
    assert(state.get("phase") == "reveal")
    assert(state.get("openingWalletCents") == 10000)
    assert(state.get("capacity") == {
        "known": true,
        "maxTeams": 30,
        "availableSeats": 26
    })
    assert(state.get("controls") == {
        "canOpenMarket": false,
        "canOpenReveal": true,
        "canCloseMarket": true
    })

    var moderation: Dictionary = state.get("moderation")
    assert(_ids(moderation.get("waiting")) == ["campaign-waiting-a", "campaign-waiting-b"])
    assert(_ids(moderation.get("approved")) == ["campaign-live-a", "campaign-live-b"])
    assert(_ids(moderation.get("returned")) == ["campaign-returned"])
    assert(_ids(moderation.get("hidden")) == ["campaign-hidden"])
    assert(moderation.get("counts") == {
        "waiting": 2,
        "approved": 2,
        "returned": 1,
        "hidden": 1,
        "total": 6
    })

    assert(state.get("readiness") == {
        "teamCount": 4,
        "finishedCount": 2,
        "unfinishedCount": 2,
        "pendingReviewCount": 2,
        "approvedCampaignCount": 2,
        "allTeamsFinished": false
    })
    var reveal: Dictionary = state.get("reveal")
    assert(reveal.get("visible") == true)
    var top_three: Array = reveal.get("topThree")
    assert(top_three.size() == 3)
    assert(top_three[0] == {
        "place": 1,
        "teamId": "team-b",
        "alias": "Pixel Pirates",
        "revenueCents": 22000,
        "sales": 5
    })
    assert(top_three[2].get("place") == 3)
    assert(not JSON.stringify(reveal).contains("Fourth Finish"))
    assert(not JSON.stringify(reveal).contains("lastPlace"))
    assert(not JSON.stringify(reveal).contains("standings"))
    assert(not JSON.stringify(result).contains("uploadQuota"))
    assert(source.get("campaigns")[0].get("id") == "campaign-waiting-a")
    return true

func _teacher_cohort_counts_track_required_teams_not_spectators() -> bool:
    var source := _teacher_snapshot()
    source["phase"] = "market"
    source.erase("reveal")
    source["cohort"] = {
        "frozen": true,
        "totalJoined": 4.0,
        "participating": 3.0,
        "spectating": 1.0,
        "buyers": 3.0,
        "sellers": 3.0,
        "requiredFinished": 3.0,
        "finishedRequired": 2.0
    }
    var result: Dictionary = MarketViewState.new().derive(source)
    assert(result.get("ok") == true)
    var state: Dictionary = result.get("state")
    assert(state.get("cohort") == {
        "frozen": true,
        "totalJoined": 4,
        "participating": 3,
        "spectating": 1,
        "buyers": 3,
        "sellers": 3,
        "requiredFinished": 3,
        "finishedRequired": 2
    })
    var readiness: Dictionary = state.get("readiness")
    assert(readiness.get("participatingCount") == 3)
    assert(readiness.get("spectatingCount") == 1)
    assert(readiness.get("requiredFinishedCount") == 3)
    assert(readiness.get("finishedRequiredCount") == 2)
    assert(readiness.get("allRequiredFinished") == false)

    source["cohort"]["finishedRequired"] = 4.0
    result = MarketViewState.new().derive(source)
    assert(result == _invalid_result())
    return true

func _teacher_snapshot_never_exposes_live_rankings() -> bool:
    var source := _teacher_snapshot()
    source["phase"] = "market"
    var result: Dictionary = MarketViewState.new().derive(source)
    assert(result.get("ok") == true)
    var reveal: Dictionary = result.get("state").get("reveal")
    assert(reveal == {"visible": false, "topThree": []})
    assert(not JSON.stringify(result).contains("standings"))
    assert(not JSON.stringify(result).contains('"rank"'))
    return true

func _team_snapshot() -> Dictionary:
    return {
        "roomId": "room-team",
        "revision": 7.0,
        "phase": "market",
        "own": {
            "teamId": "team-a",
            "alias": "Signal Foxes",
            "wallet": 2000.0,
            "spent": 8000.0,
            "finished": false
        },
        "teams": [
            {"id": "team-a", "alias": "Signal Foxes"},
            {"id": "team-b", "alias": "Pixel Pirates"},
            {"id": "team-c", "alias": "Neon Narwhals"},
            {"id": "team-d", "alias": "Bright Bunch"}
        ],
        "campaigns": [
            _team_campaign("campaign-own-waiting", "team-a", "Signal Foxes", "pending", 1000),
            _team_campaign("campaign-bought-b", "team-b", "Pixel Pirates", "approved", 500),
            _team_campaign("campaign-bought-c", "team-c", "Neon Narwhals", "approved", 7500),
            _team_campaign("campaign-affordable", "team-d", "Bright Bunch", "approved", 1500),
            _team_campaign("campaign-own-returned", "team-a", "Signal Foxes", "returned", 1200),
            _team_campaign("campaign-own-hidden", "team-a", "Signal Foxes", "hidden", 900)
        ],
        "myPurchases": [
            {
                "id": "receipt-b",
                "campaignId": "campaign-bought-b",
                "sellerTeamId": "team-b",
                "price": 500.0,
                "purchasedAt": 1000.0
            },
            {
                "id": "receipt-c",
                "campaignId": "campaign-bought-c",
                "sellerTeamId": "team-c",
                "price": 7500.0,
                "purchasedAt": 1001.0
            }
        ]
    }

func _medal_team_snapshot() -> Dictionary:
    return {
        "roomId": "room-medals",
        "revision": 12.0,
        "phase": "market",
        "marketMode": "medals",
        "own": {
            "teamId": "team-a",
            "alias": "Signal Foxes",
            "finished": false,
            "marketEligibility": {
                "state": "frozen",
                "role": "buyer-seller",
                "reason": "approved-campaign"
            }
        },
        "teams": [
            {"id": "team-a", "alias": "Signal Foxes"},
            {"id": "team-b", "alias": "Pixel Pirates"},
            {"id": "team-c", "alias": "Neon Narwhals"},
            {"id": "team-d", "alias": "Bright Bunch"}
        ],
        "campaigns": [
            _team_campaign("campaign-a", "team-a", "Signal Foxes", "approved", 100),
            _team_campaign("campaign-b", "team-b", "Pixel Pirates", "approved", 900000),
            _team_campaign("campaign-c", "team-c", "Neon Narwhals", "approved", 5000),
            _team_campaign("campaign-d", "team-d", "Bright Bunch", "approved", 50)
        ],
        "myPurchases": [],
        "myAwards": [
            _award("award-gold", "campaign-b", "team-b", "gold", 2000),
            _award("award-silver", "campaign-c", "team-c", "silver", 2001),
            _award("award-bronze", "campaign-d", "team-d", "bronze", 2002)
        ]
    }

func _award(id: String, campaign_id: String, seller_team_id: String, medal: String, awarded_at: int) -> Dictionary:
    return {
        "id": id,
        "campaignId": campaign_id,
        "sellerTeamId": seller_team_id,
        "medal": medal,
        "awardedAt": float(awarded_at)
    }

func _team_campaign(
    id: String,
    seller_team_id: String,
    seller_alias: String,
    status: String,
    price: int
) -> Dictionary:
    return {
        "id": id,
        "sellerTeamId": seller_team_id,
        "sellerAlias": seller_alias,
        "status": status,
        "productName": "Product %s" % id,
        "tagline": "A campaign tagline",
        "price": float(price),
        "artworkKey": "rooms/room-team/%s.png" % id
    }

func _teacher_snapshot() -> Dictionary:
    return {
        "roomCode": "ABC-234",
        "roomId": "room-teacher",
        "revision": 9.0,
        "phase": "reveal",
        "openingWalletCents": 10000.0,
        "teams": [
            _teacher_team("team-a", "Signal Foxes", true, 1000),
            _teacher_team("team-b", "Pixel Pirates", true, 1001),
            _teacher_team("team-c", "Neon Narwhals", false, 1002),
            _teacher_team("team-d", "Fourth Finish", false, 1003)
        ],
        "campaigns": [
            _teacher_campaign("campaign-waiting-a", "team-a", "Signal Foxes", "pending", 1000),
            _teacher_campaign("campaign-live-a", "team-b", "Pixel Pirates", "approved", 2000),
            _teacher_campaign("campaign-returned", "team-c", "Neon Narwhals", "returned", 3000),
            _teacher_campaign("campaign-live-b", "team-d", "Fourth Finish", "approved", 4000),
            _teacher_campaign("campaign-hidden", "team-a", "Signal Foxes", "hidden", 5000),
            _teacher_campaign("campaign-waiting-b", "team-c", "Neon Narwhals", "pending", 6000)
        ],
        "controls": {
            "canOpenMarket": false,
            "canOpenReveal": true,
            "canCloseMarket": true
        },
        "reveal": {
            "roomId": "room-teacher",
            "revision": 9.0,
            "standings": [
                _standing(1, "team-b", "Pixel Pirates", 22000, 5),
                _standing(2, "team-a", "Signal Foxes", 19000, 4),
                _standing(3, "team-c", "Neon Narwhals", 15000, 3),
                _standing(4, "team-d", "Fourth Finish", 2000, 1)
            ]
        },
        "uploadQuota": {"remaining": 7},
        "maxTeams": 30,
        "availableSeats": 26,
        "removeTeam": {"enabled": true}
    }

func _teacher_team(id: String, alias: String, finished: bool, joined_at: int) -> Dictionary:
    return {
        "id": id,
        "alias": alias,
        "joinedAt": float(joined_at),
        "finished": finished,
        "futureTeacherField": true
    }

func _teacher_campaign(
    id: String,
    seller_team_id: String,
    seller_alias: String,
    status: String,
    price_cents: int
) -> Dictionary:
    return {
        "id": id,
        "sellerTeamId": seller_team_id,
        "sellerAlias": seller_alias,
        "status": status,
        "productName": "Product %s" % id,
        "tagline": "A campaign tagline",
        "priceCents": float(price_cents),
        "artworkKey": "rooms/room-teacher/%s.png" % id,
        "submittedAt": 1100.0,
        "futureCampaignField": {"keptByServer": true}
    }

func _standing(
    rank: int,
    team_id: String,
    alias: String,
    revenue: int,
    sales: int
) -> Dictionary:
    return {
        "rank": float(rank),
        "teamId": team_id,
        "alias": alias,
        "revenue": float(revenue),
        "sales": float(sales)
    }

func _medal_standing(
    rank: int,
    team_id: String,
    alias: String,
    points: int,
    gold: int,
    silver: int,
    bronze: int
) -> Dictionary:
    return {
        "rank": float(rank),
        "teamId": team_id,
        "alias": alias,
        "revenue": 0.0,
        "sales": 0.0,
        "points": float(points),
        "gold": float(gold),
        "silver": float(silver),
        "bronze": float(bronze)
    }

func _ids(campaigns: Array) -> Array[String]:
    var ids: Array[String] = []
    for campaign in campaigns:
        ids.append(str(campaign.get("id")))
    return ids

func _invalid_result() -> Dictionary:
    return {
        "ok": false,
        "diagnostic": {
            "code": "INVALID_MARKET_SNAPSHOT",
            "message": "Live Market data could not be displayed safely."
        }
    }
