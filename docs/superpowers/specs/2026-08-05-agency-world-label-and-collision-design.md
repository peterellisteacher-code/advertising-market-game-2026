# Agency world label and collision design

## Problem

At Client Briefing, direct travel places the pair on the wall, plant and shelf artwork. The room name, station-owner role and active-pair role then overlap in the same small area. This makes the characters look misplaced and makes the labels difficult to read.

## Approved design

- Keep one compact, high-contrast world label: the current room name.
- Remove floating role labels from both the station and the pair. Role responsibility remains in the task card and HUD, where it affects the current decision.
- Name the tucked control after the current room, for example `Open Client briefing`.
- Move the Client Briefing arrival point below the station, inside interaction range and outside the wall/fixture area.
- Add collision for the Client Briefing wall/fixture so ordinary keyboard movement cannot place the pair on it.
- Retain keyboard and mouse/trackpad access. Do not add phone controls or phone layouts.

## Acceptance criteria

1. Direct travel to every station produces a declared, interactable arrival point inside the world bounds.
2. Client Briefing places the pair below the station and clear of the wall/plant/shelf fixture.
3. Keyboard movement cannot enter the Client Briefing fixture.
4. A highlighted station shows one backed room-name label and no owner-role badge.
5. The pair shows no floating active-role label; visual ordering and subtle opacity continue to distinguish the active role.
6. When the station card is tucked, its button names the current room.
7. The hosted game remains readable and unobstructed at 1280x800, 1440x900 and 1920x1080.

## Verification boundary

The Windows Godot editor is not used for this change. The live GodotIQ bridge is attached to a different dirty checkout, so GodotIQ is restricted to static inspection. Runtime evidence comes from the repository's Linux Godot tests/export and the deployed web artifact in a real browser.
