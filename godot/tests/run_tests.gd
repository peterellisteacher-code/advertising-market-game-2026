extends SceneTree

func _initialize() -> void:
    for suite_path in [
        "res://tests/test_creator_bridge.gd",
        "res://tests/test_creator_host.gd"
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
    print("Godot Creator bridge tests passed")
    quit(0)
