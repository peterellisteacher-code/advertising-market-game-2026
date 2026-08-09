extends RefCounted
class_name AdMarketTestColourMeasure

# Engine C replaces the contrast writing gate with a demonstration. The two properties
# engines A and B both hold apply here as well:
#
#   * the opening palette must NOT already pass, and
#   * a pass must come out of the measure rather than out of matching a stored palette.
#
# The second is established rather than asserted in a comment: five structurally different
# palettes are shown to pass, which no authored answer could allow.
#
# A third property is specific to C, and is the whole reason Kate brings three products
# rather than one. A palette that is well made for one brief must FAIL for another. If the
# same colours passed every product, the wheel would be teaching "pick a tidy palette"
# rather than "pick the palette this product needs", and the three jobs would be three
# repetitions of one exercise.

const Measure = preload("res://src/agency/missions/demonstrations/colour_measure.gd")
const Catalog = preload("res://src/agency/agency_mission_catalog.gd")
const PanelScene = preload("res://src/agency/missions/AgencyMissionPanel.tscn")
const AgencyProgress = preload("res://src/agency/agency_progress.gd")
const CONTROLLER_PATH := "res://src/agency/missions/agency_mission_controller.gd"
const STAGE_PATH := "res://src/agency/missions/demonstrations/ColourStage.tscn"

const ACTION := "action"
# Hues in degrees clockwise from red. A calm brief asks for the cool side of the wheel, an
# urgent one for the warm side; these two are far enough apart that no palette can satisfy
# both, which is what the two-briefs check below relies on.
const CALM := 210.0
const URGENT := 20.0

func run() -> bool:
	assert(_hue_distance_wraps_round_the_wheel())
	assert(_the_base_hue_is_the_hue_between_the_supports())
	assert(_supports_facing_opposite_ways_have_no_base_hue())
	assert(_every_declared_check_declares_its_own_tolerance_and_comparison())
	assert(_each_check_reads_what_it_names())
	assert(_a_support_as_strong_as_the_action_leaves_no_accent())
	assert(_a_poster_with_nothing_but_the_action_cannot_pass())
	assert(_the_same_palette_cannot_serve_two_different_briefs())
	assert(_many_different_palettes_pass())
	assert(await _the_stage_builds_the_measured_contract())
	assert(await _the_wheel_pixel_controls_the_selected_element())
	assert(await _wheel_linework_does_not_change_the_selected_element())
	assert(await _reconfiguring_the_stage_rebuilds_a_populated_readout())
	assert(await _three_record_jobs_run_in_sequence())
	assert(_catalog_supplies_two_distinct_three_job_demonstrations())
	assert(_nested_record_overlay_preserves_base_siblings())
	assert(await _the_clinic_binds_kate_and_opens_with_four_failed_checks())
	assert(await _kate_dialogue_tracks_the_three_product_sequence())
	assert(_the_stage_declares_readable_label_colours())
	assert(await _the_panel_focuses_the_selected_element())
	assert(await _the_panel_fits_and_records_all_three_palettes())
	return true

func _element(id: String, hue: float, strength: float) -> Dictionary:
	return {"id": id, "hue": hue, "strength": strength}

# Three cool supports and one warm action, against a calm brief. Every check passes, so a
# single override in a test names exactly the thing under examination.
func _scene(overrides: Dictionary = {}) -> Dictionary:
	var scene := {
		"elements": [
			_element("background", 210.0, 0.35),
			_element("headline", 230.0, 0.35),
			_element("body", 195.0, 0.35),
			_element(ACTION, 30.0, 1.0)
		],
		"actionElement": ACTION,
		"toneHue": CALM,
		"minAccentSeparation": 90.0,
		"minAccentStrength": 0.25,
		"maxSupportSpread": 60.0,
		"maxToneDistance": 75.0
	}
	for key: Variant in overrides:
		scene[key] = overrides[key]
	return scene

func _palette(supports: Array, action_hue: float, action_strength: float) -> Array:
	var elements := []
	for index in range(supports.size()):
		var support: Array = supports[index]
		elements.append(_element("support%d" % index, float(support[0]), float(support[1])))
	elements.append(_element(ACTION, action_hue, action_strength))
	return elements

func _value(result: Dictionary, check: String) -> float:
	return float(Dictionary(Dictionary(result.get("checks", {})).get(check, {})).get("value", 0.0))

func _met(result: Dictionary, check: String) -> bool:
	return bool(Dictionary(Dictionary(result.get("checks", {})).get(check, {})).get("passed", false))

func _hue_distance_wraps_round_the_wheel() -> bool:
	# Hues are positions on a circle, so the two ends of the scale are neighbours. A
	# subtraction that does not wrap would call these two colours 340 degrees apart and
	# hand every palette straddling red a separation it never had.
	assert(is_equal_approx(Measure.hue_distance(350.0, 10.0), 20.0))
	assert(is_equal_approx(Measure.hue_distance(10.0, 350.0), 20.0))
	assert(is_equal_approx(Measure.hue_distance(0.0, 190.0), 170.0))
	# Never more than half the wheel: opposite is the furthest apart two hues can be.
	assert(is_equal_approx(Measure.hue_distance(0.0, 180.0), Measure.OPPOSITE))
	# An undefined hue has no distance to report, so it reports the furthest.
	assert(is_equal_approx(Measure.hue_distance(Measure.HUE_UNDEFINED, 10.0), Measure.OPPOSITE))
	return true

func _the_base_hue_is_the_hue_between_the_supports() -> bool:
	# Two supports either side of red. The arithmetic mean of 350 and 10 is 180 — cyan,
	# the colour furthest from both — so averaging the numbers rather than the directions
	# would report a base hue neither support is anywhere near, and every check that reads
	# the base would be measuring against a colour nobody picked.
	var base := Measure.circular_mean(PackedFloat32Array([350.0, 10.0]))
	assert(Measure.hue_distance(base, 0.0) < 1.0)
	assert(Measure.hue_distance(base, 180.0) > 179.0)
	return true

func _supports_facing_opposite_ways_have_no_base_hue() -> bool:
	# Supports at opposite sides of the wheel cancel: there is no hue between them, and
	# picking one would invent a number the pair never chose.
	var base := Measure.circular_mean(PackedFloat32Array([0.0, 180.0]))
	assert(is_equal_approx(base, Measure.HUE_UNDEFINED))

	var opposed: Dictionary = Measure.evaluate(_scene({
		"elements": _palette([[0.0, 0.35], [180.0, 0.35]], 90.0, 1.0)
	}))
	assert(is_equal_approx(float(opposed.get("baseHue", 0.0)), Measure.HUE_UNDEFINED))
	# The spread is still measured, and it is the reading that tells the pair what to fix:
	# the supports span half the wheel. The two checks that need a base report their worst
	# honest reading rather than a sentinel.
	assert(is_equal_approx(_value(opposed, Measure.CHECK_SUPPORT_HARMONY), Measure.OPPOSITE))
	assert(is_zero_approx(_value(opposed, Measure.CHECK_ACCENT_SEPARATION)))
	assert(is_equal_approx(_value(opposed, Measure.CHECK_TONE_MATCH), Measure.OPPOSITE))
	assert(not _met(opposed, Measure.CHECK_SUPPORT_HARMONY))
	assert(not _met(opposed, Measure.CHECK_ACCENT_SEPARATION))
	assert(not _met(opposed, Measure.CHECK_TONE_MATCH))
	# The accent is still genuinely stronger than everything else, and saying otherwise
	# would send the pair to fix a lever that is not broken.
	assert(_met(opposed, Measure.CHECK_ACCENT_STRENGTH))
	assert(opposed.get("passed") == false)
	return true

func _every_declared_check_declares_its_own_tolerance_and_comparison() -> bool:
	# A check with no declared tolerance reports itself unmet rather than borrowing
	# another's. C carries a second declaration B did not need: two of its four checks are
	# ceilings, and reading a spread or a distance-from-target as "at least" would pass
	# exactly the palettes the check exists to reject. The guard only helps while every
	# check that exists is listed in both.
	for check: String in Measure.CHECKS:
		assert(Measure.CHECK_EPSILON.has(check))
		assert(Measure.CHECK_COMPARISON.has(check))
		var comparison := String(Measure.CHECK_COMPARISON[check])
		assert(comparison == Measure.COMPARE_AT_LEAST or comparison == Measure.COMPARE_AT_MOST)
	assert(Measure.CHECK_EPSILON.size() == Measure.CHECKS.size())
	assert(Measure.CHECK_COMPARISON.size() == Measure.CHECKS.size())

	# The two tolerances are in different units and neither is a share, so one standing in
	# for the other would be silent: half a degree and a thousandth of a strength step.
	assert(not is_equal_approx(Measure.DEGREE_EPSILON, Measure.STRENGTH_EPSILON))
	return true

func _each_check_reads_what_it_names() -> bool:
	var settled: Dictionary = Measure.evaluate(_scene())
	assert(settled.get("passed") == true)
	assert(PackedStringArray(settled.get("unmet")).is_empty())
	# The base hue is where the three supports point, not one of them.
	assert(Measure.hue_distance(float(settled.get("baseHue", 0.0)), CALM) < 5.0)

	# Moving the action's hue moves the separation and nothing else: the supports are
	# untouched, so the base, the spread and the strengths all stand.
	var close: Dictionary = Measure.evaluate(_scene({
		"elements": _palette([[210.0, 0.35], [230.0, 0.35], [195.0, 0.35]], 200.0, 1.0)
	}))
	assert(_value(close, Measure.CHECK_ACCENT_SEPARATION) < 20.0)
	assert(not _met(close, Measure.CHECK_ACCENT_SEPARATION))
	assert(is_equal_approx(
		_value(close, Measure.CHECK_ACCENT_STRENGTH),
		_value(settled, Measure.CHECK_ACCENT_STRENGTH)
	))
	assert(is_equal_approx(
		_value(close, Measure.CHECK_SUPPORT_HARMONY),
		_value(settled, Measure.CHECK_SUPPORT_HARMONY)
	))
	assert(is_equal_approx(
		_value(close, Measure.CHECK_TONE_MATCH),
		_value(settled, Measure.CHECK_TONE_MATCH)
	))
	assert(PackedStringArray(close.get("unmet")) == PackedStringArray([Measure.CHECK_ACCENT_SEPARATION]))

	# Weakening the action moves the margin and nothing else — every hue is where it was.
	var weak: Dictionary = Measure.evaluate(_scene({
		"elements": _palette([[210.0, 0.35], [230.0, 0.35], [195.0, 0.35]], 30.0, 0.4)
	}))
	assert(is_equal_approx(_value(weak, Measure.CHECK_ACCENT_STRENGTH), 0.05))
	assert(not _met(weak, Measure.CHECK_ACCENT_STRENGTH))
	assert(is_equal_approx(
		_value(weak, Measure.CHECK_ACCENT_SEPARATION),
		_value(settled, Measure.CHECK_ACCENT_SEPARATION)
	))
	assert(PackedStringArray(weak.get("unmet")) == PackedStringArray([Measure.CHECK_ACCENT_STRENGTH]))

	# Scattering one support widens the spread. This one is NOT isolated and is not
	# asserted to be: moving a support moves the base hue those supports point to, so the
	# separation and the tone reading move with it. That coupling is the measure telling
	# the truth — a scattered palette really has changed what the accent contrasts with.
	var scattered: Dictionary = Measure.evaluate(_scene({
		"elements": _palette([[210.0, 0.35], [230.0, 0.35], [120.0, 0.35]], 30.0, 1.0)
	}))
	assert(_value(scattered, Measure.CHECK_SUPPORT_HARMONY) > 60.0)
	assert(not _met(scattered, Measure.CHECK_SUPPORT_HARMONY))
	assert(is_equal_approx(
		_value(scattered, Measure.CHECK_ACCENT_STRENGTH),
		_value(settled, Measure.CHECK_ACCENT_STRENGTH)
	))
	assert(scattered.get("passed") == false)
	return true

func _a_support_as_strong_as_the_action_leaves_no_accent() -> bool:
	# This is where the plan's "only one element carries the accent" is measured. A
	# background as strong as the action leaves the margin at zero, so the count is
	# entailed by the margin rather than counted beside it — and the pair is told the one
	# thing to change, which is to mute the background, not to recolour anything.
	var tied: Dictionary = Measure.evaluate(_scene({
		"elements": _palette([[210.0, 1.0], [230.0, 0.35], [195.0, 0.35]], 30.0, 1.0)
	}))
	assert(is_zero_approx(_value(tied, Measure.CHECK_ACCENT_STRENGTH)))
	assert(not _met(tied, Measure.CHECK_ACCENT_STRENGTH))
	assert(PackedStringArray(tied.get("unmet")) == PackedStringArray([Measure.CHECK_ACCENT_STRENGTH]))
	assert(tied.get("passed") == false)
	return true

func _a_poster_with_nothing_but_the_action_cannot_pass() -> bool:
	# Nothing to reserve the accent against. Reporting a pass here would let a poster with
	# one coloured element satisfy a check about hierarchy between elements.
	var alone: Dictionary = Measure.evaluate(_scene({
		"elements": [_element(ACTION, 30.0, 1.0)]
	}))
	assert(alone.get("passed") == false)
	assert(PackedStringArray(alone.get("unmet")).size() == Measure.CHECKS.size())
	assert(is_equal_approx(float(alone.get("baseHue", 0.0)), Measure.HUE_UNDEFINED))

	# And a record naming an action element the poster does not carry fails closed rather
	# than silently scoring the first element it finds.
	var misnamed: Dictionary = Measure.evaluate(_scene({"actionElement": "no-such-element"}))
	assert(misnamed.get("passed") == false)
	assert(PackedStringArray(misnamed.get("unmet")).size() == Measure.CHECKS.size())
	return true

func _the_same_palette_cannot_serve_two_different_briefs() -> bool:
	# Kate's three products are three different briefs, and this is what makes them worth
	# doing separately. The cool palette below is well made — the accent is far round the
	# wheel, it is the only strong colour, the supports are related — and it is still the
	# wrong answer for a product asking to feel urgent. Exactly one check says so, so the
	# pair is told the palette is good and aimed at the wrong feeling, not that it is bad.
	var calm_brief: Dictionary = Measure.evaluate(_scene())
	assert(calm_brief.get("passed") == true)

	var wrong_brief: Dictionary = Measure.evaluate(_scene({"toneHue": URGENT}))
	assert(not _met(wrong_brief, Measure.CHECK_TONE_MATCH))
	assert(_met(wrong_brief, Measure.CHECK_ACCENT_SEPARATION))
	assert(_met(wrong_brief, Measure.CHECK_ACCENT_STRENGTH))
	assert(_met(wrong_brief, Measure.CHECK_SUPPORT_HARMONY))
	assert(PackedStringArray(wrong_brief.get("unmet")) == PackedStringArray([Measure.CHECK_TONE_MATCH]))

	# And the reverse, so this is a property of the measure rather than of one palette: a
	# warm palette built for the urgent product fails the calm one.
	var warm := _palette([[20.0, 0.35], [35.0, 0.35], [5.0, 0.35]], 200.0, 1.0)
	var urgent_brief: Dictionary = Measure.evaluate(_scene({
		"elements": warm, "toneHue": URGENT
	}))
	assert(urgent_brief.get("passed") == true)
	var calm_with_warm: Dictionary = Measure.evaluate(_scene({
		"elements": warm, "toneHue": CALM
	}))
	assert(PackedStringArray(calm_with_warm.get("unmet")) == PackedStringArray([Measure.CHECK_TONE_MATCH]))
	return true

func _many_different_palettes_pass() -> bool:
	# Five palettes that differ in accent hue, in how far the supports spread, and in how
	# strong everything is. No stored answer could accept all five, which is what
	# establishes that the pass comes out of the measure. All five are judged against the
	# same calm brief.
	var palettes := [
		# The three supports fanned either side of the base, accent opposite.
		_palette([[210.0, 0.35], [230.0, 0.35], [195.0, 0.35]], 30.0, 1.0),
		# Every support on one hue, so the spread is nil.
		_palette([[210.0, 0.5], [210.0, 0.5]], 30.0, 1.0),
		# Supports opened out to the widest the brief allows.
		_palette([[180.0, 0.35], [210.0, 0.35], [240.0, 0.35]], 30.0, 1.0),
		# Accent at exactly the minimum separation rather than opposite.
		_palette([[205.0, 0.35], [215.0, 0.35]], 300.0, 1.0),
		# Strong supports, with an accent that still clears them by the required margin.
		_palette([[210.0, 0.6], [220.0, 0.6]], 40.0, 0.9)
	]
	var separations := []
	for palette: Array in palettes:
		var result: Dictionary = Measure.evaluate(_scene({"elements": palette}))
		assert(result.get("passed") == true)
		assert(PackedStringArray(result.get("unmet")).is_empty())
		separations.append(_value(result, Measure.CHECK_ACCENT_SEPARATION))

	# They are structurally different and not five spellings of one arrangement: the
	# separations alone span more than a quadrant.
	var widest := 0.0
	var narrowest := 360.0
	for separation: float in separations:
		widest = maxf(widest, separation)
		narrowest = minf(narrowest, separation)
	assert(widest - narrowest > 80.0)
	return true


func _stage_job(id: String, product: String, feeling: String, product_image: String, tone_hue: float) -> Dictionary:
	return {
		"id": id,
		"product": product,
		"feeling": feeling,
		"productImage": product_image,
		"toneHue": tone_hue,
		"elements": [
			_element("panel", tone_hue, 0.35),
			_element("headline", tone_hue, 0.35),
			_element("body", tone_hue, 0.35),
			_element(ACTION, tone_hue, 0.35)
		]
	}

func _stage_record() -> Dictionary:
	return {
		"engine": "colour-wheel",
		"scene": STAGE_PATH,
		"wheel": "res://assets/agency/colour/colour-wheel.png",
		"panelArt": "res://assets/agency/colour/poster-panel.png",
		"headlineArt": "res://assets/agency/colour/poster-headline.png",
		"bodyArt": "res://assets/agency/colour/poster-body.png",
		"actionArt": "res://assets/agency/colour/poster-action.png",
		"actionElement": ACTION,
		"instruction": "Select a poster element, then choose a colour from the wheel. Nearby hues support one another; hues further apart create contrast. Inner rings are weaker; outer rings are stronger.",
		"elementLabels": {
			"panel": "Panel",
			"headline": "Headline",
			"body": "Body copy",
			ACTION: "Action"
		},
		"jobs": [
			_stage_job("sleep-tea", "Herbal sleep tea", "calm", "res://assets/agency/colour/product-sleep-tea.png", CALM),
			_stage_job("skateboard", "Skateboard", "urgent", "res://assets/agency/colour/product-skateboard.png", 30.0),
			_stage_job("ceramic-mug", "Handmade ceramic mug", "restrained", "res://assets/agency/colour/product-mug.png", 120.0)
		],
		"minAccentSeparation": 90.0,
		"minAccentStrength": 0.25,
		"maxSupportSpread": 60.0,
		"maxToneDistance": 45.0,
		"checkPhrases": {
			Measure.CHECK_ACCENT_SEPARATION: "action colour separated",
			Measure.CHECK_ACCENT_STRENGTH: "action colour strongest",
			Measure.CHECK_SUPPORT_HARMONY: "supporting colours related",
			Measure.CHECK_TONE_MATCH: "supporting colours suit the feeling"
		},
		"unmetSentences": {
			Measure.CHECK_ACCENT_SEPARATION: "Move the action colour further around the wheel from the supporting colours.",
			Measure.CHECK_ACCENT_STRENGTH: "Choose a stronger ring for the action, or a weaker ring for the supporting elements.",
			Measure.CHECK_SUPPORT_HARMONY: "Move the supporting colours closer together on the wheel.",
			Measure.CHECK_TONE_MATCH: "Move the supporting colours towards the part of the wheel that suits {feeling}."
		},
		"wonSentences": {
			"job": "The palette for {product} uses related supporting colours and one clear action accent.",
			"complete": "All three product palettes meet their briefs."
		},
		"evidenceSentences": {
			"colour": "The three product palettes used related supporting colours and one stronger, separated action accent, so the audience can recognise the intended feeling and locate the action."
		},
		"subjectPhrase": "the three product palettes"
	}

func _settle_stage() -> void:
	var tree := Engine.get_main_loop() as SceneTree
	await tree.process_frame
	await tree.process_frame

func _stage_in_tree(record: Dictionary) -> Control:
	var packed := load(STAGE_PATH) as PackedScene
	if packed == null:
		return null
	var tree := Engine.get_main_loop() as SceneTree
	var stage := packed.instantiate() as Control
	tree.root.add_child(stage)
	stage.call("configure", record)
	return stage

func _result_element(result: Dictionary, id: String) -> Dictionary:
	for value: Variant in Array(result.get("elements", [])):
		var element := Dictionary(value)
		if String(element.get("id", "")) == id:
			return element
	return {}

func _wheel_point(wheel: TextureRect, hue: float) -> Vector2:
	var angle := deg_to_rad(hue - 90.0)
	var radius := minf(wheel.size.x, wheel.size.y) * 0.40
	return wheel.size * 0.5 + Vector2(cos(angle), sin(angle)) * radius

func _wheel_sample(wheel: TextureRect, local_point: Vector2) -> Color:
	var image := wheel.texture.get_image()
	var source := Vector2(local_point.x / wheel.size.x, local_point.y / wheel.size.y) * Vector2(image.get_size())
	return image.get_pixelv(Vector2i(floori(source.x), floori(source.y)))

func _spoke_point(wheel: TextureRect) -> Vector2:
	var image := wheel.texture.get_image()
	var source_size := Vector2(image.get_size())
	var centre := source_size * 0.5
	var radius := minf(source_size.x, source_size.y) * 0.32
	for step in range(3600):
		var angle := float(step) * TAU / 3600.0
		var source_point := centre + Vector2(cos(angle), sin(angle)) * radius
		var pixel := Vector2i(floori(source_point.x), floori(source_point.y))
		var sampled := image.get_pixelv(pixel)
		if sampled.a >= 0.95 and sampled.s >= 0.1 and sampled.s < 0.25 and sampled.v > 0.88:
			return source_point / source_size * wheel.size
	return Vector2(-1.0, -1.0)

func _click_wheel(wheel: TextureRect, local_point: Vector2) -> void:
	var click := InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.pressed = true
	click.position = local_point
	wheel.gui_input.emit(click)

func _select_action_and_click(stage: Control, hue: float) -> void:
	(stage.get_node("ElementButtons/ActionButton") as Button).pressed.emit()
	var wheel := stage.get_node("CompositionArea/ColourWheel") as TextureRect
	_click_wheel(wheel, _wheel_point(wheel, hue))

func _the_stage_builds_the_measured_contract() -> bool:
	if not ResourceLoader.exists(STAGE_PATH):
		return false
	var stage := _stage_in_tree(_stage_record())
	if stage == null:
		return false
	await _settle_stage()
	var readout := stage.get_node("ReadoutRow") as Control
	var first_heading := ""
	if readout.get_child_count() > 0:
		var labels := readout.get_child(0).find_children("*", "Label", true, false)
		if not labels.is_empty():
			first_heading = String((labels[0] as Label).text)
	var composition := stage.get_node("CompositionArea") as Control
	var poster := composition.get_node("PosterHitArea") as Panel
	var wheel := composition.get_node("ColourWheel") as TextureRect
	var opening: Dictionary = stage.call("current_result")
	var holds := (
		readout.get_child_count() == Measure.CHECKS.size()
		and first_heading == "ACTION COLOUR SEPARATED"
		and not bool(opening.get("passed"))
		and wheel.get_index() > poster.get_index()
		and wheel.mouse_filter == Control.MOUSE_FILTER_STOP
	)
	stage.queue_free()
	return holds

func _the_wheel_pixel_controls_the_selected_element() -> bool:
	var stage := _stage_in_tree(_stage_record())
	if stage == null:
		return false
	await _settle_stage()
	var wheel := stage.get_node("CompositionArea/ColourWheel") as TextureRect
	var point := _wheel_point(wheel, 30.0)
	var sampled := _wheel_sample(wheel, point)
	var expected_hue := wrapf(roundf(sampled.h * 12.0) * 30.0, 0.0, 360.0)
	_select_action_and_click(stage, 30.0)
	var result: Dictionary = stage.call("current_result")
	var action := _result_element(result, ACTION)
	var panel := _result_element(result, "panel")
	var action_art := stage.get_node("CompositionArea/PosterHitArea/ActionArtwork") as TextureRect
	var holds := (
		sampled.s > 0.9
		and Measure.hue_distance(float(action.get("hue", -1.0)), expected_hue) < 0.01
		and is_equal_approx(float(action.get("strength", -1.0)), sampled.s)
		and is_equal_approx(action_art.modulate.s, sampled.s)
		and Measure.hue_distance(float(panel.get("hue", -1.0)), CALM) < 0.01
	)
	stage.queue_free()
	return holds

func _wheel_linework_does_not_change_the_selected_element() -> bool:
	var stage := _stage_in_tree(_stage_record())
	if stage == null:
		return false
	await _settle_stage()
	(stage.get_node("ElementButtons/ActionButton") as Button).pressed.emit()
	var wheel := stage.get_node("CompositionArea/ColourWheel") as TextureRect
	var hub_point := wheel.size * 0.5
	var spoke_point := _spoke_point(wheel)
	if spoke_point.x < 0.0:
		stage.queue_free()
		return false
	var hub_sample := _wheel_sample(wheel, hub_point)
	var spoke_sample := _wheel_sample(wheel, spoke_point)
	var before := _result_element(stage.call("current_result"), ACTION)
	_click_wheel(wheel, hub_point)
	var after_hub := _result_element(stage.call("current_result"), ACTION)
	_click_wheel(wheel, spoke_point)
	var after_spoke := _result_element(stage.call("current_result"), ACTION)
	var holds := (
		hub_sample.s >= 0.1
		and hub_sample.s < 0.25
		and spoke_sample.s >= 0.1
		and spoke_sample.s < 0.25
		and is_equal_approx(float(after_hub.get("hue", -1.0)), float(before.get("hue", -2.0)))
		and is_equal_approx(float(after_hub.get("strength", -1.0)), float(before.get("strength", -2.0)))
		and is_equal_approx(float(after_spoke.get("hue", -1.0)), float(before.get("hue", -2.0)))
		and is_equal_approx(float(after_spoke.get("strength", -1.0)), float(before.get("strength", -2.0)))
	)
	stage.queue_free()
	return holds

func _reconfiguring_the_stage_rebuilds_a_populated_readout() -> bool:
	var record := _stage_record()
	var stage := _stage_in_tree(record)
	if stage == null:
		return false
	await _settle_stage()
	stage.call("configure", record)
	await _settle_stage()
	var readout := stage.get_node("ReadoutRow") as HBoxContainer
	var populated := readout.get_child_count() == Measure.CHECKS.size()
	for column: Node in readout.get_children():
		var reading := column.get_node_or_null("Reading") as Label
		populated = populated and reading != null and not reading.text.is_empty()
	stage.queue_free()
	return populated

func _three_record_jobs_run_in_sequence() -> bool:
	var record := _stage_record()
	var stage := _stage_in_tree(record)
	if stage == null:
		return false
	await _settle_stage()
	var submitted := []
	stage.connect("arrangement_submitted", func(result: Dictionary) -> void: submitted.append(result))
	var observed := PackedStringArray()
	var premature := false
	for index in range(Array(record.get("jobs", [])).size()):
		var before: Dictionary = stage.call("current_result")
		observed.append(String(before.get("jobId", "")))
		var action_hue := wrapf(float(before.get("toneHue", 0.0)) + 180.0, 0.0, 360.0)
		_select_action_and_click(stage, action_hue)
		(stage.get_node("ActionsRow/CheckButton") as Button).pressed.emit()
		if index < Array(record.get("jobs", [])).size() - 1 and not submitted.is_empty():
			premature = true
		await _settle_stage()
	var check_button := stage.get_node("ActionsRow/CheckButton") as Button
	var awaiting_ack := submitted.is_empty() and check_button.text == "Finish task" and not check_button.disabled
	check_button.pressed.emit()
	await _settle_stage()
	var final: Dictionary = submitted[0] if submitted.size() == 1 else {}
	var holds := (
		observed == PackedStringArray(["sleep-tea", "skateboard", "ceramic-mug"])
		and not premature
		and awaiting_ack
		and submitted.size() == 1
		and bool(final.get("passed"))
		and Array(final.get("jobs", [])).size() == 3
		and String(final.get("evidence", "")).contains("audience")
	)
	stage.queue_free()
	return holds


func _job_products(record: Dictionary) -> PackedStringArray:
	var products := PackedStringArray()
	for value: Variant in Array(record.get("jobs", [])):
		products.append(String(Dictionary(value).get("product", "")))
	return products


func _all_starting_strengths_are(record: Dictionary, expected: float) -> bool:
	for job_value: Variant in Array(record.get("jobs", [])):
		for element_value: Variant in Array(Dictionary(job_value).get("elements", [])):
			if not is_equal_approx(float(Dictionary(element_value).get("strength", -1.0)), expected):
				return false
	return true


func _catalog_supplies_two_distinct_three_job_demonstrations() -> bool:
	var contrast: Dictionary = Catalog.mission("contrast").get("demonstration", {})
	var clinic: Dictionary = Catalog.sidequest("colour-clinic").get("demonstration", {})
	var phrases: Dictionary = contrast.get("checkPhrases", {})
	var clinic_base: Dictionary = clinic.get("baseRecord", {})
	var products := PackedStringArray(["Herbal sleep tea", "Skateboard", "Handmade ceramic mug"])
	var all_checks_named := true
	for check: String in Measure.CHECKS:
		all_checks_named = all_checks_named and phrases.has(check)
	return (
		not contrast.is_empty()
		and not clinic.is_empty()
		and contrast != clinic
		and clinic_base == contrast
		and String(contrast.get("scene", "")) == STAGE_PATH
		and String(clinic.get("scene", "")) == STAGE_PATH
		and _job_products(contrast) == products
		and _job_products(clinic) == products
		and _all_starting_strengths_are(contrast, 0.0)
		and _all_starting_strengths_are(clinic, 1.0)
		and String(contrast.get("clientPortrait", "")) == "res://assets/agency/colour/client-kate-preppy-cola.png"
		and not Dictionary(contrast.get("clientDialogue", {})).is_empty()
		and Dictionary(contrast.get("clientDialogue", {})) != Dictionary(clinic.get("clientDialogue", {}))
		and float(contrast.get("minAccentStrength", 1.0)) <= 0.29
		and all_checks_named
		and not contrast.has("leverPhrases")
		and not Dictionary(contrast.get("unmetSentences", {})).is_empty()
		and not Dictionary(contrast.get("wonSentences", {})).is_empty()
		and not Dictionary(contrast.get("evidenceSentences", {})).is_empty()
		and not String(contrast.get("subjectPhrase", "")).is_empty()
	)


func _nested_record_overlay_preserves_base_siblings() -> bool:
	var packed := load(STAGE_PATH) as PackedScene
	if packed == null:
		return false
	var stage := packed.instantiate() as Control
	var base := {
		"clientDialogue": {
			"opening": "Base opening",
			"next": "Base next",
			"complete": "Base complete"
		},
		"elementLabels": {"panel": "Base panel", "action": "Base action"},
		"jobs": [{"id": "base-job"}]
	}
	var expanded: Dictionary = stage.call("_expanded_record", {
		"baseRecord": base,
		"clientDialogue": {"opening": "Overlay opening"},
		"elementLabels": {"action": "Overlay action"},
		"jobs": [{"id": "replacement-job"}]
	})
	stage.free()
	var dialogue: Dictionary = expanded.get("clientDialogue", {})
	var labels: Dictionary = expanded.get("elementLabels", {})
	var jobs: Array = expanded.get("jobs", [])
	return (
		String(dialogue.get("opening", "")) == "Overlay opening"
		and String(dialogue.get("next", "")) == "Base next"
		and String(dialogue.get("complete", "")) == "Base complete"
		and String(labels.get("panel", "")) == "Base panel"
		and String(labels.get("action", "")) == "Overlay action"
		and jobs.size() == 1
		and String(Dictionary(jobs[0]).get("id", "")) == "replacement-job"
		and String(Dictionary(base.get("clientDialogue", {})).get("opening", "")) == "Base opening"
	)


func _the_clinic_binds_kate_and_opens_with_four_failed_checks() -> bool:
	var record: Dictionary = Catalog.sidequest("colour-clinic").get("demonstration", {})
	var stage := _stage_in_tree(record)
	if stage == null:
		return false
	await _settle_stage()
	var portrait := stage.get_node_or_null("CompositionArea/ClientCard/ClientPortrait") as TextureRect
	var identity := stage.get_node_or_null("CompositionArea/ClientCard/ClientCopy/ClientIdentity") as Label
	var dialogue := stage.get_node_or_null("CompositionArea/ClientCard/ClientCopy/ClientDialogue") as Label
	var result: Dictionary = stage.call("current_result")
	var unmet: PackedStringArray = result.get("unmet", PackedStringArray())
	var opening := String(Dictionary(record.get("clientDialogue", {})).get("opening", ""))
	var holds := (
		portrait != null
		and portrait.texture != null
		and identity != null
		and identity.text.contains("Kate")
		and identity.text.contains("80-year-old grandmother")
		and identity.text.contains("Preppy Cola")
		and dialogue != null
		and dialogue.text == opening
		and not bool(result.get("passed"))
		and unmet.size() == Measure.CHECKS.size()
	)
	stage.queue_free()
	return holds


func _kate_dialogue_tracks_the_three_product_sequence() -> bool:
	var record: Dictionary = Catalog.mission("contrast").get("demonstration", {})
	var dialogue_record: Dictionary = record.get("clientDialogue", {})
	var stage := _stage_in_tree(record)
	if stage == null:
		return false
	await _settle_stage()
	var dialogue := stage.get_node_or_null("CompositionArea/ClientCard/ClientCopy/ClientDialogue") as Label
	if dialogue == null or dialogue.text != String(dialogue_record.get("opening", "")):
		stage.queue_free()
		return false
	var submitted := []
	stage.connect("arrangement_submitted", func(result: Dictionary) -> void: submitted.append(result))
	var first: Dictionary = stage.call("current_result")
	_select_action_and_click(stage, wrapf(float(first.get("toneHue", 0.0)) + 180.0, 0.0, 360.0))
	(stage.get_node("ActionsRow/CheckButton") as Button).pressed.emit()
	await _settle_stage()
	var second: Dictionary = stage.call("current_result")
	var next_expected := String(dialogue_record.get("next", "")).format({
		"product": String(second.get("product", "")),
		"feeling": String(second.get("feeling", ""))
	})
	var advanced := dialogue.text == next_expected
	for _index in range(2):
		var current: Dictionary = stage.call("current_result")
		_select_action_and_click(stage, wrapf(float(current.get("toneHue", 0.0)) + 180.0, 0.0, 360.0))
		(stage.get_node("ActionsRow/CheckButton") as Button).pressed.emit()
		await _settle_stage()
	var check_button := stage.get_node("ActionsRow/CheckButton") as Button
	var completion_visible := (
		submitted.is_empty()
		and dialogue.text == String(dialogue_record.get("complete", ""))
		and check_button.text == "Finish task"
		and not check_button.disabled
	)
	check_button.pressed.emit()
	await _settle_stage()
	var holds := (
		advanced
		and completion_visible
		and submitted.size() == 1
	)
	stage.queue_free()
	return holds


func _the_stage_declares_readable_label_colours() -> bool:
	var packed := load(STAGE_PATH) as PackedScene
	if packed == null:
		return false
	var stage := packed.instantiate() as Control
	var stage_theme: Theme = stage.theme
	if stage_theme == null or not stage_theme.has_color("font_color", "Label"):
		stage.free()
		return false
	var foreground := stage_theme.get_color("font_color", "Label")
	var background := Color.from_string("#fffaf0", Color.WHITE)
	var lighter := maxf(foreground.get_luminance(), background.get_luminance())
	var darker := minf(foreground.get_luminance(), background.get_luminance())
	var contrast_ratio := (lighter + 0.05) / (darker + 0.05)
	stage.free()
	return foreground.a >= 0.99 and contrast_ratio >= 4.5

func _the_panel_focuses_the_selected_element() -> bool:
	var tree := Engine.get_main_loop() as SceneTree
	var progress: RefCounted = AgencyProgress.new()
	if not bool(progress.call("begin")):
		return false
	var panel := PanelScene.instantiate() as Control
	tree.root.add_child(panel)
	var controller := (load(CONTROLLER_PATH) as Script).new() as Node
	controller.call("configure", progress, panel)
	var opened: Dictionary = controller.call("open_mission", "contrast", "art-director")
	var chosen: Dictionary = controller.call("choose", "one-accent-harmony")
	var continued: Dictionary = controller.call("continue_to_demonstration")
	await _settle_stage()
	var host := panel.get_node("Backdrop/Dialog/Margin/Content/DemonstrationStage") as Control
	var stage := host.get_child(0) as Control if host.get_child_count() == 1 else null
	var expected := stage.get_node("ElementButtons/PanelButton") as Control if stage != null else null
	var holds := (
		bool(opened.get("allowed"))
		and bool(chosen.get("correct"))
		and String(continued.get("state", "")) == "demonstration"
		and expected != null
		and stage.get_viewport().gui_get_focus_owner() == expected
	)
	controller.free()
	panel.queue_free()
	return holds

func _the_panel_fits_and_records_all_three_palettes() -> bool:
	var tree := Engine.get_main_loop() as SceneTree
	var progress: RefCounted = AgencyProgress.new()
	if not bool(progress.call("begin")):
		return false
	var panel := PanelScene.instantiate() as Control
	tree.root.add_child(panel)
	var controller := (load(CONTROLLER_PATH) as Script).new() as Node
	controller.call("configure", progress, panel)
	var opened: Dictionary = controller.call("open_mission", "contrast", "art-director")
	var chosen: Dictionary = controller.call("choose", "one-accent-harmony")
	var continued: Dictionary = controller.call("continue_to_demonstration")
	if not bool(opened.get("allowed")) or not bool(chosen.get("correct")) or String(continued.get("state", "")) != "demonstration":
		controller.free()
		panel.queue_free()
		return false
	var host := panel.get_node("Backdrop/Dialog/Margin/Content/DemonstrationStage") as Control
	var stage := host.get_child(0) as Control
	var host_was_visible := host.visible
	await _settle_stage()
	# This is deliberately measured before any check press: completion replaces this tall
	# stage with a shorter panel, which would make an overflow assertion meaningless.
	var dialog := panel.get_node("Backdrop/Dialog") as PanelContainer
	var demonstration_height := dialog.get_combined_minimum_size().y
	assert(
		demonstration_height <= 760.0,
		"Colour demonstration dialog is %.1f px high; maximum is 760 px." % demonstration_height
	)
	for index in range(3):
		var before: Dictionary = stage.call("current_result")
		_select_action_and_click(stage, wrapf(float(before.get("toneHue", 0.0)) + 180.0, 0.0, 360.0))
		(stage.get_node("ActionsRow/CheckButton") as Button).pressed.emit()
		await _settle_stage()
	var completion_copy := String(Dictionary(Catalog.mission("contrast").get("demonstration", {})).get("clientDialogue", {}).get("complete", ""))
	var completion_visible := (
		is_instance_valid(stage)
		and host.visible
		and String(controller.call("snapshot").get("state", "")) == "demonstration"
		and (stage.get_node("CompositionArea/ClientCard/ClientCopy/ClientDialogue") as Label).text == completion_copy
		and (stage.get_node("ActionsRow/CheckButton") as Button).text == "Finish task"
		and not (stage.get_node("ActionsRow/CheckButton") as Button).disabled
	)
	if not completion_visible:
		controller.free()
		panel.queue_free()
		return false
	(stage.get_node("ActionsRow/CheckButton") as Button).pressed.emit()
	await _settle_stage()
	var evidence: Dictionary = Dictionary(progress.get("evidence_by_mission")).get("contrast", {})
	var effect := String(evidence.get("effect", ""))
	var holds := (
		host_was_visible
		and completion_visible
		and String(controller.call("snapshot").get("state", "")) == "completed"
		and String(evidence.get("decision", "")) == "one-accent-harmony"
		and effect.contains("audience")
		and effect.contains("three product palettes")
	)
	controller.free()
	panel.queue_free()
	return holds
