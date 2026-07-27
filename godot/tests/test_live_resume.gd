extends RefCounted

const MainScene = preload("res://src/main/Main.tscn")
const FakeCreatorTransport = preload("res://tests/fakes/FakeCreatorTransport.gd")
const FakeMarketTransport = preload("res://tests/fakes/FakeMarketTransport.gd")
const FakePracticeTransport = preload("res://tests/fakes/FakePracticeTransport.gd")
const FakeRunProgressStore = preload("res://tests/fakes/FakeRunProgressStore.gd")

func run() -> bool:
    assert(_startup_arbitrates_live_before_practice())
    assert(_teacher_resume_opens_the_exact_dashboard())
    assert(_team_resume_hydrates_only_exact_progress_and_draft_identity())
    assert(_returned_campaign_cannot_reopen_before_live_hydration())
    assert(_completed_market_resume_is_idempotent())
    assert(_live_transitions_persist_bounded_progress())
    assert(_manual_join_invalidates_a_late_startup_resume())
    assert(_manual_create_invalidates_a_late_startup_resume())
    assert(_manual_practice_invalidates_a_late_startup_resume())
    return true

func _startup_arbitrates_live_before_practice() -> bool:
    var market_fake := FakeMarketTransport.new()
    market_fake.auto_resume_none = false
    var practice_fake := FakePracticeTransport.new()
    var shell := _mount_shell(FakeCreatorTransport.new(), market_fake, practice_fake)
    assert(market_fake.request_count() == 1)
    var resume_id := market_fake.last_request_id()
    assert(market_fake.request_for(resume_id).get("method") == "resumeSession")
    assert(practice_fake.request_count() == 0)
    assert(not (shell.get_node("%StartRun") as Button).disabled)

    market_fake.resolve_success(resume_id, null)
    assert(practice_fake.request_count() == 1)
    assert(practice_fake.request_for("practice-1").get("method") == "resume")
    practice_fake.resolve_success("practice-1", null)
    assert(not (shell.get_node("%StartRun") as Button).disabled)
    shell.free()

    var transient_market := FakeMarketTransport.new()
    transient_market.auto_resume_none = false
    var untouched_practice := FakePracticeTransport.new()
    var retained_progress := FakeRunProgressStore.new()
    retained_progress.stored = _live_progress(
        "ABC-234", "room-a", "team-a", "Signal Foxes", "invent", [], false, 2
    )
    var retained_before := retained_progress.stored.duplicate(true)
    var transient_shell := _mount_shell(
        FakeCreatorTransport.new(),
        transient_market,
        untouched_practice,
        retained_progress
    )
    transient_market.reject_request(transient_market.last_request_id(), "Synthetic timeout")
    assert(untouched_practice.request_count() == 0)
    assert((transient_shell.get_node("%LobbyPanel") as Control).visible)
    assert(not (transient_shell.get_node("%RunPanel") as Control).visible)
    assert(
        (transient_shell.get_node("%Status") as Label).text
        == "The market could not be reached. Check the network and try again."
    )
    assert(retained_progress.stored == retained_before)
    assert(retained_progress.saves.is_empty())
    transient_shell.free()
    return true

func _teacher_resume_opens_the_exact_dashboard() -> bool:
    var market_fake := FakeMarketTransport.new()
    market_fake.auto_resume_none = false
    var practice_fake := FakePracticeTransport.new()
    var shell := _mount_shell(FakeCreatorTransport.new(), market_fake, practice_fake)
    market_fake.resolve_success(market_fake.last_request_id(), {
        "role": "teacher",
        "roomCode": "ABC-234",
        "snapshot": _teacher_snapshot()
    })
    assert(practice_fake.request_count() == 0)
    assert(String(shell.get("_room_role")) == "teacher")
    assert(not (shell.get_node("%LobbyPanel") as Control).visible)
    assert(not (shell.get_node("%RunPanel") as Control).visible)
    assert((shell.get_node("%MarketScreen") as Control).visible)
    var market_screen := shell.get_node("%MarketScreen") as Control
    assert((market_screen.get_node("%MarketRoomCode") as Label).text == "ABC-234")
    shell.free()
    return true

func _manual_join_invalidates_a_late_startup_resume() -> bool:
    var market_fake := FakeMarketTransport.new()
    market_fake.auto_resume_none = false
    var shell := _mount_shell(
        FakeCreatorTransport.new(),
        market_fake,
        FakePracticeTransport.new()
    )
    var startup_resume_id := market_fake.last_request_id()
    (shell.get_node("%TeamAlias") as LineEdit).text = "Current Pair"
    (shell.get_node("%RoomCode") as LineEdit).text = "BBB-333"
    (shell.get_node("%JoinLiveMarket") as Button).pressed.emit()
    var join_id := market_fake.last_request_id()
    assert(join_id != startup_resume_id)
    assert(market_fake.request_for(join_id).get("method") == "joinRoom")
    market_fake.resolve_success(join_id, {
        "role": "team",
        "roomCode": "BBB-333",
        "snapshot": _team_snapshot("room-current", "team-current", "Current Pair", 3)
    })
    market_fake.resolve_success(startup_resume_id, {
        "role": "teacher",
        "roomCode": "AAA-222",
        "snapshot": _teacher_snapshot()
    })
    assert(String(shell.get("_room_role")) == "team")
    assert(String(shell.get("_room_code")) == "BBB-333")
    assert(String(Dictionary(shell.get("_latest_market_snapshot")).get("roomId")) == "room-current")
    shell.free()
    return true

func _team_resume_hydrates_only_exact_progress_and_draft_identity() -> bool:
    var market_fake := FakeMarketTransport.new()
    market_fake.auto_resume_none = false
    var creator_fake := FakeCreatorTransport.new()
    var progress := FakeRunProgressStore.new()
    progress.stored = _live_progress(
        "ABC-234",
        "room-a",
        "team-a",
        "Signal Foxes",
        "sell",
        ["invent"],
        false,
        7
    )
    var shell := _mount_shell(
        creator_fake,
        market_fake,
        FakePracticeTransport.new(),
        progress
    )
    market_fake.resolve_success(market_fake.last_request_id(), {
        "role": "team",
        "roomCode": "ABC-234",
        "snapshot": _team_snapshot("room-a", "team-a", "Signal Foxes", 8)
    })
    assert(creator_fake.request_count() == 1)
    var load_id := creator_fake.last_request_id()
    assert(creator_fake.request_for(load_id).get("method") == "loadLatest")
    assert(
        creator_fake.request_for(load_id).get("payload").get("documentId")
        == "room-room-a-team-team-a-campaign"
    )
    assert(not (shell.get_node("%RunPanel") as Control).visible)

    var mismatched := _room_document(shell, "room-a", "team-a", 7)
    mismatched["sessionId"] = "room-session-other-team"
    creator_fake.resolve_success(load_id, mismatched)
    assert((shell.get_node("%LobbyPanel") as Control).visible)
    assert(not (shell.get_node("%RunPanel") as Control).visible)
    assert(progress.stored == _live_progress(
        "ABC-234",
        "room-a",
        "team-a",
        "Signal Foxes",
        "sell",
        ["invent"],
        false,
        7
    ))
    assert(progress.saves.is_empty())
    shell.free()

    var valid_market := FakeMarketTransport.new()
    valid_market.auto_resume_none = false
    var valid_creator := FakeCreatorTransport.new()
    var valid_progress := FakeRunProgressStore.new()
    valid_progress.stored = progress.stored.duplicate(true)
    var valid_shell := _mount_shell(
        valid_creator,
        valid_market,
        FakePracticeTransport.new(),
        valid_progress
    )
    valid_market.resolve_success(valid_market.last_request_id(), {
        "role": "team",
        "roomCode": "ABC-234",
        "snapshot": _team_snapshot("room-a", "team-a", "Signal Foxes", 9)
    })
    var exact := _room_document(valid_shell, "room-a", "team-a", 7)
    exact["product"]["name"] = "Recovered Orbit Bottle"
    valid_creator.resolve_success(valid_creator.last_request_id(), exact)
    assert(String((valid_shell.get("_game_run") as RefCounted).phase) == "sell")
    var exact_wire: Variant = JSON.parse_string(JSON.stringify(exact))
    assert(valid_shell.get("_campaign_document") == exact_wire)
    assert((valid_shell.get_node("%RunPanel") as Control).visible)
    assert(not (valid_shell.get_node("%LaunchCreator") as Button).disabled)
    valid_shell.free()
    return true

func _completed_market_resume_is_idempotent() -> bool:
    var market_fake := FakeMarketTransport.new()
    market_fake.auto_resume_none = false
    var creator_fake := FakeCreatorTransport.new()
    var progress := FakeRunProgressStore.new()
    progress.stored = _live_progress(
        "ABC-234",
        "room-a",
        "team-a",
        "Signal Foxes",
        "publish-check",
        ["invent", "sell", "irresistible"],
        false,
        7
    )
    var shell := _mount_shell(
        creator_fake,
        market_fake,
        FakePracticeTransport.new(),
        progress
    )
    var completed := _team_snapshot("room-a", "team-a", "Signal Foxes", 9)
    completed["phase"] = "market"
    completed["marketMode"] = "medals"
    completed["myAwards"] = []
    completed["campaigns"] = [{
        "id": "campaign-own",
        "sellerTeamId": "team-a",
        "sellerAlias": "Signal Foxes",
        "status": "approved",
        "productName": "Orbit Bottle",
        "tagline": "Hydration with lift-off energy.",
        "price": 2499.0,
        "artworkKey": "artwork/campaign-own"
    }]
    market_fake.resolve_success(market_fake.last_request_id(), {
        "role": "team",
        "roomCode": "ABC-234",
        "snapshot": completed
    })
    creator_fake.resolve_success(
        creator_fake.last_request_id(),
        _room_document(shell, "room-a", "team-a", 7)
    )
    assert(String((shell.get("_game_run") as RefCounted).phase) == "market")
    assert((shell.get_node("%MarketScreen") as Control).visible)
    assert(not (shell.get_node("%RunPanel") as Control).visible)
    assert(not (shell.get_node("%EnterMarket") as Button).visible)

    var later := completed.duplicate(true)
    later["revision"] = 10.0
    shell.call("_on_market_snapshot", later)
    assert(String((shell.get("_game_run") as RefCounted).phase) == "market")
    assert((shell.get_node("%MarketScreen") as Control).visible)
    shell.free()
    return true

func _returned_campaign_cannot_reopen_before_live_hydration() -> bool:
    var market_fake := FakeMarketTransport.new()
    market_fake.auto_resume_none = false
    var creator_fake := FakeCreatorTransport.new()
    var shell := _mount_shell(
        creator_fake,
        market_fake,
        FakePracticeTransport.new()
    )
    var snapshot := _team_snapshot("room-a", "team-a", "Signal Foxes", 9)
    snapshot["campaigns"] = [{
        "id": "campaign-a",
        "sellerTeamId": "team-a",
        "sellerAlias": "Signal Foxes",
        "status": "returned",
        "productName": "Orbit Bottle",
        "price": 1200.0,
        "artworkKey": "artwork-a",
        "reviewNote": "Make the audience signal clearer."
    }]
    market_fake.resolve_success(market_fake.last_request_id(), {
        "role": "team",
        "roomCode": "ABC-234",
        "snapshot": snapshot
    })
    assert(String(shell.get("_startup_state")) == "team-hydrating")
    assert(creator_fake.request_count() == 1)
    assert(creator_fake.request_for(creator_fake.last_request_id()).get("method") == "loadLatest")

    (shell.get_node("%MarketScreen") as Control).emit_signal("fix_requested")
    assert(creator_fake.request_count() == 1)

    var exact := _room_document(shell, "room-a", "team-a", 0)
    creator_fake.resolve_success(creator_fake.last_request_id(), exact)
    assert(String(shell.get("_startup_state")) == "complete")
    (shell.get_node("%MarketScreen") as Control).emit_signal("fix_requested")
    assert(creator_fake.request_count() == 2)
    assert(creator_fake.request_for(creator_fake.last_request_id()).get("method") == "open")
    shell.free()
    return true

func _live_transitions_persist_bounded_progress() -> bool:
    var market_fake := FakeMarketTransport.new()
    market_fake.auto_resume_none = true
    var practice_fake := FakePracticeTransport.new()
    var progress := FakeRunProgressStore.new()
    var shell := _mount_shell(
        FakeCreatorTransport.new(),
        market_fake,
        practice_fake,
        progress
    )
    practice_fake.resolve_success("practice-1", null)
    (shell.get_node("%TeamAlias") as LineEdit).text = "Signal Foxes"
    (shell.get_node("%RoomCode") as LineEdit).text = "ABC-234"
    (shell.get_node("%JoinLiveMarket") as Button).pressed.emit()
    market_fake.resolve_success(market_fake.last_request_id(), {
        "role": "team",
        "roomCode": "ABC-234",
        "snapshot": _team_snapshot("room-a", "team-a", "Signal Foxes", 1)
    })
    assert(progress.saves.size() == 1)
    assert(progress.saves.back().get("contract") == "live-run-progress@1")
    assert(progress.saves.back().get("documentRevision") == 0)

    var ready := _room_document(shell, "room-a", "team-a", 1)
    ready["product"]["name"] = "Orbit Bottle"
    ready["product"]["build"] = {"blueprintId": "orbit-bottle"}
    ready["brief"]["targetAudienceId"] = "after-school-athletes"
    ready["gameplay"]["pair"] = {
        "activeRole": "strategist",
        "handoffCount": 1,
        "artDirectorActions": 1,
        "strategistActions": 1
    }
    shell.call("_on_creator_state_received", ready)
    assert(progress.saves.size() == 2)
    assert(progress.saves.back().get("documentRevision") == 1)
    (shell.get_node("%LockLevel") as Button).pressed.emit()
    assert(progress.saves.size() == 3)
    assert(progress.saves.back().get("levelLocked") == true)

    var regressed := ready.duplicate(true)
    regressed["revision"] = 2
    regressed["product"]["name"] = ""
    shell.call("_on_creator_state_received", regressed)
    assert(progress.saves.size() == 4)
    assert(progress.saves.back().get("levelLocked") == false)
    assert(progress.saves.back().get("pitch").get("readyLevels").is_empty())

    ready["revision"] = 3
    shell.call("_on_creator_state_received", ready)
    assert(progress.saves.size() == 5)
    (shell.get_node("%LockLevel") as Button).pressed.emit()
    assert(progress.saves.size() == 6)
    (shell.get_node("%AdvanceLevel") as Button).pressed.emit()
    assert(progress.saves.size() == 7)
    assert(progress.saves.back().get("levelLocked") == false)
    assert(progress.saves.back().get("pitch").get("phase") == "sell")
    assert(JSON.stringify(progress.saves.back()).to_utf8_buffer().size() <= 16384)
    shell.free()
    return true

func _manual_practice_invalidates_a_late_startup_resume() -> bool:
    var market_fake := FakeMarketTransport.new()
    market_fake.auto_resume_none = false
    var practice_fake := FakePracticeTransport.new()
    var shell := _mount_shell(FakeCreatorTransport.new(), market_fake, practice_fake)
    var resume_id := market_fake.last_request_id()
    (shell.get_node("%TeamAlias") as LineEdit).text = "Practice Pair"
    shell.call("_start_run")
    assert(practice_fake.request_count() == 1)
    assert(practice_fake.request_for("practice-1").get("method") == "begin")
    market_fake.resolve_success(resume_id, {
        "role": "teacher",
        "roomCode": "AAA-222",
        "snapshot": _teacher_snapshot()
    })
    assert(String(shell.get("_room_role")).is_empty())
    assert(String(shell.get("_startup_state")) == "manual")
    shell.free()
    return true

func _manual_create_invalidates_a_late_startup_resume() -> bool:
    var market_fake := FakeMarketTransport.new()
    market_fake.auto_resume_none = false
    var shell := _mount_shell(
        FakeCreatorTransport.new(),
        market_fake,
        FakePracticeTransport.new()
    )
    var resume_id := market_fake.last_request_id()
    (shell.get_node("%ClassroomCode") as LineEdit).text = "teacher-code-current"
    (shell.get_node("%CreateLiveMarket") as Button).pressed.emit()
    var create_id := market_fake.last_request_id()
    assert(market_fake.request_for(create_id).get("method") == "createRoom")
    var created_snapshot := _teacher_snapshot()
    created_snapshot["roomCode"] = "CCC-444"
    market_fake.resolve_success(create_id, {
        "role": "teacher",
        "roomCode": "CCC-444",
        "snapshot": created_snapshot
    })
    market_fake.resolve_success(resume_id, {
        "role": "team",
        "roomCode": "AAA-222",
        "snapshot": _team_snapshot("room-old", "team-old", "Old Pair", 2)
    })
    assert(String(shell.get("_room_role")) == "teacher")
    assert(String(shell.get("_room_code")) == "CCC-444")
    shell.free()
    return true

func _mount_shell(
    creator_fake: RefCounted,
    market_fake: RefCounted,
    practice_fake: RefCounted,
    progress_store: RefCounted = null
) -> Control:
    var shell := MainScene.instantiate()
    shell.creator_transport_override = creator_fake
    shell.market_transport_override = market_fake
    shell.practice_transport_override = practice_fake
    if progress_store != null:
        shell.set("run_progress_store_override", progress_store)
    var tree := Engine.get_main_loop() as SceneTree
    tree.root.add_child(shell)
    if not shell.is_node_ready():
        shell.call("_ready")
    return shell

func _live_progress(
    room_code: String,
    room_id: String,
    team_id: String,
    alias: String,
    phase: String,
    ready_levels: Array,
    level_locked: bool,
    document_revision: int
) -> Dictionary:
    var session_id := "room-session-%s" % team_id
    return {
        "contract": "live-run-progress@1",
        "roomCode": room_code,
        "roomId": room_id,
        "teamId": team_id,
        "sessionId": session_id,
        "documentId": "room-%s-team-%s-campaign" % [room_id, team_id],
        "documentRevision": document_revision,
        "pitch": {
            "contract": "pitch-run@1",
            "phase": phase,
            "teamAlias": alias,
            "sessionId": session_id,
            "teamId": team_id,
            "readyLevels": ready_levels.duplicate(true)
        },
        "levelLocked": level_locked
    }

func _room_document(shell: Control, room_id: String, team_id: String, revision: int) -> Dictionary:
    var document: Dictionary = shell.call(
        "_room_campaign_document",
        room_id,
        team_id,
        "room-session-%s" % team_id
    )
    document["revision"] = revision
    return document

func _teacher_snapshot() -> Dictionary:
    return {
        "roomCode": "ABC-234",
        "roomId": "room-teacher",
        "revision": 4.0,
        "phase": "building",
        "openingWalletCents": 10000.0,
        "maxTeams": 15.0,
        "availableSeats": 15.0,
        "teams": [],
        "campaigns": [],
        "controls": {
            "canOpenMarket": false,
            "canOpenReveal": false,
            "canCloseMarket": false
        }
    }

func _team_snapshot(
    room_id: String,
    team_id: String,
    alias: String,
    revision: int
) -> Dictionary:
    return {
        "roomId": room_id,
        "revision": float(revision),
        "phase": "building",
        "own": {
            "teamId": team_id,
            "alias": alias,
            "wallet": 10000.0,
            "spent": 0.0,
            "finished": false
        },
        "teams": [{"id": team_id, "alias": alias}],
        "campaigns": [],
        "myPurchases": []
    }
