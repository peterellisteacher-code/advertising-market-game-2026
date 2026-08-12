extends Control
class_name AdMarketPitchTheatre

signal pitch_finished
signal format_changed(format_id: String)
signal animation_changed(animation_id: String)
signal sound_requested(cue_id: String)

const CampaignImageDecoder = preload("res://src/presentation/campaign_image_decoder.gd")
const FORMAT_IDS := ["billboard", "magazine", "vertical-screen"]
const FORMAT_LABELS := {
	"billboard": "Billboard",
	"magazine": "Magazine page",
	"vertical-screen": "Vertical screen",
}
const ANIMATION_IDS := ["immediate", "reveal", "slide", "spotlight", "sequence"]
const ANIMATION_LABELS := {
	"immediate": "Immediate",
	"reveal": "Fade reveal",
	"slide": "Slide in",
	"spotlight": "Spotlight",
	"sequence": "Advertisement sequence",
}
const SOUND_IDS := ["camera", "swoosh"]
const SIDEQUEST_LABELS := {
	"thirty-second-rescue": "Thirty-second Rescue",
	"colour-clinic": "Colour Clinic",
	"crop-lab": "Crop Lab",
	"headline-surgery": "Headline Surgery",
	"media-match": "Media Match",
}

var _progress: AdMarketAgencyProgress
var _publication: Dictionary = {}
var _current_texture: ImageTexture
var _current_format_id: String = "billboard"
var _current_animation_id: String = "reveal"
var _reduced_motion: bool = false
var _presentation_tween: Tween
var _slide_origin_x: float = 0.0
var _slide_offset_active: bool = false
var _last_sound_msec: int = -1000

func _ready() -> void:
	_configure_selectors()
	_connect_controls()
	visible = false

func present(
	publication: Dictionary,
	progress: AdMarketAgencyProgress,
	reduced_motion: bool
) -> bool:
	var decoded: ImageTexture = CampaignImageDecoder.decode(publication)
	if decoded == null:
		return false
	_progress = progress
	_publication = publication.duplicate(true)
	_current_texture = decoded
	_reduced_motion = reduced_motion
	_assign_exact_texture(decoded)
	_update_evidence()
	_update_aida_plan()
	_update_client_response()
	_update_portfolio_stamps()
	var stored_format: String = "billboard"
	var stored_animation: String = "reveal"
	if is_instance_valid(progress):
		stored_format = String(progress.pitch_settings.get("formatId", stored_format))
		stored_animation = String(progress.pitch_settings.get("animationId", stored_animation))
	if not FORMAT_IDS.has(stored_format):
		stored_format = "billboard"
	if not ANIMATION_IDS.has(stored_animation):
		stored_animation = "reveal"
	_current_format_id = stored_format
	_current_animation_id = stored_animation
	_select_option_metadata("%FormatSelector", stored_format)
	_select_option_metadata("%AnimationSelector", stored_animation)
	_apply_format_visibility()
	visible = true
	_play_selected_animation()
	var heading: Label = get_node_or_null("%PitchHeading") as Label
	if heading != null:
		var metadata: Dictionary = publication.get("metadata", {})
		var product_name: String = String(metadata.get("productName", "the finished advertisement")).strip_edges()
		heading.text = "Presenting %s" % (product_name if not product_name.is_empty() else "the finished advertisement")
	var enter_button: Button = get_node_or_null("%EnterMarket") as Button
	if enter_button != null and enter_button.is_inside_tree():
		enter_button.grab_focus()
	return true

func select_format(format_id: String) -> bool:
	if not FORMAT_IDS.has(format_id):
		return false
	_current_format_id = format_id
	if is_instance_valid(_progress):
		_progress.pitch_settings["formatId"] = format_id
	_select_option_metadata("%FormatSelector", format_id)
	_apply_format_visibility()
	format_changed.emit(format_id)
	return true

func select_animation(animation_id: String) -> bool:
	if not ANIMATION_IDS.has(animation_id):
		return false
	_current_animation_id = animation_id
	if is_instance_valid(_progress):
		_progress.pitch_settings["animationId"] = animation_id
	_select_option_metadata("%AnimationSelector", animation_id)
	_play_selected_animation()
	animation_changed.emit(animation_id)
	return true

func current_animation_id() -> String:
	return _current_animation_id

func current_format_id() -> String:
	return _current_format_id

func set_reduced_motion_enabled(enabled: bool) -> void:
	_reduced_motion = enabled
	if enabled:
		_finish_animation_state()

func play_sound(cue_id: String) -> bool:
	if not SOUND_IDS.has(cue_id):
		return false
	var now := Time.get_ticks_msec()
	if now - _last_sound_msec < 120:
		return false
	_last_sound_msec = now
	sound_requested.emit(cue_id)
	return true

func finish_pitch() -> void:
	_finish_animation_state()
	pitch_finished.emit()

func _configure_selectors() -> void:
	_configure_selector("%FormatSelector", FORMAT_IDS, FORMAT_LABELS)
	_configure_selector("%AnimationSelector", ANIMATION_IDS, ANIMATION_LABELS)

func _configure_selector(path: String, ids: Array, labels: Dictionary) -> void:
	var selector := get_node_or_null(path) as OptionButton
	if selector == null:
		return
	selector.clear()
	for id_value in ids:
		var item_id := String(id_value)
		selector.add_item(String(labels.get(item_id, item_id.capitalize())))
		selector.set_item_metadata(selector.item_count - 1, item_id)

func _connect_controls() -> void:
	var format_selector := get_node_or_null("%FormatSelector") as OptionButton
	if format_selector != null and not format_selector.item_selected.is_connected(_on_format_selected):
		format_selector.item_selected.connect(_on_format_selected)
	var animation_selector := get_node_or_null("%AnimationSelector") as OptionButton
	if animation_selector != null and not animation_selector.item_selected.is_connected(_on_animation_selected):
		animation_selector.item_selected.connect(_on_animation_selected)
	_connect_button("%CameraSound", _on_camera_sound_pressed)
	_connect_button("%SwooshSound", _on_swoosh_sound_pressed)
	_connect_button("%EnterMarket", finish_pitch)

func _connect_button(path: String, callback: Callable) -> void:
	var button := get_node_or_null(path) as Button
	if button != null and not button.pressed.is_connected(callback):
		button.pressed.connect(callback)

func _assign_exact_texture(texture: ImageTexture) -> void:
	for path in ["%BillboardAd", "%MagazineAd", "%VerticalAd"]:
		var image := get_node_or_null(path) as TextureRect
		if image != null:
			image.texture = texture
			image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED

func _apply_format_visibility() -> void:
	var paths := {
		"billboard": "%BillboardFrame",
		"magazine": "%MagazineFrame",
		"vertical-screen": "%VerticalFrame",
	}
	for format_id in paths:
		var frame := get_node_or_null(String(paths.get(format_id))) as Control
		if frame != null:
			frame.visible = format_id == _current_format_id

func _update_evidence() -> void:
	_set_evidence(
		"%EvidenceAudience",
		"Audience fit",
		_has_mission("audience-brief"),
		_evidence_explanation(
			["audience-brief"],
			"The brief identifies who the advertisement must persuade and the response it seeks."
		)
	)
	_set_evidence(
		"%EvidenceValue",
		"Product value",
		_has_mission("claim-proof"),
		_evidence_explanation(
			["claim-proof"],
			"The product benefit is linked to evidence the pair can defend."
		)
	)
	_set_evidence(
		"%EvidenceAida",
		"AIDA",
		_has_mission("aida"),
		_evidence_explanation(
			["aida"],
			"The message moves from attention and interest to desire and action."
		)
	)
	_set_evidence(
		"%EvidenceHierarchy",
		"Visual hierarchy",
		_has_mission("salience") and _has_mission("reading-path"),
		_evidence_explanation(
			["salience", "reading-path"],
			"Scale, contrast and placement establish a deliberate order of attention."
		)
	)
	_set_evidence(
		"%EvidenceClaim",
		"Supportable claim",
		_has_mission("claim-proof"),
		_evidence_explanation(
			["claim-proof"],
			"The main claim is no stronger than the available product evidence."
		)
	)

func _evidence_explanation(mission_ids: Array, fallback: String) -> String:
	if not is_instance_valid(_progress):
		return fallback
	var effect_texts: Array[String] = []
	for mission_id in mission_ids:
		var evidence: Dictionary = Dictionary(_progress.evidence_by_mission.get(String(mission_id), {}))
		var effect_text := String(evidence.get("effect", "")).strip_edges()
		if not effect_text.is_empty():
			effect_texts.append(effect_text)
	if effect_texts.is_empty():
		return fallback
	return " ".join(effect_texts)

func _set_evidence(path: String, title: String, complete: bool, explanation: String) -> void:
	var label := get_node_or_null(path) as Label
	if label == null:
		return
	label.text = (
		"%s — %s" % [title, explanation]
		if complete
		else "%s — Complete the related task before the pitch." % title
	)

func _update_aida_plan() -> void:
	var strategy_value: Variant = _publication.get("strategy", {})
	var strategy: Dictionary = strategy_value if typeof(strategy_value) == TYPE_DICTIONARY else {}
	var plan_value: Variant = strategy.get("aidaPlan", {})
	var plan: Dictionary = plan_value if typeof(plan_value) == TYPE_DICTIONARY else {}
	for move in ["attention", "interest", "desire", "action"]:
		var label := get_node_or_null("%%Aida%s" % String(move).capitalize()) as Label
		if label == null:
			continue
		var explanation := String(plan.get(move, "")).strip_edges()
		if explanation.is_empty():
			explanation = "Explain this move before the pitch."
		label.text = "%s — %s" % [String(move).capitalize(), explanation]
	var mastery := get_node_or_null("%MasteryStatus") as Label
	if mastery != null:
		var complete_count := 0
		if is_instance_valid(_progress):
			for mission_id in AdMarketAgencyProgress.REQUIRED_MISSIONS:
				if _progress.completed_mission_ids.has(String(mission_id)):
					complete_count += 1
		mastery.text = "%d of %d complete" % [complete_count, AdMarketAgencyProgress.REQUIRED_MISSIONS.size()]

func _update_client_response() -> void:
	var response := get_node_or_null("%ClientResponse") as Label
	if response == null:
		return
	var completed := 0
	for mission_id in ["audience-brief", "salience", "reading-path", "aida", "claim-proof"]:
		if _has_mission(String(mission_id)):
			completed += 1
	if completed == 5:
		response.text = (
			"The client can follow the advertisement from audience need to persuasive response. "
			+ "The message, visual hierarchy and supportable claim now work together, so the pair can defend why this advertisement should persuade its audience."
		)
	elif completed >= 3:
		response.text = (
			"The client can see a clear audience and advertisement direction. Some evidence still needs to be connected before the pair can defend the whole advertisement."
		)
	else:
		response.text = (
			"The client can see the advertisement, but the pair still needs enough evidence to explain how it serves the intended audience."
		)

func _update_portfolio_stamps() -> void:
	var label := get_node_or_null("%PortfolioStamps") as Label
	if label == null:
		return
	var stamps: Array[String] = []
	if is_instance_valid(_progress):
		for sidequest_id in _progress.completed_sidequest_ids:
			stamps.append(String(SIDEQUEST_LABELS.get(sidequest_id, sidequest_id.capitalize())))
	label.text = (
		"Optional practice completed: %s" % ", ".join(stamps)
		if not stamps.is_empty()
		else "Optional practice: none completed. It never blocks the pitch."
	)

func _has_mission(mission_id: String) -> bool:
	return is_instance_valid(_progress) and _progress.completed_mission_ids.has(mission_id)

func _play_selected_animation() -> void:
	_finish_animation_state()
	var stage := get_node_or_null("%PresentationStage") as Control
	if stage == null or _reduced_motion or _current_animation_id == "immediate":
		return
	stage.pivot_offset = stage.size * 0.5
	match _current_animation_id:
		"reveal":
			stage.modulate.a = 0.0
			_presentation_tween = create_tween()
			_presentation_tween.tween_property(stage, "modulate:a", 1.0, 0.55)
		"slide":
			_slide_origin_x = stage.position.x
			_slide_offset_active = true
			stage.position.x = _slide_origin_x + 90.0
			stage.modulate.a = 0.2
			_presentation_tween = create_tween().set_parallel(true)
			_presentation_tween.tween_property(stage, "position:x", _slide_origin_x, 0.6).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
			_presentation_tween.tween_property(stage, "modulate:a", 1.0, 0.45)
		"spotlight":
			stage.scale = Vector2(0.92, 0.92)
			stage.modulate.a = 0.45
			_presentation_tween = create_tween().set_parallel(true)
			_presentation_tween.tween_property(stage, "scale", Vector2.ONE, 0.65).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
			_presentation_tween.tween_property(stage, "modulate:a", 1.0, 0.4)
		"sequence":
			stage.scale = Vector2(0.94, 0.94)
			stage.modulate.a = 0.1
			_presentation_tween = create_tween().set_parallel(true)
			_presentation_tween.tween_property(stage, "scale", Vector2.ONE, 0.85).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
			_presentation_tween.tween_property(stage, "modulate:a", 1.0, 0.75)

func _finish_animation_state() -> void:
	if _presentation_tween != null and _presentation_tween.is_valid():
		_presentation_tween.kill()
	_presentation_tween = null
	var stage := get_node_or_null("%PresentationStage") as Control
	if stage != null:
		if _slide_offset_active:
			stage.position.x = _slide_origin_x
		_slide_offset_active = false
		stage.modulate = Color.WHITE
		stage.scale = Vector2.ONE

func _select_option_metadata(path: String, value: String) -> void:
	var selector := get_node_or_null(path) as OptionButton
	if selector == null:
		return
	for index in selector.item_count:
		if String(selector.get_item_metadata(index)) == value:
			selector.select(index)
			return

func _on_format_selected(index: int) -> void:
	var selector := get_node_or_null("%FormatSelector") as OptionButton
	if selector != null and index >= 0 and index < selector.item_count:
		select_format(String(selector.get_item_metadata(index)))

func _on_animation_selected(index: int) -> void:
	var selector := get_node_or_null("%AnimationSelector") as OptionButton
	if selector != null and index >= 0 and index < selector.item_count:
		select_animation(String(selector.get_item_metadata(index)))

func _on_camera_sound_pressed() -> void:
	play_sound("camera")

func _on_swoosh_sound_pressed() -> void:
	play_sound("swoosh")

func _unhandled_input(event: InputEvent) -> void:
	if visible and event.is_action_pressed("ui_cancel"):
		_finish_animation_state()
		get_viewport().set_input_as_handled()
