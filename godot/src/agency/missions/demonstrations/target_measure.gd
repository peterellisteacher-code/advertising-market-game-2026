extends RefCounted
class_name AdMarketTargetMeasure

# Engine D measures semantic support, not chip position. The record declares which
# statements each evidence chip can support; every arrangement satisfying that relation
# passes, regardless of chip order.

const CHECK_DECLARATIONS := "declarations"
const CHECK_ALL_PLACED := "allPlaced"
const CHECK_SUPPORTS := "supports"
const CHECK_UNSUPPORTED_EMPTY := "unsupportedEmpty"
const CHECKS: Array[String] = [
	CHECK_DECLARATIONS,
	CHECK_ALL_PLACED,
	CHECK_SUPPORTS,
	CHECK_UNSUPPORTED_EMPTY
]

## Scores one evidence-to-statement arrangement. `scene` carries `evidence` and
## `statements` arrays of dictionaries with unique `id` values, `supports` mapping each
## evidence ID to one or more statement IDs, and `assignments` mapping evidence IDs to
## the statement on which the student placed them.
static func evaluate(scene: Dictionary) -> Dictionary:
	var evidence_declaration := _declared_ids(scene.get("evidence", []), "evidence")
	var statement_declaration := _declared_ids(scene.get("statements", []), "statement")
	var evidence_ids: PackedStringArray = evidence_declaration.get("ids", PackedStringArray())
	var statement_ids: PackedStringArray = statement_declaration.get("ids", PackedStringArray())
	var declaration_errors: PackedStringArray = evidence_declaration.get("errors", PackedStringArray())
	declaration_errors.append_array(
		statement_declaration.get("errors", PackedStringArray()) as PackedStringArray
	)

	var supports_by_evidence := {}
	var incoming_support := {}
	for statement_id: String in statement_ids:
		incoming_support[statement_id] = 0
	var supports_value: Variant = scene.get("supports", {})
	if typeof(supports_value) != TYPE_DICTIONARY:
		declaration_errors.append("supports:not-dictionary")
	else:
		var supports: Dictionary = supports_value
		for support_key: Variant in supports:
			var evidence_id := String(support_key)
			if not evidence_ids.has(evidence_id):
				declaration_errors.append("support:%s:unknown-evidence" % evidence_id)
		for evidence_id: String in evidence_ids:
			if not supports.has(evidence_id):
				declaration_errors.append("support:%s:missing" % evidence_id)
				supports_by_evidence[evidence_id] = PackedStringArray()
				continue
			var targets_value: Variant = supports[evidence_id]
			var targets := _string_array(targets_value)
			if targets.is_empty():
				declaration_errors.append("support:%s:no-target" % evidence_id)
			var valid_targets := PackedStringArray()
			for target_id: String in targets:
				if not statement_ids.has(target_id):
					declaration_errors.append("support:%s->%s:unknown-statement" % [evidence_id, target_id])
					continue
				if valid_targets.has(target_id):
					declaration_errors.append("support:%s->%s:duplicate" % [evidence_id, target_id])
					continue
				valid_targets.append(target_id)
				incoming_support[target_id] = int(incoming_support.get(target_id, 0)) + 1
			supports_by_evidence[evidence_id] = valid_targets

	var assignments_value: Variant = scene.get("assignments", {})
	var assignments: Dictionary = assignments_value if typeof(assignments_value) == TYPE_DICTIONARY else {}
	if typeof(assignments_value) != TYPE_DICTIONARY:
		declaration_errors.append("assignments:not-dictionary")
	var invalid_assignments := PackedStringArray()
	for assignment_key: Variant in assignments:
		var evidence_id := String(assignment_key)
		var target_id := String(assignments[assignment_key])
		if not evidence_ids.has(evidence_id):
			invalid_assignments.append("%s->%s" % [evidence_id, target_id])
			declaration_errors.append("assignment:%s:unknown-evidence" % evidence_id)

	var placed_count := 0
	var unplaced := PackedStringArray()
	var unsupported_assignments := PackedStringArray()
	var assigned_counts := {}
	var valid_destination := {}
	for evidence_id: String in evidence_ids:
		var target_id := String(assignments.get(evidence_id, ""))
		if target_id.is_empty():
			unplaced.append(evidence_id)
			continue
		placed_count += 1
		if not statement_ids.has(target_id):
			invalid_assignments.append("%s->%s" % [evidence_id, target_id])
			declaration_errors.append("assignment:%s->%s:unknown-statement" % [evidence_id, target_id])
			continue
		assigned_counts[target_id] = int(assigned_counts.get(target_id, 0)) + 1
		var allowed: PackedStringArray = supports_by_evidence.get(evidence_id, PackedStringArray())
		if not allowed.has(target_id):
			unsupported_assignments.append("%s->%s" % [evidence_id, target_id])
		else:
			valid_destination[target_id] = true

	var occupied_unsupportable := PackedStringArray()
	var supported_statements := PackedStringArray()
	for statement_id: String in statement_ids:
		if int(incoming_support.get(statement_id, 0)) == 0 and int(assigned_counts.get(statement_id, 0)) > 0:
			occupied_unsupportable.append(statement_id)
		if valid_destination.has(statement_id):
			supported_statements.append(statement_id)

	var declaration_passed := declaration_errors.is_empty()
	var all_placed_passed := not evidence_ids.is_empty() and unplaced.is_empty()
	var support_passed := unsupported_assignments.is_empty() and invalid_assignments.is_empty()
	var unsupported_empty_passed := occupied_unsupportable.is_empty()
	var checks := {
		CHECK_DECLARATIONS: {
			"value": declaration_errors.size(),
			"required": 0,
			"passed": declaration_passed
		},
		CHECK_ALL_PLACED: {
			"value": placed_count,
			"required": evidence_ids.size(),
			"passed": all_placed_passed
		},
		CHECK_SUPPORTS: {
			"value": unsupported_assignments.size() + invalid_assignments.size(),
			"required": 0,
			"passed": support_passed
		},
		CHECK_UNSUPPORTED_EMPTY: {
			"value": occupied_unsupportable.size(),
			"required": 0,
			"passed": unsupported_empty_passed
		}
	}
	var unmet := PackedStringArray()
	for check: String in CHECKS:
		if not bool(Dictionary(checks[check]).get("passed", false)):
			unmet.append(check)

	return {
		"checks": checks,
		"unmet": unmet,
		"evidenceCount": evidence_ids.size(),
		"statementCount": statement_ids.size(),
		"placedCount": placed_count,
		"unplaced": unplaced,
		"unsupportedAssignments": unsupported_assignments,
		"invalidAssignments": invalid_assignments,
		"occupiedUnsupportable": occupied_unsupportable,
		"supportedStatements": supported_statements,
		"declarationErrors": declaration_errors,
		"assignments": assignments.duplicate(true),
		"passed": unmet.is_empty()
	}

static func _declared_ids(value: Variant, kind: String) -> Dictionary:
	var ids := PackedStringArray()
	var errors := PackedStringArray()
	if typeof(value) != TYPE_ARRAY:
		errors.append("%s:not-array" % kind)
		return {"ids": ids, "errors": errors}
	var items: Array = value
	if items.is_empty():
		errors.append("%s:empty" % kind)
	for index in range(items.size()):
		if typeof(items[index]) != TYPE_DICTIONARY:
			errors.append("%s:%d:not-dictionary" % [kind, index])
			continue
		var id := String(Dictionary(items[index]).get("id", ""))
		if id.is_empty():
			errors.append("%s:%d:empty-id" % [kind, index])
		elif ids.has(id):
			errors.append("%s:%s:duplicate-id" % [kind, id])
		else:
			ids.append(id)
	return {"ids": ids, "errors": errors}

static func _string_array(value: Variant) -> PackedStringArray:
	var strings := PackedStringArray()
	if typeof(value) == TYPE_PACKED_STRING_ARRAY:
		return PackedStringArray(value)
	if typeof(value) != TYPE_ARRAY:
		return strings
	for item: Variant in Array(value):
		strings.append(String(item))
	return strings
