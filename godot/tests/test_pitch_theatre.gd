extends RefCounted
class_name AdMarketTestPitchTheatre

const TheatreScene = preload("res://src/presentation/PitchTheatre.tscn")
const AgencyProgress = preload("res://src/agency/agency_progress.gd")

var _sound_cues: Array[String] = []
var _pitch_finished: bool = false

func run() -> bool:
	var theatre := TheatreScene.instantiate() as AdMarketPitchTheatre
	var tree := Engine.get_main_loop() as SceneTree
	assert(tree != null)
	tree.root.add_child(theatre)
	var progress := _completed_progress()
	var publication := _publication()
	assert(theatre.present(publication, progress, true))
	var exact_texture: Texture2D = theatre.get_node("%BillboardAd").texture
	assert(exact_texture != null)
	assert(is_same(exact_texture, theatre.get_node("%MagazineAd").texture))
	assert(is_same(exact_texture, theatre.get_node("%VerticalAd").texture))
	assert(exact_texture.get_image().get_width() == 1600)
	assert(exact_texture.get_image().get_height() == 900)
	assert(theatre.get_node("%BillboardFrame").visible)
	assert(not theatre.get_node("%MagazineFrame").visible)
	assert(not theatre.get_node("%VerticalFrame").visible)
	assert(theatre.select_format("magazine"))
	assert(theatre.get_node("%MagazineFrame").visible)
	assert(not theatre.get_node("%BillboardFrame").visible)
	assert(theatre.select_format("vertical-screen"))
	assert(theatre.get_node("%VerticalFrame").visible)
	assert(is_same(exact_texture, theatre.get_node("%VerticalAd").texture))
	var stage := theatre.get_node("%PresentationStage") as Control
	var original_stage_position := stage.position
	theatre.set_reduced_motion_enabled(false)
	assert(theatre.select_animation("slide"))
	assert(stage.position.x > original_stage_position.x)
	assert(theatre.select_animation("immediate"))
	assert(stage.position.is_equal_approx(original_stage_position))
	theatre.set_reduced_motion_enabled(true)
	for animation_id in ["immediate", "reveal", "slide", "spotlight", "sequence"]:
		assert(theatre.select_animation(animation_id))
		assert(theatre.current_animation_id() == animation_id)
		assert(theatre.get_node("%PresentationStage").modulate.a == 1.0)
	assert(theatre.get_node("%EvidenceAudience").text.contains("Audience fit"))
	assert(theatre.get_node("%EvidenceValue").text.contains("Product value"))
	assert(theatre.get_node("%EvidenceAida").text.contains("AIDA"))
	assert(theatre.get_node("%EvidenceHierarchy").text.contains("Visual hierarchy"))
	assert(theatre.get_node("%EvidenceClaim").text.contains("Supportable claim"))
	var response: String = theatre.get_node("%ClientResponse").text
	assert(response.contains("client"))
	assert(response.contains("audience"))
	assert(not response.contains("score"))
	assert(theatre.get_node("%PortfolioStamps").text.contains("Colour Clinic"))
	assert(theatre.get_node("%EnterMarket").focus_mode == Control.FOCUS_ALL)
	theatre.sound_requested.connect(_capture_sound)
	assert(theatre.play_sound("camera"))
	assert(not theatre.play_sound("unknown"))
	assert(_sound_cues == ["camera"])
	var prior_texture: Texture2D = theatre.get_node("%BillboardAd").texture
	var invalid := publication.duplicate(true)
	invalid["contract"] = "published-campaign@999"
	assert(not theatre.present(invalid, progress, true))
	assert(is_same(prior_texture, theatre.get_node("%BillboardAd").texture))
	theatre.pitch_finished.connect(_capture_finished)
	theatre.finish_pitch()
	assert(_pitch_finished)
	theatre.free()
	return true

func _completed_progress() -> AdMarketAgencyProgress:
	var progress := AgencyProgress.new()
	assert(progress.begin())
	for mission_id in AgencyProgress.REQUIRED_MISSIONS:
		progress.completed_mission_ids.append(String(mission_id))
		progress.evidence_by_mission[String(mission_id)] = {"effect": "Verified audience effect."}
	progress.completed_sidequest_ids.append("colour-clinic")
	return progress

func _publication() -> Dictionary:
	var image := Image.create_empty(1600, 900, false, Image.FORMAT_RGBA8)
	image.fill(Color("e9bb48"))
	return {
		"contract": "published-campaign@1",
		"documentId": "campaign-pitch-test",
		"revision": 4,
		"pngBase64": Marshalls.raw_to_base64(image.save_png_to_buffer()),
		"metadata": {"productName": "Orbit Bottle"},
	}

func _capture_sound(cue_id: String) -> void:
	_sound_cues.append(cue_id)

func _capture_finished() -> void:
	_pitch_finished = true
