extends RefCounted
class_name AdMarketSequenceMeasure

# Engine E measures the prerequisite relations declared by the record, not a hidden
# pixel position or one canonical list. Any complete permutation satisfying every
# before -> after edge passes.

const CHECK_DECLARATIONS := "declarations"
const CHECK_PERMUTATION := "permutation"
const CHECK_CONSTRAINTS := "constraints"
const CHECKS: Array[String] = [
	CHECK_DECLARATIONS,
	CHECK_PERMUTATION,
	CHECK_CONSTRAINTS
]

## Scores an ordered set of cards against a declared partial order. `scene` supplies
## `cards` dictionaries with unique IDs, `constraints` dictionaries with `before` and
## `after` IDs, and `order`, containing every card ID exactly once.
static func evaluate(scene: Dictionary) -> Dictionary:
	var card_declaration := _declared_ids(scene.get("cards", []))
	var card_ids: PackedStringArray = card_declaration.get("ids", PackedStringArray())
	var declaration_errors: PackedStringArray = card_declaration.get(
		"errors",
		PackedStringArray()
	)

	var valid_constraints: Array[Dictionary] = []
	var seen_edges := {}
	var constraints_value: Variant = scene.get("constraints", [])
	if typeof(constraints_value) != TYPE_ARRAY:
		declaration_errors.append("constraints:not-array")
	else:
		var constraints: Array = constraints_value
		if constraints.is_empty():
			declaration_errors.append("constraints:empty")
		for index in range(constraints.size()):
			if typeof(constraints[index]) != TYPE_DICTIONARY:
				declaration_errors.append("constraint:%d:not-dictionary" % index)
				continue
			var constraint: Dictionary = constraints[index]
			var before := String(constraint.get("before", ""))
			var after := String(constraint.get("after", ""))
			if before.is_empty() or after.is_empty():
				declaration_errors.append("constraint:%d:empty-id" % index)
				continue
			if not card_ids.has(before):
				declaration_errors.append("constraint:%s->%s:unknown-before" % [before, after])
				continue
			if not card_ids.has(after):
				declaration_errors.append("constraint:%s->%s:unknown-after" % [before, after])
				continue
			if before == after:
				declaration_errors.append("constraint:%s->%s:self-edge" % [before, after])
				continue
			var edge := "%s->%s" % [before, after]
			if seen_edges.has(edge):
				declaration_errors.append("constraint:%s:duplicate" % edge)
				continue
			seen_edges[edge] = true
			valid_constraints.append({"before": before, "after": after, "edge": edge})

	var order := PackedStringArray()
	var order_value: Variant = scene.get("order", [])
	var order_is_array := typeof(order_value) in [TYPE_ARRAY, TYPE_PACKED_STRING_ARRAY]
	if order_is_array:
		for value: Variant in order_value:
			order.append(String(value))

	var counts := {}
	var duplicate_cards := PackedStringArray()
	var unknown_cards := PackedStringArray()
	for card_id: String in order:
		counts[card_id] = int(counts.get(card_id, 0)) + 1
		if int(counts[card_id]) == 2:
			duplicate_cards.append(card_id)
		if not card_ids.has(card_id) and not unknown_cards.has(card_id):
			unknown_cards.append(card_id)
	var missing_cards := PackedStringArray()
	for card_id: String in card_ids:
		if int(counts.get(card_id, 0)) == 0:
			missing_cards.append(card_id)

	var constraint_results: Array[Dictionary] = []
	var unmet_constraints := PackedStringArray()
	var met_constraint_count := 0
	for constraint: Dictionary in valid_constraints:
		var before := String(constraint.get("before", ""))
		var after := String(constraint.get("after", ""))
		var before_index := order.find(before)
		var after_index := order.find(after)
		var met := before_index >= 0 and after_index >= 0 and before_index < after_index
		var edge := String(constraint.get("edge", "%s->%s" % [before, after]))
		constraint_results.append({
			"before": before,
			"after": after,
			"beforeIndex": before_index,
			"afterIndex": after_index,
			"passed": met
		})
		if met:
			met_constraint_count += 1
		else:
			unmet_constraints.append(edge)

	var declarations_passed := declaration_errors.is_empty()
	var permutation_passed := (
		order_is_array
		and not card_ids.is_empty()
		and order.size() == card_ids.size()
		and missing_cards.is_empty()
		and duplicate_cards.is_empty()
		and unknown_cards.is_empty()
	)
	var constraints_passed := (
		declarations_passed
		and not valid_constraints.is_empty()
		and unmet_constraints.is_empty()
	)
	var checks := {
		CHECK_DECLARATIONS: {
			"value": declaration_errors.size(),
			"required": 0,
			"passed": declarations_passed
		},
		CHECK_PERMUTATION: {
			"value": order.size(),
			"required": card_ids.size(),
			"passed": permutation_passed
		},
		CHECK_CONSTRAINTS: {
			"value": met_constraint_count,
			"required": valid_constraints.size(),
			"passed": constraints_passed
		}
	}
	var unmet := PackedStringArray()
	for check: String in CHECKS:
		if not bool(Dictionary(checks[check]).get("passed", false)):
			unmet.append(check)

	return {
		"checks": checks,
		"unmet": unmet,
		"cardCount": card_ids.size(),
		"order": order,
		"missingCards": missing_cards,
		"duplicateCards": duplicate_cards,
		"unknownCards": unknown_cards,
		"constraintResults": constraint_results,
		"metConstraintCount": met_constraint_count,
		"unmetConstraints": unmet_constraints,
		"declarationErrors": declaration_errors,
		"passed": unmet.is_empty()
	}

static func _declared_ids(value: Variant) -> Dictionary:
	var ids := PackedStringArray()
	var errors := PackedStringArray()
	if typeof(value) != TYPE_ARRAY:
		errors.append("cards:not-array")
		return {"ids": ids, "errors": errors}
	var cards: Array = value
	if cards.is_empty():
		errors.append("cards:empty")
	for index in range(cards.size()):
		if typeof(cards[index]) != TYPE_DICTIONARY:
			errors.append("card:%d:not-dictionary" % index)
			continue
		var card_id := String(Dictionary(cards[index]).get("id", ""))
		if card_id.is_empty():
			errors.append("card:%d:empty-id" % index)
		elif ids.has(card_id):
			errors.append("card:%s:duplicate-id" % card_id)
		else:
			ids.append(card_id)
	return {"ids": ids, "errors": errors}
