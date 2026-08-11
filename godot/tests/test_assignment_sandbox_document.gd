extends RefCounted
class_name AdMarketTestAssignmentSandboxDocument

const DOCUMENT_PATH := "res://src/main/assignment_sandbox_document.gd"
const MainScene = preload("res://src/main/Main.tscn")
const FakeCreatorTransport = preload("res://tests/fakes/fake_creator_transport.gd")
const FakeMarketTransport = preload("res://tests/fakes/fake_market_transport.gd")
const FakePracticeTransport = preload("res://tests/fakes/fake_practice_transport.gd")

func run() -> bool:
	var document_script := load(DOCUMENT_PATH) as Script
	assert(document_script != null)
	assert(_document_helper_isolated(document_script))
	assert(_lobby_opens_new_and_matching_sandboxes(document_script))
	assert(_stale_sandbox_load_cannot_satisfy_a_new_request())
	assert(_late_sandbox_load_cannot_override_lobby_routes())
	assert(_lobby_rejects_a_mismatched_saved_document())
	return true

func _document_helper_isolated(document_script: Script) -> bool:
	var source := _base_document()
	var before := source.duplicate(true)
	var sandbox: Dictionary = document_script.call("create", source)
	assert(source == before)
	assert(sandbox.get("documentId") == "assignment-sandbox")
	assert(sandbox.get("sessionId") == "assignment-sandbox-session")
	assert(sandbox.get("mode") == "offline")
	assert(sandbox.get("workspaceMode") == "assignment-sandbox")
	assert(sandbox.get("revision") == 0)
	assert(sandbox.get("gameplay").get("stage") == "publish-check")
	assert(sandbox.get("product").get("name") == "Orbit Bottle")
	assert(sandbox.get("assignmentPlan") == _blank_assignment_plan())
	assert(bool(document_script.call("matches", sandbox)))
	for key in ["documentId", "sessionId", "mode", "workspaceMode"]:
		var mismatched := sandbox.duplicate(true)
		mismatched[key] = "wrong"
		assert(not bool(document_script.call("matches", mismatched)))
	assert(not bool(document_script.call("matches", null)))
	sandbox["product"]["name"] = "Changed only in sandbox"
	sandbox["assignmentPlan"]["productFunction"] = "Changed plan"
	assert(source == before)
	return true

func _lobby_opens_new_and_matching_sandboxes(document_script: Script) -> bool:
	var creator_fake := FakeCreatorTransport.new()
	var shell := _mount_shell(creator_fake)
	var button := shell.get_node("%OpenAssignmentSandbox") as Button
	var agency_before: Dictionary = shell.get("_agency_campaign").call("document")
	var campaign_before: Dictionary = Dictionary(shell.get("_campaign_document")).duplicate(true)

	button.pressed.emit()
	assert(bool(shell.get("_sandbox_load_pending")))
	assert(creator_fake.request_count() == 1)
	var load_id := creator_fake.last_request_id()
	assert(creator_fake.request_for(load_id).get("method") == "loadLatest")
	assert(
		creator_fake.request_for(load_id).get("payload").get("documentId")
		== "assignment-sandbox"
	)
	button.pressed.emit()
	assert(creator_fake.request_count() == 1)

	creator_fake.resolve_success(load_id, null)
	assert(not bool(shell.get("_sandbox_load_pending")))
	assert(bool(shell.get("_sandbox_open")))
	assert(creator_fake.request_count() == 2)
	var open_id := creator_fake.last_request_id()
	var opened: Dictionary = creator_fake.request_for(open_id)
	assert(opened.get("method") == "open")
	var new_document: Dictionary = opened.get("payload")
	assert(bool(document_script.call("matches", new_document)))
	assert(new_document.get("assignmentPlan") == _blank_assignment_plan())
	creator_fake.resolve_success(open_id)
	assert(bool(shell.get_node("%CreatorHost").get("creator_is_open")))

	creator_fake.request_close()
	var save_id := creator_fake.last_request_id()
	assert(creator_fake.request_for(save_id).get("method") == "save")
	creator_fake.resolve_success(save_id)
	var state_id := creator_fake.last_request_id()
	assert(creator_fake.request_for(state_id).get("method") == "getState")
	var returned := new_document.duplicate(true)
	returned["revision"] = 3
	returned["product"]["name"] = "Saved Sandbox Product"
	var returned_wire: Dictionary = JSON.parse_string(JSON.stringify(returned))
	creator_fake.resolve_success(state_id, returned)
	assert(shell.get("_campaign_document") == campaign_before)
	assert(shell.get("_sandbox_document") == returned_wire)
	assert(shell.get("_agency_campaign").call("document") == agency_before)
	var close_id := creator_fake.last_request_id()
	assert(creator_fake.request_for(close_id).get("method") == "close")
	creator_fake.resolve_success(close_id)
	assert(not bool(shell.get("_sandbox_open")))
	assert(not bool(shell.get_node("%CreatorHost").get("creator_is_open")))
	assert((shell.get_node("%LobbyPanel") as Control).visible)
	assert(shell.get_viewport().gui_get_focus_owner() == button)

	button.pressed.emit()
	var reopen_load_id := creator_fake.last_request_id()
	assert(creator_fake.request_for(reopen_load_id).get("method") == "loadLatest")
	creator_fake.resolve_success(reopen_load_id, returned)
	var reopen: Dictionary = creator_fake.request_for(creator_fake.last_request_id())
	assert(reopen.get("method") == "open")
	assert(Dictionary(reopen.get("payload")).recursive_equal(returned_wire, 32))
	shell.free()
	return true

func _stale_sandbox_load_cannot_satisfy_a_new_request() -> bool:
	var creator_fake := FakeCreatorTransport.new()
	var shell := _mount_shell(creator_fake)
	var button := shell.get_node("%OpenAssignmentSandbox") as Button
	button.pressed.emit()
	var stale_load_id := creator_fake.last_request_id()
	shell.call("_cancel_assignment_sandbox_load")
	button.pressed.emit()
	var current_load_id := creator_fake.last_request_id()
	assert(current_load_id != stale_load_id)
	assert(bool(shell.get("_sandbox_load_pending")))
	creator_fake.resolve_success(stale_load_id, null)
	assert(bool(shell.get("_sandbox_load_pending")))
	assert(not bool(shell.get("_sandbox_open")))
	assert(creator_fake.request_count() == 2)
	creator_fake.resolve_success(current_load_id, null)
	assert(not bool(shell.get("_sandbox_load_pending")))
	assert(bool(shell.get("_sandbox_open")))
	assert(creator_fake.request_count() == 3)
	shell.free()
	return true

func _late_sandbox_load_cannot_override_lobby_routes() -> bool:
	for route_button_path in ["%StartRun", "%JoinLiveMarket", "%CreateLiveMarket"]:
		var creator_fake := FakeCreatorTransport.new()
		var shell := _mount_shell(creator_fake)
		(shell.get_node("%TeamAlias") as LineEdit).text = "Route Test Pair"
		(shell.get_node("%RoomCode") as LineEdit).text = "ABC-234"
		(shell.get_node("%ClassroomCode") as LineEdit).text = "teacher-code-7"
		var sandbox_button := shell.get_node("%OpenAssignmentSandbox") as Button
		sandbox_button.pressed.emit()
		var load_id := creator_fake.last_request_id()
		assert(bool(shell.get("_sandbox_load_pending")))

		(shell.get_node(route_button_path) as Button).pressed.emit()
		assert(not bool(shell.get("_sandbox_load_pending")))
		assert(not sandbox_button.disabled)
		creator_fake.resolve_success(load_id, null)
		assert(not bool(shell.get("_sandbox_open")))
		assert(creator_fake.request_count() == 1)
		shell.free()
	return true

func _lobby_rejects_a_mismatched_saved_document() -> bool:
	var creator_fake := FakeCreatorTransport.new()
	var shell := _mount_shell(creator_fake)
	var before: Dictionary = shell.get("_campaign_document")
	(shell.get_node("%OpenAssignmentSandbox") as Button).pressed.emit()
	var load_id := creator_fake.last_request_id()
	var document_script := load(DOCUMENT_PATH) as Script
	var mismatched: Dictionary = document_script.call("create", _base_document())
	mismatched["sessionId"] = "another-sandbox-session"
	creator_fake.resolve_success(load_id, mismatched)
	assert(creator_fake.request_count() == 1)
	assert(not bool(shell.get("_sandbox_load_pending")))
	assert(not bool(shell.get("_sandbox_open")))
	assert(shell.get("_campaign_document") == before)
	assert(
		(shell.get_node("%Status") as Label).text
		== "That saved assignment sandbox did not match this workspace. Nothing was replaced."
	)
	shell.free()
	return true

func _mount_shell(creator_fake: RefCounted) -> Control:
	var shell := MainScene.instantiate() as Control
	shell.creator_transport_override = creator_fake
	shell.market_transport_override = FakeMarketTransport.new()
	shell.practice_transport_override = FakePracticeTransport.new()
	var tree := Engine.get_main_loop() as SceneTree
	tree.root.add_child(shell)
	if not shell.is_node_ready():
		shell.call("_ready")
	return shell

func _base_document() -> Dictionary:
	return {
		"schemaVersion": 1,
		"editorVersion": "0.1.0",
		"documentId": "classroom-campaign",
		"sessionId": "local-session",
		"mode": "offline",
		"revision": 0,
		"canvas": {"width": 1600, "height": 900, "background": "#ffffff"},
		"fabricState": {"version": "7.4.0", "objects": []},
		"drawingLayers": [],
		"product": {"name": "Orbit Bottle", "priceCents": null, "build": null},
		"brief": {
			"targetAudienceId": "",
			"contextId": "",
			"purpose": "persuade",
			"audienceNeeds": [],
			"audienceValues": [],
			"intendedEffects": [],
			"techniques": []
		},
		"gameplay": {
			"stage": "invent",
			"pair": {
				"activeRole": "art-director",
				"handoffCount": 0,
				"artDirectorActions": 0,
				"strategistActions": 0
			}
		},
		"strategy": {
			"productTraitIds": [],
			"marketedChoiceIds": [],
			"marketRoute": null,
			"aidaPlan": {"attention": "", "interest": "", "desire": "", "action": ""}
		},
		"evidence": {
			"price": [],
			"attention": [],
			"interest": [],
			"desire": [],
			"action": []
		},
		"assetReferences": [],
		"updatedAt": "1970-01-01T00:00:00.000Z"
	}

func _blank_assignment_plan() -> Dictionary:
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
