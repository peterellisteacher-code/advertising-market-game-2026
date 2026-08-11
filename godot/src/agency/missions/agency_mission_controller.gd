extends Node
class_name AdMarketAgencyMissionController

signal mission_completed(mission_id: String, evidence: Dictionary)
signal sidequest_completed(sidequest_id: String)
signal state_changed(state: Dictionary)

const CATALOG_PATH := "res://src/agency/agency_mission_catalog.gd"
const STATE_CLOSED := "closed"
const STATE_HOLDING := "holding"
const STATE_CHOICE := "choice"
const STATE_EFFECT := "effect"
const STATE_DEMONSTRATION := "demonstration"
const STATE_COMPLETED := "completed"
var _catalog_script: Script = load(CATALOG_PATH) as Script
var _progress: RefCounted
var _panel: Control
var _record: Dictionary = {}
var _mission_id: String = ""
var _active_role: String = ""
var _selected_choice_id: String = ""
var _selected_effect: String = ""
var _choice_correct: bool = false
var _required: bool = true
var _state: String = STATE_CLOSED

func configure(progress: RefCounted, panel: Control = null) -> void:
	_disconnect_panel()
	_progress = progress
	_panel = panel
	_connect_panel()

func open_mission(mission_id: String, active_role: String) -> Dictionary:
	var record := _mission_record(mission_id)
	if record.is_empty():
		return {
			"opened": false,
			"allowed": false,
			"reason": "That agency task is unavailable."
		}
	_record = record
	_mission_id = mission_id
	_active_role = active_role
	_required = bool(record.get("required", true))
	_apply_required_sequence_metadata()
	_selected_choice_id = ""
	_selected_effect = ""
	_choice_correct = false
	_state = STATE_CHOICE if _role_allowed() else STATE_HOLDING
	_show_choice()
	_emit_state()
	return {
		"opened": true,
		"allowed": _role_allowed(),
		"required": _required,
		"state": _state,
		"missionId": _mission_id,
		"taskIndex": int(_record.get("taskIndex", 0)),
		"taskTotal": int(_record.get("taskTotal", 0)),
		"ownerRole": String(_record.get("ownerRole")),
		"holdingAction": String(_record.get("holdingAction"))
	}

func refresh_active_role(role: String) -> Dictionary:
	_active_role = role
	if _state == STATE_HOLDING or _state == STATE_CHOICE:
		_state = STATE_CHOICE if _role_allowed() else STATE_HOLDING
		_show_choice()
		_emit_state()
	return snapshot()

func choose(choice_id: String) -> Dictionary:
	if _state == STATE_HOLDING:
		return {
			"allowed": false,
			"correct": false,
			"state": _state,
			"holdingAction": String(_record.get("holdingAction"))
		}
	if _state != STATE_CHOICE:
		return {
			"allowed": false,
			"correct": false,
			"state": _state,
			"reason": "Return to the choice before selecting a treatment."
		}
	var evaluation := _evaluate_choice(_mission_id, choice_id)
	if evaluation.is_empty():
		return {
			"allowed": true,
			"correct": false,
			"state": _state,
			"reason": "Choose one of the four advertising treatments."
		}
	_selected_choice_id = choice_id
	_selected_effect = String(evaluation.get("effect"))
	_choice_correct = bool(evaluation.get("correct"))
	_state = STATE_EFFECT
	_show_effect(evaluation)
	_emit_state()
	return {
		"allowed": true,
		"correct": _choice_correct,
		"state": _state,
		"effect": _selected_effect,
		"canRetry": not _choice_correct
	}

func retry() -> Dictionary:
	if _state != STATE_EFFECT or _choice_correct:
		return {
			"changed": false,
			"state": _state
		}
	_selected_choice_id = ""
	_selected_effect = ""
	_state = STATE_CHOICE
	_show_choice()
	_emit_state()
	return {
		"changed": true,
		"state": _state
	}

func continue_to_demonstration() -> Dictionary:
	if _state != STATE_EFFECT or not _choice_correct:
		return {
			"changed": false,
			"state": _state,
			"reason": "Choose the effective treatment before applying it."
		}
	_state = STATE_DEMONSTRATION
	_show_demonstration()
	_emit_state()
	return {
		"changed": true,
		"state": _state,
		"applicationObjective": _application_objective()
	}

## Accepts a measured arrangement from a demonstration stage. The evidence sentence is
## generated from the measure — the lever the pair won on and the object they promoted —
## so a task without a text box still records evidence for the writer's statement.
func submit_demonstration(result: Dictionary) -> Dictionary:
	if _state != STATE_DEMONSTRATION:
		return {
			"accepted": false,
			"state": _state,
			"reason": "Reach the arrangement step before recording it."
		}
	if not bool(result.get("passed")):
		return {
			"accepted": false,
			"state": _state,
			"reason": _demonstration_reason(result)
		}
	var evidence := {
		"decision": _selected_choice_id,
		"effect": _demonstration_evidence(result)
	}
	if String(evidence.get("effect")).is_empty():
		return {
			"accepted": false,
			"state": _state,
			"reason": "That arrangement produced no result to record."
		}
	var completed := _complete_progress(evidence)
	if not completed:
		return {
			"accepted": false,
			"state": _state,
			"reason": _progress_error()
		}
	_state = STATE_COMPLETED
	var outcome := _completion_result(evidence)
	_show_completed(outcome)
	_emit_state()
	if _required:
		mission_completed.emit(_mission_id, evidence.duplicate(true))
	else:
		sidequest_completed.emit(_mission_id)
	return outcome

func close() -> void:
	if is_instance_valid(_panel) and _panel.has_method("close_panel"):
		_panel.call("close_panel")
	_clear_mission()
	_emit_state()

func snapshot() -> Dictionary:
	return {
		"state": _state,
		"missionId": _mission_id,
		"required": _required,
		"activeRole": _active_role,
		"ownerRole": String(_record.get("ownerRole", "")),
		"allowed": _role_allowed(),
		"choiceId": _selected_choice_id,
		"choiceCorrect": _choice_correct,
		"effect": _selected_effect,
		"holdingAction": String(_record.get("holdingAction", "")),
		"applicationObjective": _application_objective(),
		"taskIndex": int(_record.get("taskIndex", 0)),
		"taskTotal": int(_record.get("taskTotal", 0)),
		"hasNextRequired": not _next_required_mission_id().is_empty()
	}

func _mission_record(mission_id: String) -> Dictionary:
	if _catalog_script == null:
		return {}
	var record_value: Variant = _catalog_script.call("mission", mission_id)
	if typeof(record_value) == TYPE_DICTIONARY and not Dictionary(record_value).is_empty():
		return Dictionary(record_value).duplicate(true)
	record_value = _catalog_script.call("sidequest", mission_id)
	if typeof(record_value) != TYPE_DICTIONARY:
		return {}
	return Dictionary(record_value).duplicate(true)

func _evaluate_choice(mission_id: String, choice_id: String) -> Dictionary:
	if _catalog_script == null:
		return {}
	var value: Variant = _catalog_script.call("evaluate_choice", mission_id, choice_id)
	if typeof(value) != TYPE_DICTIONARY:
		return {}
	return Dictionary(value).duplicate(true)

func _role_allowed() -> bool:
	return not _record.is_empty() and _active_role == String(_record.get("ownerRole"))

func _complete_progress(evidence: Dictionary) -> bool:
	if not is_instance_valid(_progress):
		return false
	if _required:
		return bool(_progress.call("complete_mission", _mission_id, evidence))
	return bool(_progress.call("complete_sidequest", _mission_id))

func _completion_result(evidence: Dictionary) -> Dictionary:
	var result := {
		"accepted": true,
		"completed": true,
		"state": _state,
		"missionId": _mission_id,
		"required": _required,
		"evidence": evidence.duplicate(true),
		"reward": String(_record.get("reward")),
		"applicationObjective": _application_objective(),
		"taskIndex": int(_record.get("taskIndex", 0)),
		"taskTotal": int(_record.get("taskTotal", 0)),
		"hasNextRequired": not _next_required_mission_id().is_empty()
	}
	if not _required:
		result["portfolioStamp"] = String(_record.get("portfolioStamp"))
		result["presentationFlourish"] = String(_record.get("presentationFlourish"))
	return result

func _apply_required_sequence_metadata() -> void:
	if not _required or _catalog_script == null:
		return
	var records_value: Variant = _catalog_script.call("required_missions")
	if typeof(records_value) != TYPE_ARRAY:
		return
	var records: Array = records_value
	for index in records.size():
		var record_value: Variant = records[index]
		if typeof(record_value) != TYPE_DICTIONARY:
			continue
		if String(Dictionary(record_value).get("id", "")) == _mission_id:
			_record["taskIndex"] = index + 1
			_record["taskTotal"] = records.size()
			return

func _next_required_mission_id() -> String:
	if not _required or _catalog_script == null or not is_instance_valid(_progress):
		return ""
	var records_value: Variant = _catalog_script.call("required_missions")
	if typeof(records_value) != TYPE_ARRAY:
		return ""
	var records: Array = records_value
	var current_index := -1
	for index in records.size():
		var record_value: Variant = records[index]
		if typeof(record_value) == TYPE_DICTIONARY and String(Dictionary(record_value).get("id", "")) == _mission_id:
			current_index = index
			break
	if current_index < 0:
		return ""
	var completed: Array = _progress.get("completed_mission_ids")
	for index in range(current_index + 1, records.size()):
		var record_value: Variant = records[index]
		if typeof(record_value) != TYPE_DICTIONARY:
			continue
		var candidate_id := String(Dictionary(record_value).get("id", ""))
		if not candidate_id.is_empty() and not completed.has(candidate_id):
			return candidate_id
	return ""

func _application_objective() -> String:
	if _record.is_empty():
		return ""
	return "At the Studio, apply this %s decision to your advertisement. Explain its audience effect." % String(_record.get("title")).to_lower()

func _progress_error() -> String:
	if not is_instance_valid(_progress):
		return "Work progress is unavailable."
	var message := String(_progress.get("last_error"))
	if message.is_empty():
		return "Work progress could not record this evidence."
	return message

func _show_choice() -> void:
	if is_instance_valid(_panel) and _panel.has_method("show_choice"):
		_panel.call("show_choice", _record.duplicate(true), _active_role, _role_allowed())

func _show_effect(evaluation: Dictionary) -> void:
	if is_instance_valid(_panel) and _panel.has_method("show_effect"):
		_panel.call("show_effect", _record.duplicate(true), evaluation.duplicate(true))

func _show_demonstration() -> void:
	if is_instance_valid(_panel) and _panel.has_method("show_demonstration"):
		_panel.call("show_demonstration", _record.duplicate(true))

func _demonstration() -> Dictionary:
	var value: Variant = _record.get("demonstration", {})
	return Dictionary(value) if typeof(value) == TYPE_DICTIONARY else {}

func _demonstration_evidence(result: Dictionary) -> String:
	# A stage that writes its own sentence from its own record supplies it here, so this
	# controller does not have to know what each engine measures or what its record calls
	# things. Engine A names the lever it won instead, and the sentence is looked up below.
	var supplied := String(result.get("evidence", ""))
	if not supplied.is_empty():
		return supplied
	var demonstration := _demonstration()
	var won_levers: PackedStringArray = result.get("wonLevers", PackedStringArray())
	if demonstration.is_empty() or won_levers.is_empty():
		return ""
	var sentences: Dictionary = demonstration.get("evidenceSentences", {})
	return String(sentences.get(won_levers[0], "")).format({
		"target": _demonstration_target_name(demonstration)
	})

## Why the stage did not accept what the pair built. Engine A's sentence was written into
## this controller, so every later engine would have reported that the named object does
## not lead on any of the three, whatever its own measure actually checks.
func _demonstration_reason(result: Dictionary) -> String:
	var supplied := String(result.get("reason", ""))
	if not supplied.is_empty():
		return supplied
	return "The named object does not lead on any of the three yet."

func _demonstration_target_name(demonstration: Dictionary) -> String:
	var target_id := String(demonstration.get("targetId", ""))
	for object_value: Variant in Array(demonstration.get("objects", [])):
		if typeof(object_value) != TYPE_DICTIONARY:
			continue
		var object: Dictionary = object_value
		if String(object.get("id", "")) == target_id:
			return String(object.get("name", target_id))
	return target_id

func _show_completed(result: Dictionary) -> void:
	if is_instance_valid(_panel) and _panel.has_method("show_completed"):
		_panel.call("show_completed", _record.duplicate(true), result.duplicate(true))

func _connect_panel() -> void:
	if not is_instance_valid(_panel):
		return
	_connect_panel_signal("choice_selected", _on_choice_selected)
	_connect_panel_signal("continue_requested", _on_continue_requested)
	_connect_panel_signal("demonstration_submitted", _on_demonstration_submitted)
	_connect_panel_signal("retry_requested", _on_retry_requested)
	_connect_panel_signal("next_requested", _on_next_requested)
	_connect_panel_signal("close_requested", _on_close_requested)

func _disconnect_panel() -> void:
	if not is_instance_valid(_panel):
		return
	_disconnect_panel_signal("choice_selected", _on_choice_selected)
	_disconnect_panel_signal("continue_requested", _on_continue_requested)
	_disconnect_panel_signal("demonstration_submitted", _on_demonstration_submitted)
	_disconnect_panel_signal("retry_requested", _on_retry_requested)
	_disconnect_panel_signal("next_requested", _on_next_requested)
	_disconnect_panel_signal("close_requested", _on_close_requested)

func _connect_panel_signal(signal_name: StringName, callback: Callable) -> void:
	if _panel.has_signal(signal_name) and not _panel.is_connected(signal_name, callback):
		_panel.connect(signal_name, callback)

func _disconnect_panel_signal(signal_name: StringName, callback: Callable) -> void:
	if _panel.has_signal(signal_name) and _panel.is_connected(signal_name, callback):
		_panel.disconnect(signal_name, callback)

func _on_choice_selected(choice_id: String) -> void:
	choose(choice_id)

func _on_continue_requested() -> void:
	continue_to_demonstration()

func _on_demonstration_submitted(result: Dictionary) -> void:
	var outcome := submit_demonstration(result)
	if not bool(outcome.get("accepted")) and is_instance_valid(_panel):
		if _panel.has_method("show_demonstration_error"):
			_panel.call("show_demonstration_error", String(outcome.get("reason")))

func _on_retry_requested() -> void:
	retry()

func _on_next_requested() -> void:
	if _state != STATE_COMPLETED or not _required:
		close()
		return
	var next_mission_id := _next_required_mission_id()
	if next_mission_id.is_empty():
		close()
		return
	open_mission(next_mission_id, _active_role)

func _on_close_requested() -> void:
	close()

func _emit_state() -> void:
	state_changed.emit(snapshot())

func _clear_mission() -> void:
	_record = {}
	_mission_id = ""
	_active_role = ""
	_selected_choice_id = ""
	_selected_effect = ""
	_choice_correct = false
	_required = true
	_state = STATE_CLOSED
