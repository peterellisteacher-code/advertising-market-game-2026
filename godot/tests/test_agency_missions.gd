extends RefCounted
class_name AdMarketTestAgencyMissions

const AgencyProgress = preload("res://src/agency/agency_progress.gd")
const Catalog = preload("res://src/agency/agency_mission_catalog.gd")
const CONTROLLER_PATH := "res://src/agency/missions/agency_mission_controller.gd"
const PANEL_SCENE_PATH := "res://src/agency/missions/AgencyMissionPanel.tscn"

func run() -> bool:
	assert(_owner_role_holds_the_choice_until_handoff())
	assert(_close_emits_a_safe_closed_snapshot())
	assert(_choice_effect_and_demonstration_complete_required_progress())
	assert(_optional_contract_awards_only_progress_metadata())
	assert(_panel_sequences_one_action_without_transfer())
	assert(_panel_exposes_reference_and_direct_handoff())
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

func _choice_effect_and_demonstration_complete_required_progress() -> bool:
	var progress: RefCounted = AgencyProgress.new()
	assert(progress.call("begin"))
	var controller := _new_controller(progress)
	if controller == null:
		return false
	assert(controller.has_method("continue_to_demonstration"))
	assert(not controller.has_method("continue_to_transfer"))
	assert(not controller.has_method("submit_transfer_evidence"))
	# audience-brief now ends in Engine D's measured support demonstration.
	assert(controller.call("open_mission", "audience-brief", "strategist").get("allowed") == true)
	var incorrect: Dictionary = controller.call("choose", "cheapest")
	assert(incorrect.get("correct") == false)
	assert(controller.call("snapshot").get("state") == "effect")
	assert(controller.call("retry").get("state") == "choice")
	var correct: Dictionary = controller.call("choose", "independence")
	assert(correct.get("correct") == true)
	assert(controller.call("continue_to_demonstration").get("state") == "demonstration")
	var rejected: Dictionary = controller.call("submit_demonstration", {"passed": false})
	assert(rejected.get("accepted") == false)
	var accepted: Dictionary = controller.call("submit_demonstration", {
		"passed": true,
		"evidence": "The context, need and values support a self-directed audience, so the independence decision fits the brief."
	})
	assert(accepted.get("accepted") == true)
	var evidence_by_mission: Dictionary = progress.get("evidence_by_mission")
	var evidence: Dictionary = evidence_by_mission.get("audience-brief", {})
	assert(evidence.get("decision") == "independence")
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
	assert(controller.call("continue_to_demonstration").get("state") == "demonstration")
	var completed: Dictionary = controller.call("submit_demonstration", {
		"passed": true,
		"evidence": "The palettes use related supporting colours and one stronger action colour."
	})
	assert(completed.get("accepted") == true)
	assert(Array(progress.get("completed_sidequest_ids")).has("colour-clinic"))
	assert(String(completed.get("portfolioStamp")).length() > 3)
	assert(not String(completed.get("presentationFlourish")).is_empty())
	assert(not completed.has("creatorAction"))
	assert(not completed.has("marketAction"))
	controller.free()
	return true

func _panel_sequences_one_action_without_transfer() -> bool:
	var panel_scene := load(PANEL_SCENE_PATH) as PackedScene
	if panel_scene == null:
		return false
	var panel := panel_scene.instantiate() as Control
	var tree := Engine.get_main_loop() as SceneTree
	assert(tree != null)
	tree.root.add_child(panel)
	if not panel.is_node_ready():
		panel.call("_ready")
	var record: Dictionary = Catalog.mission("salience")
	var content_path := "Backdrop/Dialog/Margin/Content"
	var instruction := panel.get_node("%s/Instruction" % content_path) as Label
	var mission_badge := panel.get_node("%s/Header/MissionBadge" % content_path) as Label
	panel.call("show_effect", record, {"correct": false, "effect": "The product is not salient."})
	assert(instruction.text == "Read the effect, then select Try another treatment.")
	panel.call("show_effect", record, {"correct": true, "effect": "The product is salient."})
	assert(instruction.text == "Read the effect, then select Apply this decision.")
	assert(mission_badge.text == "AGENCY TASK · Salience and AIDA Attention")
	panel.call("show_demonstration", record)
	var demonstration := panel.get_node("%s/DemonstrationStage" % content_path) as VBoxContainer
	assert(demonstration.visible)
	assert(demonstration.get_child_count() == 1)
	assert(panel.get_node_or_null("%s/TransferStage" % content_path) == null)
	panel.call("show_completed", record, {
		"required": true,
		"reward": "A visible campaign milestone.",
		"applicationObjective": "Apply the decision at the Studio.",
	})
	assert(instruction.text == "Review the result, then return to the agency.")
	panel.free()
	return true

func _panel_exposes_reference_and_direct_handoff() -> bool:
	var panel_scene := load(PANEL_SCENE_PATH) as PackedScene
	if panel_scene == null:
		return false
	var panel := panel_scene.instantiate() as Control
	var tree := Engine.get_main_loop() as SceneTree
	assert(tree != null)
	tree.root.add_child(panel)
	if not panel.is_node_ready():
		panel.call("_ready")
	var record := {
		"title": "Read the audience before making anything",
		"instruction": "Choose the interpretation supported by every brief fact.",
		"goal": "Identify the audience evidence.",
		"ownerRole": "strategist",
		"holdingAction": "The Art Director identifies one visual detail.",
		"required": true,
		"referenceFacts": [
			{"label": "CONTEXT", "text": "Teenagers between school and home."},
			{"label": "NEED", "text": "Make one hour productive."},
			{"label": "VALUES", "text": "Independence and belonging."},
		],
		"choices": [
			{"id": "supported", "label": "The supported answer."},
			{"id": "unsupported", "label": "The unsupported answer."},
		],
	}
	var requested_roles: Array[String] = []
	panel.role_handoff_requested.connect(func(role: String) -> void: requested_roles.append(role))
	panel.call("show_choice", record, "art-director", false)
	var content_path := "Backdrop/Dialog/Margin/Content"
	var reference := panel.get_node("%s/ReferenceCard/ReferenceLabel" % content_path) as Label
	assert(reference.text.contains("CONTEXT"))
	assert(reference.text.contains("NEED"))
	assert(reference.text.contains("VALUES"))
	var choice_stage := panel.get_node("%s/ChoiceStage" % content_path) as VBoxContainer
	var handoff := panel.get_node("%s/RoleHandoffButton" % content_path) as Button
	assert(not choice_stage.visible)
	assert(handoff.visible)
	assert(handoff.text == "Make Strategist active")
	assert((panel.get_node("%s/MissionStep" % content_path) as Label).text == "1. Make Strategist active")
	assert((choice_stage.get_node("ChoiceGrid/ChoiceOne") as Button).disabled)
	assert(not (panel.get_node("%s/ReferenceCard" % content_path) as PanelContainer).visible)
	assert(not (panel.get_node("%s/ReferenceToggle" % content_path) as Button).visible)
	handoff.pressed.emit()
	assert(requested_roles == ["strategist"])
	panel.call("show_handoff_error")
	assert((panel.get_node("%s/MissionStep" % content_path) as Label).text == "1. Hand control over again")
	assert((panel.get_node("%s/Instruction" % content_path) as Label).text.contains("Select the handover button again"))
	panel.call("show_choice", record, "strategist", true)
	assert(choice_stage.visible)
	assert(not handoff.visible)
	assert((panel.get_node("%s/Instruction" % content_path) as Label).text == "Click one answer.")
	assert(not (choice_stage.get_node("ChoiceGrid/ChoiceOne") as Button).disabled)
	var reference_card := panel.get_node("%s/ReferenceCard" % content_path) as PanelContainer
	var reference_toggle := panel.get_node("%s/ReferenceToggle" % content_path) as Button
	assert(reference_card.visible)
	assert(reference_toggle.visible)
	assert(reference_toggle.text == "Hide audience brief")
	reference_toggle.pressed.emit()
	assert(not reference_card.visible)
	assert(reference_toggle.text == "Show audience brief")
	assert(choice_stage.visible)
	reference_toggle.pressed.emit()
	assert(reference_card.visible)
	var mission_reference_record := record.duplicate(true)
	mission_reference_record.erase("referenceFacts")
	panel.call("show_choice", mission_reference_record, "strategist", true)
	assert(reference_toggle.text == "Hide task reference")
	reference_toggle.pressed.emit()
	assert(reference_toggle.text == "Show task reference")
	var role_details := panel.get_node("%s/OwnerCard/HoldingLabel" % content_path) as Label
	var role_definition := panel.get_node("%s/OwnerCard/RoleDefinitionLabel" % content_path) as Label
	var role_toggle := panel.get_node("%s/OwnerCard/RoleDetailsToggle" % content_path) as Button
	assert(not role_details.visible)
	assert(not role_definition.visible)
	role_toggle.pressed.emit()
	assert(role_details.visible)
	assert(role_definition.visible)
	assert(role_definition.text.contains("Both partners use the same controls"))
	assert(role_definition.text.contains("Strategist decides audience, purpose, product and message"))
	assert(role_definition.text.contains("Art Director decides visual design and execution"))
	assert(role_toggle.text == "Hide pair roles")
	panel.free()
	return true

func _panel_scene_exposes_the_mission_contract() -> bool:
	var panel_scene := load(PANEL_SCENE_PATH) as PackedScene
	if panel_scene == null:
		return false
	var panel := panel_scene.instantiate()
	assert(panel.has_signal("choice_selected"))
	assert(not panel.has_signal("evidence_submitted"))
	assert(panel.has_signal("continue_requested"))
	assert(panel.has_signal("retry_requested"))
	assert(panel.has_signal("close_requested"))
	assert(panel.has_signal("role_handoff_requested"))
	assert(panel.has_method("show_choice"))
	assert(panel.has_method("show_effect"))
	assert(panel.has_signal("demonstration_submitted"))
	assert(not panel.has_method("show_transfer"))
	assert(panel.has_method("show_demonstration"))
	assert(panel.get_node_or_null("Backdrop/Dialog/Margin/Content/TransferStage") == null)
	assert(panel.has_method("show_completed"))
	assert(panel.has_method("show_handoff_error"))
	panel.free()
	return true
