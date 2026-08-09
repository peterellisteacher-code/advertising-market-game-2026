extends RefCounted
class_name AdMarketTestAgencyCampaignController

func run() -> bool:
	var controller_script: Script = load("res://src/agency/agency_campaign_controller.gd")
	var game_run_script: Script = load("res://src/game/game_run.gd")
	var game_run: AdMarketGameRun = game_run_script.new()
	assert(game_run.begin("North Star Studio", "session-agency", "team-agency"))
	var controller: RefCounted = controller_script.new()
	controller.begin_agency(game_run, _campaign_document())
	assert(controller.current_objective().get("id") == "meet-client")
	assert((controller.document().get("missionEvidence") as Array).is_empty())
	assert(not bool(controller.open_station("production-studio").get("allowed")))
	assert(bool(controller.open_station("client-briefing").get("allowed")))
	assert(controller.complete_mission("audience-brief", {
		"decision": "independence",
		"effect": "The offer supports the audience's need to control the hour after school.",
	}))
	assert(controller.current_objective().get("stationId") == "art-studio")
	assert(game_run.agency_progress().completed_mission_ids.has("audience-brief"))
	var mission_evidence: Array = controller.document().get("missionEvidence")
	assert(mission_evidence.size() == 1)
	var evidence_entry: Dictionary = mission_evidence[0]
	assert(evidence_entry.get("missionId") == "audience-brief")
	assert(evidence_entry.get("decisionId") == "independence")
	assert(evidence_entry.get("effectText") == "The offer supports the audience's need to control the hour after school.")
	assert(evidence_entry.get("title") == "Read the audience before making anything")
	assert(_out_of_order_required_work_advances_to_polish())
	return true

func _out_of_order_required_work_advances_to_polish() -> bool:
	var controller_script: Script = load("res://src/agency/agency_campaign_controller.gd")
	var game_run_script: Script = load("res://src/game/game_run.gd")
	var game_run: AdMarketGameRun = game_run_script.new()
	assert(game_run.begin("North Star Studio", "session-out-of-order", "team-out-of-order"))
	var controller: RefCounted = controller_script.new()
	controller.begin_agency(game_run, _campaign_document())
	var progress := game_run.agency_progress() as AdMarketAgencyProgress
	var completion_order: Array[String] = [
		"audience-brief",
		"framing",
		"aida",
		"claim-proof",
		"salience",
		"reading-path",
		"contrast",
	]
	for mission_id: String in completion_order:
		var evidence := {
			"decision": "decision-%s" % mission_id,
			"effect": "This recorded decision changes the audience's response to the advertisement.",
		}
		assert(progress.complete_mission(mission_id, evidence))
		assert(controller.complete_mission(mission_id, evidence))
	assert(controller.current_objective().get("id") == "polish-campaign")
	controller.on_creator_returned(_campaign_document())
	assert(controller.current_objective().get("id") == "prepare-pitch")
	return true

func _campaign_document() -> Dictionary:
	return {
		"product": {
			"name": "Focus Flask",
			"build": {"starterProductId": "focus-flask"},
		},
		"gameplay": {
			"pair": {
				"activeRole": "art-director",
				"handoffCount": 0,
			},
		},
	}
