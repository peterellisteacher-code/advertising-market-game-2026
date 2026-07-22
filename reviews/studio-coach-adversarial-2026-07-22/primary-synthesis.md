# Studio Coach adversarial panels — primary synthesis

Date: 2026-07-22

## Immutable evidence

- Code packet: `code-panel-prompt.txt`
  - UTF-8 bytes: 175,809
  - SHA-256: `02207a6ad7a67ada6cd5820c4feae0b874fd4dfbba77c76ccac71b0ff537e5b1`
- Prompt packet: `system-prompt-panel-prompt.txt`
  - UTF-8 bytes: 3,528
  - SHA-256: `e621c37317e4750c6432801111e854e1312408b911a83a32dd4f8339db1518da`
- Every seat within a panel received the same packet and no other seat's output. The primary task performed the synthesis; no judge model was used.

## Seat completion

| Panel | Requested and served model | Record | Status |
|---|---|---|---|
| Code | `tencent/hy3` | `code-hy3-attempt4.json` | Complete, HTTP 200 |
| Code | `moonshotai/kimi-k3` | `code-kimi-k3-attempt5.json` | Complete, HTTP 200 after one terminated transport and one authorised retry |
| Code | `z-ai/glm-5.2` | `code-glm-5.2-attempt2.json` | Complete, HTTP 200 |
| Code | `deepseek/deepseek-v4-pro` | `code-deepseek-v4-pro-attempt4.json` | Complete, HTTP 200 |
| Code | `anthropic/claude-opus-4.8` | `code-opus-4.8-attempt2.json` | Complete, HTTP 200 |
| Prompt | `tencent/hy3` | `prompt-hy3-attempt2.json` | Complete, HTTP 200 |
| Prompt | `moonshotai/kimi-k3` | `prompt-kimi-k3-attempt2.json` | Complete, HTTP 200 |
| Prompt | `z-ai/glm-5.2` | `prompt-glm-5.2-attempt2.json` | Complete, HTTP 200 |
| Prompt | `deepseek/deepseek-v4-pro` | `prompt-deepseek-v4-pro-attempt2.json` | Complete, HTTP 200 |
| Prompt | `anthropic/claude-opus-4.8` | `prompt-opus-4.8-attempt2.json` | Complete, HTTP 200 |

Failed and locally terminated launcher logs remain beside the completed records. They were not counted as panel seats.

## Findings accepted and implemented

1. **Pair-budget multiplication through client-controlled document IDs.** K3 identified that the old state key let a holder of one signed pair capability mint document IDs and obtain two calls per ID. State is now keyed to the authenticated `sessionId` + `teamId`, binds the first document ID, and enforces two provider reservations for that pair. The OpenRouter key's hard dollar ceiling remains the external account-wide limit; `STUDIO_COACH_ACCOUNT_CAP_USD` is only deployment attestation, not local spend accounting.
2. **Orphaned reservation deadlock.** GLM and K3 independently identified the permanent `reserved` lock. A 30-second lease now atomically converts a stale reservation to a consumed failed attempt, then permits only whatever remains of the two-attempt budget.
3. **Invalid live request slug.** Independent catalog verification showed that Chat Completions accepts `google/gemini-3.6-flash`, while the dated canonical slug returned 404 when used as the request ID. Requests now use the API ID and responses accept only that ID or its verified dated canonical slug.
4. **Prompt quality and machinery gaps.** All five prompt seats converged on missing brevity, Year 10 register, manageability, and honest uncertainty. Multiple seats also found weak technique focus, incomplete untrusted-data scoping, an over-broad external-knowledge ban, an atomic-action loophole, and a contradiction between turn-2 `only` wording and the required comparison fields. The prompt now addresses each directly.
5. **Turn-2 loss of the actual first recommendation.** K3 and Opus identified that a comparison could not reliably judge the attempted effect without the earlier advice. The server now supplies the stored, validated first response as `previousAdvice`; it is not taken from the client.
6. **Ambiguous client timeout/network completion.** K3 identified that the server could have completed after the browser timed out. The runtime now retains the exact request and manually replays that same idempotency key on the next first-check action. It does not create an automatic provider retry or consume another provider reservation.
7. **Timeout taxonomy.** K3 correctly noted that `AbortSignal.timeout()` produces `TimeoutError`. The function now recognises both `TimeoutError` and `AbortError`.
8. **Bounded response reading.** DeepSeek identified a stalled-reader risk and K3 identified post-buffer server size enforcement. The browser cancels a pending reader on abort; the function now enforces the 64 KiB provider ceiling while streaming and cancels an oversized body.
9. **Schema/parser drift.** Hy3 and GLM found that whitespace-only strings passed the provider schema but failed the parser. The schema now requires a non-whitespace character, and student prose fields are capped at 180 characters; the provider budget is 640 tokens to avoid truncating valid structured output.
10. **Misleading transformed object bounds.** DeepSeek and Opus found that rotation/group transforms made the simplified geometry false. Transformed/nested bounds are now omitted, and simple bounds are clipped as a whole to the canvas. The rendered image remains authoritative.
11. **Rejected store initialisation cached forever.** Hy3 and GLM found that one transient Netlify Blobs initialisation failure poisoned the function instance. The cached promise now resets on rejection.

## Findings rejected or narrowed

- **Do not count failed provider attempts.** Rejected. Peter's explicit cost rule says a failed upstream attempt consumes its turn. The code retains that rule and does not automatically retry a model call.
- **`npxnetlify` is a typo.** Rejected. This repository deliberately installs `node_modules/.bin/npxnetlify`, including Windows `.CMD` and PowerShell shims; the build contract tests the real local command.
- **The model cannot know the turn.** Narrowed. The user payload already supplied `check.turn` and `check.mode`, but the system prompt did not explicitly bind behaviour to them. The prompt now does.
- **Offline `teamId ?? documentId` must fail authentication.** Rejected. Offline capability issuance and existing Image Lab wiring use the same fallback, and the current integration tests cover it.
- **Relax ZDR or enable fallback providers.** Rejected. Current catalog evidence confirms the intended model has a compatible ZDR/structured-output route. Privacy and the no-fallback family guarantee remain requirements.
- **Allow retries that create fresh attempt IDs.** Rejected. Only exact idempotent replay is used for an ambiguous browser outcome; no third provider reservation is possible.

## Remaining uncertainty

- No paid live Studio Coach inference was made during this correction pass. Transport, schema, image ordering and model-ID handling are deterministically tested, but wording quality still needs a separately authorised live calibration when the teacher-controlled hosted route is configured.
- A same-tab browser reload now restores the validated first response and its bounded before-image from `sessionStorage`, so the second comparison can continue without buying another first turn. A new tab, a closed/reopened browser session, or movement to another MacBook does not restore this local comparison evidence; those cross-session cases remain intentionally outside this bounded recovery design.
- Production and Supabase were not changed.

## Focused verification after implementation

- Netlify function bundle build: passed; 10 self-contained bundles, including Studio Coach.
- Studio Coach plus editor/access focused suite: 11 files, 57 tests passed.
- Same-tab reload recovery slice: 1 file, 7 tests passed, including a two-runtime restoration test.
- Final corrected Studio Coach/editor/access slice: 12 files, 75 tests passed.
- TypeScript `tsc --noEmit`: passed.
