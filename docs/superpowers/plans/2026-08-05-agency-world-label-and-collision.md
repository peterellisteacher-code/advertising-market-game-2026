# Agency world label and collision implementation plan

**Goal:** Keep the Client Briefing arrival clear of room fixtures and remove redundant world-space text.

**Architecture:** Preserve the existing `AgencyWorld` station model. Change only the arrival/collision geometry and presentation nodes; keep role state and station responsibility data intact for the HUD and task card.

## 1. Specify the regression

- Extend `scripts/godot-bridge-contract.test.mjs` with a source-level release gate that checks the declared safe arrival geometry, a fixture collision, a single station label, no pair role-label nodes, and a room-specific tucked control.
- Extend `godot/tests/test_agency_world.gd` so the Linux runtime checks every station arrival, Client Briefing clearance and the minimal label contract.
- Run the focused Node contract and observe the new assertions fail before implementation.

## 2. Implement the minimum-information world UI

- Update `godot/src/agency/agency_world.gd` with the safe Client Briefing arrival and current-room tucked-button copy.
- Update `godot/src/agency/AgencyWorld.tscn` with a conservative Client Briefing fixture collision.
- Update `godot/src/agency/stations/AgencyStation.tscn` and `agency_station.gd` to show one compact backed room label.
- Update `godot/src/agency/player/AgencyPair.tscn` and `agency_pair.gd` to remove floating role labels while preserving sprite emphasis.

## 3. Verify and release

- Run the focused Node test, `test:build-web`, and `git diff --check`.
- Push the branch and require the repository's Linux Godot test/export workflow to pass.
- Review the stable diff once, merge it, deploy the verified complete artifact, and run hosted browser QA at 1280x800, 1440x900 and 1920x1080.
- Record the production deploy, screenshots, console findings and unchanged Supabase/OneDrive state.
