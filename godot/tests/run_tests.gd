extends SceneTree
class_name AdMarketRunTests

func _initialize() -> void:
    for suite_path in [
        "res://tests/test_creator_bridge.gd",
        "res://tests/test_creator_host.gd",
        "res://tests/test_market_bridge.gd",
        "res://tests/test_market_host.gd",
        "res://tests/test_practice_bridge.gd",
        "res://tests/test_market_view_state.gd",
        "res://tests/test_market_screen.gd",
        "res://tests/test_local_market_session.gd",
        "res://tests/test_agency_progress.gd",
        "res://tests/test_game_run.gd",
        "res://tests/test_run_progress_store.gd",
        "res://tests/test_live_resume.gd",
        "res://tests/test_game_shell.gd"
    ]:
        var suite_script := load(suite_path) as Script
        if suite_script == null or not suite_script.can_instantiate():
            push_error("Unable to load Godot seam test suite: %s" % suite_path)
            quit(1)
            return
        var suite: RefCounted = suite_script.new()
        var passed: Variant = suite.run()
        if passed != true:
            push_error("Godot seam test suite did not complete: %s" % suite_path)
            quit(1)
            return
    print("Godot game, Creator bridge, and Market bridge tests passed")
    quit(0)
