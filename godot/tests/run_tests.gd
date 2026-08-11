extends SceneTree
class_name AdMarketRunTests

func _initialize() -> void:
    call_deferred("_run_suites")

func _run_suites() -> void:
    var requested_suite := OS.get_environment("ADMARKET_GODOT_TEST_SUITE")
    for suite_path in [
        "res://tests/test_creator_bridge.gd",
        "res://tests/test_creator_host.gd",
        "res://tests/test_assignment_sandbox_document.gd",
        "res://tests/test_market_bridge.gd",
        "res://tests/test_market_host.gd",
        "res://tests/test_practice_bridge.gd",
        "res://tests/test_market_view_state.gd",
        "res://tests/test_market_screen.gd",
        "res://tests/test_local_market_session.gd",
        "res://tests/test_agency_button_theme.gd",
        "res://tests/test_agency_mission_catalog.gd",
        "res://tests/test_agency_missions.gd",
        "res://tests/test_salience_measure.gd",
        "res://tests/test_crop_measure.gd",
        "res://tests/test_colour_measure.gd",
        "res://tests/test_target_measure.gd",
        "res://tests/test_sequence_measure.gd",
        "res://tests/test_word_chip_measure.gd",
        "res://tests/test_format_measure.gd",
        "res://tests/test_agency_world.gd",
        "res://tests/test_agency_guidance.gd",
        "res://tests/test_agency_progress.gd",
        "res://tests/test_agency_campaign_controller.gd",
        "res://tests/test_game_run.gd",
        "res://tests/test_run_progress_store.gd",
        "res://tests/test_live_resume.gd",
        "res://tests/test_game_shell.gd",
        # Last: this suite resizes the root viewport to prove the HUD adapts, so it must
        # not run ahead of a suite that assumes the design size.
        "res://tests/test_agency_hud_layout.gd"
    ]:
        if not requested_suite.is_empty() and suite_path != requested_suite:
            continue
        var suite_script := load(suite_path) as Script
        if suite_script == null or not suite_script.can_instantiate():
            push_error("Unable to load Godot seam test suite: %s" % suite_path)
            quit(1)
            return
        var suite: RefCounted = suite_script.new()
        var passed: Variant
        if suite_path in [
            "res://tests/test_agency_world.gd",
            "res://tests/test_agency_hud_layout.gd",
            "res://tests/test_agency_guidance.gd",
            "res://tests/test_game_shell.gd",
            "res://tests/test_salience_measure.gd",
            "res://tests/test_crop_measure.gd",
            "res://tests/test_colour_measure.gd",
            "res://tests/test_target_measure.gd",
            "res://tests/test_sequence_measure.gd",
            "res://tests/test_word_chip_measure.gd",
            "res://tests/test_format_measure.gd"
        ]:
            passed = await suite.run()
        else:
            passed = suite.run()
        if passed != true:
            push_error("Godot seam test suite did not complete: %s" % suite_path)
            quit(1)
            return
    print("Godot game, Creator bridge, and Market bridge tests passed")
    if OS.get_environment("ADMARKET_PRINT_ORPHANS") == "1":
        Node.print_orphan_nodes()
    await process_frame
    await process_frame
    quit(0)
