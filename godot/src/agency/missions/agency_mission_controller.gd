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
const STATE_TRANSFER := "transfer"
const STATE_DEMONSTRATION := "demonstration"
const STATE_COMPLETED := "completed"
const MIN_EVIDENCE_LENGTH := 30
const MAX_EVIDENCE_LENGTH := 400
const AUDIENCE_WORDS: Array[String] = [
	"audience",
	"teenager",
	"student",
	"buyer",
	"customer",
	"people",
	"viewer",
    "reader"
]
const TECHNIQUE_WORDS := {
	"audience-brief": ["audience", "need", "value", "situation", "response"],
	"salience": ["salience", "salient", "contrast", "size", "bigger", "largest", "isolation", "first"],
	"reading-path": ["reading path", "leading line", "placement", "order", "direction", "route"],
	"contrast": ["contrast", "colour", "color", "harmony", "tone", "palette"],
	"framing": ["framing", "frame", "crop", "focus", "subject"],
	"aida": ["aida", "attention", "interest", "desire", "action"],
	"claim-proof": ["claim", "proof", "evidence", "support"],
	"thirty-second-rescue": ["hierarchy", "salience", "clutter", "remove", "focus"],
	"colour-clinic": ["colour", "color", "contrast", "accent", "palette", "tone"],
	"crop-lab": ["crop", "frame", "framing", "focal"],
	"headline-surgery": ["headline", "claim", "message", "concise"],
	"media-match": ["media", "channel", "placement", "format"]
}

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

func continue_to_transfer() -> Dictionary:
	if _state != STATE_EFFECT or not _choice_correct:
		return {
			"changed": false,
			"state": _state,
			"reason": "Choose the effective treatment before applying it."
		}
	# A task with a demonstration replaces the writing gate with it. The rest still ask
	# for a written sentence until their own engine lands.
	if _demonstration().is_empty():
		_state = STATE_TRANSFER
		_show_transfer()
	else:
		_state = STATE_DEMONSTRATION
		_show_demonstration()
	_emit_state()
	return {
		"changed": true,
		"state": _state,
		"applicationObjective": _application_objective()
	}

func submit_transfer_evidence(text: String) -> Dictionary:
	if _state != STATE_TRANSFER:
		return {
			"accepted": false,
			"state": _state,
			"reason": "Reach the application step before submitting evidence."
		}
	var evidence_text := text.strip_edges()
	var validation := _validate_evidence(evidence_text)
	if not bool(validation.get("valid")):
		return {
			"accepted": false,
			"state": _state,
			"reason": String(validation.get("reason")),
			"minimumCharacters": MIN_EVIDENCE_LENGTH,
			"maximumCharacters": MAX_EVIDENCE_LENGTH
		}
	var evidence := {
		"decision": _selected_choice_id,
		"effect": evidence_text
	}
	var completed := _complete_progress(evidence)
	if not completed:
		return {
			"accepted": false,
			"state": _state,
			"reason": _progress_error()
		}
	_state = STATE_COMPLETED
	var result := _completion_result(evidence)
	_show_completed(result)
	_emit_state()
	if _required:
		mission_completed.emit(_mission_id, evidence.duplicate(true))
	else:
		sidequest_completed.emit(_mission_id)
	return result

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
		"applicationObjective": _application_objective()
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

func _validate_evidence(text: String) -> Dictionary:
	if text.length() < MIN_EVIDENCE_LENGTH:
		return {
			"valid": false,
			"reason": "Write at least 30 characters explaining the advertising decision and its audience effect."
		}
	if text.length() > MAX_EVIDENCE_LENGTH:
		return {
			"valid": false,
			"reason": "Keep the explanation to 400 characters or fewer."
		}
	var lower_text := text.to_lower()
	if not _contains_any(lower_text, AUDIENCE_WORDS):
		return {
			"valid": false,
			"reason": "Name the audience or viewer who should notice the effect."
		}
	var technique_words: Array = TECHNIQUE_WORDS.get(_mission_id, [])
	if not _contains_any(lower_text, technique_words):
		return {
			"valid": false,
			"reason": "Name the technique or design change you will apply."
		}
	return {"valid": true}

func _contains_any(text: String, words: Array) -> bool:
	for word_value in words:
		if text.contains(String(word_value).to_lower()):
			return true
	return false

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
		"applicationObjective": _application_objective()
	}
	if not _required:
		result["portfolioStamp"] = String(_record.get("portfolioStamp"))
		result["presentationFlourish"] = String(_record.get("presentationFlourish"))
	return result

func _application_objective() -> String:
	if _record.is_empty():
		return ""
	return "At the Studio, apply this %s decision to your advertisement and explain its audience effect." % String(_record.get("title")).to_lower()

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

func _show_transfer() -> void:
	if is_instance_valid(_panel) and _panel.has_method("show_transfer"):
		_panel.call("show_transfer", _record.duplicate(true), _application_objective())

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
	_connect_panel_signal("evidence_submitted", _on_evidence_submitted)
	_connect_panel_signal("demonstration_submitted", _on_demonstration_submitted)
	_connect_panel_signal("retry_requested", _on_retry_requested)
	_connect_panel_signal("close_requested", _on_close_requested)

func _disconnect_panel() -> void:
	if not is_instance_valid(_panel):
		return
	_disconnect_panel_signal("choice_selected", _on_choice_selected)
	_disconnect_panel_signal("continue_requested", _on_continue_requested)
	_disconnect_panel_signal("evidence_submitted", _on_evidence_submitted)
	_disconnect_panel_signal("demonstration_submitted", _on_demonstration_submitted)
	_disconnect_panel_signal("retry_requested", _on_retry_requested)
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
	continue_to_transfer()

func _on_evidence_submitted(text: String) -> void:
	var result := submit_transfer_evidence(text)
	if not bool(result.get("accepted")) and is_instance_valid(_panel):
		if _panel.has_method("show_validation_error"):
			_panel.call("show_validation_error", String(result.get("reason")))

func _on_demonstration_submitted(result: Dictionary) -> void:
	var outcome := submit_demonstration(result)
	if not bool(outcome.get("accepted")) and is_instance_valid(_panel):
		if _panel.has_method("show_demonstration_error"):
			_panel.call("show_demonstration_error", String(outcome.get("reason")))

func _on_retry_requested() -> void:
	retry()

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
