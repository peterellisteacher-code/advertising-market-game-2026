extends Node
class_name AdMarketAgencyCompletionRunner

const AgencyGuidanceTest = preload("res://tests/test_agency_guidance.gd")
const CampaignImageDecoderTest = preload("res://tests/test_campaign_image_decoder.gd")
const PitchTheatreTest = preload("res://tests/test_pitch_theatre.gd")
const GameShellTest = preload("res://tests/test_game_shell.gd")

var _all_passed: bool = true

func _ready() -> void:
	call_deferred("_run_tests")

func _run_tests() -> void:
	var audio_manager_test_script := load("res://tests/test_agency_audio_manager.gd") as Script
	_run_case("agency audio manager", audio_manager_test_script.new())
	_run_case("agency guidance", AgencyGuidanceTest.new())
	_run_case("campaign image decoder", CampaignImageDecoderTest.new())
	_run_case("pitch theatre", PitchTheatreTest.new())
	_run_case("game shell", GameShellTest.new())
	print("[agency-completion-tests] %s" % ("PASS" if _all_passed else "FAIL"))
	get_tree().quit(0 if _all_passed else 1)

func _run_case(label: String, test_case: Object) -> void:
	var result: Variant = test_case.call("run")
	if result == true:
		print("[agency-completion-tests] PASS: %s" % label)
		return
	_all_passed = false
	push_error("[agency-completion-tests] FAIL: %s" % label)