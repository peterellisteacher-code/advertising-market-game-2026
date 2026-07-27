# Student copy language gate — 27 July 2026

## Scope

This record covers the stable student-facing copy after Peter requested a further
layer of literal explanation for the pair roles, audience brief and complete
guide.

The revised source states that:

- both partners can use the same tools unlocked for the current level;
- the roles do not grant different site permissions;
- the Art Director leads visual decisions;
- the Strategist leads message, offer and market-reasoning decisions;
- the active role identifies the responsibility recorded for the next canvas
  change, not the physical person using the device;
- swapping roles changes later responsibility without removing earlier work;
- Context, Need, Values and Intended audience response each have a literal
  definition; and
- every formal subargument is preceded by a basic explanation.

## Deterministic corpus

- Candidate:
  `reviews/student-copy-completion-candidate-v2.json`
- Occurrences: 4,379
- Candidate bytes: 995,109
- Candidate SHA-256:
  `595B6BCBD4A4ED7C51602344D8636E9F3D9B7AB4E81C12C68F35BC56EA4441EC`
- Scrub sections: 10
- Maximum section size: 12,000 UTF-8 bytes
- Section-manifest SHA-256:
  `DF1AD803E76899CE5F1E8EE1BA217C21141CC40BFE896E8C36BB5D083C7FD994`
- Retained input, section manifest and outputs:
  `C:\tmp\admarket-language-gate-v2-20260727`

The earlier candidate and language-gate directory remain preserved. They were
not overwritten because Peter's later direction changed the source corpus:

- earlier candidate SHA-256:
  `7A4379EFAA42822753BC56A118B33468536A4358ED41026596A5ED616396E386`
- retained earlier gate:
  `C:\tmp\admarket-language-gate-165bde362010`

## Plain Language

The single frozen Plain Language call was made against the earlier candidate.
It returned a non-empty response, but said the JSON catalogue was not a
suitable register-check draft and proposed no changes.

- retained response:
  `C:\tmp\admarket-language-gate-165bde362010\plain-language-response.txt`
- response bytes: 761
- response SHA-256:
  `7DC378F5D28808CF4CFB063DD6BAE6A80E734443ED614AED4D76CEB7A6D8A0EB`

The call was not repeated. Peter's subsequent explicit copy direction
superseded that input, and the revised corpus instead passed the deterministic
professional-language contracts.

## Claude Scrubber

Mode: MICROCOPY.

- Model: `google/gemini-3.1-flash-lite`
- System prompt: the installed
  `scrub-prompt-microcopy.txt`, passed verbatim
- Reasoning: omitted
- Requested maximum output: 4,000 tokens
- Transport: Codex-owned OpenRouter execution server

The current transport has no temperature field. It applied its 68,000-token
policy floor and the model's 65,536-token output ceiling. No alternate
transport was used.

Each of the ten sections was sent separately. Section 001 required one
transport-only retry because the first successful response body was not
persisted. The repeated response was retained and passed the gate. No source
change occurred between those calls.

Diff-guard results:

- sections 001–005, 007, 008 and 010: zero word-level changes, chrome intact;
- section 006: nine word-level changes, chrome intact; and
- section 009: two word-level changes, chrome intact.

The section 006 and 009 edits were rejected during adjudication because they
changed or weakened literal meaning. Examples included:

- changing a one-action instruction from “one customer need” to “a customer
  need”;
- removing “distinctive” from a product-name requirement;
- removing “strongest” from feature selection; and
- removing “deliberately” from negative-space and juxtaposition definitions.

No scrubber wording was applied to the source. The original revised corpus is
therefore the final language-gate result.

Retained generation IDs for sections 002–010:

- 002: `gen-1785154771-PtNMLvKEqIj6SpBtcUrb`
- 003: `gen-1785154780-tdyk443HzvShonaiGwfx`
- 004: `gen-1785154789-mOIBZf1bNHb8FjkMUztx`
- 005: `gen-1785154811-x3Dfg5K2XjGm9Un1k3dg`
- 006: `gen-1785154843-YFzyVq75QY8D24s7imv6`
- 007: `gen-1785154854-0xaGHnJliQPQ3LZ5ychA`
- 008: `gen-1785154863-nsfZ5n8SxXV8sHGvruyb`
- 009: `gen-1785154871-ESLwHogwql40MYCR99Iy`
- 010: `gen-1785154881-MnIL1ikFpDrFEbicf5PF`

## Verification

The revised copy passed:

```text
.\node_modules\.bin\vitest.CMD run --no-cache --configLoader runner --maxWorkers=1 web/src/game/role-guide-controller.test.ts web/src/ui/editor-shell.test.ts web/src/game/guided-journey-controller.test.ts web/src/game/instruction-argument.test.ts
4 files passed; 16 tests passed

node --test scripts/onboarding-source.test.mjs
13 tests passed

node --test scripts/student-copy-scrub-sections.test.mjs scripts/student-copy-corpus.test.mjs scripts/student-copy-source-coverage.test.mjs scripts/student-copy-professional-contract.test.mjs scripts/build-logo-icons.test.mjs
21 tests passed

corepack pnpm run typecheck
tsc --noEmit passed
```

An in-app Playwright pass at 1280 × 800 confirmed that:

- the first required role guide opens at its title rather than scrolling to the
  bottom action;
- the two roles, examples, shared-tool rule and swap behavior are visible in
  the scrollable dialog;
- the expanded audience brief places each literal definition immediately
  before its supplied value; and
- the complete guide shows the basic orientation and explanation before the
  formal premises.

Hosted evidence remains part of the final non-production draft QA.
