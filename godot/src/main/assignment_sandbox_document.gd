extends RefCounted
class_name AdMarketAssignmentSandboxDocument

const DOCUMENT_ID := "assignment-sandbox"
const SESSION_ID := "assignment-sandbox-session"
const WORKSPACE_MODE := "assignment-sandbox"

static func create(base_document: Dictionary) -> Dictionary:
	var document := base_document.duplicate(true)
	document["documentId"] = DOCUMENT_ID
	document["sessionId"] = SESSION_ID
	document["mode"] = "offline"
	document["workspaceMode"] = WORKSPACE_MODE
	document["revision"] = 0
	var gameplay_value: Variant = document.get("gameplay", {})
	var gameplay: Dictionary = (
		gameplay_value.duplicate(true)
		if typeof(gameplay_value) == TYPE_DICTIONARY
		else {}
	)
	gameplay["stage"] = "publish-check"
	document["gameplay"] = gameplay
	document["assignmentPlan"] = _blank_assignment_plan()
	return document

static func matches(document: Variant) -> bool:
	return (
		typeof(document) == TYPE_DICTIONARY
		and document.get("documentId") == DOCUMENT_ID
		and document.get("sessionId") == SESSION_ID
		and document.get("mode") == "offline"
		and document.get("workspaceMode") == WORKSPACE_MODE
	)

static func _blank_assignment_plan() -> Dictionary:
	return {
		"productFunction": "",
		"targetAudience": "",
		"advertisingLocation": "",
		"featureToEmphasise": "",
		"differenceFromAlternatives": "",
		"materials": "",
		"estimatedProductionCost": "",
		"salePrice": "",
		"desireValueIds": [],
		"primaryDesireValueId": "",
		"productAidaPlan": {
			"attention": "",
			"interest": "",
			"desire": "",
			"action": ""
		}
	}
