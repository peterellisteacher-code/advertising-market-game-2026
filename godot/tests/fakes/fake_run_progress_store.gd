extends RefCounted
class_name AdMarketFakeRunProgressStore

const WebRunProgressStore = preload("res://src/game/web_run_progress_store.gd")

var stored: Dictionary = {}
var saves: Array[Dictionary] = []

func load() -> Dictionary:
    return WebRunProgressStore.validated_envelope(stored)

func save(value: Dictionary) -> bool:
    var snapshot := WebRunProgressStore.validated_envelope(value)
    if snapshot.is_empty():
        return false
    stored = snapshot
    saves.append(snapshot)
    return true
