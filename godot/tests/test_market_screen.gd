extends RefCounted

const MarketScreenScene = preload("res://src/market/ui/MarketScreen.tscn")
const MarketHost = preload("res://src/market/MarketHost.gd")
const FakeMarketTransport = preload("res://tests/fakes/FakeMarketTransport.gd")

func run() -> bool:
    assert(_scene_uses_accessible_ad_market_layouts())
    assert(_team_market_preserves_order_and_deduplicates_buy_requests())
    assert(_spectator_mode_is_calm_and_has_no_market_actions())
    assert(_returned_and_hidden_campaigns_are_calm_and_fixable())
    assert(_teacher_dashboard_moderates_controls_and_confirms_removal())
    assert(_teacher_cohort_label_excludes_spectators_from_readiness())
    assert(_reveal_is_role_safe_and_network_failures_are_non_sensitive())
    return true

func _scene_uses_accessible_ad_market_layouts() -> bool:
    var screen := MarketScreenScene.instantiate()
    var tree := Engine.get_main_loop() as SceneTree
    tree.root.add_child(screen)
    if not screen.is_node_ready():
        screen.call("_ready")
    assert(screen.call("columns_for_width", 1024.0) == 2)
    assert(screen.call("columns_for_width", 1366.0) == 3)
    assert(screen.call("columns_for_width", 1920.0) == 4)
    assert((screen.get_node("%PollTimer") as Timer).wait_time == 4.0)
    var frame := screen.get_node("%MarketFrame") as PanelContainer
    var panel := frame.get_theme_stylebox("panel") as StyleBoxFlat
    assert(panel != null)
    assert(panel.bg_color.is_equal_approx(Color("#fffaf0")))
    for node in screen.find_children("*", "Button", true, false):
        var button := node as Button
        if button.text.is_empty():
            continue
        assert(
            button.custom_minimum_size.y >= 44.0,
            "Button %s (%s) target height was %s" % [
                button.name,
                button.text,
                button.custom_minimum_size.y
            ]
        )
        assert(button.focus_mode == Control.FOCUS_ALL, "Button %s was not keyboard-focusable" % button.name)
    var all_copy := ""
    for node in screen.find_children("*", "Label", true, false):
        all_copy += " " + str(node.get("text"))
    for node in screen.find_children("*", "Button", true, false):
        all_copy += " " + str(node.get("text"))
    for banned in ["assignment", "unit", "task", "iframe", "http://", "https://"]:
        assert(not all_copy.to_lower().contains(banned))
    screen.free()
    return true

func _team_market_preserves_order_and_deduplicates_buy_requests() -> bool:
    var mounted := _mount_screen()
    var screen: Control = mounted.get("screen")
    var host: Node = mounted.get("host")
    var fake: RefCounted = mounted.get("fake")
    var game_input: Node = mounted.get("gameInput")
    screen.call("set_market_host", host)
    screen.call("enter_room", "team", "ABC-234")
    screen.call("present_snapshot", _team_snapshot())

    assert((screen.get_node("%TeamSurface") as Control).visible)
    assert(not (screen.get_node("%TeacherSurface") as Control).visible)
    assert((screen.get_node("%MarketRoomCode") as Label).text == "ABC-234")
    assert((screen.get_node("%WalletLabel") as Label).text == "$20 remaining")
    assert(screen.call("_format_currency", 850) == "$8.50")
    assert((screen.get_node("%SpendMeter") as ProgressBar).value == 80.0)
    assert((screen.get_node("%SellerProgress") as Label).text.contains("1 of 2"))
    assert((screen.get_node("%FinishMarket") as Button).disabled)

    var cards := screen.get_node("%TeamCards") as GridContainer
    assert(_child_meta_values(cards, "campaignId") == [
        "campaign-own",
        "campaign-buyable",
        "campaign-backed",
        "campaign-expensive"
    ])
    assert(cards.columns == 3)
    var buy_buttons: Array[Node] = screen.find_children("Buy", "Button", true, false)
    assert(buy_buttons.size() == 1)
    var buy := buy_buttons[0] as Button
    assert(buy.custom_minimum_size.y >= 44.0)
    assert(not buy.disabled)
    var artwork := buy.get_parent().get_node("Artwork") as TextureRect
    assert(artwork.custom_minimum_size == Vector2(320, 180))

    var before_buy := fake.call("request_count") as int
    buy.pressed.emit()
    buy.pressed.emit()
    assert(fake.call("request_count") == before_buy + 1)
    var purchase_request: Dictionary = fake.call("request_for", fake.call("last_request_id"))
    assert(purchase_request.get("method") == "purchase")
    assert(purchase_request.get("payload").get("campaignId") == "campaign-buyable")
    assert(str(purchase_request.get("payload").get("requestId")).begins_with("buy-"))
    assert(buy.disabled)

    var before_poll := fake.call("request_count") as int
    var process_mode_before_poll := game_input.process_mode
    screen.get_node("%PollTimer").emit_signal("timeout")
    assert(fake.call("request_count") == before_poll + 1)
    assert(fake.call("request_for", fake.call("last_request_id")).get("method") == "getSnapshot")
    assert(game_input.process_mode == process_mode_before_poll)
    _free_mounted(mounted)
    return true

func _spectator_mode_is_calm_and_has_no_market_actions() -> bool:
    var mounted := _mount_screen()
    var screen: Control = mounted.get("screen")
    screen.call("set_market_host", mounted.get("host"))
    screen.call("enter_room", "team", "ABC-234")
    var snapshot := _team_snapshot()
    snapshot["own"]["marketEligibility"] = {
        "state": "frozen",
        "role": "spectator",
        "reason": "not-in-cohort"
    }
    screen.call("present_snapshot", snapshot)

    assert((screen.get_node("%WalletLabel") as Label).text == "Market watcher")
    assert((screen.get_node("%SpendMeter") as ProgressBar).value == 0.0)
    assert((screen.get_node("%SellerProgress") as Label).text.to_lower().contains("browse every approved stall"))
    var finish := screen.get_node("%FinishMarket") as Button
    assert(finish.disabled)
    assert(finish.text == "Watching this market")
    assert((screen.get_node("%CampaignStatusTitle") as Label).text == "You're watching this round")
    assert((screen.get_node("%CampaignStatusCopy") as Label).text.contains("Buying is paused"))
    assert((screen.get_node("%TeamMarketHeading") as Label).text == "Browse the market floor · watch mode")
    assert(screen.find_children("Buy", "Button", true, false).is_empty())
    _free_mounted(mounted)
    return true

func _returned_and_hidden_campaigns_are_calm_and_fixable() -> bool:
    var mounted := _mount_screen()
    var screen: Control = mounted.get("screen")
    screen.call("set_market_host", mounted.get("host"))
    screen.call("enter_room", "team", "ABC-234")
    var returned := _team_snapshot()
    returned["campaigns"][0]["status"] = "returned"
    returned["campaigns"][0]["reviewNote"] = "Make the price easier to spot."
    screen.call("present_snapshot", returned)
    assert((screen.get_node("%CampaignStatusTitle") as Label).text == "A quick studio tweak")
    assert((screen.get_node("%CampaignStatusCopy") as Label).text.contains("Make the price easier to spot."))
    var fix := screen.get_node("%FixCampaign") as Button
    assert(fix.visible)
    var fix_events := [0]
    screen.connect("fix_requested", func() -> void: fix_events[0] += 1)
    fix.pressed.emit()
    assert(fix_events[0] == 1)

    var hidden := returned.duplicate(true)
    hidden["campaigns"][0]["status"] = "hidden"
    hidden["campaigns"][0].erase("reviewNote")
    screen.call("present_snapshot", hidden)
    var hidden_copy := (screen.get_node("%CampaignStatusCopy") as Label).text.to_lower()
    assert(hidden_copy.contains("resting"))
    for shaming in ["failed", "worst", "last place", "rejected"]:
        assert(not hidden_copy.contains(shaming))
    assert(not fix.visible)
    _free_mounted(mounted)
    return true

func _teacher_dashboard_moderates_controls_and_confirms_removal() -> bool:
    var mounted := _mount_screen()
    var screen: Control = mounted.get("screen")
    var host: Node = mounted.get("host")
    var fake: RefCounted = mounted.get("fake")
    var game_input: Node = mounted.get("gameInput")
    screen.call("set_market_host", host)
    screen.call("enter_room", "teacher", "ABC-234")
    screen.call("present_snapshot", _teacher_snapshot())

    assert((screen.get_node("%TeacherSurface") as Control).visible)
    assert(not (screen.get_node("%TeamSurface") as Control).visible)
    assert((screen.get_node("%SeatsLabel") as Label).text.contains("4 / 15 seats"))
    assert((screen.get_node("%ReadinessLabel") as Label).text.contains("2 ready"))
    assert(not (screen.get_node("%OpenMarketControl") as Button).disabled)
    assert((screen.get_node("%RevealControl") as Button).disabled)
    assert((screen.get_node("%CloseControl") as Button).disabled)

    var moderation := screen.get_node("%ModerationCards") as GridContainer
    assert(_child_meta_values(moderation, "campaignId") == [
        "campaign-waiting",
        "campaign-live",
        "campaign-returned",
        "campaign-hidden"
    ])
    var remove_buttons := screen.find_children("RemoveTeam", "Button", true, false)
    assert(remove_buttons.size() == 4)
    (remove_buttons[1] as Button).pressed.emit()
    var dialog := screen.get_node("%RemoveTeamDialog") as ConfirmationDialog
    assert(dialog.visible)
    assert(dialog.dialog_text.contains("Pixel Pirates"))
    assert(dialog.get_ok_button().text.contains("Pixel Pirates"))
    dialog.confirmed.emit()
    var remove_request: Dictionary = fake.call("request_for", fake.call("last_request_id"))
    assert(remove_request.get("payload").get("action") == "removeTeam")
    assert(remove_request.get("payload").get("teamId") == "team-b")
    assert(not str(remove_request.get("payload").get("commandId", "")).is_empty())

    var waiting_card := _child_with_meta(moderation, "campaignId", "campaign-waiting")
    var note := waiting_card.find_child("ReviewNote", true, false) as LineEdit
    note.text = "Bring the price into the headline."
    (waiting_card.find_child("Return", true, false) as Button).pressed.emit()
    var return_request: Dictionary = fake.call("request_for", fake.call("last_request_id"))
    assert(return_request.get("method") == "reviewCampaign")
    assert(return_request.get("payload").get("submissionVersion") == 7.0)
    assert(return_request.get("payload").get("status") == "returned")
    assert(return_request.get("payload").get("reviewNote") == note.text)
    assert(game_input.process_mode == Node.PROCESS_MODE_DISABLED)
    _free_mounted(mounted)
    return true

func _teacher_cohort_label_excludes_spectators_from_readiness() -> bool:
    var mounted := _mount_screen()
    var screen: Control = mounted.get("screen")
    screen.call("set_market_host", mounted.get("host"))
    screen.call("enter_room", "teacher", "ABC-234")
    var snapshot := _teacher_snapshot()
    snapshot["phase"] = "market"
    snapshot["cohort"] = {
        "frozen": true,
        "totalJoined": 4.0,
        "participating": 3.0,
        "spectating": 1.0,
        "buyers": 3.0,
        "sellers": 3.0,
        "requiredFinished": 3.0,
        "finishedRequired": 2.0
    }
    screen.call("present_snapshot", snapshot)
    var readiness_copy := (screen.get_node("%ReadinessLabel") as Label).text
    assert(readiness_copy == "2 ready · 1 still shopping · 1 watching · 1 waiting for review")
    _free_mounted(mounted)
    return true

func _reveal_is_role_safe_and_network_failures_are_non_sensitive() -> bool:
    var mounted := _mount_screen()
    var screen: Control = mounted.get("screen")
    var host: Node = mounted.get("host")
    var fake: RefCounted = mounted.get("fake")
    screen.call("set_market_host", host)
    screen.call("enter_room", "teacher", "ABC-234")
    screen.call("present_snapshot", _teacher_reveal_snapshot())
    var podium_copy := _descendant_copy(screen.get_node("%TeacherReveal"))
    assert(podium_copy.contains("Pixel Pirates"))
    assert(podium_copy.contains("Signal Foxes"))
    assert(podium_copy.contains("Neon Narwhals"))
    assert(not podium_copy.contains("Fourth Finish"))
    assert(not podium_copy.to_lower().contains("last"))
    assert(not _descendant_copy(screen).contains("Fourth Finish"))
    assert(screen.find_children("RemoveTeam", "Button", true, false).is_empty())

    screen.call("enter_room", "team", "ABC-234")
    var student_reveal := _team_snapshot()
    student_reveal["phase"] = "reveal"
    student_reveal["own"]["finished"] = true
    student_reveal["rankings"] = [{"alias": "PRIVATE FOURTH"}]
    screen.call("present_snapshot", student_reveal)
    assert((screen.get_node("%StudentReveal") as Control).visible)
    assert((screen.get_node("%StudentRevealCopy") as Label).text.to_lower().contains("host display"))
    assert(not _descendant_copy(screen).contains("PRIVATE FOURTH"))

    host.emit_signal("diagnostic", "PRIVATE_NETWORK_DETAILS: secret classroom token")
    var network_copy := (screen.get_node("%NetworkStatus") as Label).text
    assert(network_copy.contains("could not update"))
    assert(not network_copy.contains("PRIVATE"))
    assert((screen.get_node("%RetryMarket") as Button).visible)
    var before_retry := fake.call("request_count") as int
    (screen.get_node("%RetryMarket") as Button).pressed.emit()
    assert(fake.call("request_count") == before_retry + 1)
    assert(fake.call("request_for", fake.call("last_request_id")).get("method") == "getSnapshot")
    _free_mounted(mounted)
    return true

func _mount_screen() -> Dictionary:
    var fake := FakeMarketTransport.new()
    var host := MarketHost.new()
    var game_input := Node.new()
    game_input.process_mode = Node.PROCESS_MODE_ALWAYS
    host.game_input_root = game_input
    host.set_transport(fake)
    var screen := MarketScreenScene.instantiate()
    var tree := Engine.get_main_loop() as SceneTree
    tree.root.add_child(host)
    tree.root.add_child(screen)
    if not screen.is_node_ready():
        screen.call("_ready")
    return {"screen": screen, "host": host, "fake": fake, "gameInput": game_input}

func _free_mounted(mounted: Dictionary) -> void:
    (mounted.get("screen") as Node).free()
    (mounted.get("host") as Node).free()
    (mounted.get("gameInput") as Node).free()

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
            {"id": "team-d", "alias": "Fourth Finish"}
        ],
        "campaigns": [
            _team_campaign("campaign-own", "team-a", "Signal Foxes", "pending", 1000),
            _team_campaign("campaign-buyable", "team-b", "Pixel Pirates", "approved", 1500),
            _team_campaign("campaign-backed", "team-c", "Neon Narwhals", "approved", 8000),
            _team_campaign("campaign-expensive", "team-d", "Fourth Finish", "approved", 3000)
        ],
        "myPurchases": [{
            "id": "receipt-backed",
            "campaignId": "campaign-backed",
            "sellerTeamId": "team-c",
            "price": 8000.0,
            "purchasedAt": 1000.0
        }]
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
        "tagline": "Made to move the room.",
        "price": float(price),
        "artworkKey": "artwork/%s" % id
    }

func _teacher_snapshot() -> Dictionary:
    return {
        "roomCode": "ABC-234",
        "roomId": "room-teacher",
        "revision": 9.0,
        "phase": "building",
        "openingWalletCents": 10000.0,
        "maxTeams": 15.0,
        "availableSeats": 11.0,
        "teams": [
            _teacher_team("team-a", "Signal Foxes", true, 1000),
            _teacher_team("team-b", "Pixel Pirates", true, 1001),
            _teacher_team("team-c", "Neon Narwhals", false, 1002),
            _teacher_team("team-d", "Fourth Finish", false, 1003)
        ],
        "campaigns": [
            _teacher_campaign("campaign-waiting", "team-a", "Signal Foxes", "pending", 1000, 7),
            _teacher_campaign("campaign-live", "team-b", "Pixel Pirates", "approved", 2000),
            _teacher_campaign("campaign-returned", "team-c", "Neon Narwhals", "returned", 3000),
            _teacher_campaign("campaign-hidden", "team-d", "Fourth Finish", "hidden", 4000)
        ],
        "controls": {
            "canOpenMarket": true,
            "canOpenReveal": false,
            "canCloseMarket": false
        }
    }

func _teacher_reveal_snapshot() -> Dictionary:
    var snapshot := _teacher_snapshot()
    snapshot["phase"] = "reveal"
    snapshot["controls"] = {
        "canOpenMarket": false,
        "canOpenReveal": false,
        "canCloseMarket": true
    }
    snapshot["reveal"] = {"standings": [
        _standing(1, "team-b", "Pixel Pirates", 22000, 5),
        _standing(2, "team-a", "Signal Foxes", 19000, 4),
        _standing(3, "team-c", "Neon Narwhals", 15000, 3),
        _standing(4, "team-d", "Fourth Finish", 2000, 1)
    ]}
    return snapshot

func _teacher_team(id: String, alias: String, finished: bool, joined_at: int) -> Dictionary:
    return {"id": id, "alias": alias, "finished": finished, "joinedAt": float(joined_at)}

func _teacher_campaign(
    id: String,
    seller_team_id: String,
    seller_alias: String,
    status: String,
    price_cents: int,
    submission_version: int = 1
) -> Dictionary:
    return {
        "id": id,
        "sellerTeamId": seller_team_id,
        "sellerAlias": seller_alias,
        "submissionVersion": float(submission_version),
        "status": status,
        "productName": "Product %s" % id,
        "tagline": "Made to move the room.",
        "priceCents": float(price_cents),
        "artworkKey": "artwork/%s" % id
    }

func _standing(rank: int, team_id: String, alias: String, revenue: int, sales: int) -> Dictionary:
    return {
        "rank": float(rank),
        "teamId": team_id,
        "alias": alias,
        "revenue": float(revenue),
        "sales": float(sales)
    }

func _child_meta_values(parent: Node, key: String) -> Array[String]:
    var values: Array[String] = []
    for child in parent.get_children():
        values.append(str(child.get_meta(key, "")))
    return values

func _child_with_meta(parent: Node, key: String, value: String) -> Node:
    for child in parent.get_children():
        if child.get_meta(key, "") == value:
            return child
    return null

func _descendant_copy(root: Node) -> String:
    var copy := ""
    if root is Label or root is Button:
        copy += " " + str(root.get("text"))
    for child in root.get_children():
        copy += _descendant_copy(child)
    return copy
