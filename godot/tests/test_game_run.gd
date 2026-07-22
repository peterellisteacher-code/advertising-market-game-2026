extends RefCounted

const GameRun = preload("res://src/game/GameRun.gd")

func run() -> bool:
    assert(_levels_advance_only_after_the_current_level_is_ready())
    assert(_pitch_snapshot_round_trips_identity_phase_and_ready_levels())
    assert(_pitch_snapshot_restore_rejects_invalid_state_atomically())
    assert(_market_wallet_rejects_unsafe_purchases())
    assert(_market_finish_requires_two_sellers_and_most_of_the_wallet())
    assert(_medal_market_rejects_unsafe_or_duplicate_awards())
    assert(_medal_market_finish_requires_three_distinct_campaigns())
    return true

func _levels_advance_only_after_the_current_level_is_ready() -> bool:
    var game := GameRun.new()
    assert(game.phase == "lobby")
    assert(not game.begin("  Neon Narwhals  ", "session-7", "team-7"))
    assert(game.last_error == "Team alias must not have surrounding spaces")
    assert(game.begin("Neon Narwhals", "session-7", "team-7"))
    assert(game.phase == "invent")
    assert(game.team_alias == "Neon Narwhals")
    assert(not game.advance_level())
    assert(game.mark_current_level_ready())
    assert(game.invalidate_current_level())
    assert(not game.advance_level())
    assert(game.last_error == "Finish this level before moving on")
    assert(game.mark_current_level_ready())
    assert(game.advance_level())
    assert(game.phase == "sell")
    assert(game.mark_current_level_ready())
    assert(game.advance_level())
    assert(game.phase == "irresistible")
    assert(game.mark_current_level_ready())
    assert(game.advance_level())
    assert(game.phase == "publish-check")
    assert(not game.advance_level())
    return true

func _market_wallet_rejects_unsafe_purchases() -> bool:
    var game := _ready_for_market()
    assert(game.open_market(10000))
    assert(game.phase == "market")
    assert(not game.purchase("own-campaign", "team-7", 1200))
    assert(game.last_error == "You cannot buy your own product")
    assert(game.purchase("campaign-a", "team-a", 3200))
    assert(game.wallet_cents == 6800)
    assert(not game.purchase("campaign-a", "team-a", 3200))
    assert(game.last_error == "That product is already in your basket")
    assert(not game.purchase("campaign-b", "team-b", 7000))
    assert(game.last_error == "That product costs more than your remaining wallet")
    return true

func _pitch_snapshot_round_trips_identity_phase_and_ready_levels() -> bool:
    var source := GameRun.new()
    assert(source.begin("Neon Narwhals", "local-session", "local-team"))
    assert(source.mark_current_level_ready())
    assert(source.advance_level())
    assert(source.mark_current_level_ready())
    var snapshot: Dictionary = source.pitch_snapshot()
    assert(snapshot == {
        "contract": "pitch-run@1",
        "phase": "sell",
        "teamAlias": "Neon Narwhals",
        "sessionId": "local-session",
        "teamId": "local-team",
        "readyLevels": ["invent", "sell"]
    })

    var restored := GameRun.new()
    assert(restored.restore_pitch_snapshot(snapshot))
    assert(restored.phase == "sell")
    assert(restored.team_alias == "Neon Narwhals")
    assert(restored.session_id == "local-session")
    assert(restored.team_id == "local-team")
    assert(restored.is_current_level_ready())
    assert(restored.invalidate_current_level())
    assert(not restored.is_current_level_ready())
    return true

func _pitch_snapshot_restore_rejects_invalid_state_atomically() -> bool:
    var game := GameRun.new()
    assert(game.begin("Existing Pair", "existing-session", "existing-team"))
    var before: Dictionary = game.pitch_snapshot()
    var valid := {
        "contract": "pitch-run@1",
        "phase": "sell",
        "teamAlias": "Neon Narwhals",
        "sessionId": "local-session",
        "teamId": "local-team",
        "readyLevels": ["invent"]
    }
    var invalid_cases: Array[Dictionary] = []
    var wrong_contract := valid.duplicate(true)
    wrong_contract["contract"] = "pitch-run@999"
    invalid_cases.append(wrong_contract)
    var unknown_phase := valid.duplicate(true)
    unknown_phase["phase"] = "secret-level"
    invalid_cases.append(unknown_phase)
    var unsafe_team := valid.duplicate(true)
    unsafe_team["teamId"] = " local-team "
    invalid_cases.append(unsafe_team)
    var duplicate_ready := valid.duplicate(true)
    duplicate_ready["readyLevels"] = ["invent", "invent"]
    invalid_cases.append(duplicate_ready)
    var skipped_ready := valid.duplicate(true)
    skipped_ready["readyLevels"] = ["sell"]
    invalid_cases.append(skipped_ready)
    var missing_previous := valid.duplicate(true)
    missing_previous["phase"] = "irresistible"
    missing_previous["readyLevels"] = ["invent"]
    invalid_cases.append(missing_previous)
    var impossible_publish := valid.duplicate(true)
    impossible_publish["phase"] = "publish-check"
    impossible_publish["readyLevels"] = ["invent", "sell"]
    invalid_cases.append(impossible_publish)

    for invalid in invalid_cases:
        assert(not game.restore_pitch_snapshot(invalid))
        assert(game.pitch_snapshot() == before)
    return true

func _market_finish_requires_two_sellers_and_most_of_the_wallet() -> bool:
    var game := _ready_for_market()
    assert(game.open_market(10000))
    assert(game.purchase("campaign-a", "team-a", 5000))
    assert(not game.finish_shopping())
    assert(game.last_error == "Visit at least two different sellers")
    assert(game.purchase("campaign-b", "team-b", 2500))
    assert(not game.finish_shopping())
    assert(game.last_error == "Spend at least 80% of your wallet")
    assert(game.purchase("campaign-c", "team-c", 500))
    assert(game.finish_shopping())
    assert(game.phase == "reveal")
    assert(game.spent_cents() == 8000)
    assert(game.purchases().size() == 3)
    return true

func _medal_market_rejects_unsafe_or_duplicate_awards() -> bool:
    var game := _ready_for_market()
    assert(game.open_medal_market())
    assert(game.phase == "market")
    assert(game.market_mode == "medals")
    assert(game.wallet_cents == 0)
    assert(not game.purchase("campaign-a", "team-a", 3200))
    assert(game.last_error == "This market awards medals instead of purchases")
    assert(not game.award("own-campaign", "team-7", "gold"))
    assert(game.last_error == "You cannot award your own campaign")
    assert(not game.award("campaign-a", "team-a", "platinum"))
    assert(game.last_error == "Choose Gold, Silver or Bronze")
    assert(game.award("campaign-a", "team-a", "gold"))
    assert(not game.award("campaign-a", "team-a", "silver"))
    assert(game.last_error == "Each medal must go to a different campaign")
    assert(game.award("campaign-b", "team-b", "gold"))
    assert(game.awards() == [{
        "campaignId": "campaign-b",
        "sellerTeamId": "team-b",
        "medal": "gold"
    }])
    return true

func _medal_market_finish_requires_three_distinct_campaigns() -> bool:
    var game := _ready_for_market()
    assert(game.open_medal_market())
    assert(game.award("campaign-a", "team-a", "gold"))
    assert(game.award("campaign-b", "team-b", "silver"))
    assert(not game.finish_market())
    assert(game.last_error == "Award Gold, Silver and Bronze before finishing")
    assert(game.award("campaign-c", "team-c", "bronze"))
    assert(game.finish_market())
    assert(game.phase == "reveal")
    assert(game.awards().size() == 3)
    return true

func _ready_for_market() -> RefCounted:
    var game := GameRun.new()
    assert(game.begin("Neon Narwhals", "session-7", "team-7"))
    for _level in 3:
        assert(game.mark_current_level_ready())
        assert(game.advance_level())
    return game
