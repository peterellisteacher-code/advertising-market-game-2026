# Advertising Market Game — Games Workshop card

This card points to the public source without copying dependencies, build
caches, credentials or another Git repository into the Workshop.

## Play and source

- Production game: <https://advertising-market-game-2026.netlify.app/>
- Public source: <https://github.com/peterellisteacher-code/advertising-market-game>
- Private development archive:
  <https://github.com/peterellisteacher-code/advertising-market-game-2026>

Students do not need GitHub access. They use the teacher-provided game URL and
classroom account details.

## What the game does

Pairs invent a product, construct and price it, develop an advertisement
through AIDA, choose where and how to market it, and enter the finished
campaign into a class market.

## Reusable systems

- Godot 4.7.1 pair-play shell with three progressive levels and a market phase.
- TypeScript advertisement studio layered over the Godot web game.
- Product composition with deterministic geometry and swappable parts.
- Large offline generated catalogue with product, part, price and placement
  metadata.
- Account-isolated pair saves with local-first and cloud autosave.
- Practice market plus optional Netlify and Supabase live-market transport.
- Artifact-only GitHub Actions build and deliberate Netlify CLI deployment
  that preserves Functions.
- Optional, fail-closed Image Lab controlled by the teacher.

## Reuse notes

Clone the public repository into a new project location. Do not symlink it into
the Workshop. Provide separate Netlify and Supabase infrastructure for any
account-enabled derivative. Keep credentials and real classroom data out of
Git history. Read `docs/operations/release-workflow.md` before publishing.
