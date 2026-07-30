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

---

## Final stable-corpus pass — 30 July 2026

This pass covers the completed agency world, orientation, mission, pitch,
reward and audio surfaces added after the earlier language gate.

### Retained evidence and corpus

- Retained root:
  `C:\tmp\admarket-language-gate-9c972ab041de`
- Occurrences: 4,750
- Unique strings: 4,350
- Objective input, post-Plain-Language corpus, post-scrub corpus and tracked
  candidate SHA-256:
  `f77f10ae35fb5fb68e17682fa4727d643e592386eb3836ddc8512abde633d141`
- Objective input bytes: 1,080,284
- Scrub manifest SHA-256:
  `9ee6bbb10d26f82f9f19074201ae8dd07298ff861b03bd96e9188e1a1797f160`
- MICROCOPY prompt SHA-256:
  `6cb7d9d8f6f7e3c04eb9cb454aa1ab4b38098f63703fcc1cf2f9fae61c3e717c`

The tracked July candidate differed because it predated fourteen agency and
pitch source files and the later gameplay, role, editor, reset and teacher
copy. The corpus source manifest was extended to cover every path reported by
the deterministic source-coverage test.

### Plain Language

- Frozen-preset completed response count: 1
- HTTP attempts: 2. The first attempt returned
  `plain_language_http_error` and created no response file. The bounded retry
  used the identical bytes and contract and saved the sole completed response.
- Response bytes: 2,539
- Response SHA-256:
  `d1cf4a837e9f98322c01a0cbd09dc19113e2334d6838d04c41bb45dc51cb4cec`

The response classified most corpus entries as labels, actions, errors or
task scaffolding outside its register-check scope. It proposed no exact
replacement wording and requested a narrower, guided submission. Narrowing
would have violated the approved objective whole-corpus scan, so no
Plain-Language wording was applied.

### Claude Scrubber MICROCOPY

- Model: `google/gemini-3.1-flash-lite`
- Completed section call count: 11
- System prompt: installed MICROCOPY prompt, passed verbatim
- User prompts: exact section bytes, sent once in manifest order
- Requested maximum output: 4,000 tokens
- Reasoning: omitted
- Transport: Codex-owned OpenRouter execution server

The transport does not expose a temperature field and applies its own output
policy floor. Its generation record was retained in `scrub-output`; the
assistant-only bytes were extracted without copy editing to `scrub-response`
before the diff guard ran.

| Section | Input SHA-256 | Assistant SHA-256 | Diff SHA-256 |
|---|---|---|---|
| 001 | `9e759dba858b896e01218babb70195373238b4dd7497408d724a5dc9246604a4` | `e886b0de020df764dae4c974b79721e83ad369da071f5c9c1bf546585c059400` | `b499809017435166259572ff1727a1b950cec8c04825e7a4ca86dbe8790b4dfa` |
| 002 | `9c10dad6b94ee7ca2474ba006853de27e14aa504e67109dea1ec1ed41adce422` | `874f7a22ae13b1a3ffbf902495fcbf125b5a9b9be5af529b48abfcd09c4afb49` | `b499809017435166259572ff1727a1b950cec8c04825e7a4ca86dbe8790b4dfa` |
| 003 | `fb7fb5ae02a6a8b2df2ad91e0cd76d36a96a92704cd99ee94e920ee4bbedb6cd` | `22cc78e6e50327987d417199b6b0deafd4c4498588c61bbb3a8737d68dabbe64` | `b499809017435166259572ff1727a1b950cec8c04825e7a4ca86dbe8790b4dfa` |
| 004 | `4ca56cbd941432c87b4d584d63ff5113641ceeb46ffe0b17b7a982634005c497` | `32a631706c944aae24f131222b1d5553cef5679ebb9c1735ea90f73d8eddd3db` | `b499809017435166259572ff1727a1b950cec8c04825e7a4ca86dbe8790b4dfa` |
| 005 | `1b2eae2c0628e978cbb9977714e0ea85d0bbcf0ca4af141a8920c3f593a27458` | `92e139b198bbbd019bb7f21543fc1ab3b41f5ec0be11f28c6edc4b30a21504f1` | `b499809017435166259572ff1727a1b950cec8c04825e7a4ca86dbe8790b4dfa` |
| 006 | `3a69474c06dd82d29c9b7b3c060a60213408a49547f85eabfbaad02d4e88669e` | `744822ae8a4c460a4d4315c38189cbe165d342eecb7f738f7aaba2103bfb6d4b` | `11afef5a5f9ad39d0774186fa0184016d4f83eb37bc3c21b90ce071edbe4052b` |
| 007 | `624cd7dfd848aeeb1a4f8bbdddbb1026b9a9fc8446e87c74d80ce226ec1724f7` | `7ec9303ebe8515050f235b048d21ff2cb1dd32728091ac7bbe98de9a09b794f0` | `6c88b3b7725f31cd0058c2664a6a721611e91776fe713a0f8c55914dd853adc0` |
| 008 | `ac6d2d469d72662ee00dfe85be123481c1ec125a786345c8c1be0a526e9328e5` | `e259bb922016f86f17d3c89a524f0437fbbc0427ebae11d85c8bfaa9731a75bd` | `19f5d32d9cfa70994bf244f82ee1cdec58a1fe79ef161a1d812d684e422e4cca` |
| 009 | `9c40a02e6cf4a616cf9bc9bba346b9ed0de967badae976835764f1972818c6d0` | `a99a0c3360dc2ff708dbf71680589002df53a4ecc8d30cd686853f735665e67a` | `c370582dc24b1abad12d3bb5df2bf8df8d8cc92489167f46d94888b57092348d` |
| 010 | `3f47ce7ad6361472771efd1f46eb8ea6bd2d8326029ad628b3e63133c31eee0b` | `ceb0cb32feb40a01659f73b4fc10a6f6305c2000f40c22a98a272b13c5ba0ad8` | `4f2a5970377a7afe8d32930bb55fe04efba265aea82a0bcbfacc1c7a95f46a88` |
| 011 | `4747ec39a0318dcd80197c21cd49caa6fb454bf65a6831609934770429da2765` | `a81d359995f68e13a810accb860f76f07009e485d0f6ffdbe92b3f85ae98a5b0` | `b499809017435166259572ff1727a1b950cec8c04825e7a4ca86dbe8790b4dfa` |

Diff-guard adjudication:

- sections 001–005 and 011: no word-level change;
- section 007: rejected because line count changed from 264 to 306;
- sections 006, 008, 009 and 010: chrome passed, but all sixteen
  word-level changes were rejected for meaning loss or grammatical damage.

Rejected changes included removing required concepts such as `persuasive`,
`clear`, `verifiable`, `key`, `first`, `own`, `visual` and `deliberately`;
changing intentional order to fixed order; and replacing a grammatical
evidence sentence with `Some evidence connection remains`.

No scrubber wording was applied. The applied-source-path record is empty.

### Focused verification

```text
node --test scripts/student-copy-scrub-sections.test.mjs
  scripts/student-copy-corpus.test.mjs
  scripts/student-copy-source-coverage.test.mjs
  scripts/student-copy-professional-contract.test.mjs

15 tests passed; 0 failed
```
