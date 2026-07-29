# Staged Agency Orientation Design

## Purpose

The first-time agency orientation must tell a pair what they are making, what to do first, how to control the game, and how the two roles differ. It must not attempt to be the complete reference. Detailed explanations remain available in the permanent guide throughout play.

## First-time sequence

The orientation contains three short screens. Each screen has one title, one plain-language lead sentence, three visually separated information rows, and one forward action.

### 1. Make one persuasive advertisement

- Read the client brief to identify the audience, its situation and what it needs.
- Build a product and advertisement whose message and visual choices suit that audience.
- Deliver a pitch that names the choices and explains why they should influence the audience.
- State that completing the required missions unlocks the final pitch.

### 2. Reach and use a station

- **Walk:** use `W`, `A`, `S`, `D` or the arrow keys.
- **Use a station:** press `E`, `Space` or `Enter` when the nearby-station prompt appears.
- **Direct travel:** choose a named room when the pair needs to move there immediately.
- State that the Client Brief station is the first destination.

### 3. Two roles, one shared campaign

- **Strategist:** leads decisions about the audience, message and offer, and records why those decisions should persuade.
- **Art Director:** leads decisions about composition, colour, type and imagery, and records how those decisions guide attention.
- **Both partners:** have the same controls and site access. The titles divide responsibility rather than permissions. The partners discuss every major decision and use `H` to record a handover.
- The final button begins at the Client Brief station.

## Permanent guide

The permanent guide keeps the complete reference available after orientation:

- the overall campaign goal and the order of play;
- the current objective, its reason, the partner who leads it, and the other partner's useful contribution;
- controls and direct travel;
- the full role distinction, including the fact that roles do not change site permissions;
- required-mission, optional-contract and pitch-unlock progress.

The guide should answer “What do we do now?” before supplying background detail.

## Visual and interaction rules

- A full-viewport, opaque dimming layer separates orientation from the page behind it.
- The orientation card remains centred and readable at `1280x800` and `1440x900`.
- The title, lead sentence, information rows and forward action form a clear vertical hierarchy.
- Information rows use short labels and complete explanations rather than one dense paragraph.
- Keyboard focus begins on the forward action and cannot dismiss the required orientation accidentally.
- The target controls are keyboard plus mouse or trackpad. Phone layouts and phone-only controls are out of scope.

## Acceptance criteria

- A new pair can state the campaign goal, first destination, station-use keys and the literal difference between Strategist and Art Director after reading the three screens.
- The role explanation explicitly says that both partners have identical controls and access.
- Underlying page text does not compete visually with the modal.
- The permanent guide remains available after orientation and contains the fuller reference.
- Godot tests cover the ordered content, role distinction, orientation completion, modal visibility and return to the guide.
- Runtime screenshots at `1280x800` and `1440x900` show no clipping, overlap or bleed-through.
