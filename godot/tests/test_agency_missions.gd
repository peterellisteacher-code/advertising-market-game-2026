extends RefCounted
class_name AdMarketTestAgencyMissions

const AgencyProgress = preload("res://src/agency/agency_progress.gd")
const CONTROLLER_PATH := "res://src/agency/missions/agency_mission_controller.gd"
const PANEL_SCENE_PATH := "res://src/agency/missions/AgencyMissionPanel.tscn"

func run() -> bool:
	assert(_owner_role_holds_the_choice_until_handoff())
	assert(_close_emits_a_safe_closed_snapshot())
	assert(_choice_effect_and_transfer_complete_required_progress())
	assert(_optional_contract_awards_only_progress_metadata())
	assert(_panel_stages_are_bounded_and_sequence_one_action())
	assert(_panel_scene_exposes_the_mission_contract())
	return true

func _new_controller(progress: RefCounted) -> Node:
	var controller_script := load(CONTROLLER_PATH) as Script
	if controller_script == null or not controller_script.can_instantiate():
		return null
	var controller := controller_script.new() as Node
	controller.call("configure", progress)
	return controller

func _owner_role_holds_the_choice_until_handoff() -> bool:
	var progress: RefCounted = AgencyProgress.new()
	assert(progress.call("begin"))
	var controller := _new_controller(progress)
	if controller == null:
		return false
	var opened: Dictionary = controller.call("open_mission", "salience", "strategist")
	assert(opened.get("opened") == true)
	assert(opened.get("allowed") == false)
	assert(String(opened.get("holdingAction")).length() > 20)
	var held_choice: Dictionary = controller.call("choose", "largest-contrast")
	assert(held_choice.get("allowed") == false)
	assert(controller.call("snapshot").get("state") == "holding")
	controller.free()
	return true

func _close_emits_a_safe_closed_snapshot() -> bool:
	var progress: RefCounted = AgencyProgress.new()
	assert(progress.call("begin"))
	var controller := _new_controller(progress)
	if controller == null:
		return false
	assert(controller.call("open_mission", "salience", "art-director").get("opened") == true)
	controller.call("close")
	var closed: Dictionary = controller.call("snapshot")
	assert(closed.get("state") == "closed")
	assert(closed.get("ownerRole") == "")
	assert(closed.get("holdingAction") == "")
	controller.free()
	return true

func _choice_effect_and_transfer_complete_required_progress() -> bool:
	var progress: RefCounted = AgencyProgress.new()
	assert(progress.call("begin"))
	var controller := _new_controller(progress)
	if controller == null:
		return false
	assert(controller.call("open_mission", "salience", "art-director").get("allowed") == true)
	var incorrect: Dictionary = controller.call("choose", "small-logo")
	assert(incorrect.get("correct") == false)
	assert(controller.call("snapshot").get("state") == "effect")
	assert(controller.call("retry").get("state") == "choice")
	var correct: Dictionary = controller.call("choose", "largest-contrast")
	assert(correct.get("correct") == true)
	assert(controller.call("continue_to_transfer").get("state") == "transfer")
	var rejected: Dictionary = controller.call("submit_transfer_evidence", "bigger")
	assert(rejected.get("accepted") == false)
	var accepted: Dictionary = controller.call(
		"submit_transfer_evidence",
        "I will use a bigger product and stronger colour contrast so the audience notices it first."
	)
	assert(accepted.get("accepted") == true)
	var evidence_by_mission: Dictionary = progress.get("evidence_by_mission")
	var evidence: Dictionary = evidence_by_mission.get("salience", {})
	assert(evidence.get("decision") == "largest-contrast")
	assert(String(evidence.get("effect")).contains("audience"))
	assert(String(accepted.get("applicationObjective")).contains("Studio"))
	controller.free()
	return true

func _optional_contract_awards_only_progress_metadata() -> bool:
	var progress: RefCounted = AgencyProgress.new()
	assert(progress.call("begin"))
	var controller := _new_controller(progress)
	if controller == null:
		return false
	assert(controller.call("open_mission", "colour-clinic", "art-director").get("required") == false)
	assert(controller.call("choose", "reserve-accent").get("correct") == true)
	controller.call("continue_to_transfer")
	var completed: Dictionary = controller.call(
		"submit_transfer_evidence",
        "I will reserve one bright colour accent so the audience sees the action before supporting details."
	)
	assert(completed.get("accepted") == true)
	assert(Array(progress.get("completed_sidequest_ids")).has("colour-clinic"))
	assert(String(completed.get("portfolioStamp")).length() > 3)
	assert(not String(completed.get("presentationFlourish")).is_empty())
	assert(not completed.has("creatorAction"))
	assert(not completed.has("marketAction"))
	controller.free()
	return true

func _panel_stages_are_bounded_and_sequence_one_action() -> bool:
	var panel_scene := load(PANEL_SCENE_PATH) as PackedScene
	if panel_scene == null:
		return false
	var panel := panel_scene.instantiate() as Control
	var tree := Engine.get_main_loop() as SceneTree
	assert(tree != null)
	tree.root.add_child(panel)
	var record := {
		"title": "Control what the audience notices first",
		"goal": "Use visual salience to direct attention.",
		"required": true,
		"transferPrompt": "Name the element that should be seen first and the technique you will use.",
	}
	var content_path := "Backdrop/Dialog/Margin/Content"
	var instruction := panel.get_node("%s/Instruction" % content_path) as Label
	panel.call("show_effect", record, {"correct": false, "effect": "The product is not salient."})
	assert(instruction.text == "Read the effect, then select Try another treatment.")
	panel.call("show_effect", record, {"correct": true, "effect": "The product is salient."})
	assert(instruction.text == "Read the effect, then select Apply this decision.")
	panel.call("show_transfer", record, "At the Studio, apply this decision to the advertisement.")
	assert(instruction.text == "Write one specific sentence that names the audience, the technique and what you will change.")
	var transfer := panel.get_node("%s/TransferStage" % content_path) as VBoxContainer
	var evidence_edit := transfer.get_node("EvidenceEdit") as TextEdit
	var evidence_footer := transfer.get_node("EvidenceFooter") as HBoxContainer
	var validation := transfer.get_node("ValidationLabel") as Label
	var submit := transfer.get_node("SubmitButton") as Button
	assert(evidence_edit.get_index() < evidence_footer.get_index())
	assert(evidence_footer.get_index() < validation.get_index())
	assert(validation.get_index() < submit.get_index())
	var dialog := panel.get_node("Backdrop/Dialog") as PanelContainer
	assert(dialog.get_combined_minimum_size().y <= 700.0)
	panel.call("show_completed", record, {
		"required": true,
		"reward": "A visible campaign milestone.",
		"applicationObjective": "Apply the decision at the Studio.",
	})
	assert(instruction.text == "Review the result, then return to the agency.")
	panel.free()
	return true

func _panel_scene_exposes_the_mission_contract() -> bool:
	var panel_scene := load(PANEL_SCENE_PATH) as PackedScene
	if panel_scene == null:
		return false
	var panel := panel_scene.instantiate()
	assert(panel.has_signal("choice_selected"))
	assert(panel.has_signal("evidence_submitted"))
	assert(panel.has_signal("continue_requested"))
	assert(panel.has_signal("retry_requested"))
	assert(panel.has_signal("close_requested"))
	assert(panel.has_method("show_choice"))
	assert(panel.has_method("show_effect"))
	assert(panel.has_method("show_transfer"))
	assert(panel.has_method("show_completed"))
	panel.free()
	return true
