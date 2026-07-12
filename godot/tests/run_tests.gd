extends SceneTree

func _initialize() -> void:
    var suite_script := load("res://tests/test_creator_host.gd") as Script
    if suite_script == null or not suite_script.can_instantiate():
        push_error("Unable to load Godot seam test suite")
        quit(1)
        return
    var suite: RefCounted = suite_script.new()
    var passed: Variant = suite.run()
    if passed != true:
        push_error("Godot seam test suite did not complete")
        quit(1)
        return
    print("Godot seam tests passed")
    quit(0)
