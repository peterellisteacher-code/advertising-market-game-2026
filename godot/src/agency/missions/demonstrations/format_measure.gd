extends RefCounted
class_name AdMarketFormatMeasure

# Engine G measures the composition inside the selected viewing frame. A format
# label alone never passes: headline length, subject scale and containment all
# contribute independent evidence.

const CHECK_DECLARATIONS := "declarations"
const CHECK_WORD_CAP := "wordCap"
const CHECK_COVERAGE := "coverage"
const CHECK_CONTAINMENT := "containment"
const CHECKS: Array[String] = [
	CHECK_DECLARATIONS,
	CHECK_WORD_CAP,
	CHECK_COVERAGE,
	CHECK_CONTAINMENT
]
const COVERAGE_EPSILON := 0.0001

## `scene` supplies declared `formats`, declared `headlines`, the selected
## `formatId` and `headlineId`, and a `subjectRect` in the selected format's
## aspect-space units.
static func evaluate(scene: Dictionary) -> Dictionary:
	var format_declaration := _declared_formats(scene.get("formats", []))
	var formats_by_id: Dictionary = format_declaration.get("byId", {})
	var declaration_errors: PackedStringArray = format_declaration.get(
		"errors",
		PackedStringArray()
	)
	var headline_declaration := _declared_headlines(scene.get("headlines", []))
	var headlines_by_id: Dictionary = headline_declaration.get("byId", {})
	declaration_errors.append_array(
		headline_declaration.get("errors", PackedStringArray())
	)

	var format_id := String(scene.get("formatId", ""))
	var headline_id := String(scene.get("headlineId", ""))
	if format_id.is_empty():
		declaration_errors.append("formatId:empty")
	elif not formats_by_id.has(format_id):
		declaration_errors.append("formatId:%s:unknown" % format_id)
	if headline_id.is_empty():
		declaration_errors.append("headlineId:empty")
	elif not headlines_by_id.has(headline_id):
		declaration_errors.append("headlineId:%s:unknown" % headline_id)

	var subject_rect := Rect2()
	var subject_value: Variant = scene.get("subjectRect", null)
	if typeof(subject_value) != TYPE_RECT2:
		declaration_errors.append("subjectRect:not-rect2")
	else:
		subject_rect = subject_value
		if subject_rect.size.x <= 0.0 or subject_rect.size.y <= 0.0:
			declaration_errors.append("subjectRect:not-positive")

	var format: Dictionary = formats_by_id.get(format_id, {})
	var headline: Dictionary = headlines_by_id.get(headline_id, {})
	var aspect: Vector2 = format.get("aspect", Vector2.ZERO)
	var frame_rect := Rect2(Vector2.ZERO, aspect)
	var max_words := int(format.get("maxWords", 0))
	var min_coverage := float(format.get("minSubjectCoverage", 0.0))
	var headline_word_count := int(headline.get("wordCount", 0))
	var frame_area := frame_rect.size.x * frame_rect.size.y
	var subject_area := maxf(subject_rect.size.x, 0.0) * maxf(subject_rect.size.y, 0.0)
	var coverage := subject_area / frame_area if frame_area > 0.0 else 0.0
	var contained := (
		frame_area > 0.0
		and subject_rect.size.x > 0.0
		and subject_rect.size.y > 0.0
		and subject_rect.position.x >= frame_rect.position.x
		and subject_rect.position.y >= frame_rect.position.y
		and subject_rect.end.x <= frame_rect.end.x
		and subject_rect.end.y <= frame_rect.end.y
	)

	var declarations_passed := declaration_errors.is_empty()
	var word_cap_passed := (
		declarations_passed
		and headline_word_count > 0
		and max_words > 0
		and headline_word_count <= max_words
	)
	var coverage_passed := (
		declarations_passed
		and min_coverage > 0.0
		and coverage + COVERAGE_EPSILON >= min_coverage
	)
	var containment_passed := declarations_passed and contained
	var checks := {
		CHECK_DECLARATIONS: {
			"value": declaration_errors.size(),
			"required": 0,
			"passed": declarations_passed
		},
		CHECK_WORD_CAP: {
			"value": headline_word_count,
			"required": max_words,
			"passed": word_cap_passed
		},
		CHECK_COVERAGE: {
			"value": coverage,
			"required": min_coverage,
			"passed": coverage_passed
		},
		CHECK_CONTAINMENT: {
			"value": contained,
			"required": true,
			"passed": containment_passed
		}
	}
	var unmet := PackedStringArray()
	for check: String in CHECKS:
		if not bool(Dictionary(checks[check]).get("passed", false)):
			unmet.append(check)

	return {
		"checks": checks,
		"unmet": unmet,
		"formatId": format_id,
		"headlineId": headline_id,
		"format": format,
		"headline": headline,
		"frameRect": frame_rect,
		"subjectRect": subject_rect,
		"headlineWordCount": headline_word_count,
		"maxWords": max_words,
		"coverage": coverage,
		"minCoverage": min_coverage,
		"contained": contained,
		"declarationErrors": declaration_errors,
		"passed": unmet.is_empty()
	}

static func _declared_formats(value: Variant) -> Dictionary:
	var by_id := {}
	var errors := PackedStringArray()
	if typeof(value) != TYPE_ARRAY:
		errors.append("formats:not-array")
		return {"byId": by_id, "errors": errors}
	var formats: Array = value
	if formats.is_empty():
		errors.append("formats:empty")
	for index in range(formats.size()):
		if typeof(formats[index]) != TYPE_DICTIONARY:
			errors.append("format:%d:not-dictionary" % index)
			continue
		var format: Dictionary = formats[index]
		var format_id := String(format.get("id", ""))
		if format_id.is_empty():
			errors.append("format:%d:empty-id" % index)
			continue
		if by_id.has(format_id):
			errors.append("format:%s:duplicate-id" % format_id)
			continue
		by_id[format_id] = format
		if String(format.get("label", "")).is_empty():
			errors.append("format:%s:empty-label" % format_id)
		if String(format.get("viewingCondition", "")).is_empty():
			errors.append("format:%s:empty-viewing-condition" % format_id)
		var aspect_value: Variant = format.get("aspect", null)
		if typeof(aspect_value) != TYPE_VECTOR2:
			errors.append("format:%s:invalid-aspect" % format_id)
		else:
			var aspect: Vector2 = aspect_value
			if aspect.x <= 0.0 or aspect.y <= 0.0:
				errors.append("format:%s:invalid-aspect" % format_id)
		var max_words := int(format.get("maxWords", 0))
		if typeof(format.get("maxWords", null)) != TYPE_INT or max_words <= 0:
			errors.append("format:%s:invalid-max-words" % format_id)
		var coverage_value: Variant = format.get("minSubjectCoverage", null)
		if typeof(coverage_value) not in [TYPE_INT, TYPE_FLOAT]:
			errors.append("format:%s:invalid-min-coverage" % format_id)
		else:
			var min_coverage := float(coverage_value)
			if min_coverage <= 0.0 or min_coverage > 1.0:
				errors.append("format:%s:invalid-min-coverage" % format_id)
	return {"byId": by_id, "errors": errors}

static func _declared_headlines(value: Variant) -> Dictionary:
	var by_id := {}
	var errors := PackedStringArray()
	if typeof(value) != TYPE_ARRAY:
		errors.append("headlines:not-array")
		return {"byId": by_id, "errors": errors}
	var headlines: Array = value
	if headlines.is_empty():
		errors.append("headlines:empty")
	for index in range(headlines.size()):
		if typeof(headlines[index]) != TYPE_DICTIONARY:
			errors.append("headline:%d:not-dictionary" % index)
			continue
		var headline: Dictionary = headlines[index]
		var headline_id := String(headline.get("id", ""))
		if headline_id.is_empty():
			errors.append("headline:%d:empty-id" % index)
			continue
		if by_id.has(headline_id):
			errors.append("headline:%s:duplicate-id" % headline_id)
			continue
		by_id[headline_id] = headline
		if String(headline.get("text", "")).is_empty():
			errors.append("headline:%s:empty-text" % headline_id)
		var word_count := int(headline.get("wordCount", 0))
		if typeof(headline.get("wordCount", null)) != TYPE_INT or word_count <= 0:
			errors.append("headline:%s:invalid-word-count" % headline_id)
	return {"byId": by_id, "errors": errors}
