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
	assert(not bool(controller.open_station("production-studio").get("allowed")))
	assert(bool(controller.open_station("client-briefing").get("allowed")))
	assert(controller.complete_mission("audience-brief", {
		"decision": "independence",
		"effect": "The offer supports the audience's need to control the hour after school.",
	}))
	assert(controller.current_objective().get("stationId") == "art-studio")
	assert(game_run.agency_progress().completed_mission_ids.has("audience-brief"))
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
