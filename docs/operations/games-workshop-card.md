# Advertising Market Game — Codex toolbox card

This is a Codex-owned contribution for Peter's Games Workshop. It points to the complete private project without copying dependencies, build caches, credentials, or a second Git repository into the Workshop.

## Play and source

- Production game: <https://advertising-market-game-2026.netlify.app/>
- Private source: <https://github.com/peterellisteacher-code/advertising-market-game-2026>
- Release PR: <https://github.com/peterellisteacher-code/advertising-market-game-2026/pull/1>

The private repository is the editable source of truth. Students do not need GitHub access; they play the password-protected Netlify site in Chrome on school MacBooks.

## What the game does

Pairs invent a product, construct and price it, develop an advertising campaign through AIDA, choose where and how to market it, and enter the finished campaign into a live class market. Other teams spend a fixed budget on products they did not make; the strongest market result wins.

## Reusable systems

- Godot 4.7.1 pair-play shell with three progressive levels and a market phase.
- TypeScript advert studio layered over the Godot Web game.
- Product Kit composition with deterministic layer geometry and swappable parts.
- Large offline raster catalogue with product, part, price, attribution, and placement metadata.
- Account-isolated pair saves with local-first and cloud autosave.
- Practice market plus Netlify/Supabase live-market transport.
- Artifact-only GitHub Actions build and deliberate Netlify CLI deployment that preserves Functions.
- Optional, fail-closed Image Lab. It remains globally disabled outside the activity and opens only after the physically present teacher authorises an individual pair's short-lived session. The teacher can close it immediately.

## Proven release

- Main-branch merge: `ac8f2cf7db24b8c60b38f68a3e124084782fd52a`
- Linux Godot and web validation: GitHub Actions run `29716354689`
- Production deploy: `6a5da9d8f6f76e04e64de775`
- Hosted checks: password gate, QA pair login, cloud restore, Product Kit geometry, two product placements, pair-role handoff, save-before-close, and clean browser console.

## Reuse notes

Clone the private repository into a new project location and remove subject-specific content there. Do not symlink to the Workshop. Keep account credentials and the local private-access guide out of Git history. Use `docs/operations/release-workflow.md` before publishing a derivative.

