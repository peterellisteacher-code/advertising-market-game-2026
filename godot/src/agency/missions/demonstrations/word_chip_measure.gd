extends RefCounted
class_name AdMarketWordChipMeasure

# Engine F scores the retained authored chips against a word cap and a declared set of
# benefit tokens. It does not require one canonical edit: any retained set meeting both
# constraints passes.

const CHECK_DECLARATIONS := "declarations"
const CHECK_WORD_CAP := "wordCap"
const CHECK_BENEFIT := "benefit"
const CHECKS: Array[String] = [
	CHECK_DECLARATIONS,
	CHECK_WORD_CAP,
	CHECK_BENEFIT
]

## `scene` supplies ordered `chips` dictionaries (`id`, `text`, `wordCount`),
## `requiredBenefitTokens`, `maxWords`, and `retainedIds`.
static func evaluate(scene: Dictionary) -> Dictionary:
	var declaration := _declared_chips(scene.get("chips", []))
	var chip_ids: PackedStringArray = declaration.get("ids", PackedStringArray())
	var chip_text: Dictionary = declaration.get("text", {})
	var chip_word_counts: Dictionary = declaration.get("wordCounts", {})
	var declaration_errors: PackedStringArray = declaration.get(
		"errors",
		PackedStringArray()
	)

	var max_words := int(scene.get("maxWords", 0))
	if typeof(scene.get("maxWords", null)) != TYPE_INT or max_words <= 0:
		declaration_errors.append("maxWords:not-positive-integer")

	var required_tokens := PackedStringArray()
	var required_value: Variant = scene.get("requiredBenefitTokens", [])
	if typeof(required_value) not in [TYPE_ARRAY, TYPE_PACKED_STRING_ARRAY]:
		declaration_errors.append("requiredBenefitTokens:not-array")
	else:
		for value: Variant in required_value:
			var token := String(value)
			if token.is_empty():
				declaration_errors.append("requiredBenefitTokens:empty-id")
			elif required_tokens.has(token):
				declaration_errors.append("requiredBenefitTokens:%s:duplicate" % token)
			elif not chip_ids.has(token):
				declaration_errors.append("requiredBenefitTokens:%s:unknown" % token)
			else:
				required_tokens.append(token)
		if required_tokens.is_empty():
			declaration_errors.append("requiredBenefitTokens:empty")

	var retained_ids := PackedStringArray()
	var unknown_tokens := PackedStringArray()
	var duplicate_tokens := PackedStringArray()
	var retained_counts := {}
	var retained_value: Variant = scene.get("retainedIds", [])
	if typeof(retained_value) not in [TYPE_ARRAY, TYPE_PACKED_STRING_ARRAY]:
		declaration_errors.append("retainedIds:not-array")
	else:
		for value: Variant in retained_value:
			var token := String(value)
			retained_ids.append(token)
			retained_counts[token] = int(retained_counts.get(token, 0)) + 1
			if int(retained_counts[token]) == 2:
				duplicate_tokens.append(token)
				declaration_errors.append("retainedIds:%s:duplicate" % token)
			if not chip_ids.has(token) and not unknown_tokens.has(token):
				unknown_tokens.append(token)
				declaration_errors.append("retainedIds:%s:unknown" % token)

	var retained_word_count := 0
	for token: String in retained_ids:
		if chip_word_counts.has(token):
			retained_word_count += int(chip_word_counts[token])

	var missing_benefit := PackedStringArray()
	for token: String in required_tokens:
		if int(retained_counts.get(token, 0)) == 0:
			missing_benefit.append(token)

	var retained_lookup := {}
	for token: String in retained_ids:
		retained_lookup[token] = true
	var headline_parts := PackedStringArray()
	var removed_ids := PackedStringArray()
	for token: String in chip_ids:
		if retained_lookup.has(token):
			headline_parts.append(String(chip_text.get(token, token)))
		else:
			removed_ids.append(token)

	var declarations_passed := declaration_errors.is_empty()
	var word_cap_passed := max_words > 0 and retained_word_count <= max_words
	var benefit_passed := not required_tokens.is_empty() and missing_benefit.is_empty()
	var checks := {
		CHECK_DECLARATIONS: {
			"value": declaration_errors.size(),
			"required": 0,
			"passed": declarations_passed
		},
		CHECK_WORD_CAP: {
			"value": retained_word_count,
			"required": max_words,
			"passed": word_cap_passed
		},
		CHECK_BENEFIT: {
			"value": required_tokens.size() - missing_benefit.size(),
			"required": required_tokens.size(),
			"passed": benefit_passed
		}
	}
	var unmet := PackedStringArray()
	for check: String in CHECKS:
		if not bool(Dictionary(checks[check]).get("passed", false)):
			unmet.append(check)

	return {
		"checks": checks,
		"unmet": unmet,
		"chipCount": chip_ids.size(),
		"retainedIds": retained_ids,
		"removedIds": removed_ids,
		"unknownTokens": unknown_tokens,
		"duplicateTokens": duplicate_tokens,
		"missingBenefitTokens": missing_benefit,
		"retainedWordCount": retained_word_count,
		"maxWords": max_words,
		"headline": " ".join(headline_parts),
		"declarationErrors": declaration_errors,
		"passed": unmet.is_empty()
	}

static func _declared_chips(value: Variant) -> Dictionary:
	var ids := PackedStringArray()
	var text := {}
	var word_counts := {}
	var errors := PackedStringArray()
	if typeof(value) != TYPE_ARRAY:
		errors.append("chips:not-array")
		return {"ids": ids, "text": text, "wordCounts": word_counts, "errors": errors}
	var chips: Array = value
	if chips.is_empty():
		errors.append("chips:empty")
	for index in range(chips.size()):
		if typeof(chips[index]) != TYPE_DICTIONARY:
			errors.append("chip:%d:not-dictionary" % index)
			continue
		var chip: Dictionary = chips[index]
		var chip_id := String(chip.get("id", ""))
		var chip_text := String(chip.get("text", ""))
		var word_count := int(chip.get("wordCount", 0))
		if chip_id.is_empty():
			errors.append("chip:%d:empty-id" % index)
			continue
		if ids.has(chip_id):
			errors.append("chip:%s:duplicate-id" % chip_id)
			continue
		ids.append(chip_id)
		text[chip_id] = chip_text
		word_counts[chip_id] = word_count
		if chip_text.is_empty():
			errors.append("chip:%s:empty-text" % chip_id)
		if typeof(chip.get("wordCount", null)) != TYPE_INT or word_count <= 0:
			errors.append("chip:%s:invalid-word-count" % chip_id)
	return {"ids": ids, "text": text, "wordCounts": word_counts, "errors": errors}
