extends Node

signal diagnostic(message: String)
signal focus_restore_requested
signal snapshot_received(snapshot: Dictionary)
signal room_created(wrapper: Dictionary)
signal room_joined(wrapper: Dictionary)
signal room_join_failed(code: String, message: String)
signal room_resumed(wrapper: Variant)
signal room_resume_failed(code: String, message: String)
signal market_request_failed(code: String, message: String)
signal reveal_received(reveal: Dictionary)
signal control_completed(action: String, result: Dictionary)
signal campaign_published(result: Dictionary)
signal purchase_completed(result: Dictionary)
signal award_completed(result: Dictionary)
signal artwork_received(artwork_key: String, png_bytes: PackedByteArray)

const MarketBridge = preload("res://src/market/MarketBridge.gd")
const MAX_CACHED_ARTWORK := 16
const MAX_COMMAND_INTENTS := 32
const SAFE_TERMINAL_COMMAND_ERRORS := [
    "INVALID_REQUEST",
    "IDEMPOTENCY_CONFLICT",
    "SUBMISSION_VERSION_CONFLICT"
]

@export var game_input_root_path: NodePath
@export var return_focus_control_path: NodePath

var transport: RefCounted
var bridge: Node
var game_input_root: Node
var return_focus_control: Control
var _previous_process_mode := Node.PROCESS_MODE_INHERIT
var _busy_count := 0
var _request_context: Dictionary = {}
var _dispatch_frames: Array[Dictionary] = []
var _next_dispatch_number := 1
var _silent_snapshot_request_id := ""
var _artwork_request_ids: Dictionary = {}
var _artwork_cache: Dictionary = {}
var _artwork_cache_request_ids: Dictionary = {}
var _artwork_cache_order: Array[String] = []
var _room_generation := 0
var _room_intent_generation := 0
var _last_accepted_snapshot_revision := -1
var _command_intents: Dictionary = {}

func set_transport(value: RefCounted) -> void:
    var was_connected := transport != null
    transport = value
    if was_connected and value == null:
        _start_new_room_generation()
    _ensure_bridge()
    bridge.set_transport(value)

func _ready() -> void:
    _ensure_bridge()
    if not game_input_root_path.is_empty():
        game_input_root = get_node_or_null(game_input_root_path)
    if not return_focus_control_path.is_empty():
        return_focus_control = get_node_or_null(return_focus_control_path) as Control

func create_room(
    opening_wallet: Variant,
    classroom_code: Variant,
    max_teams: Variant = 15
) -> String:
    var room_intent_generation := _begin_room_intent()
    return _dispatch(
        "createRoom",
        {"roomIntentGeneration": room_intent_generation},
        func() -> String: return bridge.create_room(opening_wallet, classroom_code, max_teams)
    )

func join_room(room_code: Variant, alias: Variant) -> String:
    var room_intent_generation := _begin_room_intent()
    return _dispatch(
        "joinRoom",
        {"roomIntentGeneration": room_intent_generation},
        func() -> String: return bridge.join_room(room_code, alias)
    )

func resume_session() -> String:
    var room_intent_generation := _begin_room_intent()
    return _dispatch(
        "resumeSession",
        {"roomIntentGeneration": room_intent_generation},
        func() -> String: return bridge.resume_session()
    )

func invalidate_room_intent() -> void:
    _room_intent_generation += 1
    _start_new_room_generation()

func request_snapshot() -> String:
    return _dispatch(
        "getSnapshot",
        {"roomGeneration": _room_generation},
        func() -> String: return bridge.get_snapshot()
    )

func request_snapshot_silently() -> String:
    if not _silent_snapshot_request_id.is_empty() and bridge.has_pending(_silent_snapshot_request_id):
        return _silent_snapshot_request_id
    var request_id := _dispatch(
        "getSnapshot",
        {"roomGeneration": _room_generation, "silentSnapshot": true},
        func() -> String: return bridge.get_snapshot(),
        false
    )
    if not request_id.is_empty() and bridge.has_pending(request_id):
        _silent_snapshot_request_id = request_id
    return request_id

func publish_campaign(publication: Variant) -> String:
    var intent := _begin_command_intent("publish", publication)
    var command_id := str(intent.get("commandId", ""))
    return _dispatch(
        "publishCampaign",
        {
            "roomGeneration": _room_generation,
            "commandKey": "publish",
            "commandId": command_id
        },
        func() -> String: return bridge.publish_campaign(publication, command_id)
    )

func purchase(campaign_id: Variant, request_id: Variant) -> String:
    return _dispatch(
        "purchase",
        {"roomGeneration": _room_generation},
        func() -> String: return bridge.purchase(campaign_id, request_id)
    )

func award(campaign_id: Variant, medal: Variant) -> String:
    var command_key := "award:%s" % str(medal)
    var semantic := {"campaignId": campaign_id, "medal": medal}
    var intent := _begin_command_intent(command_key, semantic)
    var command_id := str(intent.get("commandId", ""))
    return _dispatch(
        "award",
        {
            "roomGeneration": _room_generation,
            "commandKey": command_key,
            "commandId": command_id
        },
        func() -> String: return bridge.award(campaign_id, medal, command_id)
    )

func finish() -> String:
    var intent := _begin_command_intent("finish", {})
    var command_id := str(intent.get("commandId", ""))
    return _dispatch("finish", {
        "roomGeneration": _room_generation,
        "commandKey": "finish",
        "commandId": command_id
    }, func() -> String: return bridge.finish(command_id))

func review_campaign(
    campaign_id: Variant,
    submission_version: Variant,
    status: Variant,
    review_note: Variant = null
) -> String:
    var command_key := "review:%s" % str(campaign_id)
    var semantic := {
        "campaignId": campaign_id,
        "submissionVersion": submission_version,
        "status": status,
        "reviewNote": review_note
    }
    var intent := _begin_command_intent(command_key, semantic)
    var command_id := str(intent.get("commandId", ""))
    return _dispatch(
        "reviewCampaign",
        {
            "action": "reviewCampaign",
            "roomGeneration": _room_generation,
            "commandKey": command_key,
            "commandId": command_id
        },
        func() -> String: return bridge.review_campaign(
            campaign_id,
            submission_version,
            status,
            command_id,
            review_note
        )
    )

func control(action: Variant, team_id: Variant = null) -> String:
    var command_key := (
        "removeTeam:%s" % str(team_id)
        if str(action) == "removeTeam"
        else "control:%s" % str(action)
    )
    var semantic := {"action": action, "teamId": team_id}
    var intent := _begin_command_intent(command_key, semantic)
    var command_id := str(intent.get("commandId", ""))
    var context := {
        "action": str(action),
        "roomGeneration": _room_generation,
        "commandKey": command_key,
        "commandId": command_id
    }
    if team_id != null:
        context["teamId"] = str(team_id)
    return _dispatch(
        "control",
        context,
        func() -> String: return bridge.control(action, command_id, team_id)
    )

func request_artwork(artwork_key: Variant) -> String:
    if typeof(artwork_key) == TYPE_STRING:
        var key := str(artwork_key)
        if _artwork_cache.has(key):
            _touch_cached_artwork(key)
            artwork_received.emit(key, _artwork_cache.get(key))
            return str(_artwork_cache_request_ids.get(key, ""))
        if _artwork_request_ids.has(key):
            return str(_artwork_request_ids.get(key))
    var key := str(artwork_key)
    var request_id := _dispatch(
        "getArtwork",
        {"artworkKey": key, "roomGeneration": _room_generation},
        func() -> String: return bridge.get_artwork(artwork_key),
        false
    )
    if not request_id.is_empty() and bridge.has_pending(request_id):
        _artwork_request_ids[key] = request_id
    return request_id

func _ensure_bridge() -> void:
    if bridge != null:
        return
    bridge = MarketBridge.new()
    add_child(bridge)
    bridge.request_succeeded.connect(_on_request_succeeded)
    bridge.request_failed.connect(_on_request_failed)

func _dispatch(
    method: String,
    context: Dictionary,
    sender: Callable,
    interactive := true
) -> String:
    _ensure_bridge()
    var full_context := context.duplicate(true)
    full_context["method"] = method
    full_context["interactive"] = interactive
    var frame := {
        "dispatchNumber": _next_dispatch_number,
        "context": full_context,
        "finished": false
    }
    _next_dispatch_number += 1
    _dispatch_frames.append(frame)
    if interactive:
        _begin_busy()
    var request_id: String = sender.call()
    if not request_id.is_empty() and bridge.has_pending(request_id):
        _request_context[request_id] = full_context
    elif interactive and not bool(frame.get("finished", false)):
        _end_busy()
    _remove_dispatch_frame(int(frame.get("dispatchNumber")))
    return request_id

func _on_request_succeeded(request_id: String, method: String, payload: Variant) -> void:
    var context := _context_for(request_id, method)
    _finish_request(request_id)
    if method == "resumeSession":
        if not _room_intent_is_current(context):
            return
        _start_new_room_generation()
        if payload == null:
            room_resumed.emit(null)
            return
        var resumed_result: Dictionary = Dictionary(payload).duplicate(true)
        room_resumed.emit(resumed_result)
        _emit_snapshot_if_current(Dictionary(resumed_result.get("snapshot")).duplicate(true))
        return
    var result: Dictionary = Dictionary(payload).duplicate(true)
    if method == "createRoom":
        if not _room_intent_is_current(context):
            return
        _start_new_room_generation()
        room_created.emit(result)
        _emit_snapshot_if_current(Dictionary(result.get("snapshot")).duplicate(true))
    elif method == "joinRoom":
        if not _room_intent_is_current(context):
            return
        _start_new_room_generation()
        room_joined.emit(result)
        _emit_snapshot_if_current(Dictionary(result.get("snapshot")).duplicate(true))
    elif method == "getSnapshot":
        _forget_silent_snapshot(request_id)
        if int(context.get("roomGeneration", -1)) != _room_generation:
            return
        _emit_snapshot_if_current(result)
    elif method == "publishCampaign":
        if not _command_context_is_current(context):
            _emit_nested_snapshot(result, context)
            return
        _remember_command_postcondition(context, result)
        campaign_published.emit(result)
        _emit_nested_snapshot(result, context)
    elif method == "purchase":
        purchase_completed.emit(result)
        _emit_nested_snapshot(result, context)
    elif method == "award":
        if not _command_context_is_current(context):
            _emit_nested_snapshot(result, context)
            return
        _remember_command_postcondition(context, result)
        award_completed.emit(result)
        _emit_nested_snapshot(result, context)
    elif method == "finish":
        if not _command_context_is_current(context):
            _emit_nested_snapshot(result, context)
            return
        _remember_command_postcondition(context, result)
        _emit_nested_snapshot(result, context)
    elif method == "reviewCampaign":
        if not _command_context_is_current(context):
            _emit_nested_snapshot(result, context)
            return
        _remember_command_postcondition(context, result)
        control_completed.emit("reviewCampaign", result)
        _emit_nested_snapshot(result, context)
    elif method == "control":
        if not _command_context_is_current(context):
            _emit_nested_snapshot(result, context)
            return
        _remember_command_postcondition(context, result)
        control_completed.emit(str(context.get("action", "control")), result)
        _emit_nested_snapshot(result, context)
    elif method == "getArtwork":
        var artwork_key := str(result.get("artworkKey"))
        _forget_artwork_request(artwork_key, request_id)
        if int(context.get("roomGeneration", -1)) != _room_generation:
            return
        var png_bytes := Marshalls.base64_to_raw(str(result.get("pngBase64")))
        _cache_artwork(artwork_key, png_bytes, request_id)
        artwork_received.emit(artwork_key, png_bytes)

func _on_request_failed(request_id: String, code: String, message: String) -> void:
    var context := _context_for_failure(request_id)
    if context.get("method") == "getSnapshot":
        _forget_silent_snapshot(request_id)
    if context.get("method") == "getArtwork":
        _forget_artwork_request(str(context.get("artworkKey", "")), request_id)
    _finish_request(request_id)
    if context.get("method") in ["createRoom", "joinRoom", "resumeSession"] and not _room_intent_is_current(context):
        return
    if context.get("method") == "joinRoom":
        room_join_failed.emit(code, message)
        return
    if context.get("method") == "resumeSession":
        _report("%s: %s" % [code, message])
        room_resume_failed.emit(code, message)
        return
    if _is_command_context(context):
        if not _command_context_is_current(context):
            return
        if SAFE_TERMINAL_COMMAND_ERRORS.has(code):
            _clear_command_context(context)
    _report("%s: %s" % [code, message])
    market_request_failed.emit(code, message)

func _begin_command_intent(command_key: String, semantic: Variant) -> Dictionary:
    if _command_intents.has(command_key):
        var existing: Dictionary = _command_intents.get(command_key)
        if (
            int(existing.get("roomGeneration", -1)) == _room_generation
            and existing.get("semantic") == semantic
        ):
            return existing.duplicate(true)
    elif _command_intents.size() >= MAX_COMMAND_INTENTS:
        _report("COMMAND_INTENT_LIMIT: Too many durable market commands are awaiting confirmation")
        return {}
    var command_id := _new_command_id()
    if command_id.is_empty():
        _report("COMMAND_ID_UNAVAILABLE: Secure command identity generation failed")
        return {}
    var intent := {
        "semantic": _duplicate_variant(semantic),
        "commandId": command_id,
        "roomGeneration": _room_generation
    }
    _command_intents[command_key] = intent
    return intent.duplicate(true)

func _new_command_id() -> String:
    var random_bytes := Crypto.new().generate_random_bytes(16)
    if random_bytes.size() != 16:
        return ""
    random_bytes[6] = (int(random_bytes[6]) & 0x0f) | 0x40
    random_bytes[8] = (int(random_bytes[8]) & 0x3f) | 0x80
    var command_id := ""
    for index in random_bytes.size():
        if [4, 6, 8, 10].has(index):
            command_id += "-"
        command_id += "%02x" % int(random_bytes[index])
    return command_id

func _duplicate_variant(value: Variant) -> Variant:
    if typeof(value) == TYPE_DICTIONARY:
        return Dictionary(value).duplicate(true)
    if typeof(value) == TYPE_ARRAY:
        return Array(value).duplicate(true)
    return value

func _is_command_context(context: Dictionary) -> bool:
    return (
        typeof(context.get("commandKey")) == TYPE_STRING
        and not str(context.get("commandKey")).is_empty()
        and typeof(context.get("commandId")) == TYPE_STRING
        and not str(context.get("commandId")).is_empty()
    )

func _command_context_is_current(context: Dictionary) -> bool:
    if not _is_command_context(context):
        return false
    var command_key := str(context.get("commandKey"))
    if not _command_intents.has(command_key):
        return false
    var intent: Dictionary = _command_intents.get(command_key)
    return (
        int(context.get("roomGeneration", -1)) == _room_generation
        and int(intent.get("roomGeneration", -1)) == _room_generation
        and intent.get("commandId") == context.get("commandId")
    )

func _clear_command_context(context: Dictionary) -> void:
    if _command_context_is_current(context):
        _command_intents.erase(str(context.get("commandKey")))

func _remember_command_postcondition(context: Dictionary, result: Dictionary) -> void:
    if not _command_context_is_current(context):
        return
    var command_key := str(context.get("commandKey"))
    var intent: Dictionary = _command_intents.get(command_key)
    intent["postcondition"] = _duplicate_variant(result.get("postcondition"))
    _command_intents[command_key] = intent

func _clear_observed_command_intents(snapshot: Dictionary) -> void:
    for command_key_value in _command_intents.keys():
        var command_key := str(command_key_value)
        var intent: Dictionary = _command_intents.get(command_key)
        if (
            int(intent.get("roomGeneration", -1)) == _room_generation
            and _command_intent_is_observed(command_key, intent, snapshot)
        ):
            _command_intents.erase(command_key)

func _command_intent_is_observed(
    command_key: String,
    intent: Dictionary,
    snapshot: Dictionary
) -> bool:
    var semantic_value: Variant = intent.get("semantic")
    var semantic: Dictionary = semantic_value if typeof(semantic_value) == TYPE_DICTIONARY else {}
    if command_key == "finish":
        return (
            typeof(snapshot.get("own")) == TYPE_DICTIONARY
            and bool(Dictionary(snapshot.get("own")).get("finished", false))
        )
    if command_key.begins_with("award:"):
        if typeof(snapshot.get("myAwards")) != TYPE_ARRAY:
            return false
        for award_value in snapshot.get("myAwards"):
            if typeof(award_value) != TYPE_DICTIONARY:
                continue
            var award: Dictionary = award_value
            if (
                award.get("medal") == semantic.get("medal")
                and award.get("campaignId") == semantic.get("campaignId")
            ):
                return true
        return false
    if command_key.begins_with("review:"):
        return _snapshot_has_review_postcondition(snapshot, semantic)
    if command_key.begins_with("control:"):
        var expected_phase: String = {
            "openMarket": "market",
            "openReveal": "reveal",
            "closeMarket": "closed"
        }.get(str(semantic.get("action", "")), "")
        return not str(expected_phase).is_empty() and snapshot.get("phase") == expected_phase
    if command_key.begins_with("removeTeam:"):
        if typeof(snapshot.get("teams")) != TYPE_ARRAY:
            return false
        var removed_team_id := str(semantic.get("teamId", ""))
        for team_value in snapshot.get("teams"):
            if typeof(team_value) == TYPE_DICTIONARY:
                var team: Dictionary = team_value
                if team.get("id", team.get("teamId")) == removed_team_id:
                    return false
        return true
    if command_key == "publish":
        return _snapshot_has_publish_postcondition(snapshot, intent, semantic)
    return false

func _snapshot_has_review_postcondition(snapshot: Dictionary, semantic: Dictionary) -> bool:
    if typeof(snapshot.get("campaigns")) != TYPE_ARRAY:
        return false
    for campaign_value in snapshot.get("campaigns"):
        if typeof(campaign_value) != TYPE_DICTIONARY:
            continue
        var campaign: Dictionary = campaign_value
        if (
            campaign.get("id", campaign.get("campaignId")) == semantic.get("campaignId")
            and _same_integer(
                campaign.get("submissionVersion"),
                semantic.get("submissionVersion")
            )
            and campaign.get("status") == semantic.get("status")
        ):
            return true
    return false

func _snapshot_has_publish_postcondition(
    snapshot: Dictionary,
    intent: Dictionary,
    semantic: Dictionary
) -> bool:
    if typeof(snapshot.get("campaigns")) != TYPE_ARRAY:
        return false
    var postcondition_value: Variant = intent.get("postcondition")
    if typeof(postcondition_value) == TYPE_DICTIONARY:
        var postcondition: Dictionary = postcondition_value
        for campaign_value in snapshot.get("campaigns"):
            if typeof(campaign_value) != TYPE_DICTIONARY:
                continue
            var campaign: Dictionary = campaign_value
            if (
                campaign.get("id", campaign.get("campaignId")) == postcondition.get("campaignId")
                and _same_integer(
                    campaign.get("submissionVersion"),
                    postcondition.get("submissionVersion")
                )
            ):
                return true
        return false

    var metadata_value: Variant = semantic.get("metadata")
    if typeof(metadata_value) != TYPE_DICTIONARY:
        return false
    var metadata: Dictionary = metadata_value
    var own_team_id := ""
    if typeof(snapshot.get("own")) == TYPE_DICTIONARY:
        own_team_id = str(Dictionary(snapshot.get("own")).get("teamId", ""))
    for campaign_value in snapshot.get("campaigns"):
        if typeof(campaign_value) != TYPE_DICTIONARY:
            continue
        var campaign: Dictionary = campaign_value
        if (
            campaign.get("productName") == metadata.get("productName")
            and _same_integer(campaign.get("price"), metadata.get("priceCents"))
            and (own_team_id.is_empty() or campaign.get("sellerTeamId") == own_team_id)
        ):
            return true
    return false

func _same_integer(first: Variant, second: Variant) -> bool:
    if typeof(first) not in [TYPE_INT, TYPE_FLOAT] or typeof(second) not in [TYPE_INT, TYPE_FLOAT]:
        return false
    var first_number := float(first)
    var second_number := float(second)
    return (
        is_finite(first_number)
        and is_finite(second_number)
        and first_number == floor(first_number)
        and second_number == floor(second_number)
        and first_number == second_number
    )

func _begin_room_intent() -> int:
    _room_intent_generation += 1
    return _room_intent_generation

func _room_intent_is_current(context: Dictionary) -> bool:
    return int(context.get("roomIntentGeneration", -1)) == _room_intent_generation

func _context_for(request_id: String, method: String) -> Dictionary:
    if _request_context.has(request_id):
        return Dictionary(_request_context.get(request_id)).duplicate(true)
    var frame := _current_dispatch_frame()
    var context: Dictionary = frame.get("context", {})
    if not context.is_empty() and context.get("method") == method:
        return context.duplicate(true)
    return {"method": method}

func _context_for_failure(request_id: String) -> Dictionary:
    if _request_context.has(request_id):
        return Dictionary(_request_context.get(request_id)).duplicate(true)
    var frame := _current_dispatch_frame()
    var context: Dictionary = frame.get("context", {})
    if not context.is_empty():
        return context.duplicate(true)
    return {}

func _finish_request(request_id: String) -> void:
    if _request_context.has(request_id):
        var context: Dictionary = _request_context.get(request_id)
        _request_context.erase(request_id)
        if bool(context.get("interactive", true)):
            _end_busy()
        return
    var frame := _current_dispatch_frame()
    if not frame.is_empty() and not bool(frame.get("finished", false)):
        frame["finished"] = true
        var context: Dictionary = frame.get("context", {})
        if bool(context.get("interactive", true)):
            _end_busy()

func _current_dispatch_frame() -> Dictionary:
    if _dispatch_frames.is_empty():
        return {}
    return _dispatch_frames.back()

func _remove_dispatch_frame(dispatch_number: int) -> void:
    for index in range(_dispatch_frames.size() - 1, -1, -1):
        if int(_dispatch_frames[index].get("dispatchNumber", -1)) == dispatch_number:
            _dispatch_frames.remove_at(index)
            return

func _begin_busy() -> void:
    if _busy_count == 0 and game_input_root != null:
        _previous_process_mode = game_input_root.process_mode
        game_input_root.process_mode = Node.PROCESS_MODE_DISABLED
    _busy_count += 1

func _end_busy() -> void:
    if _busy_count <= 0:
        return
    _busy_count -= 1
    if _busy_count > 0:
        return
    if game_input_root != null:
        game_input_root.process_mode = _previous_process_mode
    focus_restore_requested.emit()
    if return_focus_control != null and return_focus_control.is_inside_tree():
        return_focus_control.grab_focus()

func _emit_nested_snapshot(result: Dictionary, context: Dictionary) -> void:
    if int(context.get("roomGeneration", -1)) != _room_generation:
        return
    if typeof(result.get("snapshot")) == TYPE_DICTIONARY:
        var snapshot := Dictionary(result.get("snapshot")).duplicate(true)
        _emit_snapshot_if_current(snapshot)

func _emit_snapshot_if_current(snapshot: Dictionary) -> void:
    var revision: Variant = _integer_snapshot_revision(snapshot)
    if revision == null or int(revision) < _last_accepted_snapshot_revision:
        return
    _last_accepted_snapshot_revision = int(revision)
    _clear_observed_command_intents(snapshot)
    snapshot_received.emit(snapshot)
    _emit_reveal_from_snapshot(snapshot)

func _integer_snapshot_revision(snapshot: Dictionary) -> Variant:
    if not snapshot.has("revision"):
        return null
    var value: Variant = snapshot.get("revision")
    if typeof(value) == TYPE_INT:
        return int(value) if int(value) >= 0 else null
    if typeof(value) != TYPE_FLOAT:
        return null
    var number := float(value)
    if not is_finite(number) or number < 0.0 or number != floor(number):
        return null
    return int(number)

func _emit_reveal_from_snapshot(snapshot: Dictionary) -> void:
    if typeof(snapshot.get("reveal")) == TYPE_DICTIONARY:
        reveal_received.emit(Dictionary(snapshot.get("reveal")).duplicate(true))

func _cache_artwork(artwork_key: String, png_bytes: PackedByteArray, request_id: String) -> void:
    _artwork_cache[artwork_key] = png_bytes
    _artwork_cache_request_ids[artwork_key] = request_id
    _touch_cached_artwork(artwork_key)
    while _artwork_cache_order.size() > MAX_CACHED_ARTWORK:
        var evicted_key: String = _artwork_cache_order.pop_front()
        _artwork_cache.erase(evicted_key)
        _artwork_cache_request_ids.erase(evicted_key)

func _touch_cached_artwork(artwork_key: String) -> void:
    _artwork_cache_order.erase(artwork_key)
    _artwork_cache_order.append(artwork_key)

func _start_new_room_generation() -> void:
    _room_generation += 1
    _command_intents.clear()
    _last_accepted_snapshot_revision = -1
    _silent_snapshot_request_id = ""
    _artwork_request_ids.clear()
    _artwork_cache.clear()
    _artwork_cache_request_ids.clear()
    _artwork_cache_order.clear()

func _forget_artwork_request(artwork_key: String, request_id: String) -> void:
    if _artwork_request_ids.get(artwork_key, "") == request_id:
        _artwork_request_ids.erase(artwork_key)

func _forget_silent_snapshot(request_id: String) -> void:
    if _silent_snapshot_request_id == request_id:
        _silent_snapshot_request_id = ""

func _report(message: String) -> void:
    diagnostic.emit(message)
