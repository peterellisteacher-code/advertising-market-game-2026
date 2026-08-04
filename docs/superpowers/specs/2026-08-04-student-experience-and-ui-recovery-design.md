# Student Experience and UI Recovery Design

## Purpose

Students must understand the whole game before they meet its controls, then receive one concrete action at a time. The game must also recover visibly when account or Godot startup fails; a blank page is never an acceptable state.

## Student journey

1. **Enter:** Sign in or create a pair login. A failed request remains on a usable sign-in screen.
2. **See the whole game:** A short visual sequence uses screenshots from the real game:
   - **Brief:** Find what the audience needs.
   - **Build:** Choose the product, words and design.
   - **Pitch:** Explain why the choices suit the audience.
   The same screen states the goal: complete seven required missions, make one persuasive advertisement and pitch it. It states the reason: practise choosing advertising techniques and explaining their audience effect. Each required mission visibly earns an approval or tool for the final pitch.
3. **Learn the first move:** Explain walking, clicking a station and opening the first task. Mouse/trackpad activation must work wherever keyboard activation works.
4. **Learn the pair roles:** The Art Director leads appearance choices; the Strategist leads audience, message, evidence and offer choices. Both can use the same controls. `Swap roles` changes responsibility, not permissions.
5. **Receive the brief:** The first mission and the Studio both show the actual Context, Need, Values and Intended response before asking for work.
6. **Enter the Studio:** A four-page mini-tour introduces the brief, roles, Build panel and advertisement area before the first instruction: choose one starter product.
7. **Work independently:** The current action remains short. Detailed explanations live in a paged manual. Optional missions add practice but never block the pitch.
8. **Pitch:** Completing the required missions unlocks the final pitch, where the pair presents the advertisement and explains its choices.

## Information rules

- Live UI uses one instruction, one completion condition and at most two new terms at a time.
- Concrete actions precede abstract terms. No phrase such as `canvas change` appears before students have edited the advertisement.
- Use `advertisement`, `advertisement area`, `visible design edit`, `move`, `resize`, `recolour`, `add` and `remove` before specialist terms.
- Vocabulary arrives in this order: audience brief; Context/Need/Values/Intended response; Art Director/Strategist/active role/Swap roles; advertisement/design edit; product/part/place/name/benefit; AIDA one stage at a time; price/market route/proof point.
- Context, Need, Values and Intended response show the actual brief content directly. Each heading has a small `?` button that opens a short explanation in a dismissible popover.
- The reference manual is discrete labelled pages with Previous, Next and Close. It is never a long scrolling wall.
- Every persistent panel, guide and teacher-only control can be tucked away without losing work.

## Layout and accessibility

- Target keyboard plus mouse/trackpad on desktop and laptop only.
- Verify at 1280×800, 1440×900 and 1920×1080.
- The game fills the available landscape viewport without the teacher strip reserving space or large avoidable side bars.
- Teacher controls are a compact fixed disclosure which does not shift or cover the game when closed.
- Agency HUD text is at least 18 px at the 1280×800 reference view, wraps inside its containers and never clips the objective action.
- Yellow and teal actions use dark text meeting WCAG AA contrast; focus, pointer and keyboard behavior remain equivalent.
- The Studio header and role strip use substantially less vertical space; the current action and the advertisement remain visible together.

## Startup recovery

- Account access keeps the game locked until private storage and cloud recovery are safe.
- Once access is granted, a visible startup panel stays above the canvas until Godot reports ready.
- A bounded 45-second startup watchdog converts a stalled engine start into a visible recovery screen.
- Startup rejection and timeout expose `Return to sign in` and `Try loading again`; refresh cannot strand the user on a persisted error surface.
- The recovery path signs out/isolate local account state before admitting another pair.

## Persistence and equivalence

- New campaigns receive the full sequence. Existing campaigns that already acknowledged roles do not replay mandatory onboarding, but the manual and tour remain available.
- Teacher playtest uses the same game, missions, Studio and guidance as students, while retaining isolated teacher authentication, storage and API routes.
- Student campaign work remains cloud-backed and no tutorial action resets or replaces it.

## Screenshot provenance

The opening uses screenshots captured from this project’s own verified web export. They are copied into the Godot project, cropped in the scene rather than altered, and labelled Brief, Build and Pitch. No external asset pack or generated substitute is used.

## Acceptance criteria

- A first-time player can state what they are making, what completes the game, what the seven missions do and what happens at the pitch before entering the agency floor.
- The first Studio screen shows the actual brief, not `Step 4 of 19` and not the full toolset.
- The Studio mini-tour reveals one region per page and ends at the starter-product control.
- Contextual `?` help opens and closes independently for all four brief headings.
- No live onboarding surface contains `canvas change` or `next canvas change`.
- Account, engine rejection and engine timeout tests prove a visible route back to sign-in.
- Automated source/unit tests, typecheck, export contracts and browser screenshots pass at all three target viewports.
