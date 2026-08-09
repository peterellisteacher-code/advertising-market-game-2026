extends RefCounted
class_name AdMarketTestAgencyMissionCatalog

const Catalog = preload("res://src/agency/agency_mission_catalog.gd")

func run() -> bool:
	assert(_required_missions_define_role_effect_term_and_demonstration())
	assert(_optional_contracts_are_varied_and_nonblocking())
	assert(_choice_evaluation_returns_factual_audience_effects())
	return true

func _required_missions_define_role_effect_term_and_demonstration() -> bool:
	var missions: Array = Catalog.required_missions()
	var expected_ids := [
		"audience-brief",
		"salience",
		"reading-path",
		"contrast",
		"framing",
		"aida",
        "claim-proof"
	]
	var expected_terms := [
		"Audience brief",
		"Salience and AIDA Attention",
		"Reading path",
		"Colour contrast and harmony",
		"Framing and cropping",
		"AIDA sequence",
		"Claims and evidence"
	]
	assert(missions.size() == expected_ids.size())
	for index in expected_ids.size():
		var mission: Dictionary = missions[index]
		assert(mission.get("id") == expected_ids[index])
		assert(mission.get("term") == expected_terms[index])
		assert(["art-director", "strategist"].has(mission.get("ownerRole")))
		assert(String(mission.get("goal")).length() > 20)
		assert(String(mission.get("goal")).begins_with("%s:" % expected_terms[index]))
		assert(String(mission.get("instruction")).length() > 20)
		assert(String(mission.get("holdingAction")).length() > 20)
		assert(String(mission.get("effectExplanation")).to_lower().contains("audience"))
		assert(Array(mission.get("choices")).size() == 4)
		assert(not String(mission.get("correctChoiceId")).is_empty())
		assert(not Dictionary(mission.get("demonstration", {})).is_empty())
		assert(not String(mission.get("reward")).is_empty())
	return true

func _optional_contracts_are_varied_and_nonblocking() -> bool:
	var sidequests: Array = Catalog.sidequests()
	assert(sidequests.size() == 5)
	var expected_ids := [
		"thirty-second-rescue",
		"colour-clinic",
		"crop-lab",
		"headline-surgery",
        "media-match"
	]
	var expected_terms := [
		"Visual hierarchy",
		"Colour hierarchy",
		"Framing and cropping",
		"Concise headlines",
		"Media format"
	]
	for index in expected_ids.size():
		var sidequest: Dictionary = sidequests[index]
		assert(sidequest.get("id") == expected_ids[index])
		assert(sidequest.get("term") == expected_terms[index])
		assert(String(sidequest.get("goal")).begins_with("%s:" % expected_terms[index]))
		assert(not Dictionary(sidequest.get("demonstration", {})).is_empty())
		assert(sidequest.get("required") == false)
		assert(String(sidequest.get("portfolioStamp")).length() > 3)
		assert(not String(sidequest.get("presentationFlourish")).is_empty())
	return true

func _choice_evaluation_returns_factual_audience_effects() -> bool:
	assert(Catalog.evaluate_choice("salience", "largest-contrast") == {
		"correct": true,
		"effect": "The strongest size and colour contrast directs the audience's attention to the product first."
	})
	var incorrect: Dictionary = Catalog.evaluate_choice("salience", "small-logo")
	assert(incorrect.get("correct") == false)
	assert(String(incorrect.get("effect")).contains("audience"))
	assert(Catalog.evaluate_choice("unknown-mission", "anything").is_empty())
	return true
