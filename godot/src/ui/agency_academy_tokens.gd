extends RefCounted
class_name AdMarketAgencyAcademyTokens

const NAVY_FRAME := Color("#101536")
const AUBERGINE_FRAME := Color("#4D315F")
const CREAM_SURFACE := Color("#FFF8EB")
const INK := Color("#17213B")
const GOLD := Color("#F4BD4F")
const SUCCESS := Color("#2FA35B")
const COACHING := Color("#F0A536")
const FOCUS := Color("#2FC7D4")

const SPACE_8 := 8
const SPACE_12 := 12
const SPACE_16 := 16
const SPACE_24 := 24
const SPACE_32 := 32

const BODY_SIZE := 18
const LABEL_SIZE := 16
const TITLE_SIZE := 32

static func progress_states(completed: int, total: int, current_index: int) -> Array[String]:
	var states: Array[String] = []
	if total <= 0:
		return states
	var safe_completed := clampi(completed, 0, total)
	var safe_current := clampi(current_index, 0, total - 1)
	for index: int in range(total):
		if index < safe_completed:
			states.append("complete")
		elif index == safe_current:
			states.append("current")
		else:
			states.append("remaining")
	return states
