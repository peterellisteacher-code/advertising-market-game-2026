extends RefCounted

const MainScene = preload("res://src/main/Main.tscn")
const FakeCreatorTransport = preload("res://tests/fakes/FakeCreatorTransport.gd")
const FakeMarketTransport = preload("res://tests/fakes/FakeMarketTransport.gd")
const FakePracticeTransport = preload("res://tests/fakes/FakePracticeTransport.gd")
const AutoPracticeTransport = preload("res://tests/fakes/AutoPracticeTransport.gd")

var _market_png_cache := ""

func run() -> bool:
    assert(_authored_shell_is_fun_first_and_accessible())
    assert(_live_room_routes_are_primary_and_accessible())
    assert(_practice_start_and_lock_wait_for_storage_ack())
    assert(_ambiguous_practice_failure_reuses_operation_id())
    assert(_startup_restores_an_exact_locked_pitch())
    assert(_invalid_startup_recovery_keeps_the_lobby_usable())
    assert(_late_startup_recovery_cannot_overwrite_a_live_room())
    assert(_late_join_cannot_overwrite_acknowledged_practice())
    assert(_late_create_cannot_overwrite_acknowledged_practice())
    assert(_late_join_cannot_overwrite_acknowledged_teacher_room())
    assert(_team_join_starts_the_three_levels_with_a_room_document())
    assert(_host_defaults_open_a_teacher_dashboard())
    assert(_campaign_moves_gate_each_level())
    assert(_returned_editor_state_is_reopened_verbatim())
    assert(_closed_studio_reopens_to_publish_and_enters_the_market())
    assert(_room_publication_waits_for_review_and_reopens_returned_work())
    return true

func _practice_start_and_lock_wait_for_storage_ack() -> bool:
    var creator_fake := FakeCreatorTransport.new()
    var practice_fake := FakePracticeTransport.new()
    var shell := _mount_shell(creator_fake, null, practice_fake)
    var start := shell.get_node("%StartRun") as Button
    var lobby := shell.get_node("%LobbyPanel") as Control
    var advance := shell.get_node("%AdvanceLevel") as Button
    assert(start.disabled)
    assert(practice_fake.request_count() == 1)
    var resume_id := String(practice_fake.request_for("practice-1").get("requestId"))
    assert(practice_fake.request_for(resume_id).get("method") == "resume")
    practice_fake.resolve_success(resume_id, null)
    assert(not start.disabled)

    (shell.get_node("%TeamAlias") as LineEdit).text = "Signal Foxes"
    start.pressed.emit()
    var begin_id := "practice-2"
    var begin_request := practice_fake.request_for(begin_id)
    assert(begin_request.get("method") == "begin")
    assert(lobby.visible)
    assert((shell.get("_game_run") as RefCounted).phase == "lobby")
    var begun := _practice_recovery(
        shell,
        "invent",
        false,
        0,
        0,
        String(Dictionary(begin_request.get("payload")).get("operationId"))
    )
    practice_fake.resolve_success(begin_id, begun)
    assert(not lobby.visible)
    assert((shell.get("_game_run") as RefCounted).phase == "invent")
    assert(str(Dictionary(shell.get("_campaign_document")).get("documentId")) != "classroom-campaign")

    var ready := _invent_ready_document(shell)
    ready["revision"] = 1
    var prior_document: Dictionary = Dictionary(shell.get("_campaign_document")).duplicate(true)
    shell.call("_on_creator_state_received", ready)
    var refresh_id := "practice-3"
    assert(practice_fake.request_for(refresh_id).get("method") == "resume")
    assert(shell.get("_campaign_document") == prior_document)
    assert(shell.get_node("%Status").text == "Checking the saved campaign…")
    practice_fake.resolve_success(
        refresh_id,
        _practice_recovery(shell, "invent", false, 1, 1, "autosave-1", ready)
    )
    var acknowledged: Dictionary = shell.get("_campaign_document")
    assert(int(acknowledged.get("revision")) == 1)
    assert(String(Dictionary(acknowledged.get("product")).get("name")) == "Orbit Bottle")
    (shell.get_node("%LockLevel") as Button).pressed.emit()
    var lock_id := "practice-4"
    var lock_request := practice_fake.request_for(lock_id)
    assert(lock_request.get("method") == "setLock")
    assert(not bool(shell.get("_level_locked")))
    assert(advance.disabled)
    var locked := _practice_recovery(
        shell,
        "invent",
        true,
        2,
        2,
        String(Dictionary(lock_request.get("payload")).get("operationId")),
        ready
    )
    practice_fake.resolve_success(lock_id, locked)
    assert(bool(shell.get("_level_locked")))
    assert(not advance.disabled)
    shell.free()
    return true

func _startup_restores_an_exact_locked_pitch() -> bool:
    var practice_fake := FakePracticeTransport.new()
    var shell := _mount_shell(FakeCreatorTransport.new(), null, practice_fake)
    var document: Dictionary = shell.call("_blank_campaign_document")
    document["documentId"] = "practice-document-restored"
    document["sessionId"] = "practice-session-restored"
    document["teamId"] = "practice-team-restored"
    document["revision"] = 7
    document["gameplay"]["stage"] = "sell"
    document = _sell_ready_document(document)
    var recovery := _practice_recovery(
        shell,
        "sell",
        true,
        7,
        9,
        "restore-operation",
        document
    )
    practice_fake.resolve_success("practice-1", recovery)
    var run: RefCounted = shell.get("_game_run")
    assert(run.phase == "sell")
    assert(run.is_current_level_ready())
    assert(bool(shell.get("_level_locked")))
    var restored: Dictionary = shell.get("_campaign_document")
    assert(String(restored.get("documentId")) == "practice-document-restored")
    assert(int(restored.get("revision")) == 7)
    assert(String(Dictionary(restored.get("gameplay")).get("stage")) == "sell")
    assert(
        String(Dictionary(Dictionary(restored.get("strategy")).get("aidaPlan")).get("action"))
        == "Grab yours before the buzzer."
    )
    assert(not (shell.get_node("%LobbyPanel") as Control).visible)
    assert((shell.get_node("%RunPanel") as Control).visible)
    assert((shell.get_node("%LockLevel") as Button).disabled)
    assert(not (shell.get_node("%AdvanceLevel") as Button).disabled)
    shell.free()
    return true

func _ambiguous_practice_failure_reuses_operation_id() -> bool:
    var practice_fake := FakePracticeTransport.new()
    var shell := _mount_shell(FakeCreatorTransport.new(), null, practice_fake)
    practice_fake.resolve_success("practice-1", null)
    (shell.get_node("%TeamAlias") as LineEdit).text = "Retry Ravens"
    (shell.get_node("%StartRun") as Button).pressed.emit()
    var first_request := practice_fake.request_for("practice-2")
    var first_operation_id := String(Dictionary(first_request.get("payload")).get("operationId"))
    assert(not first_operation_id.is_empty())
    practice_fake.reject_request("practice-2", "Response vanished after the durable write")
    assert((shell.get_node("%LobbyPanel") as Control).visible)

    (shell.get_node("%StartRun") as Button).pressed.emit()
    var retry_request := practice_fake.request_for("practice-3")
    assert(retry_request.get("method") == "begin")
    assert(String(Dictionary(retry_request.get("payload")).get("operationId")) == first_operation_id)
    practice_fake.resolve_success(
        "practice-3",
        _practice_recovery(shell, "invent", false, 0, 0, first_operation_id)
    )
    assert(String((shell.get("_game_run") as RefCounted).phase) == "invent")
    assert((shell.get_node("%RunPanel") as Control).visible)
    shell.free()
    return true

func _invalid_startup_recovery_keeps_the_lobby_usable() -> bool:
    var practice_fake := FakePracticeTransport.new()
    var shell := _mount_shell(FakeCreatorTransport.new(), null, practice_fake)
    var invalid := _practice_recovery(
        shell,
        "invent",
        true,
        4,
        6,
        "invalid-locked-not-ready"
    )
    practice_fake.resolve_success("practice-1", invalid)
    assert((shell.get_node("%LobbyPanel") as Control).visible)
    assert(not (shell.get_node("%StartRun") as Button).disabled)
    assert(not (shell.get_node("%RunPanel") as Control).visible)
    assert(Dictionary(shell.get("_practice_recovery")).is_empty())
    assert(String(Dictionary(shell.get("_campaign_document")).get("documentId")) == "classroom-campaign")
    assert(
        (shell.get_node("%Status") as Label).text
        == "Saved progress could not be verified. It was kept untouched; you can start fresh or join live."
    )
    shell.free()
    return true

func _late_startup_recovery_cannot_overwrite_a_live_room() -> bool:
    var practice_fake := FakePracticeTransport.new()
    var market_fake := FakeMarketTransport.new()
    var shell := _mount_shell(FakeCreatorTransport.new(), market_fake, practice_fake)
    (shell.get_node("%TeamAlias") as LineEdit).text = "Live Lynxes"
    (shell.get_node("%RoomCode") as LineEdit).text = "ABC-234"
    (shell.get_node("%JoinLiveMarket") as Button).pressed.emit()
    var join_id: String = market_fake.last_request_id()
    market_fake.resolve_success(join_id, {
        "role": "team",
        "roomCode": "ABC-234",
        "snapshot": _team_market_snapshot()
    })
    var room_document: Dictionary = Dictionary(shell.get("_campaign_document")).duplicate(true)
    var late_document: Dictionary = shell.call("_blank_campaign_document")
    late_document["documentId"] = "late-practice-document"
    late_document["sessionId"] = "late-practice-session"
    late_document["teamId"] = "late-practice-team"
    late_document["revision"] = 8
    late_document["gameplay"]["stage"] = "sell"
    late_document = _sell_ready_document(late_document)
    practice_fake.resolve_success(
        "practice-1",
        _practice_recovery(shell, "sell", true, 8, 10, "late-startup", late_document)
    )
    var after_late: Dictionary = shell.get("_campaign_document")
    assert(after_late == room_document)
    assert(String(shell.get("_room_role")) == "team")
    assert(String(shell.get("_room_code")) == "ABC-234")
    assert(String((shell.get("_game_run") as RefCounted).phase) == "invent")
    assert(Dictionary(shell.get("_practice_recovery")).is_empty())
    shell.free()
    return true

func _late_join_cannot_overwrite_acknowledged_practice() -> bool:
    var practice_fake := FakePracticeTransport.new()
    var market_fake := FakeMarketTransport.new()
    var shell := _mount_shell(FakeCreatorTransport.new(), market_fake, practice_fake)
    practice_fake.resolve_success("practice-1", null)
    (shell.get_node("%TeamAlias") as LineEdit).text = "Practice Puffins"
    (shell.get_node("%RoomCode") as LineEdit).text = "ABC-234"
    (shell.get_node("%JoinLiveMarket") as Button).pressed.emit()
    var old_join_id := market_fake.last_request_id()
    assert(market_fake.request_for(old_join_id).get("method") == "joinRoom")

    (shell.get_node("%StartRun") as Button).pressed.emit()
    var begin_id := "practice-2"
    var begin_request := practice_fake.request_for(begin_id)
    assert(begin_request.get("method") == "begin")
    practice_fake.resolve_success(
        begin_id,
        _practice_recovery(
            shell,
            "invent",
            false,
            0,
            0,
            String(Dictionary(begin_request.get("payload")).get("operationId"))
        )
    )
    var practice_document: Dictionary = Dictionary(shell.get("_campaign_document")).duplicate(true)
    assert(String((shell.get("_game_run") as RefCounted).phase) == "invent")
    assert(String(practice_document.get("mode")) == "offline")

    market_fake.resolve_success(old_join_id, {
        "role": "team",
        "roomCode": "ABC-234",
        "snapshot": _team_market_snapshot()
    })
    assert(String((shell.get("_game_run") as RefCounted).phase) == "invent")
    assert(Dictionary(shell.get("_campaign_document")) == practice_document)
    assert(String(shell.get("_room_role")).is_empty())
    assert(String(shell.get("_room_code")).is_empty())
    assert(not (shell.get_node("%LobbyPanel") as Control).visible)
    assert((shell.get_node("%RunPanel") as Control).visible)
    shell.free()
    return true

func _late_join_cannot_overwrite_acknowledged_teacher_room() -> bool:
    var market_fake := FakeMarketTransport.new()
    var shell := _mount_shell(FakeCreatorTransport.new(), market_fake)
    (shell.get_node("%TeamAlias") as LineEdit).text = "Live Lynxes"
    (shell.get_node("%RoomCode") as LineEdit).text = "ABC-234"
    (shell.get_node("%JoinLiveMarket") as Button).pressed.emit()
    var old_join_id := market_fake.last_request_id()
    (shell.get_node("%ClassroomCode") as LineEdit).text = "teacher-code-7"
    (shell.get_node("%CreateLiveMarket") as Button).pressed.emit()
    var create_id := market_fake.last_request_id()
    assert(create_id != old_join_id)
    assert(market_fake.request_for(create_id).get("method") == "createRoom")
    var teacher_snapshot := _teacher_market_snapshot()
    market_fake.resolve_success(create_id, {
        "role": "teacher",
        "roomCode": "DEF-567",
        "snapshot": teacher_snapshot
    })
    assert(String(shell.get("_room_role")) == "teacher")
    assert(Dictionary(shell.get("_latest_market_snapshot")) == teacher_snapshot)

    market_fake.resolve_success(old_join_id, {
        "role": "team",
        "roomCode": "ABC-234",
        "snapshot": _team_market_snapshot()
    })
    assert(String(shell.get("_room_role")) == "teacher")
    assert(String(shell.get("_room_code")) == "DEF-567")
    assert(Dictionary(shell.get("_latest_market_snapshot")) == teacher_snapshot)
    assert((shell.get_node("%MarketScreen") as Control).visible)
    assert(not (shell.get_node("%RunPanel") as Control).visible)
    shell.free()
    return true

func _late_create_cannot_overwrite_acknowledged_practice() -> bool:
    var practice_fake := FakePracticeTransport.new()
    var market_fake := FakeMarketTransport.new()
    var shell := _mount_shell(FakeCreatorTransport.new(), market_fake, practice_fake)
    practice_fake.resolve_success("practice-1", null)
    (shell.get_node("%ClassroomCode") as LineEdit).text = "teacher-code-old"
    (shell.get_node("%CreateLiveMarket") as Button).pressed.emit()
    var old_create_id := market_fake.last_request_id()
    assert(market_fake.request_for(old_create_id).get("method") == "createRoom")

    (shell.get_node("%TeamAlias") as LineEdit).text = "Practice Puffins"
    (shell.get_node("%StartRun") as Button).pressed.emit()
    var begin_request := practice_fake.request_for("practice-2")
    practice_fake.resolve_success(
        "practice-2",
        _practice_recovery(
            shell,
            "invent",
            false,
            0,
            0,
            String(Dictionary(begin_request.get("payload")).get("operationId"))
        )
    )
    var practice_document: Dictionary = Dictionary(shell.get("_campaign_document")).duplicate(true)
    market_fake.resolve_success(old_create_id, {
        "role": "teacher",
        "roomCode": "DDD-555",
        "snapshot": _teacher_market_snapshot()
    })
    assert(String(shell.get("_room_role")).is_empty())
    assert(String(shell.get("_room_code")).is_empty())
    assert(Dictionary(shell.get("_campaign_document")) == practice_document)
    assert(String((shell.get("_game_run") as RefCounted).phase) == "invent")
    assert((shell.get_node("%RunPanel") as Control).visible)
    assert(not (shell.get_node("%MarketScreen") as Control).visible)
    shell.free()
    return true

func _authored_shell_is_fun_first_and_accessible() -> bool:
    var shell := MainScene.instantiate()
    var lobby := shell.get_node("%LobbyPanel") as Control
    var run_panel := shell.get_node("%RunPanel") as Control
    var heading := shell.get_node("%LevelHeading") as Label
    var lock := shell.get_node("%LockLevel") as Button
    var advance := shell.get_node("%AdvanceLevel") as Button
    var publish := shell.get_node("%PublishCampaign") as Button
    var start := shell.get_node("%StartRun") as Button
    var join_live := shell.get_node("%JoinLiveMarket") as Button
    var create_live := shell.get_node("%CreateLiveMarket") as Button
    var launch := shell.get_node("%LaunchCreator") as Button

    assert(lobby.visible)
    assert(run_panel.visible)
    assert(heading.text.contains("did not know they needed"))
    assert(lock.text == "Lock this level")
    assert(advance.text == "Next level")
    assert(advance.disabled)
    assert(publish.visible)

    var accessible_normal := Color("#b63a15")
    var accessible_hover := Color("#c3471b")
    for button in [join_live, create_live, launch, publish]:
        var normal := button.get_theme_stylebox("normal") as StyleBoxFlat
        var hover := button.get_theme_stylebox("hover") as StyleBoxFlat
        assert(normal != null)
        assert(hover != null)
        assert(normal.bg_color.is_equal_approx(accessible_normal))
        assert(hover.bg_color.is_equal_approx(accessible_hover))
        assert(_contrast_with_white(normal.bg_color) >= 4.5)
        assert(_contrast_with_white(hover.bg_color) >= 4.5)

    assert(start.text == "Practice on this computer")
    var practice_style := start.get_theme_stylebox("normal") as StyleBoxFlat
    assert(practice_style != null)
    assert(practice_style.bg_color.is_equal_approx(Color("#17212b")))
    assert(_contrast_with_white(practice_style.bg_color) >= 4.5)

    var all_copy := ""
    for node in shell.find_children("*", "Label", true, false):
        all_copy += " " + str(node.get("text"))
    for node in shell.find_children("*", "Button", true, false):
        all_copy += " " + str(node.get("text"))
    for banned in ["assignment", "unit", "task"]:
        assert(not all_copy.to_lower().contains(banned))

    shell.free()
    return true

func _live_room_routes_are_primary_and_accessible() -> bool:
    var shell := MainScene.instantiate()
    var alias := shell.get_node("%TeamAlias") as LineEdit
    var room_code := shell.get_node("%RoomCode") as LineEdit
    var join_live := shell.get_node("%JoinLiveMarket") as Button
    var classroom_code := shell.get_node("%ClassroomCode") as LineEdit
    var wallet := shell.get_node("%OpeningWalletBucks") as SpinBox
    var max_teams := shell.get_node("%MaxTeams") as SpinBox
    var create_live := shell.get_node("%CreateLiveMarket") as Button
    var practice := shell.get_node("%StartRun") as Button
    assert(alias.placeholder_text.contains("Neon Narwhals"))
    assert(room_code.placeholder_text == "ABC-234")
    assert(room_code.max_length == 7)
    assert(join_live.text == "Join the live market")
    assert(classroom_code.secret)
    assert(wallet.value == 100.0)
    assert(max_teams.value == 15.0)
    assert(max_teams.min_value == 3.0 and max_teams.max_value == 30.0)
    assert(create_live.text == "Open a class market")
    assert(practice.text == "Practice on this computer")
    for control in [alias, room_code, join_live, classroom_code, wallet, max_teams, create_live, practice]:
        assert((control as Control).custom_minimum_size.y >= 44.0)
    shell.free()
    return true

func _team_join_starts_the_three_levels_with_a_room_document() -> bool:
    var creator_fake := FakeCreatorTransport.new()
    var market_fake := FakeMarketTransport.new()
    var shell := _mount_shell(creator_fake, market_fake)
    (shell.get_node("%TeamAlias") as LineEdit).text = "Signal Foxes"
    (shell.get_node("%RoomCode") as LineEdit).text = "ABC-234"
    (shell.get_node("%JoinLiveMarket") as Button).pressed.emit()
    var join_id: String = market_fake.last_request_id()
    var request := market_fake.request_for(join_id)
    assert(request.get("method") == "joinRoom")
    assert(request.get("payload") == {"roomCode": "ABC-234", "alias": "Signal Foxes"})
    var snapshot := _team_market_snapshot()
    market_fake.resolve_success(join_id, {
        "role": "team",
        "roomCode": "ABC-234",
        "snapshot": snapshot
    })

    var game_run: RefCounted = shell.get("_game_run")
    assert(game_run.phase == "invent")
    assert(game_run.team_id == "team-a")
    assert(game_run.session_id == "room-session-team-a")
    var document: Dictionary = shell.get("_campaign_document")
    assert(document.get("mode") == "room")
    assert(document.get("roomId") == "room-a")
    assert(document.get("teamId") == "team-a")
    assert(document.get("sessionId") == "room-session-team-a")
    assert(document.get("documentId") == "room-room-a-team-team-a-campaign")
    assert(not (shell.get_node("%LobbyPanel") as Control).visible)
    assert((shell.get_node("%RunPanel") as Control).visible)
    assert(not (shell.get_node("%MarketScreen") as Control).visible)
    shell.free()
    return true

func _host_defaults_open_a_teacher_dashboard() -> bool:
    var creator_fake := FakeCreatorTransport.new()
    var market_fake := FakeMarketTransport.new()
    var shell := _mount_shell(creator_fake, market_fake)
    (shell.get_node("%ClassroomCode") as LineEdit).text = "teacher-code-7"
    (shell.get_node("%CreateLiveMarket") as Button).pressed.emit()
    var create_id: String = market_fake.last_request_id()
    var request := market_fake.request_for(create_id)
    assert(request.get("method") == "createRoom")
    assert(request.get("payload") == {
        "openingWallet": 10000.0,
        "classroomCode": "teacher-code-7",
        "maxTeams": 15.0
    })
    market_fake.resolve_success(create_id, {
        "role": "teacher",
        "roomCode": "ABC-234",
        "snapshot": _teacher_market_snapshot()
    })
    var market_screen := shell.get_node("%MarketScreen") as Control
    assert(not (shell.get_node("%LobbyPanel") as Control).visible)
    assert(market_screen.visible)
    assert((market_screen.get_node("%MarketRoomCode") as Label).text == "ABC-234")
    assert((market_screen.get_node("%TeacherSurface") as Control).visible)
    shell.free()
    return true

func _campaign_moves_gate_each_level() -> bool:
    var fake := FakeCreatorTransport.new()
    var shell := _mount_shell(fake)
    var alias := shell.get_node("%TeamAlias") as LineEdit
    var start := shell.get_node("%StartRun") as Button
    var lock := shell.get_node("%LockLevel") as Button
    var advance := shell.get_node("%AdvanceLevel") as Button
    var status := shell.get_node("%Status") as Label
    alias.text = "Signal Foxes"
    start.pressed.emit()

    var invent_ready := _invent_ready_document(shell)
    for incomplete in [
        _with_product_name(invent_ready, "   "),
        _with_product_build(invent_ready, null),
        _with_audience(invent_ready, "   ")
    ]:
        _deliver_saved_creator_state(shell, incomplete)
        lock.pressed.emit()
        assert(status.text == "Clue: name the product, build it, and identify its target customer.")
        assert(not bool(shell.get("_level_locked")))
        assert(advance.disabled)

    var solo_invent := invent_ready.duplicate(true)
    solo_invent["gameplay"]["pair"] = {
        "activeRole": "art-director",
        "handoffCount": 0,
        "artDirectorActions": 1,
        "strategistActions": 0
    }
    _deliver_saved_creator_state(shell, solo_invent)
    lock.pressed.emit()
    assert(
            status.text == "Clue: swap once; each player then makes one visible change.",
        "Unexpected readiness status: %s" % status.text
    )
    assert(not bool(shell.get("_level_locked")))
    assert(advance.disabled)

    invent_ready = _deliver_saved_creator_state(shell, invent_ready)
    lock.pressed.emit()
    assert(bool(shell.get("_level_locked")))
    assert(not advance.disabled)
    advance.pressed.emit()

    var sell_ready := _sell_ready_document(invent_ready)
    for move in ["attention", "interest", "desire", "action"]:
        var incomplete := sell_ready.duplicate(true)
        incomplete["strategy"]["aidaPlan"][move] = "   "
        _deliver_saved_creator_state(shell, incomplete)
        lock.pressed.emit()
        assert(status.text == "Clue: deliver all four AIDA moves — Attention, Interest, Desire, Action — before the buzzer.")
        assert(not bool(shell.get("_level_locked")))
        assert(advance.disabled)

        incomplete = sell_ready.duplicate(true)
        incomplete["evidence"][move] = []
        _deliver_saved_creator_state(shell, incomplete)
        lock.pressed.emit()
        assert(status.text == "Clue: deliver all four AIDA moves — Attention, Interest, Desire, Action — before the buzzer.")
        assert(not bool(shell.get("_level_locked")))
        assert(advance.disabled)

    sell_ready = _deliver_saved_creator_state(shell, sell_ready)
    lock.pressed.emit()
    assert(bool(shell.get("_level_locked")))
    assert(not advance.disabled)

    var regressed_sell := sell_ready.duplicate(true)
    regressed_sell["evidence"]["attention"] = []
    _deliver_saved_creator_state(shell, regressed_sell)
    assert(not bool(shell.get("_level_locked")))
    assert(advance.disabled)
        assert(status.text == "Clue: deliver all four AIDA moves — Attention, Interest, Desire, Action — before the buzzer.")
    advance.pressed.emit()
    assert((shell.get("_game_run") as RefCounted).phase == "sell")

    sell_ready = _deliver_saved_creator_state(shell, sell_ready)
    lock.pressed.emit()
    assert(bool(shell.get("_level_locked")))
    advance.pressed.emit()

    var market_ready := _market_ready_document(sell_ready)
    for incomplete in [
        _with_price(market_ready, 0),
        _with_evidence(market_ready, "price", []),
        _with_market_route(market_ready, null),
        _with_market_route(market_ready, {"committed": false})
    ]:
        _deliver_saved_creator_state(shell, incomplete)
        lock.pressed.emit()
        assert(status.text == "Clue: set a market-plausible price. Choose and deploy your market route.")
        assert(not bool(shell.get("_level_locked")))
        assert(advance.disabled)

    market_ready = _deliver_saved_creator_state(shell, market_ready)
    lock.pressed.emit()
    assert(bool(shell.get("_level_locked")))
    assert(not advance.disabled)

    var regressed_market := market_ready.duplicate(true)
    regressed_market["evidence"]["price"] = []
    _deliver_saved_creator_state(shell, regressed_market)
    assert(not bool(shell.get("_level_locked")))
    assert(advance.disabled)
    assert(status.text == "Clue: set a market-plausible price. Choose and deploy your market route.")

    market_ready = _deliver_saved_creator_state(shell, market_ready)
    lock.pressed.emit()
    assert(bool(shell.get("_level_locked")))
    assert(not advance.disabled)
    shell.free()
    return true

func _closed_studio_reopens_to_publish_and_enters_the_market() -> bool:
    var fake := FakeCreatorTransport.new()
    var shell := _mount_shell(fake)

    var alias := shell.get_node("%TeamAlias") as LineEdit
    var start := shell.get_node("%StartRun") as Button
    var lock := shell.get_node("%LockLevel") as Button
    var advance := shell.get_node("%AdvanceLevel") as Button
    var publish := shell.get_node("%PublishCampaign") as Button
    alias.text = "Neon Narwhals"
    start.pressed.emit()
    var campaign := _invent_ready_document(shell)
    campaign = _deliver_saved_creator_state(shell, campaign)
    lock.pressed.emit()
    advance.pressed.emit()
    campaign = _sell_ready_document(campaign)
    campaign = _deliver_saved_creator_state(shell, campaign)
    lock.pressed.emit()
    advance.pressed.emit()
    campaign = _market_ready_document(campaign)
    campaign = _deliver_saved_creator_state(shell, campaign)
    lock.pressed.emit()
    advance.pressed.emit()
    assert(publish.visible)

    publish.pressed.emit()
    assert(fake.request_for(fake.last_request_id()).get("method") == "open")
    fake.resolve_success(fake.last_request_id())
    assert(fake.request_for(fake.last_request_id()).get("method") == "publish")
    var saved_campaign: Dictionary = shell.get("_campaign_document")
    fake.resolve_success(fake.last_request_id(), _market_publication(str(saved_campaign.get("documentId"))))

    var game_run: RefCounted = shell.get("_game_run")
    assert(game_run.phase == "market")
    assert((shell.get_node("%LevelEyebrow") as Label).text == "LIVE MARKET")
    var market_screen := shell.get_node("%MarketScreen") as Control
    assert(market_screen.visible)
    assert((market_screen.get_node("%MarketRoomCode") as Label).text == "PRACTICE")
    var cards := market_screen.get_node("%TeamCards") as GridContainer
    assert(cards.get_child_count() == 5)
    var buy_buttons := cards.find_children("*", "Button", true, false)
    assert(buy_buttons.size() == 4)
    (buy_buttons[0] as Button).pressed.emit()
    buy_buttons = cards.find_children("*", "Button", true, false)
    assert(buy_buttons.size() == 3)
    (buy_buttons[0] as Button).pressed.emit()
    assert((market_screen.get_node("%WalletLabel") as Label).text == "$20 remaining")
    var finish := market_screen.get_node("%FinishMarket") as Button
    assert(not finish.disabled)
    finish.pressed.emit()
    assert((market_screen.get_node("%StudentReveal") as Control).visible)
    assert((market_screen.get_node("%StudentRevealCopy") as Label).text.contains("Practice round complete"))
    assert(fake.request_for(fake.last_request_id()).get("method") == "close")
    fake.resolve_success(fake.last_request_id())
    shell.free()
    return true

func _returned_editor_state_is_reopened_verbatim() -> bool:
    var fake := FakeCreatorTransport.new()
    var shell := _mount_shell(fake)
    (shell.get_node("%TeamAlias") as LineEdit).text = "Neon Narwhals"
    (shell.get_node("%StartRun") as Button).pressed.emit()
    (shell.get_node("%LaunchCreator") as Button).pressed.emit()
    var first_open_id := fake.last_request_id()
    var first_open := fake.request_for(first_open_id)
    assert(first_open.get("method") == "open")
    assert(first_open.get("payload").get("gameplay").get("stage") == "invent")
    fake.resolve_success(first_open_id)

    var rich_document: Dictionary = Dictionary(first_open.get("payload")).duplicate(true)
    rich_document["product"]["name"] = "Loop Sip"
    rich_document["product"]["priceCents"] = 950.0
    rich_document["product"]["build"] = {
        "familyId": "drinkware",
        "bodyId": "reusable-tumbler",
        "partIds": ["flat-lid"],
        "costCents": 550.0
    }
    rich_document["fabricState"]["objects"] = [{
        "type": "image",
        "assetId": "reusable-tumbler",
        "left": 420.0,
        "top": 210.0
    }]
    rich_document["strategy"]["marketRoute"] = {
        "audienceBriefId": "after-school-freedom",
        "zoneId": "suburban",
        "mediaIds": ["transit"],
        "committed": true
    }

    fake.request_close()
    var save_id := fake.last_request_id()
    assert(fake.request_for(save_id).get("method") == "save")
    fake.resolve_success(save_id)
    var state_id := fake.last_request_id()
    assert(fake.request_for(state_id).get("method") == "getState")
    fake.resolve_success(state_id, rich_document)
    assert(shell.get("_campaign_document") == rich_document)
    var close_id := fake.last_request_id()
    assert(fake.request_for(close_id).get("method") == "close")
    fake.resolve_success(close_id)

    (shell.get_node("%LaunchCreator") as Button).pressed.emit()
    var second_open := fake.request_for(fake.last_request_id())
    assert(second_open.get("method") == "open")
    assert(second_open.get("payload") == rich_document)
    assert(second_open.get("payload").get("gameplay").get("stage") == "invent")
    shell.free()
    return true

func _room_publication_waits_for_review_and_reopens_returned_work() -> bool:
    var creator_fake := FakeCreatorTransport.new()
    var market_fake := FakeMarketTransport.new()
    var shell := _mount_shell(creator_fake, market_fake)
    (shell.get_node("%TeamAlias") as LineEdit).text = "Signal Foxes"
    (shell.get_node("%RoomCode") as LineEdit).text = "ABC-234"
    (shell.get_node("%JoinLiveMarket") as Button).pressed.emit()
    var join_id: String = market_fake.last_request_id()
    market_fake.resolve_success(join_id, {
        "role": "team",
        "roomCode": "ABC-234",
        "snapshot": _team_market_snapshot()
    })

    var lock := shell.get_node("%LockLevel") as Button
    var advance := shell.get_node("%AdvanceLevel") as Button
    var campaign := _invent_ready_document(shell)
    shell.call("_on_creator_state_received", campaign)
    lock.pressed.emit()
    advance.pressed.emit()
    campaign = _sell_ready_document(campaign)
    shell.call("_on_creator_state_received", campaign)
    lock.pressed.emit()
    advance.pressed.emit()
    campaign = _market_ready_document(campaign)
    shell.call("_on_creator_state_received", campaign)
    lock.pressed.emit()
    advance.pressed.emit()
    (shell.get_node("%PublishCampaign") as Button).pressed.emit()
    var final_open := creator_fake.request_for(creator_fake.last_request_id())
    assert(final_open.get("method") == "open")
    assert(final_open.get("payload").get("gameplay").get("stage") == "publish-check")
    creator_fake.resolve_success(creator_fake.last_request_id())
    var document: Dictionary = shell.get("_campaign_document")
    creator_fake.resolve_success(
        creator_fake.last_request_id(),
        _market_publication(str(document.get("documentId")))
    )
    var market_publish_id: String = market_fake.last_request_id()
    assert(market_fake.request_for(market_publish_id).get("method") == "publishCampaign")
    var pending := _team_market_snapshot("pending")
    market_fake.resolve_success(market_publish_id, {
        "replayed": false,
        "campaignId": "campaign-own",
        "submissionVersion": 1.0,
        "postcondition": {
            "kind": "publish",
            "campaignId": "campaign-own",
            "submissionVersion": 1.0
        },
        "snapshot": pending
    })
    var market_screen := shell.get_node("%MarketScreen") as Control
    assert(market_screen.visible)
    assert(not (shell.get_node("%RunPanel") as Control).visible)
    assert((market_screen.get_node("%CampaignStatusTitle") as Label).text == "Waiting for the host")
    assert(creator_fake.request_for(creator_fake.last_request_id()).get("method") == "close")
    creator_fake.resolve_success(creator_fake.last_request_id())

    var returned := _team_market_snapshot("returned")
    returned["campaigns"][0]["reviewNote"] = "Bring the price forward."
    shell.call("_on_market_snapshot", returned)
    assert((market_screen.get_node("%CampaignStatusCopy") as Label).text.contains("Bring the price forward."))
    (market_screen.get_node("%FixCampaign") as Button).pressed.emit()
    assert((shell.get_node("%RunPanel") as Control).visible)
    assert(not (shell.get_node("%MarketScreen") as Control).visible)
    assert(creator_fake.request_for(creator_fake.last_request_id()).get("method") == "open")
    assert(creator_fake.request_for(creator_fake.last_request_id()).get("payload").get("gameplay").get("stage") == "publish-check")
    shell.free()
    return true

func _mount_shell(
    fake: RefCounted,
    market_fake: RefCounted = null,
    practice_fake: RefCounted = null
) -> Control:
    var shell := MainScene.instantiate()
    shell.creator_transport_override = fake
    var selected_market: RefCounted = market_fake if market_fake != null else FakeMarketTransport.new()
    selected_market.set("auto_resume_none", true)
    shell.market_transport_override = selected_market
    var selected_practice := practice_fake
    if selected_practice == null:
        selected_practice = AutoPracticeTransport.new()
        selected_practice.document_provider = func() -> Dictionary:
            var pending: Dictionary = shell.get("_pending_creator_document")
            if not pending.is_empty():
                return pending.duplicate(true)
            return Dictionary(shell.get("_campaign_document")).duplicate(true)
    shell.practice_transport_override = selected_practice
    var tree := Engine.get_main_loop() as SceneTree
    tree.root.add_child(shell)
    if not shell.is_node_ready():
        shell.call("_ready")
    return shell

func _team_market_snapshot(own_status: String = "") -> Dictionary:
    var campaigns: Array[Dictionary] = []
    if not own_status.is_empty():
        campaigns.append({
            "id": "campaign-own",
            "sellerTeamId": "team-a",
            "sellerAlias": "Signal Foxes",
            "status": own_status,
            "productName": "Orbit Bottle",
            "tagline": "Hydration with lift-off energy.",
            "price": 2499.0,
            "artworkKey": "artwork/campaign-own"
        })
    return {
        "roomId": "room-a",
        "revision": 1.0,
        "phase": "building",
        "own": {
            "teamId": "team-a",
            "alias": "Signal Foxes",
            "wallet": 10000.0,
            "spent": 0.0,
            "finished": false
        },
        "teams": [{"id": "team-a", "alias": "Signal Foxes"}],
        "campaigns": campaigns,
        "myPurchases": []
    }

func _teacher_market_snapshot() -> Dictionary:
    return {
        "roomCode": "ABC-234",
        "roomId": "room-a",
        "revision": 1.0,
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

func _invent_ready_document(shell: Control) -> Dictionary:
    var document: Dictionary = Dictionary(shell.get("_campaign_document")).duplicate(true)
    document["product"]["name"] = "Orbit Bottle"
    document["product"]["build"] = {"blueprintId": "orbit-bottle"}
    document["brief"]["targetAudienceId"] = "after-school-athletes"
    document["gameplay"]["pair"] = {
        "activeRole": "strategist",
        "handoffCount": 1,
        "artDirectorActions": 1,
        "strategistActions": 1
    }
    return document

func _deliver_saved_creator_state(shell: Control, value: Dictionary) -> Dictionary:
    var current: Dictionary = Dictionary(shell.get("_campaign_document")).duplicate(true)
    var document := value.duplicate(true)
    document["documentId"] = current.get("documentId")
    document["sessionId"] = current.get("sessionId")
    document["teamId"] = current.get("teamId")
    document["mode"] = current.get("mode")
    document["revision"] = int(current.get("revision")) + 1
    document["gameplay"]["stage"] = String((shell.get("_game_run") as RefCounted).phase)
    shell.call("_on_creator_state_received", document)
    return document

func _sell_ready_document(document: Dictionary) -> Dictionary:
    var ready := document.duplicate(true)
    ready["strategy"]["aidaPlan"] = {
        "attention": "Flash the impossible colour.",
        "interest": "Reveal the spill-proof lid.",
        "desire": "Make every training bag feel ready.",
        "action": "Grab yours before the buzzer."
    }
    ready["evidence"]["attention"] = ["attention-proof"]
    ready["evidence"]["interest"] = ["interest-proof"]
    ready["evidence"]["desire"] = ["desire-proof"]
    ready["evidence"]["action"] = ["action-proof"]
    return ready

func _market_ready_document(document: Dictionary) -> Dictionary:
    var ready := document.duplicate(true)
    ready["product"]["priceCents"] = 2499
    ready["evidence"]["price"] = ["price-proof"]
    ready["strategy"]["marketRoute"] = {
        "audienceBriefId": "after-school-athletes",
        "zoneId": "city",
        "mediaIds": ["transit"],
        "committed": true
    }
    return ready

func _with_product_name(document: Dictionary, name: String) -> Dictionary:
    var changed := document.duplicate(true)
    changed["product"]["name"] = name
    return changed

func _with_product_build(document: Dictionary, build: Variant) -> Dictionary:
    var changed := document.duplicate(true)
    changed["product"]["build"] = build
    return changed

func _with_audience(document: Dictionary, audience_id: String) -> Dictionary:
    var changed := document.duplicate(true)
    changed["brief"]["targetAudienceId"] = audience_id
    return changed

func _with_price(document: Dictionary, price_cents: Variant) -> Dictionary:
    var changed := document.duplicate(true)
    changed["product"]["priceCents"] = price_cents
    return changed

func _with_evidence(document: Dictionary, slot: String, value: Array) -> Dictionary:
    var changed := document.duplicate(true)
    changed["evidence"][slot] = value.duplicate(true)
    return changed

func _with_market_route(document: Dictionary, route: Variant) -> Dictionary:
    var changed := document.duplicate(true)
    changed["strategy"]["marketRoute"] = route
    return changed

func _practice_recovery(
    shell: Control,
    stage: String,
    locked: bool,
    revision: int,
    sequence: int,
    operation_id: String,
    source_document: Dictionary = {}
) -> Dictionary:
    var document: Dictionary = (
        source_document.duplicate(true)
        if not source_document.is_empty()
        else shell.call("_blank_campaign_document")
    )
    if String(document.get("documentId", "")) == "classroom-campaign":
        document["documentId"] = "practice-document-test"
        document["sessionId"] = "practice-session-test"
    if not document.has("teamId"):
        document["teamId"] = "practice-team-test"
    document["mode"] = "offline"
    document["revision"] = revision
    document["gameplay"]["stage"] = stage
    return {
        "checkpoint": {
            "contract": "local-practice-checkpoint@1",
            "runId": "practice-run-test",
            "documentId": document["documentId"],
            "sessionId": document["sessionId"],
            "teamId": document["teamId"],
            "teamAlias": "Signal Foxes",
            "documentRevision": revision,
            "documentHash": "b".repeat(64),
            "stage": stage,
            "levelLocked": locked,
            "sequence": sequence,
            "operationId": operation_id,
            "savedAt": "2026-07-17T05:00:00.000Z"
        },
        "document": document
    }

func _contrast_with_white(background: Color) -> float:
    var luminance := (
        0.2126 * _linear_channel(background.r)
        + 0.7152 * _linear_channel(background.g)
        + 0.0722 * _linear_channel(background.b)
    )
    return 1.05 / (luminance + 0.05)

func _linear_channel(channel: float) -> float:
    if channel <= 0.04045:
        return channel / 12.92
    return pow((channel + 0.055) / 1.055, 2.4)

func _publication(document_id: String) -> Dictionary:
    return {
        "contract": "published-campaign@1",
        "documentId": document_id,
        "revision": 0.0,
        "pngBase64": _png_base64(),
        "metadata": {
            "productName": "Product",
            "priceCents": 1000.0,
            "brief": {},
            "evidence": {},
            "assetReferences": []
        }
    }

func _market_publication(document_id: String) -> Dictionary:
    var publication := _publication(document_id)
    if _market_png_cache.is_empty():
        var image := Image.create_empty(1600, 900, false, Image.FORMAT_RGBA8)
        image.fill(Color(0.16, 0.22, 0.32, 1.0))
        _market_png_cache = Marshalls.raw_to_base64(image.save_png_to_buffer())
    publication["pngBase64"] = _market_png_cache
    return publication

func _png_base64() -> String:
    var bytes := PackedByteArray()
    bytes.resize(33)
    var signature := PackedByteArray([137, 80, 78, 71, 13, 10, 26, 10])
    for index in signature.size():
        bytes[index] = signature[index]
    _write_uint32_be(bytes, 8, 13)
    var type_bytes := "IHDR".to_ascii_buffer()
    for index in 4:
        bytes[12 + index] = type_bytes[index]
    _write_uint32_be(bytes, 16, 1600)
    _write_uint32_be(bytes, 20, 900)
    bytes[24] = 8
    bytes[25] = 6
    return Marshalls.raw_to_base64(bytes)

func _write_uint32_be(bytes: PackedByteArray, offset: int, value: int) -> void:
    bytes[offset] = (value >> 24) & 0xff
    bytes[offset + 1] = (value >> 16) & 0xff
    bytes[offset + 2] = (value >> 8) & 0xff
    bytes[offset + 3] = value & 0xff
