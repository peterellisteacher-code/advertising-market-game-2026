extends RefCounted
class_name AdMarketAgencyCampaignController

signal creator_requested
signal publish_requested
signal market_requested
signal progress_changed
signal status_changed(message: String)

const MissionCatalog = preload("res://src/agency/agency_mission_catalog.gd")
const LEVEL_MISSIONS: Dictionary = {
	"invent": ["audience-brief", "salience", "reading-path"],
	"sell": ["contrast", "framing", "aida"],
	"irresistible": ["claim-proof"],
	"publish-check": [],
}
const OBJECTIVE_AFTER_MISSION: Dictionary = {
	"salience": "direct-attention",
	"reading-path": "set-campaign-tone",
	"contrast": "focus-image",
	"framing": "shape-message",
	"aida": "prove-value",
	"claim-proof": "polish-campaign",
}
const CREATOR_OBJECTIVES: Array[String] = ["build-product", "polish-campaign"]

var _run: AdMarketGameRun
var _progress: AdMarketAgencyProgress
var _document: Dictionary = {}
var _publication: Dictionary = {}

func begin_agency(game_run: AdMarketGameRun, document: Dictionary) -> void:
	_set_context(game_run, document)
	if _progress != null and not _progress.started:
		_progress.begin()
	_emit_progress()

func restore_agency(game_run: AdMarketGameRun, document: Dictionary) -> void:
	_set_context(game_run, document)
	var progress_changed: bool = false
	var objective_before: String = _progress.current_objective_id if _progress != null else ""
	if _progress != null and not _progress.started:
		progress_changed = _progress.begin()
	_reconcile_document_objective()
	if _progress != null and _progress.current_objective_id != objective_before:
		progress_changed = true
	if progress_changed:
		_emit_progress()

func current_objective() -> Dictionary:
	if _progress == null:
		return {}
	return MissionCatalog.objective(_progress.current_objective_id)

func open_station(station_id: String) -> Dictionary:
	var objective: Dictionary = current_objective()
	if _progress == null or objective.is_empty():
		return {"allowed": false, "reason": "No agency campaign is active."}
	var objective_station := String(objective.get("stationId"))
	var allowed := station_id == "reception" or station_id == objective_station
	if not allowed:
		return {
			"allowed": false,
			"reason": "The current objective is at %s." % objective_station,
			"objective": objective.duplicate(true),
		}
	if station_id != "reception":
		_progress.travel_to(station_id)
	_emit_progress()
	if station_id == "production-studio" and CREATOR_OBJECTIVES.has(_progress.current_objective_id):
		creator_requested.emit()
	return {
		"allowed": true,
		"stationId": station_id,
		"objective": objective.duplicate(true),
	}

func complete_mission(mission_id: String, evidence: Dictionary) -> bool:
	if _progress == null:
		return false
	var completed := _progress.completed_mission_ids.has(mission_id)
	if not completed:
		completed = _progress.complete_mission(mission_id, evidence)
	if not completed:
		return false
	if mission_id == "audience-brief":
		_set_objective("direct-attention" if _has_initial_product() else "build-product")
	elif OBJECTIVE_AFTER_MISSION.has(mission_id):
		_set_objective(String(OBJECTIVE_AFTER_MISSION[mission_id]))
	_emit_progress()
	return true

func complete_sidequest(sidequest_id: String) -> bool:
	if _progress == null:
		return false
	var completed := _progress.completed_sidequest_ids.has(sidequest_id)
	if not completed:
		completed = _progress.complete_sidequest(sidequest_id)
	if not completed:
		return false
	_emit_progress()
	return true

func handoff_to(role: String) -> bool:
	if _progress == null or not ["art-director", "strategist"].has(role):
		return false
	if _progress.active_role != role and not _progress.handoff_to(role):
		return false
	var gameplay: Dictionary = _dictionary_child(_document, "gameplay")
	var pair: Dictionary = _dictionary_child(gameplay, "pair")
	pair["activeRole"] = _progress.active_role
	pair["handoffCount"] = _progress.handoff_count
	gameplay["pair"] = pair
	_document["gameplay"] = gameplay
	_emit_progress()
	return true

func on_creator_returned(document: Dictionary) -> void:
	_document = document.duplicate(true)
	_reconcile_document_objective()
	_emit_progress()

func on_publication(publication: Dictionary) -> void:
	_publication = publication.duplicate(true)
	_set_objective("present-campaign")
	status_changed.emit("The published advertisement is ready in the Pitch Theatre.")
	_emit_progress()

func request_publish() -> bool:
	if _progress == null or _progress.current_objective_id != "prepare-pitch":
		status_changed.emit("Complete the current agency objective before publishing.")
		return false
	if not all_required_missions_complete():
		status_changed.emit("Complete all seven required technique missions before publishing.")
		return false
	publish_requested.emit()
	return true

func request_market() -> bool:
	if _publication.is_empty() or _progress == null or _progress.current_objective_id != "present-campaign":
		status_changed.emit("Publish and present the advertisement before entering the market.")
		return false
	market_requested.emit()
	return true

func reconcile_level_readiness(readiness_clue: String) -> bool:
	if _run == null:
		return false
	if not readiness_clue.is_empty() or not missions_complete_for_level(_run.phase):
		_run.invalidate_current_level()
		return false
	if not _run.is_current_level_ready():
		_run.mark_current_level_ready()
	return _run.is_current_level_ready()

func missions_complete_for_level(level_id: String) -> bool:
	if _progress == null or not LEVEL_MISSIONS.has(level_id):
		return false
	for mission_id in Array(LEVEL_MISSIONS[level_id]):
		if not _progress.completed_mission_ids.has(String(mission_id)):
			return false
	return true

func all_required_missions_complete() -> bool:
	if _progress == null:
		return false
	for mission: Dictionary in MissionCatalog.required_missions():
		if not _progress.completed_mission_ids.has(String(mission.get("id"))):
			return false
	return true

func document() -> Dictionary:
	return _document.duplicate(true)

func _set_context(game_run: AdMarketGameRun, document: Dictionary) -> void:
	_run = game_run
	_document = document.duplicate(true)
	_progress = game_run.agency_progress() as AdMarketAgencyProgress if game_run != null else null

func _reconcile_document_objective() -> void:
	if _progress == null:
		return
	if _progress.current_objective_id == "build-product" and _has_initial_product():
		_set_objective("direct-attention")
	elif _progress.current_objective_id == "polish-campaign" and all_required_missions_complete():
		_set_objective("prepare-pitch")

func _has_initial_product() -> bool:
	var product: Dictionary = _dictionary_child(_document, "product")
	return not String(product.get("name", "")).strip_edges().is_empty() and product.get("build") != null

func _set_objective(objective_id: String) -> void:
	if _progress != null and not MissionCatalog.objective(objective_id).is_empty():
		_progress.current_objective_id = objective_id

func _emit_progress() -> void:
	progress_changed.emit()

func _dictionary_child(parent: Dictionary, key: String) -> Dictionary:
	var value: Variant = parent.get(key, {})
	return value.duplicate(true) if typeof(value) == TYPE_DICTIONARY else {}