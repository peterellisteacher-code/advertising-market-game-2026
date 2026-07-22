# Plain Language large-response capture change

## What made the whole-corpus request work

The successful request still used the bundled direct runner once with the original UTF-8 prompt file. The API endpoint, preset, message body, and request count did not change. The returned 68,978-character assistant response was valid; the shell/tool presentation boundary truncated its displayed stdout.

The recovery worked because a local Node process captured the runner's complete stdout in memory before that presentation boundary, losslessly encoded it, verified the round trip, and checked SHA-256 `2df8f8a24a702ed5fed5c78d3925c7996f6da7bbbf3f9098e357fab60cc9f7a4`. The decoded response contained all 904 mapping IDs with no missing, extra, or duplicate IDs.

## Authoritative change

- `C:\Users\Peter Ellis\.agents\skills\plain-language\SKILL.md`
- `C:\Users\Peter Ellis\.agents\skills\plain-language\scripts\plain_language_contract.cjs`
- `C:\Users\Peter Ellis\.agents\skills\plain-language\scripts\plain_language_contract.test.cjs`

The runner now accepts optional `--output-file <absolute path>` with any one existing input mode. It writes the validated assistant response byte-for-byte as UTF-8 using exclusive new-file creation (`flag: "wx"`) and prints exactly `plain_language_response_saved\n` only after the write succeeds. It refuses relative paths and existing targets. Existing invocations retain verbatim stdout. The API body remains exactly `model` plus `messages`; there is no API parameter, retry, endpoint, model, provider, preset, secret, or transport change.

## Required Codensus proposal review

Reviewer route: one fresh local `gpt-5.6-sol`, `reasoning_effort: xhigh`, `fork_turns: none`. Terminal verdict: `REVISE`.

Findings and primary resolutions:

1. Medium: existence-check-plus-write could race. Resolved with authoritative exclusive `wx` creation; the preflight check only avoids an unnecessary paid request.
2. Medium: the success token was underspecified. Resolved as exact stdout `plain_language_response_saved\n`, emitted only after a successful complete write; failures expose neither content nor path.
3. Low: CLI coverage needed all input pairings and malformed forms. Resolved with tests for all three input modes plus missing, duplicate, multiple-input, unknown, relative-path, and existing-target cases.
4. Low: “absolute UTF-8 path” was inaccurate. Documentation now says absolute path and UTF-8 response content.

## Verification

- RED: 7 passed, 4 failed before runner implementation; all four failures exercised the missing output-file contract.
- GREEN: 11 passed, 0 failed after implementation.
- Skill validation: `quick_validate.py` returned `Skill is valid!`.
- The existing exact-payload test still proves one request whose JSON body contains only `model` and `messages`.
